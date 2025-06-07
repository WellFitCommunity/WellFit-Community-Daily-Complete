// src/components/SendSmsButton.jsx (or .js/.tsx)

import React, { useState } from 'react';

function SendSmsButton() {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');

  // Place your sendSMS function here:
  async function sendSMS(to, message) {
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message }),
    });
    const data = await response.json();
    if (data.success) {
      setStatus('Message sent!');
    } else {
      setStatus('Failed to send: ' + (data.error || 'Unknown error'));
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Recipient phone (+15551234567)"
        value={to}
        onChange={e => setTo(e.target.value)}
      />
      <input
        type="text"
        placeholder="Message"
        value={message}
        onChange={e => setMessage(e.target.value)}
      />
      <button onClick={() => sendSMS(to, message)}>
        Send SMS
      </button>
      <div>{status}</div>
    </div>
  );
}

export default SendSmsButton;
