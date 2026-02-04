// src/pages/DemoPage.tsx
// Standalone demo login page with persona switcher + feature showcase
// Completely separate from /login — does not affect production auth flow

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import HCaptchaWidget, { HCaptchaRef } from '../components/HCaptchaWidget';
import { DemoPersonaSwitcher } from '../components/demo/DemoPersonaSwitcher';
import { auditLogger } from '../services/auditLogger';

const DemoPage: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const { branding } = useBranding();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loggedInAs, setLoggedInAs] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptchaRef>(null);

  const primary = branding.primaryColor;

  // Check if already logged in
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled && session) {
          setLoggedInAs(session.user?.email || session.user?.phone || 'demo user');
        }
      } catch {
        // Ignore session check errors
      }
    };
    check();
    return () => { cancelled = true; };
  }, [supabase.auth]);

  const refreshCaptcha = () => {
    captchaRef.current?.reset();
    setCaptchaToken(null);
  };

  const ensureCaptcha = async (): Promise<string> => {
    if (captchaToken) return captchaToken;
    try {
      const t = await captchaRef.current?.execute();
      return t || '';
    } catch {
      return '';
    }
  };

  // Route user to the correct dashboard after login
  const nextRouteForUser = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return '/demo';

    const { data } = await supabase
      .from('profiles')
      .select('role, role_code, onboarded, consent, demographics_complete')
      .eq('user_id', uid)
      .maybeSingle();

    if (!data) return '/dashboard';

    const profileData = data as {
      role?: string;
      role_code?: number;
      onboarded?: boolean;
      consent?: boolean;
      demographics_complete?: boolean;
    };
    const role = profileData.role || '';
    const roleCode = profileData.role_code || 0;

    // Staff roles → admin PIN page
    const staffRoleCodes = [1, 2, 3, 5, 8, 9, 10, 11, 12, 14, 15, 17, 18, 19];
    const staffRoles = [
      'super_admin', 'admin', 'nurse', 'physician', 'doctor',
      'nurse_practitioner', 'physician_assistant', 'clinical_supervisor',
      'department_head', 'physical_therapist', 'case_manager',
      'social_worker', 'community_health_worker', 'chw', 'it_admin',
    ];

    if (staffRoles.includes(role) || staffRoleCodes.includes(roleCode)) {
      return '/admin-login';
    }

    // Seniors → dashboard (demo users are pre-onboarded)
    return '/dashboard';
  };

  const handleDemoPersona = async (persona: {
    loginType: 'phone' | 'email';
    credential: string;
    password: string;
  }) => {
    setError('');
    setLoading(true);

    try {
      // Sign out any existing session first
      if (loggedInAs) {
        await supabase.auth.signOut();
        setLoggedInAs(null);
      }

      let token = '';
      try {
        token = await ensureCaptcha();
      } catch {
        // Captcha failed
      }

      if (!token) {
        setError('Please complete the captcha verification.');
        refreshCaptcha();
        setLoading(false);
        return;
      }

      const signInParams = persona.loginType === 'phone'
        ? { phone: persona.credential, password: persona.password, options: { captchaToken: token } }
        : { email: persona.credential, password: persona.password, options: { captchaToken: token } };

      const { error: signInError } = await supabase.auth.signInWithPassword(signInParams);

      if (signInError) {
        auditLogger.auth('LOGIN_FAILED', false, { method: 'demo_persona', credential: persona.credential, error: signInError.message });
        setError(`Demo login failed: ${signInError.message}`);
        refreshCaptcha();
        return;
      }

      auditLogger.auth('LOGIN', true, { method: 'demo_persona', credential: persona.credential });
      const route = await nextRouteForUser();
      navigate(route, { replace: true });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Demo login failed.';
      auditLogger.auth('LOGIN_FAILED', false, { method: 'demo_persona', error: errMsg });
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAndStay = async () => {
    await supabase.auth.signOut();
    setLoggedInAs(null);
    setError('');
    refreshCaptcha();
  };

  return (
    <div className="min-h-screen" style={{ background: branding.gradient }}>
      {/* Header */}
      <div className="py-6 px-4 text-center">
        <img
          src={branding.logoUrl}
          alt={`${branding.appName} Logo`}
          className="h-14 w-auto mx-auto mb-3"
        />
        <h1 className="text-2xl font-bold text-white">
          {branding.appName} Demo
        </h1>
        <p className="text-white/80 text-sm mt-1">
          Tap a persona to log in and explore
        </p>
      </div>

      {/* Persona Switcher Card */}
      <div className="max-w-md mx-auto px-4 pb-6">
        <div className="bg-white rounded-xl shadow-lg p-5">
          {loggedInAs ? (
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600">
                Currently logged in as <strong>{loggedInAs}</strong>
              </p>
              <div className="flex gap-2 justify-center mt-3">
                <button
                  type="button"
                  onClick={async () => {
                    const route = await nextRouteForUser();
                    navigate(route, { replace: true });
                  }}
                  className="px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: primary }}
                >
                  Continue to Dashboard
                </button>
                <button
                  type="button"
                  onClick={handleLogoutAndStay}
                  className="px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Switch Persona
                </button>
              </div>
            </div>
          ) : (
            <DemoPersonaSwitcher
              onSelectPersona={handleDemoPersona}
              disabled={loading}
            />
          )}

          {error && (
            <p role="alert" className="text-red-500 text-sm font-semibold text-center mt-3">
              {error}
            </p>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900" />
              <span className="text-sm text-gray-600">Logging in...</span>
            </div>
          )}

          <HCaptchaWidget
            ref={captchaRef}
            size="invisible"
            onVerify={(t: string) => setCaptchaToken(t)}
            onExpire={() => setCaptchaToken(null)}
            onError={(msg: string) => auditLogger.error('HCAPTCHA_ERROR', new Error(msg))}
          />
        </div>
      </div>

      {/* Quick reference */}
      <div className="max-w-md mx-auto px-4 pb-8">
        <div className="bg-white/10 backdrop-blur rounded-xl p-4">
          <h2 className="text-white font-semibold text-sm mb-3">Demo Credentials</h2>
          <div className="space-y-2 text-white/90 text-xs">
            <div className="flex justify-between">
              <span>Patient (Floyd)</span>
              <span className="font-mono">+1 972-802-5786 / Password123!</span>
            </div>
            <div className="flex justify-between">
              <span>Staff (all 3)</span>
              <span className="font-mono">email / DemoStaff2026!</span>
            </div>
            <div className="flex justify-between">
              <span>Staff PIN</span>
              <span className="font-mono">1234</span>
            </div>
          </div>
        </div>
      </div>

      {/* Link to production login */}
      <div className="text-center pb-8">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="text-white/60 text-xs hover:text-white/90 underline"
        >
          Go to production login
        </button>
      </div>
    </div>
  );
};

export default DemoPage;
