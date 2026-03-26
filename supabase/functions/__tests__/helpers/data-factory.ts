/**
 * Synthetic Data Factory for Integration Tests
 *
 * Creates and cleans up test data in the live database.
 * All data uses TEST-0001 tenant and obviously fake names.
 * Cleanup runs even on test failure (try/finally pattern).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TEST_TENANT_ID,
  SYNTHETIC,
} from "./test-config.ts";

// Service role client — bypasses RLS for test setup/teardown
function getAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY required for data factory");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// Track created resources for cleanup
type CleanupEntry = { table: string; column: string; value: string };
const cleanupQueue: CleanupEntry[] = [];

/**
 * Register a resource for cleanup (LIFO order)
 */
function track(table: string, column: string, value: string): void {
  cleanupQueue.push({ table, column, value });
}

/**
 * Clean up ALL tracked resources — call in finally block
 */
export async function cleanupAll(): Promise<void> {
  const admin = getAdminClient();
  // Reverse order — delete children before parents
  const entries = [...cleanupQueue].reverse();
  cleanupQueue.length = 0;

  for (const entry of entries) {
    const { error } = await admin
      .from(entry.table)
      .delete()
      .eq(entry.column, entry.value);

    if (error) {
      console.warn(
        `Cleanup warning: ${entry.table}.${entry.column}=${entry.value}: ${error.message}`
      );
    }
  }
}

/**
 * Create a test check-in for a user
 */
export async function createCheckIn(
  userId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string }> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("check_ins")
    .insert({
      user_id: userId,
      tenant_id: TEST_TENANT_ID,
      label: "good",
      emotional_state: "happy",
      heart_rate: 72,
      bp_systolic: 120,
      bp_diastolic: 80,
      source: "integration_test",
      ...overrides,
    })
    .select("id")
    .single();

  if (error) throw new Error(`createCheckIn failed: ${error.message}`);
  track("check_ins", "id", String(data.id));
  return { id: String(data.id) };
}

/**
 * Create a test profile (requires an existing auth.users entry)
 * For integration tests, we query existing test users or skip.
 */
export async function createProfile(
  userId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ userId: string }> {
  const admin = getAdminClient();
  const { error } = await admin.from("profiles").upsert({
    user_id: userId,
    id: userId,
    tenant_id: TEST_TENANT_ID,
    first_name: SYNTHETIC.patient.firstName,
    last_name: SYNTHETIC.patient.lastName,
    phone: SYNTHETIC.patient.phone,
    email: SYNTHETIC.patient.email,
    ...overrides,
  });

  if (error) throw new Error(`createProfile failed: ${error.message}`);
  track("profiles", "user_id", userId);
  return { userId };
}

/**
 * Create a test bed in a hospital unit
 */
export async function createBed(
  unitId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string }> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("beds")
    .insert({
      unit_id: unitId,
      tenant_id: TEST_TENANT_ID,
      bed_number: `TEST-${Date.now()}`,
      status: "available",
      ...overrides,
    })
    .select("id")
    .single();

  if (error) throw new Error(`createBed failed: ${error.message}`);
  track("beds", "id", data.id);
  return { id: data.id };
}

/**
 * Create a test caregiver PIN for a senior
 */
export async function createCaregiverPin(
  seniorUserId: string,
  pinHash: string
): Promise<{ id: string }> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("caregiver_pins")
    .insert({
      user_id: seniorUserId,
      pin_hash: pinHash,
      salt: "test-salt-integration",
    })
    .select("id")
    .single();

  if (error) throw new Error(`createCaregiverPin failed: ${error.message}`);
  track("caregiver_pins", "id", String(data.id));
  return { id: String(data.id) };
}

/**
 * Query a table with service role (for verification)
 */
export async function queryAsAdmin(
  table: string,
  filters: Record<string, string>
): Promise<unknown[]> {
  const admin = getAdminClient();
  let query = admin.from(table).select("*");
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }
  const { data, error } = await query;
  if (error) throw new Error(`queryAsAdmin(${table}) failed: ${error.message}`);
  return data ?? [];
}

/**
 * Query a table with anon key (for RLS verification)
 */
export async function queryAsAnon(
  table: string,
  filters: Record<string, string>
): Promise<unknown[]> {
  const anon = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("VITE_SUPABASE_ANON_KEY") ||
      ""
  );
  let query = anon.from(table).select("*");
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }
  const { data, error } = await query;
  if (error) throw new Error(`queryAsAnon(${table}) failed: ${error.message}`);
  return data ?? [];
}

/**
 * Wrap a test body with automatic cleanup
 *
 * Usage:
 *   Deno.test("my test", () => withCleanup(async () => {
 *     const checkin = await createCheckIn(userId);
 *     // ... assertions ...
 *   }));
 */
export async function withCleanup(
  testFn: () => Promise<void>
): Promise<void> {
  try {
    await testFn();
  } finally {
    await cleanupAll();
  }
}
