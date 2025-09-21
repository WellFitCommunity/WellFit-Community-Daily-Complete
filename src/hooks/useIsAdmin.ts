// src/hooks/useIsAdmin.ts
import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '../contexts/AuthContext';

/**
 * useIsAdmin - HIPAA-compliant admin check
 * - Only medical roles (admin, super_admin, contractor_nurse) have admin access
 * - Based on minimum necessary principle
 * - Returns: true, false, or null (while loading / no session)
 */
export function useIsAdmin() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    // wait for a session; unauthenticated users are not admins
    if (!session) {
      setIsAdmin(null);
      return;
    }

    (async () => {
      try {
        // Get user profile with role information
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role_code, role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('useIsAdmin profile fetch error:', error);
          setIsAdmin(false);
          return;
        }

        // HIPAA-compliant: Only medical roles get admin access
        const roleCode = profile?.role_code;
        const roleName = profile?.role;
        const hasMedicalAccess = [1, 2, 12].includes(roleCode) ||
          ['admin', 'super_admin', 'contractor_nurse'].includes(roleName);

        setIsAdmin(hasMedicalAccess);
      } catch (error) {
        console.error('useIsAdmin error:', error);
        setIsAdmin(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, supabase]);

  return isAdmin;
}
