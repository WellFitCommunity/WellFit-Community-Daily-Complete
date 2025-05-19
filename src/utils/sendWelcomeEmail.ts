// /src/utils/sendWelcomeEmail.ts

/**
 * Sends a welcome email to a new user.
 * @param to - The user's email address
 * @returns true if sent successfully, otherwise throws an error
 */
export async function sendWelcomeEmail(to: string): Promise<boolean> {
  // Get the endpoint from .env or fallback (replace the fallback if needed)
  const endpoint =
    process.env.REACT_APP_SUPABASE_EMAIL_ENDPOINT ||
    "https://YOUR-SUPABASE-REF.functions.supabase.co/mailersend-email";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      subject: "Welcome to WellFit",
      text: "Welcome to WellFit! We're glad to have you in the community.",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Unknown server error");
  }
  return true;
}

