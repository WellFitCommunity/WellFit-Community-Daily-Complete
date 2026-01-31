// src/AuthGate.tsx — centralized role authority, schema-aware, fail-safe
import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSupabaseClient, useSession, useUser } from "./contexts/AuthContext";
import {
  checkAdminFromProfile,
  checkAdminFromUserRoles,
  type UserRoleData,
  type ProfileRoleData,
} from "./lib/roleAuthority";

type ProfileRow = {
  force_password_change?: boolean | null;
  onboarded?: boolean | null;
  demographics_complete?: boolean | null;
  consent?: boolean | null;
  // role hints (no joins)
  is_admin?: boolean | null;
  role?: string | null;
  role_code?: number | null;
  role_id?: number | null;
};

/**
 * Check if user has admin access using centralized role authority
 * Uses user_roles table as primary source, profiles as fallback
 */
function isAdminish(
  profile?: ProfileRow | null,
  userRoles?: UserRoleData[] | null
): boolean {
  // Priority 1: Check user_roles table (authoritative)
  if (userRoles && userRoles.length > 0) {
    return checkAdminFromUserRoles(userRoles);
  }

  // Priority 2: Check profiles table (legacy fallback)
  if (profile) {
    const profileData: ProfileRoleData = {
      role_code: profile.role_code,
      role: profile.role,
      is_admin: profile.is_admin,
    };
    return checkAdminFromProfile(profileData);
  }

  // Deny by default
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

      // Fetch profile data
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "force_password_change, onboarded, demographics_complete, consent, is_admin, role, role_code, role_id",
        )
        .eq("user_id", user.id)
        .maybeSingle<ProfileRow>();

      if (cancelled) return;

      if (error) {
        return; // fail open: don't break login
      }

      const p: ProfileRow = data || {};

      // Fetch user_roles (authoritative source for role checks)
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role, created_at")
        .eq("user_id", user.id);

      if (cancelled) return;

      const userRoles = (rolesData || []) as UserRoleData[];

      // 1) Password change hard-stop
      if (p.force_password_change) {
        if (!isGatePage && path !== "/change-password") {
          navigate("/change-password", { replace: true });
        }
        return;
      }

      // 2) Admin/staff bypass demographics (optionally mark onboarded)
      if (isAdminish(p, userRoles)) {
        if (p.onboarded === false || p.onboarded == null) {
          // fire-and-forget; don’t block navigation
          supabase
            .from("profiles")
            .update({ onboarded: true })
            .eq("user_id", user.id);
        }
        return; // continue
      }

      // 3) Seniors must complete demographics first
      // Check both onboarded AND demographics_complete for backwards compatibility
      const hasCompletedDemographics = p.onboarded === true || p.demographics_complete === true;
      const needsDemo = !hasCompletedDemographics;

      if (needsDemo) {
        if (!isGatePage && path !== "/demographics") {
          navigate("/demographics", { replace: true });
        }
        return;
      }

      // 4) After demographics, seniors must complete consent forms
      const needsConsent = p.consent === false || p.consent == null;

      if (needsConsent && hasCompletedDemographics) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token, location.pathname, navigate, supabase]);

  return <>{children}</>;
}
