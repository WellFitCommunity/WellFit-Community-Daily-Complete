// supabase/functions/sms-send-code/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors } from "../_shared/cors.ts";

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

/** E.164: +<country><nsn>, 7–15 digits total (excluding +), leading digit 1–9 */
const isE164 = (s: string) => /^\+[1-9]\d{6,14}$/.test(s);

Deno.serve(async (req: Request): Promise<Response> => {
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
  const VERIFY_SID         = getEnv("TWILIO_VERIFY_SERVICE_SID", "TWILIO_VERIFY_SID");

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !VERIFY_SID) {
    console.error("Missing Twilio envs", {
      hasSid: Boolean(TWILIO_ACCOUNT_SID),
      hasToken: Boolean(TWILIO_AUTH_TOKEN),
      hasVerify: Boolean(VERIFY_SID),
      sidPrefix: TWILIO_ACCOUNT_SID?.substring(0, 4),
      verifyPrefix: VERIFY_SID?.substring(0, 4),
    });
    return new Response(
      JSON.stringify({
        error: "SERVER_NOT_CONFIGURED",
        message: "Twilio credentials are missing. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID (or TWILIO_VERIFY_SID).",
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

    if (!phone || !isE164(phone)) {
      return new Response(
        JSON.stringify({ error: "INVALID_PHONE", message: "Provide E.164 format, e.g. +15551234567" }),
        { status: 400, headers },
      );
    }
    if (channel !== "sms" && channel !== "call") {
      return new Response(
        JSON.stringify({ error: "INVALID_CHANNEL", message: "channel must be 'sms' or 'call'" }),
        { status: 400, headers },
      );
    }

    // Twilio Verify: start verification with timeout and retry logic
    const url = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`;
    const form = new URLSearchParams({ To: phone, Channel: channel });

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
        console.log(`[sms-send-code] Attempt ${attempt}/${maxRetries} for ${phone}`);

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
        console.warn(`[sms-send-code] Attempt ${attempt} failed with status ${twilioResp.status}, will retry`);

      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const errName = err instanceof Error ? err.name : 'Unknown';
        console.error(`[sms-send-code] Attempt ${attempt} failed:`, lastError.message, `(${errName})`);

        // Don't wait after last attempt
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`[sms-send-code] Waiting ${delay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If all retries failed
    if (!twilioResp) {
      console.error("[sms-send-code] All retry attempts failed", {
        phone: phone,
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

    if (!twilioResp.ok) {
      // Map common Twilio failures to clearer messages
      let code = "TWILIO_ERROR";
      let status = 502;
      if (twilioResp.status === 401) { code = "TWILIO_AUTH_FAILED"; status = 502; }
      if (twilioResp.status === 403) { code = "TWILIO_FORBIDDEN"; status = 502; }
      if (twilioResp.status === 400) { code = "TWILIO_BAD_REQUEST"; status = 400; }
      if (twilioResp.status === 404) { code = "TWILIO_SERVICE_NOT_FOUND"; status = 502; }

      console.error("Twilio Verify error", {
        status: twilioResp.status,
        body: txt,
        phone: phone,
        channel: channel,
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
    let payload: any = {};
    try { payload = JSON.parse(txt); } catch { /* keep empty if not JSON */ }

    return new Response(
      JSON.stringify({
        ok: true,
        provider: "verify",
        status: payload?.status ?? "sent",
        sid: payload?.sid ?? null,
      }),
      { status: 200, headers },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("sms-send-code fatal", msg);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), { status: 500, headers });
  }
});
