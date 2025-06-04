import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Support both string and object for req.body
  const { to, subject, text, html } =
    typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : req.body || {};

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ message: 'Missing parameters (to, subject, and text or html required)' });
  }

  const mailersendApiKey = process.env.MAILERSEND_API_KEY;
  if (!mailersendApiKey) {
    return res.status(500).json({ message: 'MailerSend API key is missing in environment.' });
  }

  // Build the payload for MailerSend
  const emailPayload: any = {
    from: { email: "info@thewellfitcommunity.org", name: "WellFit Community" },
    to: [{ email: to }],
    subject,
  };
  if (text) emailPayload.text = text;
  if (html) emailPayload.html = html;

  try {
    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mailersendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data.message || 'Failed to send email',
        details: data,
      });
    }

    return res.status(200).json({ success: true, message: 'Email sent', data });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'MailerSend API request failed',
      error: error.message || error.toString(),
    });
  }
}

