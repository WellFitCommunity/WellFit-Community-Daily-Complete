import React from 'react';

const tips = [
  "Never share your passwords with anyone, even family.",
  "Use strong passwords with a mix of letters, numbers, and symbols.",
  "Don’t click links in emails unless you’re sure who sent them.",
  "Install updates on your phone and tablet when prompted.",
  "Use fingerprint or face ID if your device allows it.",
  "Only download apps from the App Store or Google Play.",
  "Turn on two-factor authentication for extra security."
];

const TechTip = () => {
  const today = new Date().getDay();
  return (
    <section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow">
      <h2 className="text-xl font-semibold text-[#003865] mb-2">Tech Tip of the Day</h2>
      <p className="text-gray-800">{tips[today % tips.length]}</p>
    </section>
  );
};

export default TechTip;
