// api/email/send.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendEmail } from "../_lib/mailersend";
import { getServerSession } from "../_lib/supabase-auth";
import { INTERNAL_API_KEY } from "../_lib/env";

function validateInternalApiKey(req: VercelRequest): boolean {
  // Check X-Internal-API-Key header
  const headerKey = req.headers['x-internal-api-key'] as string;
  if (headerKey && headerKey === INTERNAL_API_KEY) {
    return true;
  }

  // Check Authorization: Bearer format
  const authHeader = req.headers['authorization'] as string;
  if (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 7) {
    const bearerKey = authHeader.substring(7); // Remove "Bearer " prefix
    if (bearerKey === INTERNAL_API_KEY) {
      return true;
    }
  }

  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Option 1: Require valid session (user must be logged in)
    // Convert VercelRequest to standard Request
    const request = new Request(req.url || '', {
      method: req.method,
      headers: new Headers(req.headers as Record<string, string>),
    });
    const session = await getServerSession(request);
    // Option 2: Allow internal API key bypass
    const hasValidApiKey = validateInternalApiKey(req);

    if (!session && !hasValidApiKey) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Provide valid user session or X-Internal-API-Key header"
      });
    }

    const { to, subject, text, html } = req.body || {};
    if (!to || !subject) return res.status(400).json({ error: "to[] and subject required" });

    const result = await sendEmail({ to, subject, text, html });
    return res.status(200).json({ ok: true, id: (result as any)?.message_id ?? null });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "send failed" });
  }
}
