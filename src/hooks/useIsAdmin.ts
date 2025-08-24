// src/hooks/useIsAdmin.ts
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL as string,
  process.env.REACT_APP_SUPABASE_ANON_KEY as string
);

/**
 * useIsAdmin
 * - Calls your Postgres function `is_admin()`
 * - Returns: true, false, or null (while loading)
 */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.rpc("is_admin");
        if (error) {
          console.error("Error checking is_admin:", error.message);
          if (!cancelled) setIsAdmin(false);
          return;
        }
        if (!cancelled) setIsAdmin(Boolean(data));
      } catch (err) {
        console.error("Unexpected error checking is_admin:", err);
        if (!cancelled) setIsAdmin(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}
