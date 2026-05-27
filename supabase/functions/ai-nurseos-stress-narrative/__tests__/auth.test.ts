// supabase/functions/ai-nurseos-stress-narrative/__tests__/auth.test.ts
//
// Tests for the authorization gate added to ai-nurseos-stress-narrative.
// The bug: every authenticated nurse could fetch a different provider's stress
// narrative across every tenant. The fix: self-access OR admin role + tenant match.
//
// These tests validate the decision logic that the edge function uses.
// They do not boot the full Deno handler — they assert the access matrix.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Mirror the decision logic from the edge function so we can unit-test it.
const ADMIN_ROLES = ["admin", "care_manager", "super_admin", "department_head"];

interface AuthDecisionInput {
  callerPractitionerId: string | null;
  callerRole: string | null;
  callerTenantId: string | null;
  targetProviderId: string;
  targetTenantId: string | null;
}

type AuthDecision =
  | { allowed: true; auditAdminAccess: boolean }
  | { allowed: false; reason: "forbidden" | "cross_tenant" | "target_not_found" };

function decideAuthz(input: AuthDecisionInput): AuthDecision {
  const isSelfAccess =
    input.callerPractitionerId !== null &&
    input.callerPractitionerId === input.targetProviderId;
  const isAdminAccess =
    !isSelfAccess &&
    input.callerRole !== null &&
    ADMIN_ROLES.includes(input.callerRole);

  if (!isSelfAccess && !isAdminAccess) {
    return { allowed: false, reason: "forbidden" };
  }

  if (!isSelfAccess && input.callerRole !== "super_admin") {
    if (input.targetTenantId === null) {
      return { allowed: false, reason: "target_not_found" };
    }
    if (input.targetTenantId !== input.callerTenantId) {
      return { allowed: false, reason: "cross_tenant" };
    }
  }

  return { allowed: true, auditAdminAccess: isAdminAccess };
}

Deno.test("stress-narrative authorization gate", async (t) => {
  const TENANT_A = "00000000-0000-0000-0000-00000000000a";
  const TENANT_B = "00000000-0000-0000-0000-00000000000b";
  const SELF_ID = "10000000-0000-0000-0000-000000000001";
  const OTHER_ID = "10000000-0000-0000-0000-000000000002";

  await t.step("self-access is allowed (any role)", () => {
    const decision = decideAuthz({
      callerPractitionerId: SELF_ID,
      callerRole: "nurse",
      callerTenantId: TENANT_A,
      targetProviderId: SELF_ID,
      targetTenantId: TENANT_A,
    });
    assertEquals(decision, { allowed: true, auditAdminAccess: false });
  });

  await t.step("admin cross-provider (same tenant) is allowed + audited", () => {
    const decision = decideAuthz({
      callerPractitionerId: SELF_ID,
      callerRole: "admin",
      callerTenantId: TENANT_A,
      targetProviderId: OTHER_ID,
      targetTenantId: TENANT_A,
    });
    assertEquals(decision, { allowed: true, auditAdminAccess: true });
  });

  await t.step("care_manager cross-provider (same tenant) is allowed + audited", () => {
    const decision = decideAuthz({
      callerPractitionerId: SELF_ID,
      callerRole: "care_manager",
      callerTenantId: TENANT_A,
      targetProviderId: OTHER_ID,
      targetTenantId: TENANT_A,
    });
    assertEquals(decision, { allowed: true, auditAdminAccess: true });
  });

  await t.step("department_head cross-provider (same tenant) is allowed + audited", () => {
    const decision = decideAuthz({
      callerPractitionerId: SELF_ID,
      callerRole: "department_head",
      callerTenantId: TENANT_A,
      targetProviderId: OTHER_ID,
      targetTenantId: TENANT_A,
    });
    assertEquals(decision, { allowed: true, auditAdminAccess: true });
  });

  await t.step("non-admin cross-provider is BLOCKED (403)", () => {
    const decision = decideAuthz({
      callerPractitionerId: SELF_ID,
      callerRole: "nurse",
      callerTenantId: TENANT_A,
      targetProviderId: OTHER_ID,
      targetTenantId: TENANT_A,
    });
    assertEquals(decision, { allowed: false, reason: "forbidden" });
  });

  await t.step("caller with no role is BLOCKED (403)", () => {
    const decision = decideAuthz({
      callerPractitionerId: SELF_ID,
      callerRole: null,
      callerTenantId: TENANT_A,
      targetProviderId: OTHER_ID,
      targetTenantId: TENANT_A,
    });
    assertEquals(decision, { allowed: false, reason: "forbidden" });
  });

  await t.step("admin cross-TENANT is BLOCKED (403, cross_tenant)", () => {
    const decision = decideAuthz({
      callerPractitionerId: SELF_ID,
      callerRole: "admin",
      callerTenantId: TENANT_A,
      targetProviderId: OTHER_ID,
      targetTenantId: TENANT_B,
    });
    assertEquals(decision, { allowed: false, reason: "cross_tenant" });
  });

  await t.step("care_manager cross-TENANT is BLOCKED", () => {
    const decision = decideAuthz({
      callerPractitionerId: SELF_ID,
      callerRole: "care_manager",
      callerTenantId: TENANT_A,
      targetProviderId: OTHER_ID,
      targetTenantId: TENANT_B,
    });
    assertEquals(decision, { allowed: false, reason: "cross_tenant" });
  });

  await t.step("super_admin can cross-tenant (intentional)", () => {
    const decision = decideAuthz({
      callerPractitionerId: SELF_ID,
      callerRole: "super_admin",
      callerTenantId: TENANT_A,
      targetProviderId: OTHER_ID,
      targetTenantId: TENANT_B,
    });
    assertEquals(decision, { allowed: true, auditAdminAccess: true });
  });

  await t.step("admin with target_not_found returns target_not_found", () => {
    const decision = decideAuthz({
      callerPractitionerId: SELF_ID,
      callerRole: "admin",
      callerTenantId: TENANT_A,
      targetProviderId: OTHER_ID,
      targetTenantId: null,
    });
    assertEquals(decision, { allowed: false, reason: "target_not_found" });
  });

  await t.step("caller with no practitioner_id and non-admin role is BLOCKED", () => {
    // e.g., a user with a profile but no fhir_practitioners row, role 'nurse'
    const decision = decideAuthz({
      callerPractitionerId: null,
      callerRole: "nurse",
      callerTenantId: TENANT_A,
      targetProviderId: OTHER_ID,
      targetTenantId: TENANT_A,
    });
    assertEquals(decision, { allowed: false, reason: "forbidden" });
  });

  await t.step("caller with no practitioner_id but admin role is allowed", () => {
    // e.g., an admin without their own clinical practitioner record can still
    // perform oversight on providers within their tenant.
    const decision = decideAuthz({
      callerPractitionerId: null,
      callerRole: "admin",
      callerTenantId: TENANT_A,
      targetProviderId: OTHER_ID,
      targetTenantId: TENANT_A,
    });
    assertEquals(decision, { allowed: true, auditAdminAccess: true });
  });
});
