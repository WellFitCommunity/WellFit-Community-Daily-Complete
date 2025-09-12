// api/_lib/mailersend.ts
const API_KEY = process.env.MAILERSEND_API_KEY!;
const FROM_EMAIL = process.env.MAILERSEND_FROM_EMAIL!;
const FROM_NAME = process.env.MAILERSEND_FROM_NAME || "WellFit";
const REPLY_TO = process.env.MAILERSEND_REPLY_TO || FROM_EMAIL;

if (!API_KEY || !FROM_EMAIL) {
  throw new Error("[MailerSend] Missing MAILERSEND_API_KEY or MAILERSEND_FROM_EMAIL");
}

type SendEmailOpts = {
  to: { email: string; name?: string }[];
  subject: string;
  text?: string;
  html?: string;
};

export async function sendEmail({ to, subject, text, html }: SendEmailOpts) {
  const r = await fetch("https://api.mailersend.com/v1/email", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: REPLY_TO },
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    }),
  });
  const body = await r.text().catch(() => "");
  if (!r.ok) throw new Error(`[MailerSend] ${r.status} ${r.statusText} ${body}`);
  try { return JSON.parse(body); } catch { return { ok: true }; }
}
