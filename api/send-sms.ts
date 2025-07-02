// File: /api/send-sms.ts (Vercel) 
import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_PHONE_NUMBER!;
const internalApiKey = process.env.INTERNAL_API_KEY; // For securing the endpoint

const client = twilio(accountSid, authToken);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for internal API key
  const providedApiKey = req.headers['x-internal-api-key'];
  if (!internalApiKey || providedApiKey !== internalApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { to, message } =
    typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : req.body || {};

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
