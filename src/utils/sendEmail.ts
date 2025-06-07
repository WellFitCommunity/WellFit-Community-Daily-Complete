/**
 * Sends any email via your API.
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param text - Plain text version (optional, but should be included)
 * @param html - HTML version (optional)
 * @returns true if sent successfully, otherwise throws an error
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<boolean> {
  // Use your unified Vercel route (change if your endpoint differs)
  const endpoint = "/api/send-email";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, text, html }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Unknown server error");
  }
  return true;
}


