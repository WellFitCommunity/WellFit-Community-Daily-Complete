/**
 * Integration Test Configuration
 *
 * Shared constants and helpers for all live integration tests.
 * Uses TEST-0001 tenant — isolated from demo data via RLS.
 */

// --- Environment ---
export const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ||
  Deno.env.get("VITE_SUPABASE_URL") ||
  "";

export const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ||
  Deno.env.get("VITE_SUPABASE_ANON_KEY") ||
  "";

export const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SB_SERVICE_ROLE_KEY") ||
  Deno.env.get("SB_SECRET_KEY") ||
  "";

// --- Test Tenant ---
export const TEST_TENANT_ID = "a1b2c3d4-e5f6-0000-0000-000000000001";
export const TEST_TENANT_CODE = "TEST-0001";

// --- Synthetic Test Data (Rule #15: obviously fake) ---
export const SYNTHETIC = {
  patient: {
    firstName: "Test Patient",
    lastName: "Alpha",
    dob: "2000-01-01",
    phone: "555-0100",
    email: "test.alpha@example.com",
  },
  patient2: {
    firstName: "Test Patient",
    lastName: "Bravo",
    dob: "2000-02-02",
    phone: "555-0200",
    email: "test.bravo@example.com",
  },
  caregiver: {
    firstName: "Test Caregiver",
    lastName: "Charlie",
    phone: "555-0300",
    email: "test.charlie@example.com",
    pin: "9876",
  },
  provider: {
    firstName: "Dr. Test",
    lastName: "Delta",
    npi: "1234567890",
    email: "test.delta@example.com",
  },
} as const;

// --- Helper: Call Edge Function ---
export async function callEdgeFunction(
  functionName: string,
  body: Record<string, unknown>,
  options: {
    method?: string;
    useServiceRole?: boolean;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; data: unknown; ok: boolean }> {
  const { method = "POST", useServiceRole = false, headers = {} } = options;
  const key = useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;

  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: SUPABASE_ANON_KEY,
      ...headers,
    },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { status: response.status, data, ok: response.ok };
}

// --- Helper: Assert with descriptive message ---
export function assert(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// --- Helper: Check if env is configured ---
export function requireEnv(): void {
  if (!SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL not set. Run with: SUPABASE_URL=... SUPABASE_ANON_KEY=... deno test"
    );
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      "SUPABASE_ANON_KEY not set. Run with: SUPABASE_URL=... SUPABASE_ANON_KEY=... deno test"
    );
  }
}
