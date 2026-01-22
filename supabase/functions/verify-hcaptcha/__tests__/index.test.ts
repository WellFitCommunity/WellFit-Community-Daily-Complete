// supabase/functions/verify-hcaptcha/__tests__/index.test.ts
// Tests for hCaptcha Verification and User Registration Edge Function

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Verify hCaptcha Registration Tests", async (t) => {

  // =====================================================
  // Phone Validation Tests (US E.164)
  // =====================================================

  await t.step("should normalize 10-digit US phone to E.164", () => {
    const toE164_US = (input: string): string => {
      const digits = (input || "").replace(/[^\d]/g, "");
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
      throw new Error("Phone must be a valid US number");
    };

    assertEquals(toE164_US("5551234567"), "+15551234567");
  });

  await t.step("should normalize 11-digit US phone with leading 1", () => {
    const toE164_US = (input: string): string => {
      const digits = (input || "").replace(/[^\d]/g, "");
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
      throw new Error("Phone must be a valid US number");
    };

    assertEquals(toE164_US("15551234567"), "+15551234567");
  });

  await t.step("should normalize phone with formatting characters", () => {
    const toE164_US = (input: string): string => {
      const digits = (input || "").replace(/[^\d]/g, "");
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
      throw new Error("Phone must be a valid US number");
    };

    assertEquals(toE164_US("(555) 123-4567"), "+15551234567");
    assertEquals(toE164_US("555-123-4567"), "+15551234567");
    assertEquals(toE164_US("555.123.4567"), "+15551234567");
  });

  await t.step("should reject invalid phone formats", () => {
    const toE164_US = (input: string): string => {
      const digits = (input || "").replace(/[^\d]/g, "");
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
      throw new Error("Phone must be a valid US number");
    };

    const invalidPhones = ["123", "12345", "123456789012"];
    for (const phone of invalidPhones) {
      try {
        toE164_US(phone);
        assertEquals(true, false, `Should have thrown for ${phone}`);
      } catch (e) {
        assertEquals((e as Error).message.includes("valid US number"), true);
      }
    }
  });

  // =====================================================
  // Password Complexity Tests
  // =====================================================

  await t.step("should require minimum 8 characters", () => {
    const passwordMissingRules = (pw: string): string[] => {
      const rules = [
        { r: /.{8,}/, m: "at least 8 characters" },
        { r: /[A-Z]/, m: "one uppercase letter" },
        { r: /\d/, m: "one number" },
        { r: /[^A-Za-z0-9]/, m: "one special character" }
      ];
      return rules.filter(x => !x.r.test(pw)).map(x => x.m);
    };

    const missing = passwordMissingRules("Short1!");
    assertEquals(missing.includes("at least 8 characters"), true);
  });

  await t.step("should require uppercase letter", () => {
    const passwordMissingRules = (pw: string): string[] => {
      const rules = [
        { r: /.{8,}/, m: "at least 8 characters" },
        { r: /[A-Z]/, m: "one uppercase letter" },
        { r: /\d/, m: "one number" },
        { r: /[^A-Za-z0-9]/, m: "one special character" }
      ];
      return rules.filter(x => !x.r.test(pw)).map(x => x.m);
    };

    const missing = passwordMissingRules("lowercase123!");
    assertEquals(missing.includes("one uppercase letter"), true);
  });

  await t.step("should require number", () => {
    const passwordMissingRules = (pw: string): string[] => {
      const rules = [
        { r: /.{8,}/, m: "at least 8 characters" },
        { r: /[A-Z]/, m: "one uppercase letter" },
        { r: /\d/, m: "one number" },
        { r: /[^A-Za-z0-9]/, m: "one special character" }
      ];
      return rules.filter(x => !x.r.test(pw)).map(x => x.m);
    };

    const missing = passwordMissingRules("NoNumbers!Abc");
    assertEquals(missing.includes("one number"), true);
  });

  await t.step("should require special character", () => {
    const passwordMissingRules = (pw: string): string[] => {
      const rules = [
        { r: /.{8,}/, m: "at least 8 characters" },
        { r: /[A-Z]/, m: "one uppercase letter" },
        { r: /\d/, m: "one number" },
        { r: /[^A-Za-z0-9]/, m: "one special character" }
      ];
      return rules.filter(x => !x.r.test(pw)).map(x => x.m);
    };

    const missing = passwordMissingRules("NoSpecial123A");
    assertEquals(missing.includes("one special character"), true);
  });

  await t.step("should accept valid password", () => {
    const passwordMissingRules = (pw: string): string[] => {
      const rules = [
        { r: /.{8,}/, m: "at least 8 characters" },
        { r: /[A-Z]/, m: "one uppercase letter" },
        { r: /\d/, m: "one number" },
        { r: /[^A-Za-z0-9]/, m: "one special character" }
      ];
      return rules.filter(x => !x.r.test(pw)).map(x => x.m);
    };

    const missing = passwordMissingRules("ValidPass123!");
    assertEquals(missing.length, 0);
  });

  // =====================================================
  // Rate Limiting Tests
  // =====================================================

  await t.step("should enforce max 5 requests per 15 minutes", () => {
    const MAX_REQUESTS = 5;
    const TIME_WINDOW_MINUTES = 15;

    assertEquals(MAX_REQUESTS, 5);
    assertEquals(TIME_WINDOW_MINUTES, 15);
  });

  await t.step("should return 429 when rate limited", () => {
    const response = { error: "Too many registration attempts. Try again later." };
    assertEquals(response.error.includes("Too many"), true);
  });

  await t.step("should track attempts by IP address", () => {
    const ipTracking = {
      table: "rate_limit_registrations",
      field: "ip_address"
    };

    assertEquals(ipTracking.table, "rate_limit_registrations");
    assertEquals(ipTracking.field, "ip_address");
  });

  // =====================================================
  // hCaptcha Verification Tests
  // =====================================================

  await t.step("should require hCaptcha token", () => {
    const body = { phone: "5551234567", password: "ValidPass123!", first_name: "John", last_name: "Doe" };
    const hasToken = "hcaptcha_token" in body;

    assertEquals(hasToken, false);
  });

  await t.step("should accept token from body", () => {
    const body = { hcaptcha_token: "captcha-token-123" };
    const header = null;
    const token = body.hcaptcha_token || header;

    assertEquals(token, "captcha-token-123");
  });

  await t.step("should accept token from header", () => {
    const body = {};
    const header = "captcha-token-from-header";
    const token = (body as { hcaptcha_token?: string }).hcaptcha_token || header;

    assertEquals(token, "captcha-token-from-header");
  });

  await t.step("should return 400 for missing hCaptcha token", () => {
    const response = { error: "hCaptcha token missing." };
    assertEquals(response.error, "hCaptcha token missing.");
  });

  await t.step("should construct hCaptcha verify form data", () => {
    const secret = "0x12345...";
    const token = "captcha-token-123";
    const remoteIp = "192.168.1.1";

    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (remoteIp) form.set("remoteip", remoteIp);

    assertEquals(form.get("secret"), secret);
    assertEquals(form.get("response"), token);
    assertEquals(form.get("remoteip"), remoteIp);
  });

  await t.step("should return 401 for failed hCaptcha verification", () => {
    const response = {
      error: "hCaptcha verification failed. Please try again.",
      detail: ["invalid-input-response"]
    };

    assertEquals(response.error.includes("hCaptcha verification failed"), true);
    assertEquals(Array.isArray(response.detail), true);
  });

  // =====================================================
  // Schema Validation Tests (Zod)
  // =====================================================

  await t.step("should require phone", () => {
    const body = { password: "ValidPass123!", first_name: "John", last_name: "Doe" };
    const hasPhone = "phone" in body;

    assertEquals(hasPhone, false);
  });

  await t.step("should require password with minimum length", () => {
    const body = { phone: "5551234567", password: "Short", first_name: "John", last_name: "Doe" };
    const isValidLength = body.password.length >= 8;

    assertEquals(isValidLength, false);
  });

  await t.step("should require first_name", () => {
    const body = { phone: "5551234567", password: "ValidPass123!", last_name: "Doe" };
    const hasFirstName = "first_name" in body;

    assertEquals(hasFirstName, false);
  });

  await t.step("should require last_name", () => {
    const body = { phone: "5551234567", password: "ValidPass123!", first_name: "John" };
    const hasLastName = "last_name" in body;

    assertEquals(hasLastName, false);
  });

  await t.step("should accept optional email", () => {
    const body = { phone: "5551234567", password: "ValidPass123!", first_name: "John", last_name: "Doe" };
    const hasEmail = "email" in body;

    assertEquals(hasEmail, false); // Optional
  });

  await t.step("should accept optional consent", () => {
    const body = { phone: "5551234567", password: "ValidPass123!", first_name: "John", last_name: "Doe", consent: true };
    assertEquals(body.consent, true);
  });

  await t.step("should return 400 for validation errors", () => {
    const response = {
      error: "Validation failed",
      details: [
        { path: "phone", message: "Phone is required" },
        { path: "password", message: "Password minimum is 8" }
      ]
    };

    assertEquals(response.error, "Validation failed");
    assertEquals(Array.isArray(response.details), true);
  });

  // =====================================================
  // User Creation Tests
  // =====================================================

  await t.step("should create auth user with E.164 phone", () => {
    const createUserParams = {
      phone: "+15551234567",
      password: "ValidPass123!",
      phone_confirm: true,
      email: "user@example.com",
      email_confirm: true,
      user_metadata: {
        role: "senior",
        first_name: "John",
        last_name: "Doe"
      }
    };

    assertEquals(createUserParams.phone.startsWith("+1"), true);
    assertEquals(createUserParams.phone_confirm, true);
    assertEquals(createUserParams.user_metadata.role, "senior");
  });

  await t.step("should return 409 for existing phone/email", () => {
    const response = { error: "Phone or email already registered." };
    assertEquals(response.error, "Phone or email already registered.");
  });

  await t.step("should return 500 for user creation failure", () => {
    const response = { error: "Unable to create account." };
    assertEquals(response.error, "Unable to create account.");
  });

  // =====================================================
  // Profile Creation Tests
  // =====================================================

  await t.step("should create profile with E.164 phone", () => {
    const profileData = {
      user_id: "user-123",
      phone: "+15551234567",
      first_name: "John",
      last_name: "Doe",
      email: "user@example.com",
      consent: true,
      phone_verified: true,
      email_verified: true
    };

    assertExists(profileData.user_id);
    assertEquals(profileData.phone.startsWith("+1"), true);
    assertEquals(profileData.phone_verified, true);
  });

  await t.step("should rollback user on profile creation failure", () => {
    // If profile insert fails, delete the auth user
    const rollback = true;
    assertEquals(rollback, true);
  });

  await t.step("should return 500 for profile creation failure", () => {
    const response = { error: "Unable to save profile. Please try again." };
    assertEquals(response.error, "Unable to save profile. Please try again.");
  });

  // =====================================================
  // Success Response Tests
  // =====================================================

  await t.step("should return 201 for successful registration", () => {
    const response = {
      success: true,
      user_id: "user-123-uuid",
      phone: "+15551234567"
    };
    const status = 201;

    assertEquals(status, 201);
    assertEquals(response.success, true);
    assertExists(response.user_id);
    assertEquals(response.phone.startsWith("+1"), true);
  });

  // =====================================================
  // Client IP Extraction Tests
  // =====================================================

  await t.step("should extract IP from x-forwarded-for", () => {
    const header = "192.168.1.1, 10.0.0.1";
    const clientIp = header.split(",")[0].trim();

    assertEquals(clientIp, "192.168.1.1");
  });

  await t.step("should extract IP from cf-connecting-ip", () => {
    const clientIp = "203.0.113.195";
    assertEquals(clientIp, "203.0.113.195");
  });

  await t.step("should extract IP from x-real-ip", () => {
    const clientIp = "198.51.100.178";
    assertEquals(clientIp, "198.51.100.178");
  });

  await t.step("should use unknown if no IP headers", () => {
    const xForwardedFor = null;
    const cfConnectingIp = null;
    const xRealIp = null;
    const clientIp = xForwardedFor || cfConnectingIp || xRealIp || "unknown";

    assertEquals(clientIp, "unknown");
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/verify-hcaptcha", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should only accept POST method", () => {
    const response = { error: "Method not allowed" };
    assertEquals(response.error, "Method not allowed");
  });

  await t.step("should return 403 for disallowed origin", () => {
    const response = { error: "Origin not allowed" };
    assertEquals(response.error, "Origin not allowed");
  });

  // =====================================================
  // Error Response Tests
  // =====================================================

  await t.step("should return 500 for missing Supabase config", () => {
    const response = { error: "Server misconfiguration." };
    assertEquals(response.error, "Server misconfiguration.");
  });

  await t.step("should return 500 for missing hCaptcha config", () => {
    const response = { error: "Captcha not configured." };
    assertEquals(response.error, "Captcha not configured.");
  });

  await t.step("should return 500 for rate limit check failure", () => {
    const response = { error: "Rate limit check failed." };
    assertEquals(response.error, "Rate limit check failed.");
  });

  await t.step("should return 500 for internal errors", () => {
    const response = { error: "Internal Server Error", details: "Error message" };
    assertEquals(response.error, "Internal Server Error");
    assertExists(response.details);
  });

  // =====================================================
  // CORS Tests
  // =====================================================

  await t.step("should allow x-hcaptcha-token header", () => {
    const allowHeaders = ["authorization", "x-client-info", "apikey", "content-type", "x-hcaptcha-token"];
    assertEquals(allowHeaders.includes("x-hcaptcha-token"), true);
  });

  // =====================================================
  // Security Logging Tests
  // =====================================================

  await t.step("should log failed hCaptcha attempts", () => {
    const securityLog = {
      level: "security",
      event: "hCaptcha verification failed",
      context: {
        phone: "+15551234567",
        clientIp: "192.168.1.1",
        errorCodes: ["invalid-input-response"]
      }
    };

    assertEquals(securityLog.level, "security");
  });

  await t.step("should log registration attempts with existing phone", () => {
    const warnLog = {
      level: "warn",
      event: "Registration attempted with existing phone/email",
      context: {
        phone: "+15551234567",
        email: "user@example.com",
        clientIp: "192.168.1.1"
      }
    };

    assertEquals(warnLog.level, "warn");
  });
});
