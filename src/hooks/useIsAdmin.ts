// src/hooks/useIsAdmin.ts
import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '../lib/supabaseClient';

/**
 * useIsAdmin
 * - Calls your Postgres function `is_admin()`
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
      const { data, error } = await supabase.rpc('is_admin');
      if (cancelled) return;

      if (error) {
        console.error('is_admin error:', error);
        setIsAdmin(false);
        return;
      }
      setIsAdmin(Boolean(data));
    })();

    return () => {
      cancelled = true;
    };
  }, [session, supabase]);

  return isAdmin;
}
