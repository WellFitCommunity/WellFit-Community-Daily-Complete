import { serve } from "https://deno.land/std@0.181.0/http/server.ts";

serve(async (req) => {
  try {
    const { to, subject, text } = await req.json();

    const response = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("MAILERSEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: {
          email: Deno.env.get("SMTP_USERNAME"),
          name: "WellFit Community",
        },
        to: [{ email: to }],
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(`MailerSend error: ${err}`, { status: 500 });
    }

    return new Response("Email sent successfully!", { status: 200 });

  } catch (error) {
    return new Response(`Internal error: ${error.message}`, { status: 500 });
  }
});
