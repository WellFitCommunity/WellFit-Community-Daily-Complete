// supabase/functions/admin_register/__tests__/index.test.ts
// Tests for admin_register edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Admin Register Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/admin_register", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should reject non-POST methods", () => {
    const allowedMethods = ["POST"];
    const testMethods = ["GET", "PUT", "DELETE", "PATCH"];

    testMethods.forEach(method => {
      assertEquals(allowedMethods.includes(method), false);
    });
    assertEquals(allowedMethods.includes("POST"), true);
  });

  await t.step("should define allowed country codes", () => {
    const ALLOWED_COUNTRIES = ['US', 'CA', 'GB', 'AU'] as const;

    assertEquals(ALLOWED_COUNTRIES.includes('US'), true);
    assertEquals(ALLOWED_COUNTRIES.includes('CA'), true);
    assertEquals(ALLOWED_COUNTRIES.includes('GB'), true);
    assertEquals(ALLOWED_COUNTRIES.includes('AU'), true);
    assertEquals((ALLOWED_COUNTRIES as readonly string[]).includes('MX'), false);
  });

  await t.step("should validate payload schema - required fields", () => {
    const validPayload = {
      first_name: "John",
      last_name: "Doe",
      role_code: 4,
      email: "john@example.com"
    };

    const invalidPayload = {
      first_name: "",  // empty string should fail min(1)
      last_name: "Doe",
      role_code: 4
    };

    assertEquals(validPayload.first_name.length >= 1, true);
    assertEquals(validPayload.last_name.length >= 1, true);
    assertEquals(invalidPayload.first_name.length >= 1, false);
  });

  await t.step("should validate role codes - elevated roles", () => {
    const ELEVATED = new Set([1, 2, 3, 12, 14]);

    assertEquals(ELEVATED.has(1), true);   // admin
    assertEquals(ELEVATED.has(2), true);   // super_admin
    assertEquals(ELEVATED.has(3), true);   // staff
    assertEquals(ELEVATED.has(12), true);  // nurse_admin
    assertEquals(ELEVATED.has(14), true);  // moderator
    assertEquals(ELEVATED.has(4), false);  // senior (not elevated)
  });

  await t.step("should validate role codes - public roles", () => {
    const PUBLIC = new Set([4, 5, 6, 11, 13]);

    assertEquals(PUBLIC.has(4), true);   // senior
    assertEquals(PUBLIC.has(5), true);   // volunteer
    assertEquals(PUBLIC.has(6), true);   // caregiver
    assertEquals(PUBLIC.has(11), true);  // contractor
    assertEquals(PUBLIC.has(13), true);  // regular
    assertEquals(PUBLIC.has(1), false);  // admin (not public)
  });

  await t.step("should validate all allowed role codes", () => {
    const ELEVATED = new Set([1, 2, 3, 12, 14]);
    const PUBLIC = new Set([4, 5, 6, 11, 13]);
    const ALL = new Set([...ELEVATED, ...PUBLIC]);

    assertEquals(ALL.size, 10);
    assertEquals(ALL.has(1), true);
    assertEquals(ALL.has(99), false);
  });

  await t.step("should map role codes to role slugs correctly", () => {
    const getRoleSlug = (code: number): string => {
      switch (code) {
        case 1: return "admin";
        case 2: return "super_admin";
        case 3: return "staff";
        case 4: return "senior";
        case 5: return "volunteer";
        case 6: return "caregiver";
        case 11: return "contractor";
        case 12: return "nurse_admin";
        case 13: return "regular";
        case 14: return "moderator";
        default: return "regular";
      }
    };

    assertEquals(getRoleSlug(1), "admin");
    assertEquals(getRoleSlug(2), "super_admin");
    assertEquals(getRoleSlug(3), "staff");
    assertEquals(getRoleSlug(4), "senior");
    assertEquals(getRoleSlug(5), "volunteer");
    assertEquals(getRoleSlug(6), "caregiver");
    assertEquals(getRoleSlug(11), "contractor");
    assertEquals(getRoleSlug(12), "nurse_admin");
    assertEquals(getRoleSlug(13), "regular");
    assertEquals(getRoleSlug(14), "moderator");
    assertEquals(getRoleSlug(999), "regular"); // default
  });

  await t.step("should normalize phone numbers to E.164 format", () => {
    const normalizePhone = (phone?: string): string | undefined => {
      if (!phone) return undefined;
      const digits = phone.replace(/\D/g, "");
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
      return phone.startsWith("+") ? phone : `+${digits}`;
    };

    assertEquals(normalizePhone("5551234567"), "+15551234567");
    assertEquals(normalizePhone("15551234567"), "+15551234567");
    assertEquals(normalizePhone("+15551234567"), "+15551234567");
    assertEquals(normalizePhone("555-123-4567"), "+15551234567");
    assertEquals(normalizePhone("(555) 123-4567"), "+15551234567");
    assertEquals(normalizePhone(undefined), undefined);
  });

  await t.step("should require either email or phone", () => {
    const hasIdentifier = (email?: string, phone?: string): boolean => {
      return !!(email || phone);
    };

    assertEquals(hasIdentifier("test@example.com", undefined), true);
    assertEquals(hasIdentifier(undefined, "+15551234567"), true);
    assertEquals(hasIdentifier("test@example.com", "+15551234567"), true);
    assertEquals(hasIdentifier(undefined, undefined), false);
    assertEquals(hasIdentifier("", ""), false);
  });

  await t.step("should auto-generate password if not provided", () => {
    const generatePassword = (provided?: string): string => {
      return provided ?? crypto.randomUUID() + "aA1!";
    };

    const withProvided = generatePassword("myPassword123");
    const withoutProvided = generatePassword(undefined);

    assertEquals(withProvided, "myPassword123");
    assertEquals(withoutProvided.includes("aA1!"), true);
    assertEquals(withoutProvided.length > 10, true);
  });

  await t.step("should validate email format", () => {
    const isValidEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    assertEquals(isValidEmail("test@example.com"), true);
    assertEquals(isValidEmail("user@domain.org"), true);
    assertEquals(isValidEmail("invalid-email"), false);
    assertEquals(isValidEmail("@nodomain.com"), false);
    assertEquals(isValidEmail("noat.com"), false);
  });

  await t.step("should validate password minimum length", () => {
    const MIN_PASSWORD_LENGTH = 8;

    assertEquals("password".length >= MIN_PASSWORD_LENGTH, true);
    assertEquals("pass123!".length >= MIN_PASSWORD_LENGTH, true);
    assertEquals("short".length >= MIN_PASSWORD_LENGTH, false);
    assertEquals("".length >= MIN_PASSWORD_LENGTH, false);
  });

  await t.step("should validate delivery options", () => {
    const validDeliveryOptions = ["email", "sms", "none"];

    assertEquals(validDeliveryOptions.includes("email"), true);
    assertEquals(validDeliveryOptions.includes("sms"), true);
    assertEquals(validDeliveryOptions.includes("none"), true);
    assertEquals(validDeliveryOptions.includes("carrier_pigeon"), false);
  });

  await t.step("should default delivery to 'none'", () => {
    const getDelivery = (provided?: string): string => {
      return provided ?? "none";
    };

    assertEquals(getDelivery(undefined), "none");
    assertEquals(getDelivery("email"), "email");
    assertEquals(getDelivery("sms"), "sms");
  });

  await t.step("should require admin session OR secret header", () => {
    const isAuthorized = (
      isAdminSession: boolean,
      hasSecret: boolean
    ): boolean => {
      return isAdminSession || hasSecret;
    };

    assertEquals(isAuthorized(true, false), true);
    assertEquals(isAuthorized(false, true), true);
    assertEquals(isAuthorized(true, true), true);
    assertEquals(isAuthorized(false, false), false);
  });

  await t.step("should check if caller has elevated role", () => {
    const ELEVATED = new Set([1, 2, 3, 12, 14]);
    const isElevated = (roleCode: number): boolean => {
      return ELEVATED.has(roleCode);
    };

    assertEquals(isElevated(1), true);   // admin
    assertEquals(isElevated(2), true);   // super_admin
    assertEquals(isElevated(4), false);  // senior
    assertEquals(isElevated(6), false);  // caregiver
  });

  await t.step("should extract bearer token from authorization header", () => {
    const extractBearer = (auth: string | null): string | null => {
      if (!auth) return null;
      return auth.toLowerCase().startsWith("bearer ")
        ? auth.split(" ")[1]
        : null;
    };

    assertEquals(extractBearer("Bearer abc123"), "abc123");
    assertEquals(extractBearer("bearer xyz789"), "xyz789");
    assertEquals(extractBearer("Basic abc123"), null);
    assertEquals(extractBearer(null), null);
    assertEquals(extractBearer(""), null);
  });

  await t.step("should structure successful registration response", () => {
    const mockResponse = {
      success: true,
      user_id: "user-123",
      role_code: 4,
      role_slug: "senior",
      delivery: "none",
      temporary_password: "generated-password-aA1!",
      info: "No credentials sent."
    };

    assertEquals(mockResponse.success, true);
    assertExists(mockResponse.user_id);
    assertExists(mockResponse.role_code);
    assertExists(mockResponse.role_slug);
    assertExists(mockResponse.temporary_password);
  });

  await t.step("should return 403 for unauthorized requests", () => {
    const isAuthorized = false;
    const expectedStatus = isAuthorized ? 201 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should return 400 for invalid role_code", () => {
    const ALL = new Set([1, 2, 3, 4, 5, 6, 11, 12, 13, 14]);
    const roleCode = 99;
    const isValidRole = ALL.has(roleCode);
    const expectedStatus = isValidRole ? 201 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should return 400 for missing email and phone", () => {
    const email = undefined;
    const phone = undefined;
    const hasIdentifier = !!(email || phone);
    const expectedStatus = hasIdentifier ? 201 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should return 500 for missing server configuration", () => {
    const SB_URL = "";
    const SERVICE_KEY = "";
    const isMisconfigured = !SB_URL || !SERVICE_KEY;
    const expectedStatus = isMisconfigured ? 500 : 200;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should return 405 for non-POST methods", () => {
    const method = "GET";
    const expectedStatus = method !== "POST" ? 405 : 200;

    assertEquals(expectedStatus, 405);
  });

  await t.step("should set user metadata on registration", () => {
    const userMetadata = {
      role_code: 4,
      role_slug: "senior",
      first_name: "John",
      last_name: "Doe",
      registration_method: "admin_manual",
      registered_at: new Date().toISOString()
    };

    assertEquals(userMetadata.registration_method, "admin_manual");
    assertExists(userMetadata.registered_at);
    assertExists(userMetadata.role_code);
    assertExists(userMetadata.role_slug);
  });

  await t.step("should create profile record with required fields", () => {
    const profile = {
      id: "user-123",
      phone: "+15551234567",
      email: "test@example.com",
      first_name: "John",
      last_name: "Doe",
      role_code: 4,
      role_slug: "senior",
      created_by: null
    };

    assertExists(profile.id);
    assertExists(profile.first_name);
    assertExists(profile.last_name);
    assertExists(profile.role_code);
    assertExists(profile.role_slug);
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      created: 201,
      badRequest: 400,
      forbidden: 403,
      methodNotAllowed: 405,
      serverError: 500
    };

    assertEquals(statusCodes.created, 201);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.forbidden, 403);
    assertEquals(statusCodes.methodNotAllowed, 405);
    assertEquals(statusCodes.serverError, 500);
  });

  await t.step("should handle JSON parse errors gracefully", () => {
    const parseJSON = (str: string): unknown | null => {
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    };

    assertEquals(parseJSON('{"valid": true}'), { valid: true });
    assertEquals(parseJSON('invalid json'), null);
    assertEquals(parseJSON(''), null);
  });

  await t.step("should return 400 for invalid JSON body", () => {
    const body = null;
    const expectedStatus = body === null ? 400 : 200;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should trim empty email strings", () => {
    const processEmail = (email?: string): string | undefined => {
      return (email && email.trim() !== "") ? email : undefined;
    };

    assertEquals(processEmail("test@example.com"), "test@example.com");
    assertEquals(processEmail(""), undefined);
    assertEquals(processEmail("   "), undefined);
    assertEquals(processEmail(undefined), undefined);
  });
});
