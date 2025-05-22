export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  const { to, subject, text } = req.body || {};
  if (!to || !subject || !text) {
    res.status(400).json({ message: 'Missing parameters' });
    return;
  }

  const mailersendApiKey = process.env.MAILERSEND_API_KEY;

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
}
