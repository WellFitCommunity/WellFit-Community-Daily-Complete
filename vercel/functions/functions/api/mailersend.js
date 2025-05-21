export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { to, subject, text } =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  const mailersendApiKey = process.env.MAILERSEND_API_KEY; // Set in Vercel env vars

  if (!to || !subject || !text) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }
  if (!mailersendApiKey) {
    res.status(500).json({ error: 'Mailersend API key not configured' });
    return;
  }

  try {
    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mailersendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { email: "info@thewellfitcommunity.org", name: "WellFit Community" },
        to: [{ email: to }],
        subject,
        text,
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal error' });
  }
}
