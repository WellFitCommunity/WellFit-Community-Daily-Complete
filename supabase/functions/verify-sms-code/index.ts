// Deno Edge Function (Supabase)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN  = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const VERIFY_SID         = Deno.env.get("TWILIO_VERIFY_SERVICE_SID")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "https://wellfitcommunity.live", // 🔒 replace with your domain in prod
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const { phone, code } = await req.json();

    // Validate phone number (E.164) and code (6 digits)
    if (!/^\+\d{10,15}$/.test(phone || "")) {
      return new Response(JSON.stringify({ error: "Invalid E.164 phone." }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (!/^\d{6}$/.test(code || "")) {
      return new Response(JSON.stringify({ error: "Code must be 6 digits." }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Twilio Verify check
    const resp = await fetch(
      `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, Code: code }).toString(),
      }
    );

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.status !== "approved") {
      return new Response(JSON.stringify({ error: "Invalid or expired code." }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Mark phone as verified in profiles table
    const { error } = await sb
      .from("profiles")
      .update({ phone_verified: true })
      .eq("phone", phone);

    if (error) {
      return new Response(JSON.stringify({ error: "DB update failed" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
