// src/utils/sendSMS.js
export async function sendSMS(to: any, message: any) {
  const response = await fetch('/api/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  });
  const data = await response.json();
  return data;
}
