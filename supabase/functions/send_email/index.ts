// supabase/functions/send_email/index.ts
import { serve } from 'https://deno.land/std@0.181.0/http/server.ts';

serve(async (req) => {
  try {
    // 1) Parse
    const { to, subject, text, html } = await req.json();

    // 2) Read secrets
    const apiKey    = Deno.env.get('MAILERSEND_API_KEY')!;
    const fromEmail = Deno.env.get('MAILERSEND_FROM_EMAIL')!;

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
      const err = await resp.text();
      return new Response(`MailerSend error: ${err}`, { status: 500 });
    }

    return new Response('Email sent successfully', { status: 200 });
  } catch (e) {
    return new Response(`Internal error: ${e.message}`, { status: 500 });
  }
});


