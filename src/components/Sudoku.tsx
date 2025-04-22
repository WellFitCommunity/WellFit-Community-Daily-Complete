// File: src/components/Sudoku.tsx
import React from 'react';

const Sudoku = () => (
  <section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow">
    <h2 className="text-xl font-semibold text-[#003865] mb-2">Sudoku Game</h2>
    <p className="text-gray-700 mb-2">Enjoy today’s puzzle!</p>
    <a href="https://www.websudoku.com/" target="_blank" rel="noopener noreferrer" className="text-[#003865] underline">
      Play Sudoku ➜
    </a>
  </section>
);

export default Sudoku;
