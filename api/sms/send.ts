// api/sms/send.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendSms } from "../_lib/twilio";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { to, body } = (req.body || {}) as { to?: string; body?: string };
    if (!to || !body) return res.status(400).json({ error: "to and body required" });
    const result = await sendSms(to, body);
    return res.status(200).json({ ok: true, sid: (result as any)?.sid ?? null });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "sms failed" });
  }
}
