// api/_lib/twilio.ts
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN!;
const MSG_SERVICE = process.env.TWILIO_MESSAGING_SERVICE_SID || "";
const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || "";

if (!ACCOUNT_SID || !AUTH_TOKEN) {
  throw new Error("[Twilio] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
}
if (!MSG_SERVICE && !FROM_NUMBER) {
  throw new Error("[Twilio] Provide TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER");
}

const base = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
const authHeader = "Basic " + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");

export async function sendSms(to: string, body: string) {
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("Body", body);
  if (MSG_SERVICE) form.set("MessagingServiceSid", MSG_SERVICE);
  else form.set("From", FROM_NUMBER);

  const r = await fetch(base, { method: "POST", headers: { Authorization: authHeader }, body: form });
  const txt = await r.text().catch(() => "");
  if (!r.ok) throw new Error(`[Twilio] ${r.status} ${r.statusText} ${txt}`);
  try { return JSON.parse(txt); } catch { return { ok: true }; }
}
