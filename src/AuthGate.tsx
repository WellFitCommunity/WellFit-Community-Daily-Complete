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
 * It only acts when a user is logged in. Public routes continue to work.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = useSupabaseClient();
  const session = useSession();
  const user = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Not logged in? Do nothing; public routes will render.
      if (!user) return;

      // Don’t loop if we’re already on one of the gating pages
      const path = location.pathname;
      const isGatePage = path === '/change-password' || path === '/demographics';

      // Pull just the two flags we need
      const { data, error } = await supabase
        .from('profiles')
        .select('force_password_change, onboarded')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled || error) return; // fail open to avoid redirect loops

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
      // otherwise let them continue
    })();

    return () => { cancelled = true; };
  }, [user, supabase, navigate, location.pathname]);

  return <>{children}</>;
}
