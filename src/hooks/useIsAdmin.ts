// src/hooks/useIsAdmin.ts
import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '../contexts/AuthContext';
import { RoleCode } from '../types/roles';

/**
 * useIsAdmin - HIPAA-compliant admin check
 *
 * Administrative roles with admin panel access:
 * - super_admin (1): Platform administrators
 * - admin (2): Facility administrators
 * - department_head (11): Executive leadership (CNO, CMO)
 * - it_admin (19): Tenant IT administrators
 *
 * Based on minimum necessary principle per HIPAA requirements.
 * Returns: true, false, or null (while loading / no session)
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
          setIsAdmin(false);
          return;
        }

        // Administrative role codes that grant admin panel access
        const adminRoleCodes = [
          RoleCode.SUPER_ADMIN,      // 1
          RoleCode.ADMIN,            // 2
          RoleCode.DEPARTMENT_HEAD,  // 11
          RoleCode.IT_ADMIN,         // 19
        ];

        // Administrative role names (fallback if role_code not set)
        const adminRoleNames = [
          'super_admin',
          'admin',
          'department_head',
          'it_admin',
        ];

        const roleCode = profile?.role_code;
        const roleName = profile?.role;
        const hasAdminAccess = adminRoleCodes.includes(roleCode) ||
          adminRoleNames.includes(roleName);

        setIsAdmin(hasAdminAccess);
      } catch {
        setIsAdmin(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, supabase]);

  return isAdmin;
}
