// supabase/functions/send_welcome_email/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Validate incoming payload
const welcomeEmailSchema = z.object({
  email: z.string().email("Invalid 'email' address."),
  full_name: z.string().min(1, "'full_name' is required."),
});
type WelcomeEmailPayload = z.infer<typeof welcomeEmailSchema>;

const SEND_EMAIL_FUNCTION_NAME = "send_email";

console.log("✅ send_welcome_email initialized. Will call:", SEND_EMAIL_FUNCTION_NAME);

serve(async (req) => {
  const headers = new Headers({ "Content-Type": "application/json" });

  try {
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

    // Build email content for the generic send_email function
    const subject = "Welcome to WellFit!";
    const text = [
      `Hi ${full_name},`,
      "",
      "Welcome to the WellFit Community! We're so glad you're here.",
      "If you have any questions, reach out anytime.",
      "",
      "— The WellFit Community Team",
    ].join("\n");

    const html = text.replace(/\n/g, "<br>");

    const emailPayload = { to: email, subject, text, html };

    // Invoke the existing send_email Edge Function using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`📨 Invoking ${SEND_EMAIL_FUNCTION_NAME} for: ${email}`);
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      SEND_EMAIL_FUNCTION_NAME,
      { body: emailPayload }
    );

    if (fnError) {
      // Extract best-effort detail
      const detail =
        (fnError as any)?.message ||
        (fnError as any)?.context?.error ||
        (fnError as any)?.context?.details ||
        "Failed to send welcome email via send_email.";
      console.error(`❌ ${SEND_EMAIL_FUNCTION_NAME} error:`, detail);
      return new Response(JSON.stringify({ error: detail }), { status: 502, headers });
    }

    console.log(`✅ ${SEND_EMAIL_FUNCTION_NAME} success for: ${email}`);
    return new Response(
      JSON.stringify({
        success: true,
        message: "Welcome email dispatched.",
        response: fnData ?? null,
      }),
      { status: 200, headers }
    );
  } catch (err: unknown) {
    const msg = (err as any)?.message ?? String(err);
    console.error("❌ send_welcome_email internal error:", msg);
    return new Response(JSON.stringify({ error: "Internal server error", details: msg }), {
      status: 500,
      headers,
    });
  }
});

