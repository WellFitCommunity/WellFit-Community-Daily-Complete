import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { to, subject, text } = JSON.parse(event.body || '{}');
  if (!to || !subject || !text) {
    return { statusCode: 400, body: 'Missing parameters' };
  }

  const mailersendApiKey = process.env.MAILERSEND_API_KEY; // Set this in Netlify env vars!

  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mailersendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: { email: "info@thewellfitcommunity.org", name: "WellFit Community" }, // <-- UPDATED
      to: [{ email: to }],
      subject,
      text,
    }),
  });

  const data = await response.json();

  return {
    statusCode: response.status,
    body: JSON.stringify(data),
  };
};

export default handler;

