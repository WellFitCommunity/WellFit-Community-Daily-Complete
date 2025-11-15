// src/AuthGate.tsx — profiles-only, schema-aware, fail-safe (READY TO PASTE)
import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSupabaseClient, useSession, useUser } from "./contexts/AuthContext";

type ProfileRow = {
  force_password_change?: boolean | null;
  onboarded?: boolean | null;
  consent?: boolean | null;
  // role hints (no joins)
  is_admin?: boolean | null;
  role?: string | null;
  role_code?: number | null;
  role_id?: number | null;
};

const ADMIN_WORDS = new Set(["admin", "super_admin", "staff", "moderator"]);

function isAdminish(p?: ProfileRow | null): boolean {
  if (!p) return false;
  if (p.is_admin) return true;
  const name = (p.role || "").toLowerCase().trim();
  if (name && ADMIN_WORDS.has(name)) return true;

  // Check numeric role codes for admin roles:
  if (
    typeof p.role_code === "number" &&
    (p.role_code === 1 ||
      p.role_code === 2 ||
      p.role_code === 3 ||
      p.role_code === 12)
  )
    return true; // admin=1, super_admin=2, staff=3, contractor_nurse=12
  if (typeof p.role_id === "number" && p.role_id <= 5) return false; // conservative: don't assume admin on small ids
  return false;
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const supabase = useSupabaseClient();
  const session = useSession();
  const user = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Only run when truly logged in
      if (!user || !session) return;

      const path = location.pathname;
      const isGatePage =
        path === "/change-password" ||
        path === "/demographics" ||
        path === "/consent-photo" ||
        path === "/consent-privacy" ||
        path === "/login" ||
        path === "/admin-login" ||
        path === "/envision" ||
        path === "/register" ||
        path === "/verify" ||
        path === "/";

      // Read ONLY from profiles; no joins = no RLS surprises
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "force_password_change, onboarded, consent, is_admin, role, role_code, role_id",
        )
        .eq("user_id", user.id)
        .maybeSingle<ProfileRow>();

      if (cancelled) return;

      if (error) {
        return; // fail open: don't break login
      }

      const p: ProfileRow = data || {};

      // 1) Password change hard-stop
      if (p.force_password_change) {
        if (!isGatePage && path !== "/change-password") {
          navigate("/change-password", { replace: true });
        }
        return;
      }

      // 2) Admin/staff bypass demographics (optionally mark onboarded)
      if (isAdminish(p)) {
        if (p.onboarded === false || p.onboarded == null) {
          // fire-and-forget; don’t block navigation
          supabase
            .from("profiles")
            .update({ onboarded: true })
            .eq("user_id", user.id);
        }
        return; // continue
      }

      // 3) Seniors must complete demographics first (check via onboarded flag)
      const needsDemo = p.onboarded === false || p.onboarded == null;

      if (needsDemo) {
        if (!isGatePage && path !== "/demographics") {
          navigate("/demographics", { replace: true });
        }
        return;
      }

      // 4) After demographics, seniors must complete consent forms
      const needsConsent = p.consent === false || p.consent == null;

      if (needsConsent && p.onboarded === true) {
        if (
          !isGatePage &&
          path !== "/consent-photo" &&
          path !== "/consent-privacy"
        ) {
          navigate("/consent-photo", { replace: true });
        }
        return;
      }

      // else: allow through
    })();

    return () => {
      cancelled = true;
    };
     
  }, [user?.id, session?.access_token, location.pathname, navigate, supabase]);

  return <>{children}</>;
}
