// File: src/components/Crossword.tsx
import React from 'react';

const Crossword = () => (
  <section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow">
    <h2 className="text-xl font-semibold text-[#003865] mb-2">Crossword Puzzle</h2>
    <p className="text-gray-700 mb-2">Test your vocabulary!</p>
    <a href="https://www.theguardian.com/crosswords/series/quick" target="_blank" rel="noopener noreferrer" className="text-[#003865] underline">
      Play Crossword ➜
    </a>
  </section>
);

export default Crossword;
