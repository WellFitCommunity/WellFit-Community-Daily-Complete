// src/utils/sendSMS.ts

export async function sendSMS(to: string, message: string): Promise<unknown> {
  const response = await fetch('/api/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  });

  const data: unknown = await response.json();
  return data;
}
