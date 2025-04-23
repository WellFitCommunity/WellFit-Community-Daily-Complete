import React from 'react';

const tips = [
  "Never share your passwords with anyone, even family.",
  "Use strong, unique passwords for each account.",
  "Enable two‑factor authentication wherever possible.",
  "Keep your operating system and apps up to date.",
  "Only download apps from official stores (App Store/Play Store).",
  "Don’t click on unexpected email links—hover to inspect URLs.",
  "Use a password manager to generate and store credentials.",
  "Lock your screen when you step away from your device.",
  "Beware of public Wi‑Fi—use a VPN if you must connect.",
  "Regularly back up your photos and documents.",
  "Use face or fingerprint unlock when available.",
  "Review app permissions—only grant what’s needed.",
  "Clear your browser cache and cookies monthly.",
  "Log out of sites when done, especially on shared devices.",
  "Turn on “Find My Device” in case of loss or theft.",
  "Be cautious of “too good to be true” pop‑up ads.",
  "Scan USB drives with antivirus before opening files.",
  "Use dark mode to reduce eye strain in low light.",
  "Adjust text size and contrast for easier reading.",
  "Organize apps into folders to declutter your home screen.",
  "Voice assistants can help hands‑free—set reminders by voice.",
  "Limit screen time before bed to improve sleep quality.",
  "Label cords and chargers to avoid mix‑ups.",
  "Use browser bookmarks for frequently visited sites.",
  "Mute notifications during meals or meetings.",
  "Set up emergency contacts in your phone settings.",
  "Take regular breaks when using screens for long periods.",
  "Learn basic keyboard shortcuts to save time.",
  "Keep your device’s Bluetooth off when not in use."
];

const TechTip: React.FC = () => {
  const today = new Date().getDate();
  return (
    <section className="bg-white border-2 border-wellfit-green p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold text-wellfit-blue mb-2">Tech Tip of the Day</h2>
      <p className="text-gray-800">{tips[today % tips.length]}</p>
    </section>
  );
};

export default TechTip;

