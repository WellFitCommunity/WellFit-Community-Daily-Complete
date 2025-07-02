// supabase/functions/send_email/index.ts
import { serve } from 'https://deno.land/std@0.181.0/http/server.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Zod schema for send_email payload
const sendEmailSchema = z.object({
  to: z.string().email("Invalid 'to' email address."),
  subject: z.string().min(1, "'subject' is required."),
  text: z.string().min(1, "'text' content is required."),
  html: z.string().optional(),
});

type SendEmailPayload = z.infer<typeof sendEmailSchema>;

serve(async (req) => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  try {
    // 1) Parse and validate
    const rawBody = await req.json();
    const validationResult = sendEmailSchema.safeParse(rawBody);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }));
      return new Response(
        JSON.stringify({ error: "Validation failed", details: errors }),
        { status: 400, headers }
      );
    }
    const { to, subject, text, html } = validationResult.data;

    // 2) Read secrets
    const apiKey = Deno.env.get('MAILERSEND_API_KEY');
    const fromEmail = Deno.env.get('MAILERSEND_FROM_EMAIL');

    if (!apiKey || !fromEmail) {
      console.error("Missing MAILERSEND_API_KEY or MAILERSEND_FROM_EMAIL from environment variables.");
      return new Response(JSON.stringify({ error: "Email server configuration error." }), { status: 500, headers });
    }

    // 3) Call MailerSend
    const resp = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from: { email: fromEmail, name: 'WellFit Community' },
        to:   [{ email: to }],
        subject,
        text,
        ...(html ? { html } : {}),
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`MailerSend API error: ${resp.status}, ${errText}`);
      return new Response(JSON.stringify({ error: 'Failed to send email via provider.', details: errText.substring(0, 500) }), { status: resp.status, headers });
    }

    return new Response(JSON.stringify({ success: true, message: 'Email sent successfully.'}), { status: 200, headers });
  } catch (e) {
    console.error("Internal error in send_email function:", e.message);
    return new Response(JSON.stringify({ error: 'Internal server error', details: e.message }), { status: 500, headers });
  }
});


