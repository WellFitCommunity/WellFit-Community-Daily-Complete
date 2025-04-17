import React from 'react';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning 🌞';
  if (hour < 18) return 'Good Afternoon ☀️';
  return 'Good Evening 🌙';
};

const WelcomePage = () => {
  return (
    <section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow">
      <h2 className="text-xl font-semibold text-[#003865] mb-2">{getGreeting()}</h2>
      <p className="text-gray-700">Welcome to your daily dose of wellness, wisdom, and fun! Let’s make today a great one.</p>
    </section>
  );
};

export default WelcomePage;
