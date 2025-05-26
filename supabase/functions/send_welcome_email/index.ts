import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const MAILERSEND_API_KEY = Deno.env.get("MAILERSEND_API_KEY");
console.log("✅ MAILERSEND_API_KEY loaded:", MAILERSEND_API_KEY?.substring(0, 10));

serve(async (req) => {
  try {
    const { email, full_name } = await req.json();

    if (!email || !full_name) {
      return new Response("Missing email or full name", { status: 400 });
    }

    const response = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MAILERSEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: {
          email: "welcome@thewellfitcommunity.org",
          name: "WellFit Community",
        },
        to: [{ email }],
        subject: "Welcome to WellFit!",
        text: `Hi ${full_name},\n\nWelcome to the WellFit Community! We're so glad you're here. If you have any questions, reach out anytime.`,
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify({ status: "sent", response: data }), {
      status: 200,
    });
  } catch (error) {
    console.error("❌ Error sending welcome email:", error);
    return new Response("Internal error", { status: 500 });
  }
});
