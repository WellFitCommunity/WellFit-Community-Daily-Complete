/**
 * Envision Login Page - Secret Entry Point
 *
 * Private login for Envision VirtualEdge Group super administrators
 * Route: /envision (not publicly linked)
 *
 * Access: Only Envision staff know this URL exists
 * Authentication: Supabase auth + optional TOTP 2FA
 * Password reset: Email-based via Supabase (no SMS/Twilio required)
 * Redirects to Master Panel (/super-admin) after successful auth
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft, Smartphone, Key, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auditLogger } from '../services/auditLogger';
import HCaptchaWidget, { HCaptchaRef } from '../components/HCaptchaWidget';

type AuthStep = 'credentials' | 'totp' | 'backup-code' | 'totp-setup' | 'forgot' | 'reset-sent';

interface SuperAdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  permissions: string[];
}

export const EnvisionLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { supabase, user } = useAuth();

  // Auth flow state
  const [step, setStep] = useState<AuthStep>('credentials');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_superAdminData, setSuperAdminData] = useState<SuperAdminUser | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // TOTP state
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [totpSetupData, setTotpSetupData] = useState<{
    secret: string;
    uri: string;
    backupCodes: string[];
  } | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // hCaptcha state
  const captchaRef = useRef<HCaptchaRef>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Check if already logged in as super admin
  useEffect(() => {
    const checkExistingSession = async () => {
      // Check if logged in via Supabase
      if (user) {
        // Check if user is a super admin
        const { data: superAdmin } = await supabase
          .from('super_admin_users')
          .select('id, is_active, totp_enabled, totp_secret')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (superAdmin) {
          // Check if TOTP verification is needed
          const totpEnabled = Boolean(superAdmin.totp_enabled && superAdmin.totp_secret);
          const totpVerified = localStorage.getItem('envision_totp_verified') === user.id;

          if (totpEnabled && !totpVerified) {
            // Need TOTP verification
            setStep('totp');
          } else {
            // Already fully authenticated, redirect to Master Panel
            navigate('/super-admin');
          }
        }
      }
    };

    checkExistingSession();
  }, [user, navigate, supabase]);

  // Step 1: Login with Supabase auth
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // Check captcha token
      if (!captchaToken) {
        setError('Please complete the captcha verification.');
        setLoading(false);
        return;
      }

      // Use Supabase's built-in signInWithPassword with captcha
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
        options: { captchaToken }
      });

      if (authError) {
        setError(authError.message || 'Invalid email or password');
        return;
      }

      if (!authData.user) {
        setError('Login failed. Please try again.');
        return;
      }

      setPassword(''); // Clear password from memory

      // Now check if this user is a super admin
      const { data: checkData, error: checkError } = await supabase.functions.invoke('envision-check-super-admin', {
        headers: {
          Authorization: `Bearer ${authData.session?.access_token}`
        }
      });

      if (checkError) {
        // Sign out since they're not authorized
        await supabase.auth.signOut();
        setError('Failed to verify authorization');
        return;
      }

      if (!checkData?.is_super_admin) {
        // Not a super admin - sign them out
        await supabase.auth.signOut();
        setError('This account does not have Envision portal access.');
        return;
      }

      if (!checkData?.is_active) {
        await supabase.auth.signOut();
        setError('Your Envision account has been deactivated.');
        return;
      }

      // Store super admin data
      setSuperAdminData(checkData.user);

      // Check if TOTP verification is required
      if (checkData.requires_totp) {
        setSuccessMsg('Password verified. Please enter your authenticator code.');
        setStep('totp');
      } else {
        // No TOTP required, go directly to portal
        await auditLogger.info('ENVISION_LOGIN_SUCCESS', {
          superAdminId: checkData.user.id,
          role: checkData.user.role,
          method: 'supabase_auth'
        });
        navigate('/super-admin');
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Login failed';
      await auditLogger.error('ENVISION_LOGIN_ERROR', err as Error, { email: email.trim() });
      setError(errMsg);
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  // Initiate TOTP setup (for users who need to set up 2FA)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleInitiateTotpSetup = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session expired. Please log in again.');
        setStep('credentials');
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('envision-totp-setup', {
        body: { session_token: session.access_token }
      });

      if (fnError || data?.error) {
        setError(data?.error || fnError?.message || 'Failed to initiate TOTP setup');
        return;
      }

      if (data?.success) {
        setTotpSetupData({
          secret: data.secret,
          uri: data.totp_uri,
          backupCodes: data.backup_codes
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'TOTP setup failed';
      setError(errMsg);
    }
  };

  // Verify TOTP code during login (Supabase auth version)
  const handleTotpVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session expired. Please log in again.');
        setStep('credentials');
        setLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('envision-totp-verify-supabase', {
        body: { code: totpCode }
      });

      if (fnError) {
        setError(fnError.message || 'TOTP verification failed');
        return;
      }

      if (data?.error) {
        setError(data.error);
        if (data.remaining_attempts !== undefined) {
          setWarning(`${data.remaining_attempts} attempts remaining`);
        }
        return;
      }

      if (data?.success && data?.user) {
        // Full 2FA complete! Mark TOTP as verified and redirect
        localStorage.setItem('envision_totp_verified', session.user.id);

        await auditLogger.info('ENVISION_LOGIN_SUCCESS', {
          superAdminId: data.user.id,
          role: data.user.role,
          method: 'totp_supabase'
        });

        navigate('/super-admin');
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'TOTP verification failed';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Use backup code (Supabase auth version)
  const handleBackupCodeVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session expired. Please log in again.');
        setStep('credentials');
        setLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('envision-totp-use-backup', {
        body: { backup_code: backupCode }
      });

      if (fnError) {
        setError(fnError.message || 'Backup code verification failed');
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      if (data?.success && data?.user) {
        // Mark TOTP as verified and redirect
        localStorage.setItem('envision_totp_verified', session.user.id);

        if (data.warning) {
          await auditLogger.warn('ENVISION_LOW_BACKUP_CODES', {
            superAdminId: data.user.id,
            remainingCodes: data.remaining_backup_codes
          });
        }

        await auditLogger.info('ENVISION_LOGIN_SUCCESS', {
          superAdminId: data.user.id,
          role: data.user.role,
          method: 'backup_code_supabase'
        });

        navigate('/super-admin');
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Backup code verification failed';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Complete TOTP setup with first code
  const handleTotpSetupVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session expired. Please log in again.');
        setStep('credentials');
        setLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('envision-totp-verify-setup', {
        body: { session_token: session.access_token, code: totpCode }
      });

      if (fnError) {
        setError(fnError.message || 'TOTP setup verification failed');
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      if (data?.success) {
        // Update backup codes with fresh ones from setup completion
        if (data.backup_codes) {
          setTotpSetupData(prev => prev ? { ...prev, backupCodes: data.backup_codes } : null);
        }
        setSuccessMsg('TOTP enabled! Save your backup codes, then continue to login.');
        // Mark TOTP as verified since they just set it up
        localStorage.setItem('envision_totp_verified', session.user.id);
        // Show success for a moment, then redirect
        setTimeout(() => navigate('/super-admin'), 2000);
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'TOTP setup failed';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Request password reset via EMAIL (Supabase built-in)
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // Use Supabase's built-in password reset (sends EMAIL, not SMS)
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/envision?reset=true`
      });

      if (resetError) {
        // Don't reveal if email exists or not
        setSuccessMsg('If this email is registered, a password reset link has been sent.');
        setStep('reset-sent');
        return;
      }

      setSuccessMsg('Password reset link sent! Check your email inbox.');
      setStep('reset-sent');

    } catch (err: unknown) {
      // Don't reveal if email exists or not (prevent enumeration)
      setSuccessMsg('If this email is registered, a password reset link has been sent.');
      setStep('reset-sent');
    } finally {
      setLoading(false);
    }
  };

  // Go back to credentials step
  const goBack = async () => {
    // Sign out if we're going back
    await supabase.auth.signOut();
    localStorage.removeItem('envision_totp_verified');
    setStep('credentials');
    setSuperAdminData(null);
    setError(null);
    setWarning(null);
    setSuccessMsg(null);
    setTotpCode('');
    setBackupCode('');
    setTotpSetupData(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500/10 rounded-full mb-4 border-2 border-blue-500/30">
            <Shield className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Envision Portal</h1>
          <p className="text-blue-300 text-sm">
            {step === 'credentials' && 'Authorized Personnel Only'}
            {step === 'totp' && 'Step 2: Authenticator Code'}
            {step === 'backup-code' && 'Step 2: Backup Code'}
            {step === 'totp-setup' && 'Set Up Two-Factor Authentication'}
            {step === 'forgot' && 'Reset Your Password'}
            {step === 'reset-sent' && 'Check Your Email'}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8">

          {/* Step 1: Email + Password */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-blue-100 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="you@envisionvirtualedge.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-blue-100 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 pr-12"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-blue-100 focus:outline-none disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Messages */}
              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}
              {warning && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <p className="text-sm text-yellow-200">{warning}</p>
                </div>
              )}
              {successMsg && (
                <div className="flex items-center gap-2 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-200">{successMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password || !captchaToken}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Continue
                  </>
                )}
              </button>

              {/* hCaptcha Widget - visible for free tier */}
              <div className="flex justify-center">
                <HCaptchaWidget
                  ref={captchaRef}
                  size="normal"
                  theme="dark"
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={(msg) => setError(msg)}
                />
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep('forgot');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-sm text-blue-300 hover:text-blue-100 underline"
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          )}

          {/* Step 2: TOTP Verification */}
          {step === 'totp' && (
            <form onSubmit={handleTotpVerification} className="space-y-6">
              <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-blue-400" />
                  <p className="text-sm text-blue-200 font-medium">
                    Enter Authenticator Code
                  </p>
                </div>
                <p className="text-xs text-blue-300/70">
                  Open your authenticator app and enter the 6-digit code
                </p>
              </div>

              <div>
                <label htmlFor="totp-code" className="block text-sm font-medium text-blue-100 mb-2">
                  6-Digit Code
                </label>
                <input
                  id="totp-code"
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  required
                  autoComplete="one-time-code"
                  disabled={loading}
                  inputMode="numeric"
                  pattern="\d{6}"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              {/* Messages */}
              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}
              {warning && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <p className="text-sm text-yellow-200">{warning}</p>
                </div>
              )}
              {successMsg && (
                <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-200">{successMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-5 h-5" />
                    Verify Code
                  </>
                )}
              </button>

              <div className="flex justify-between text-center">
                <button
                  type="button"
                  onClick={goBack}
                  className="text-sm text-blue-300 hover:text-blue-100 flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('backup-code');
                    setError(null);
                  }}
                  className="text-sm text-blue-300 hover:text-blue-100 underline flex items-center gap-1"
                >
                  <Key className="w-4 h-4" />
                  Use Backup Code
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Backup Code */}
          {step === 'backup-code' && (
            <form onSubmit={handleBackupCodeVerification} className="space-y-6">
              <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-5 h-5 text-yellow-400" />
                  <p className="text-sm text-yellow-200 font-medium">
                    Emergency Backup Code
                  </p>
                </div>
                <p className="text-xs text-yellow-300/70">
                  Enter one of your 8-character backup codes (format: XXXX-XXXX)
                </p>
              </div>

              <div>
                <label htmlFor="backup-code" className="block text-sm font-medium text-blue-100 mb-2">
                  Backup Code
                </label>
                <input
                  id="backup-code"
                  type="text"
                  value={backupCode}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                    // Auto-format: insert dash after 4 chars
                    if (val.length === 4 && !val.includes('-')) {
                      setBackupCode(val + '-');
                    } else {
                      setBackupCode(val.slice(0, 9)); // Max length: XXXX-XXXX
                    }
                  }}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-center text-xl tracking-widest font-mono uppercase"
                  placeholder="XXXX-XXXX"
                  autoFocus
                />
              </div>

              {/* Messages */}
              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || backupCode.replace(/-/g, '').length !== 8}
                className="w-full py-3 px-4 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Key className="w-5 h-5" />
                    Use Backup Code
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep('totp');
                    setError(null);
                    setBackupCode('');
                  }}
                  className="text-sm text-blue-300 hover:text-blue-100 flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Authenticator
                </button>
              </div>
            </form>
          )}

          {/* TOTP Setup Flow */}
          {step === 'totp-setup' && (
            <div className="space-y-6">
              <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-green-400" />
                  <p className="text-sm text-green-200 font-medium">
                    Set Up Authenticator App
                  </p>
                </div>
                <p className="text-xs text-green-300/70">
                  Scan the QR code with Google Authenticator, Authy, or similar app
                </p>
              </div>

              {totpSetupData ? (
                <>
                  {/* QR Code placeholder - would need QR library */}
                  <div className="bg-white p-4 rounded-lg text-center">
                    <div className="text-sm text-gray-600 mb-2">
                      Scan this QR code with your authenticator app:
                    </div>
                    <div className="font-mono text-xs break-all text-gray-800 p-2 bg-gray-100 rounded">
                      {totpSetupData.uri}
                    </div>
                    <div className="mt-3 text-sm text-gray-600">
                      Or enter this secret manually:
                    </div>
                    <div className="font-mono text-lg tracking-widest text-gray-800 p-2 bg-gray-100 rounded mt-1">
                      {totpSetupData.secret}
                    </div>
                  </div>

                  {/* Backup Codes */}
                  <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-200 font-medium mb-2">
                      Save Your Backup Codes!
                    </p>
                    <p className="text-xs text-yellow-300/70 mb-3">
                      These codes can be used if you lose access to your authenticator. Each code works once.
                    </p>
                    <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                      {totpSetupData.backupCodes.map((code, i) => (
                        <div key={i} className="bg-yellow-500/10 px-2 py-1 rounded text-yellow-200 text-center">
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Verify first code */}
                  <form onSubmit={handleTotpSetupVerification} className="space-y-4">
                    <div>
                      <label htmlFor="setup-code" className="block text-sm font-medium text-blue-100 mb-2">
                        Enter code from your app to verify setup:
                      </label>
                      <input
                        id="setup-code"
                        type="text"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                        required
                        inputMode="numeric"
                        pattern="\d{6}"
                        disabled={loading}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-center text-2xl tracking-[0.5em] font-mono"
                        placeholder="000000"
                      />
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <p className="text-sm text-red-200">{error}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || totpCode.length !== 6}
                      className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Setting up...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Complete Setup
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-blue-300">Generating TOTP secret...</p>
                </div>
              )}

              <div className="text-center">
                <button
                  type="button"
                  onClick={goBack}
                  className="text-sm text-blue-300 hover:text-blue-100 flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Cancel Setup
                </button>
              </div>
            </div>
          )}

          {/* Forgot Password - Request Email Reset */}
          {step === 'forgot' && (
            <form onSubmit={handleRequestReset} className="space-y-6">
              <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <p className="text-sm text-blue-200 font-medium">
                    Reset via Email
                  </p>
                </div>
                <p className="text-xs text-blue-300/70">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-blue-100 mb-2">
                  Email Address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="you@envisionvirtualedge.com"
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    Send Reset Link
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-sm text-blue-300 hover:text-blue-100 flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
              </div>
            </form>
          )}

          {/* Reset Link Sent Confirmation */}
          {step === 'reset-sent' && (
            <div className="space-y-6">
              <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <p className="text-sm text-green-200 font-medium">
                    Check Your Email
                  </p>
                </div>
                <p className="text-xs text-green-300/70">
                  If this email is registered, you'll receive a password reset link shortly.
                  Check your inbox and spam folder.
                </p>
              </div>

              {successMsg && (
                <div className="flex items-center gap-2 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <p className="text-sm text-blue-200">{successMsg}</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Return to Login
              </button>
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-blue-300/60 text-center">
              All access attempts are logged and monitored for security purposes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-blue-400/60">
            Envision VirtualEdge Group LLC
          </p>
        </div>
      </div>
    </div>
  );
};

export default EnvisionLoginPage;
