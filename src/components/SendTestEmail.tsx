import { useState } from 'react';

const SendTestEmailButton: React.FC = () => {
  const [status, setStatus] = useState<string>('');

  async function sendTestEmail() {
    setStatus('Sending...');
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'mdleblanc@gmail.com', // <--- Your real email here
        subject: 'Production Test Email',
        text: 'This is a test email sent from WellFit production code.',
        // html: '<strong>This is a test email sent from WellFit production code.</strong>',
      }),
    });
    const data = await res.json();
    setStatus(data.success ? 'Email sent!' : 'Failed: ' + (data.message || 'Unknown error'));
  }

  return (
    <div>
      <button onClick={sendTestEmail}>Send Test Email</button>
      <div>{status}</div>
    </div>
  );
};

export default SendTestEmailButton;
