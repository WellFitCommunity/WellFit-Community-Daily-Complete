// File: /api/send-sms.ts (Vercel) 
import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

const client = twilio(accountSid, authToken);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing recipient number or message' });
  }

  try {
    const twilioRes = await client.messages.create({
      body: message,
      from: fromNumber,
      to,
    });

    return res.status(200).json({ success: true, sid: twilioRes.sid });
  } catch (error: any) {
    console.error('Twilio error:', error);
    return res.status(500).json({ error: 'Failed to send SMS', details: error.message });
  }
}
