// api/email/send.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendEmail } from "../_lib/mailersend";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { to, subject, text, html } = req.body || {};
    if (!to || !subject) return res.status(400).json({ error: "to[] and subject required" });
    const result = await sendEmail({ to, subject, text, html });
    return res.status(200).json({ ok: true, id: (result as any)?.message_id ?? null });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "send failed" });
  }
}
