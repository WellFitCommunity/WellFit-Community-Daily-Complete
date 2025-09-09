// supabase/functions/ms-send/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors } from "../_shared/cors.ts";

const API_KEY  = Deno.env.get("MAILERSEND_API_KEY")!;
const FROM     = Deno.env.get("MAILERSEND_SENDER_EMAIL")!;
const FROMNAME = Deno.env.get("MAILERSEND_SENDER_NAME") || "WellFit Community";

type SendReq = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

Deno.serve(async (req) => {
  const { headers, allowed } = cors(req.headers.get("origin"), {
    methods: ['POST','OPTIONS'],
  });

  // Preflight
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  if (!allowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const body = (await req.json()) as SendReq;
    if (!body?.to || !body?.subject || (!body.html && !body.text)) {
      return new Response(JSON.stringify({ error: "Missing to/subject and html or text." }), {
        status: 400, headers,
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
      return new Response(JSON.stringify({ error: t }), { status: 502, headers });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Unknown error" }), {
      status: 500, headers,
    });
  }
});
