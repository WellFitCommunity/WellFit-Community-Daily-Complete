import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const API_KEY  = Deno.env.get("MAILERSEND_API_KEY")!;
const FROM     = Deno.env.get("MAILERSEND_SENDER_EMAIL")!;
const FROMNAME = Deno.env.get("MAILERSEND_SENDER_NAME") || "WellFit Community";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SendReq = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  try {
    const body = (await req.json()) as SendReq;
    if (!body?.to || !body?.subject || (!body.html && !body.text)) {
      return new Response(JSON.stringify({ error: "Missing to/subject and html or text." }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { email: FROM, name: FROMNAME },
        to: [{ email: body.to }],
        subject: body.subject,
        html: body.html,
        text: body.text,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: t }), {
        status: 502, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Unknown error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
