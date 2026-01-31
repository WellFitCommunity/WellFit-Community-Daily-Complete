// src/hooks/useIsAdmin.ts
import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '../contexts/AuthContext';
import {
  determineRoleAccess,
  type UserRoleData,
  type ProfileRoleData,
} from '../lib/roleAuthority';

/**
 * useIsAdmin - HIPAA-compliant admin check using centralized role authority
 *
 * Administrative roles with admin panel access:
 * - super_admin (1): Platform administrators
 * - admin (2): Facility administrators
 * - it_admin (19): Tenant IT administrators
 * - department_head (11): Executive leadership (CNO, CMO)
 *
 * Data Sources (in priority order):
 * 1. user_roles table (authoritative)
 * 2. profiles.role_code/role (legacy fallback)
 *
 * Deny by default: Returns false if role cannot be proven.
 * Returns: true, false, or null (while loading / no session)
 */
export function useIsAdmin() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Wait for a session; unauthenticated users are not admins
    if (!session) {
      setIsAdmin(null);
      return;
    }

    (async () => {
      try {
        // Priority 1: Check user_roles table (authoritative source)
        const { data: userRolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role, created_at')
          .eq('user_id', session.user.id);

        if (cancelled) return;

        // Priority 2: Get profile as fallback
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role_code, role, is_admin')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (cancelled) return;

        // Handle errors gracefully - deny by default
        if (rolesError && profileError) {
          setIsAdmin(false);
          return;
        }

        // Use centralized role authority to determine access
        const userRoles = (userRolesData || []) as UserRoleData[];
        const profileData = profile as ProfileRoleData | null;
        const result = determineRoleAccess(userRoles, profileData);

        setIsAdmin(result.hasAdminAccess);
      } catch {
        // Deny by default on any error
        setIsAdmin(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, supabase]);

  return isAdmin;
}
