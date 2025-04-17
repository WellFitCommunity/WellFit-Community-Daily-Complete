import React from 'react';

const WordFind = () => {
  return (
    <section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow">
      <h2 className="text-xl font-semibold text-[#003865] mb-2">Word Find Game</h2>
      <p className="text-gray-700 mb-2">Challenge your mind with today’s puzzle!</p>
      <a
        href="https://games.aarp.org/games/daily-word-search"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#003865] underline"
      >
        Play Word Find on AARP ➜
      </a>
    </section>
  );
};

export default WordFind;
