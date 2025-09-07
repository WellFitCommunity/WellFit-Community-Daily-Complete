// Deno — Supabase Edge Function
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN  = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const VERIFY_SID         = Deno.env.get("TWILIO_VERIFY_SERVICE_SID")!;

// 🚨 For production, set this to your exact app domains
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { phone } = await req.json();
    if (!/^\+\d{10,15}$/.test(phone || "")) {
      return new Response(JSON.stringify({ error: "Invalid E.164 phone." }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const resp = await fetch(
      `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, Channel: "sms" }).toString(),
      }
    );

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: `Twilio error: ${t}` }), {
        status: 502, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});
