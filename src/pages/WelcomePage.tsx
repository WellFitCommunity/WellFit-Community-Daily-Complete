// src/pages/WelcomePage.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../contexts/AuthContext';

const WELLFIT_BLUE = '#003865';
const WELLFIT_GREEN = '#8cc63f';

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();

  // Auto-redirect logged-in users to appropriate page
  // Check role FIRST to avoid sending admins through senior onboarding
  useEffect(() => {
    let mounted = true;

    const checkSessionAndRedirect = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        // Handle session expiry errors gracefully
        if (error) {
          if (error.message?.includes('Invalid Refresh Token') ||
              error.message?.includes('Session Expired') ||
              error.message?.includes('Revoked by Newer Login')) {
            // Clear stale tokens
            await supabase.auth.signOut({ scope: 'local' });
            return;
          }
          return;
        }

        if (!mounted || !session) {
          return;
        }

      const userId = session.user?.id;
      if (!userId) {
        return;
      }

      // Fetch profile to check role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, role_code, onboarded, consent, force_password_change')
        .eq('user_id', userId)
        .maybeSingle();

      if (!mounted) return;

      // If profile doesn't exist or error, don't auto-redirect
      // Let user click login button to trigger proper error handling
      if (profileError) {
        return;
      }

      if (!profile) {
        return;
      }

      const role = profile?.role || '';
      const roleCode = profile?.role_code || 0;

      // Force password change takes priority
      if (profile.force_password_change) {
        navigate('/change-password', { replace: true });
        return;
      }

      // Admin/super_admin go to admin login
      if (role === 'admin' || role === 'super_admin' || roleCode === 1 || roleCode === 2) {
        navigate('/admin-login', { replace: true });
        return;
      }

      // Caregiver goes to caregiver dashboard
      if (role === 'caregiver' || roleCode === 6) {
        navigate('/caregiver-dashboard', { replace: true });
        return;
      }

      // Seniors: redirect to dashboard, AuthGate will handle onboarding flow
      navigate('/dashboard', { replace: true });
      } catch (err) {
        // On any error, just stay on welcome page
      }
    };

    checkSessionAndRedirect();

    return () => {
      mounted = false;
    };
     
  }, []);

  const handleContinue = () => {
    navigate('/register', { replace: true });
  };

  return (
    <div
      className="flex flex-col min-h-screen items-center justify-center"
      style={{ background: `linear-gradient(to bottom, ${WELLFIT_BLUE}, ${WELLFIT_GREEN})` }}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white rounded px-3 py-2 shadow">
        Skip to content
      </a>

      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-md w-full m-4 flex flex-col items-center">
        {/* Logo */}
        <img
          src="/android-chrome-512x512.png"
          alt="WellFit Community logo"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="w-28 h-28 mb-4 rounded-full shadow"
        />

        {/* App Name */}
        <h1 className="text-3xl font-extrabold text-[#003865] mb-4 text-center" id="main">
          WellFit Community
        </h1>

        {/* Welcome Message */}
        <p className="text-lg text-gray-700 text-center mb-6" id="welcome-copy">
          Welcome to WellFit Community where we are revolutionizing aging WELL! It is our hope that you feel appreciated and respected as we partner with you in the best years of your life. Thank you for allowing us the privilege of your company.<br />
          <span className="font-semibold">Strong Seniors, Stronger Community.</span>
        </p>

        {/* Continue Button */}
        <button
          type="button"
          onClick={handleContinue}
          aria-label="Continue to Registration"
          aria-describedby="welcome-copy"
          className="w-full py-3 rounded-2xl text-white text-lg font-bold transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#003865]"
          style={{ backgroundColor: WELLFIT_BLUE }}
          onMouseDown={(e) => e.currentTarget.blur()} // keeps focus ring tidy after click
        >
          Continue
        </button>

        {/* Login link - More prominent */}
        <p className="mt-4 text-center">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-lg font-semibold text-[#003865] underline hover:text-[#8cc63f] transition-colors"
          >
            Already a member? Log in here
          </button>
        </p>

        {/* Legal links */}
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            <a href="/privacy-policy" className="underline text-[#003865] hover:text-[#8cc63f]">Privacy Policy</a>
            {' · '}
            <a href="/terms" className="underline text-[#003865] hover:text-[#8cc63f]">Terms of Service</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
