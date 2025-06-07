import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_PHONE_NUMBER!;
const client = twilio(accountSid, authToken);

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Missing phone' });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store code in Supabase
  const { error } = await supabase.from('phone_verifications').insert([
    { phone, code, expires_at: expiresAt.toISOString() }
  ]);
  if (error) {
    return res.status(500).json({ error: 'Could not save code' });
  }

  // Send SMS
  try {
    await client.messages.create({
      body: `Your WellFit code is: ${code}`,
      from: fromNumber,
      to: phone,
    });
    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Could not send SMS', details: err.message });
  }
}
