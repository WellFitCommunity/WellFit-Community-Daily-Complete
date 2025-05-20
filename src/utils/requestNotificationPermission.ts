// src/requestNotificationPermission.ts
export const requestNotificationPermission = async (): Promise<void> => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Notifications not granted.');
      return;
    }

    const user_id = localStorage.getItem('user_id');
    if (!user_id) {
      alert('User not logged in.');
      return;
    }

    // Call Netlify Function to register for push notifications
    const res = await fetch('/.netlify/functions/registerPushToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }
    alert('Push token registered!');
  } catch (error) {
    console.error('Error requesting push token:', error);
    alert('Push notification setup failed.');
  }
};
