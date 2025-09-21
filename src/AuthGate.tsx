// src/AuthGate.tsx - FIXED VERSION
import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSupabaseClient, useSession, useUser } from './contexts/AuthContext';

/**
 * Gatekeeper for post-login flow:
 * 1) force_password_change === true  -> /change-password
 * 2) onboarded === false             -> /demographics
 * 3) otherwise                       -> allow
 *
 * Only acts when a user is logged in. Public routes continue to work.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const supabase = useSupabaseClient();
  const session = useSession(); // keep to react to auth changes
  const user = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user) return; // not logged in → do nothing

      const path = location.pathname;
      const isGatePage = path === '/change-password' || path === '/demographics';

      // FIXED: Query by user_id (the correct primary key) and get role info
      const { data, error } = await supabase
        .from('profiles')
        .select('force_password_change, onboarded, demographics_complete, roles(name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled || error) {
        if (error) console.warn('[AuthGate] profile fetch error:', error.message);
        return;
      }

      if (data?.force_password_change) {
        if (!isGatePage && path !== '/change-password') {
          navigate('/change-password', { replace: true });
        }
        return;
      }

      const roleName = data?.roles?.[0]?.name || 'senior';

      // Skip demographics for admin/staff roles - they go straight to dashboard
      if (['admin', 'super_admin', 'staff', 'moderator'].includes(roleName)) {
        // Set them as onboarded if not already
        if (data && !data.onboarded) {
          supabase.from('profiles').update({ onboarded: true }).eq('user_id', user.id);
        }
        return; // Let them continue to dashboard
      }

      // For seniors: check if demographics are needed
      if (data && (data.onboarded === false || !data.demographics_complete)) {
        if (!isGatePage && path !== '/demographics') {
          navigate('/demographics', { replace: true });
        }
        return;
      }
      // Otherwise, carry on.
    })();

    return () => {
      cancelled = true;
    };
  }, [user, supabase, navigate, location.pathname, session?.access_token]);

  return <>{children}</>;
}