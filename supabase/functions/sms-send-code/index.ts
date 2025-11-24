// supabase/functions/sms-send-code/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { parsePhoneNumber, isValidPhoneNumber } from "https://esm.sh/libphonenumber-js@1.12.9";
import { cors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

// Allowed country codes for phone numbers
const ALLOWED_COUNTRIES = ['US', 'CA', 'GB', 'AU'] as const;

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

/**
 * Validate phone using libphonenumber-js
 */
function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!phone) {
    return { valid: false, error: "Phone number is required" };
  }

  try {
    if (!isValidPhoneNumber(phone, 'US')) {
      return { valid: false, error: "Invalid phone number format" };
    }

    const phoneNumber = parsePhoneNumber(phone, 'US');
    if (!ALLOWED_COUNTRIES.includes(phoneNumber.country as any)) {
      return { valid: false, error: `Phone numbers from ${phoneNumber.country} are not currently supported` };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Invalid phone number format" };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('sms-send-code', req);

  const { headers, allowed } = cors(req.headers.get("origin"), {
    methods: ["POST", "OPTIONS"],
    allowHeaders: ["authorization", "x-client-info", "apikey", "content-type"],
    maxAge: 600,
  });

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: allowed ? 204 : 403, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  // ---- Env (robust) ----
  const TWILIO_ACCOUNT_SID = getEnv("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN  = getEnv("TWILIO_AUTH_TOKEN");
  // Accept either naming convention for the Verify Service SID
  const VERIFY_SID         = getEnv("TWILIO_VERIFY_SERVICE_SID");

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !VERIFY_SID) {
    logger.error("Missing Twilio environment variables", {
      hasSid: Boolean(TWILIO_ACCOUNT_SID),
      hasToken: Boolean(TWILIO_AUTH_TOKEN),
      hasVerify: Boolean(VERIFY_SID),
      sidPrefix: TWILIO_ACCOUNT_SID?.substring(0, 4),
      verifyPrefix: VERIFY_SID?.substring(0, 4),
    });
    return new Response(
      JSON.stringify({
        error: "SERVER_NOT_CONFIGURED",
        message: "Twilio credentials are missing. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.",
        debug: {
          hasSid: Boolean(TWILIO_ACCOUNT_SID),
          hasToken: Boolean(TWILIO_AUTH_TOKEN),
          hasVerify: Boolean(VERIFY_SID),
        }
      }),
      { status: 500, headers },
    );
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const phone = body?.phone as string | undefined;
    const channel = (body?.channel as "sms" | "call" | undefined) ?? "sms";

    // Validate phone using libphonenumber-js
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "INVALID_PHONE", message: "Phone number is required" }),
        { status: 400, headers },
      );
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      return new Response(
        JSON.stringify({ error: "INVALID_PHONE", message: phoneValidation.error }),
        { status: 400, headers },
      );
    }

    // Normalize phone to E.164 format for Twilio consistency
    const phoneNumber = parsePhoneNumber(phone, 'US');
    const normalizedPhone = phoneNumber.number;

    // Log phone normalization for debugging (not PHI context)
    logger.info("Phone normalization for SMS send", {
      originalPhone: phone,
      normalizedPhone: normalizedPhone,
      phoneChanged: phone !== normalizedPhone,
      channel: channel
    });

    if (channel !== "sms" && channel !== "call") {
      return new Response(
        JSON.stringify({ error: "INVALID_CHANNEL", message: "channel must be 'sms' or 'call'" }),
        { status: 400, headers },
      );
    }

    // Twilio Verify: start verification with timeout and retry logic
    const url = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`;
    const form = new URLSearchParams({ To: normalizedPhone, Channel: channel });

    // Log what we're sending to Twilio
    logger.info("Creating Twilio verification", {
      normalizedPhone: normalizedPhone,
      channel: channel,
      verifySidPrefix: VERIFY_SID.substring(0, 4),
      accountSidPrefix: TWILIO_ACCOUNT_SID.substring(0, 4)
    });

    // Helper function to fetch with proper abort on timeout
    const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
    };

    // Retry logic: 3 attempts with exponential backoff (2s, 4s)
    let twilioResp: Response | null = null;
    let lastError: Error | null = null;
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`SMS send attempt ${attempt}/${maxRetries}`, { phone, attempt, maxRetries });

        twilioResp = await fetchWithTimeout(url, {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        }, 30000); // 30 second timeout

        // If successful or client error (4xx), don't retry
        if (twilioResp.ok || (twilioResp.status >= 400 && twilioResp.status < 500)) {
          break;
        }

        // For 5xx errors, retry
        lastError = new Error(`Twilio returned ${twilioResp.status}`);
        logger.warn(`SMS send attempt failed, retrying`, {
          attempt,
          status: twilioResp.status,
          phone,
          willRetry: attempt < maxRetries
        });

      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const errName = err instanceof Error ? err.name : 'Unknown';
        logger.error(`SMS send attempt failed with exception`, {
          attempt,
          error: lastError.message,
          errorType: errName,
          phone
        });

        // Don't wait after last attempt
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          logger.info(`Waiting before retry`, { delayMs: delay, nextAttempt: attempt + 1 });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If all retries failed
    if (!twilioResp) {
      logger.error("All SMS send retry attempts exhausted", {
        phone,
        lastError: lastError?.message,
        attempts: maxRetries
      });
      return new Response(
        JSON.stringify({
          error: "SMS_SEND_FAILED",
          message: "Failed to send SMS after multiple attempts. Please try again later.",
          details: lastError?.message || "Unknown error"
        }),
        { status: 503, headers },
      );
    }

    const txt = await twilioResp.text();

    // Log Twilio's response
    logger.info("Twilio Verification creation response", {
      status: twilioResp.status,
      ok: twilioResp.ok,
      normalizedPhone: normalizedPhone,
      responseBody: txt
    });

    if (!twilioResp.ok) {
      // Map common Twilio failures to clearer messages
      let code = "TWILIO_ERROR";
      let status = 502;
      if (twilioResp.status === 401) { code = "TWILIO_AUTH_FAILED"; status = 502; }
      if (twilioResp.status === 403) { code = "TWILIO_FORBIDDEN"; status = 502; }
      if (twilioResp.status === 400) { code = "TWILIO_BAD_REQUEST"; status = 400; }
      if (twilioResp.status === 404) { code = "TWILIO_SERVICE_NOT_FOUND"; status = 502; }

      logger.error("Twilio Verify API error", {
        status: twilioResp.status,
        errorCode: code,
        responseBody: txt,
        originalPhone: phone,
        normalizedPhone: normalizedPhone,
        channel,
        verifySidPrefix: VERIFY_SID.substring(0, 4),
        accountSidPrefix: TWILIO_ACCOUNT_SID.substring(0, 4)
      });
      return new Response(
        JSON.stringify({
          error: code,
          provider_status: twilioResp.status,
          details: txt,
          help: code === "TWILIO_AUTH_FAILED" ? "Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN" :
                code === "TWILIO_SERVICE_NOT_FOUND" ? "Check TWILIO_VERIFY_SERVICE_SID (must start with VA)" :
                code === "TWILIO_BAD_REQUEST" ? "Check phone number format (E.164 required)" :
                "Check Twilio account status and credentials"
        }),
        { status, headers },
      );
    }

    // Successful start (Twilio returns JSON)
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(txt); } catch { /* keep empty if not JSON */ }

    logger.info("SMS verification code sent successfully", {
      originalPhone: phone,
      normalizedPhone: normalizedPhone,
      channel,
      verificationStatus: payload?.status ?? "sent",
      verificationSid: payload?.sid ?? null,
      verificationTo: payload?.to ?? null // This shows what Twilio recorded as the phone
    });

    return new Response(
      JSON.stringify({
        ok: true,
        provider: "verify",
        verification_status: payload?.status ?? "sent",
        verification_sid: payload?.sid ?? null,
      }),
      { status: 200, headers },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in sms-send-code", { error: msg });
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), { status: 500, headers });
  }
});
