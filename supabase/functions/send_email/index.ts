// supabase/functions/send_email/index.ts
import { serve } from 'https://deno.land/std@0.181.0/http/server.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { cors } from "../_shared/cors.ts";

const sendEmailSchema = z.object({
  to: z.string().email("Invalid 'to' email address."),
  subject: z.string().min(1, "'subject' is required."),
  text: z.string().min(1, "'text' content is required."),
  html: z.string().optional(),
});

type SendEmailPayload = z.infer<typeof sendEmailSchema>;

serve(async (req) => {
  const { headers, allowed } = cors(req.headers.get('origin'), {
    methods: ['POST','OPTIONS'],
  });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (!allowed) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers });
  if (req.method !== 'POST')
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    const rawBody = await req.json();
    const validationResult = sendEmailSchema.safeParse(rawBody);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }));
      return new Response(JSON.stringify({ error: "Validation failed", details: errors }), { status: 400, headers });
    }

    const { to, subject, text, html } = validationResult.data;
    const apiKey = Deno.env.get('MAILERSEND_API_KEY');
    const fromEmail = Deno.env.get('MAILERSEND_FROM_EMAIL');
    if (!apiKey || !fromEmail) {
      return new Response(JSON.stringify({ error: "Email server configuration error." }), { status: 500, headers });
    }

    const resp = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { email: fromEmail, name: 'WellFit Community' },
        to: [{ email: to }],
        subject, text, ...(html ? { html } : {}),
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: 'Failed to send email via provider.', details: errText.substring(0, 500) }), { status: resp.status, headers });
    }

    return new Response(JSON.stringify({ success: true, message: 'Email sent successfully.'}), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: (e as Error).message }), { status: 500, headers });
  }
});
