// src/AuthGate.tsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSupabaseClient, useSession, useUser } from './lib/supabaseClient';

/**
 * Gatekeeper for post-login flow:
 * 1) force_password_change === true  -> /change-password
 * 2) onboarded === false             -> /demographics
 * 3) otherwise                       -> allow
 *
 * Only acts when a user is logged in. Public routes continue to work.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = useSupabaseClient();
  const session = useSession(); // not used directly, but keeps this component reacting to auth changes
  const user = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user) return; // not logged in → do nothing

      // Avoid loops on gate pages
      const path = location.pathname;
      const isGatePage = path === '/change-password' || path === '/demographics';

      // Pull the two flags off profiles by user_id
      const { data, error } = await supabase
        .from('profiles')
        .select('force_password_change, onboarded')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled || error) {
        // Fail-open to avoid loops/logouts on transient errors
        if (error) console.warn('[AuthGate] profile fetch error:', error.message);
        return;
      }

      if (data?.force_password_change) {
        if (!isGatePage && path !== '/change-password') {
          navigate('/change-password', { replace: true });
        }
        return;
      }

      if (data && data.onboarded === false) {
        if (!isGatePage && path !== '/demographics') {
          navigate('/demographics', { replace: true });
        }
        return;
      }
      // Otherwise, carry on.
    })();

    return () => { cancelled = true; };
  }, [user, supabase, navigate, location.pathname, session?.access_token]);

  return <>{children}</>;
}
