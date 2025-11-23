// supabase/functions/send_welcome_email/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { cors } from "../_shared/cors.ts";

// Validate incoming payload
const welcomeEmailSchema = z.object({
  email: z.string().email("Invalid 'email' address."),
  full_name: z.string().min(1, "'full_name' is required."),
});
type WelcomeEmailPayload = z.infer<typeof welcomeEmailSchema>;

const MAILERSEND_API_KEY = Deno.env.get("MAILERSEND_API_KEY");
const MAILERSEND_FROM_EMAIL = Deno.env.get("MAILERSEND_FROM_EMAIL");
const MAILERSEND_FROM_NAME = Deno.env.get("MAILERSEND_FROM_NAME") || "WellFit Community";
const WELCOME_TEMPLATE_ID = "v69oxl5w0zzl785k";

console.log("✅ send_welcome_email initialized with template:", WELCOME_TEMPLATE_ID);

serve(async (req) => {
  const { headers, allowed } = cors(req.headers.get('origin'), {
    methods: ['POST','OPTIONS'],
  });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (!allowed) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers });
  if (req.method !== 'POST')
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    if (!MAILERSEND_API_KEY || !MAILERSEND_FROM_EMAIL) {
      return new Response(JSON.stringify({ error: "Email server configuration error." }), { status: 500, headers });
    }

    // Parse JSON body safely
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
    }

    // Validate payload
    const parsed = welcomeEmailSchema.safeParse(rawBody);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join(".") || "(root)",
        message: e.message,
      }));
      return new Response(JSON.stringify({ error: "Validation failed", details: errors }), {
        status: 400,
        headers,
      });
    }

    const { email, full_name } = parsed.data as WelcomeEmailPayload;

    // Send email using MailerSend template
    const mailersendPayload = {
      from: {
        email: MAILERSEND_FROM_EMAIL,
        name: MAILERSEND_FROM_NAME
      },
      to: [{
        email: email,
        name: full_name
      }],
      template_id: WELCOME_TEMPLATE_ID,
      subject: "Welcome to WellFit Community!",
      variables: [
        {
          email: email,
          substitutions: [
            {
              var: "full_name",
              value: full_name
            }
          ]
        }
      ]
    };

    console.log(`📨 Sending welcome email template ${WELCOME_TEMPLATE_ID}`);

    const resp = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MAILERSEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mailersendPayload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      // PHI: Email addresses not logged per HIPAA - error logged without details
      console.error(`❌ MailerSend error: Status ${resp.status}`);
      return new Response(JSON.stringify({
        error: 'Failed to send welcome email via MailerSend.',
        details: errText.substring(0, 500)
      }), { status: resp.status, headers });
    }

    console.log('✅ Welcome email template sent successfully');
    return new Response(
      JSON.stringify({
        success: true,
        message: "Welcome email sent with template.",
        template_id: WELCOME_TEMPLATE_ID
      }),
      { status: 200, headers }
    );
  } catch (err: unknown) {
    const msg = (err as any)?.message ?? String(err);
    // PHI: Error message sanitized - may contain email addresses
    console.error("❌ send_welcome_email internal error");
    return new Response(JSON.stringify({ error: "Internal server error", details: msg }), {
      status: 500,
      headers,
    });
  }
});

