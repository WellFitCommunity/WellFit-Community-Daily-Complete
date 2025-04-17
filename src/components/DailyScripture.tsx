import React from 'react';

const scriptures = [
  "This is the day the Lord has made; let us rejoice and be glad in it. – Psalm 118:24",
  "The Lord is my shepherd; I shall not want. – Psalm 23:1",
  "I can do all things through Christ who strengthens me. – Philippians 4:13",
  "Trust in the Lord with all your heart. – Proverbs 3:5",
  "Be strong and courageous. Do not be afraid. – Joshua 1:9",
  "Cast all your anxiety on Him because He cares for you. – 1 Peter 5:7",
  "The joy of the Lord is your strength. – Nehemiah 8:10"
];

const DailyScripture = () => {
  const today = new Date().getDay();
  return (
    <section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow">
      <h2 className="text-xl font-semibold text-[#003865] mb-2">Daily Scripture</h2>
      <p className="text-gray-800 italic">"{scriptures[today % scriptures.length]}"</p>
    </section>
  );
};

export default DailyScripture;
