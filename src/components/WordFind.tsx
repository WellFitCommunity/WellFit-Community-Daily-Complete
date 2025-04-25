// src/components/WordFind.tsx
import React, { useEffect, useRef, useState } from 'react';
import Confetti from 'react-confetti';
import { dailyThemes } from '../data/wordThemes';

interface Point { r: number; c: number; }
const ROWS = 15;
const COLS = 15;
const DIRECTIONS: Point[] = [
  { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: -1, c: 0 },
  { r: 1, c: 1 }, { r: 1, c: -1 }, { r: -1, c: 1 }, { r: -1, c: -1 }
];

const WordFind: React.FC = () => {
  const [grid, setGrid] = useState<string[][]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [selection, setSelection] = useState<Point[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [celebrate, setCelebrate] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build and place words randomly on mount
  useEffect(() => {
    const themeData = dailyThemes[(new Date().getDate() - 1) % dailyThemes.length];
    const matrix: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
    const placedWords: string[] = [];

    // Shuffle and pick 10 words
    const list = [...themeData.words]
      .sort(() => Math.random() - 0.5)
      .slice(0, 10)
      .map(w => w.toUpperCase());

    // Place each word
    for (const word of list) {
      let placed = false;
      for (let tries = 0; tries < 100 && !placed; tries++) {
        const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        const r0 = Math.floor(Math.random() * ROWS);
        const c0 = Math.floor(Math.random() * COLS);
        const endR = r0 + dir.r * (word.length - 1);
        const endC = c0 + dir.c * (word.length - 1);
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;
        let conflict = false;
        for (let i = 0; i < word.length; i++) {
          const rr = r0 + dir.r * i;
          const cc = c0 + dir.c * i;
          if (matrix[rr][cc] && matrix[rr][cc] !== word[i]) { conflict = true; break; }
        }
        if (conflict) continue;
        for (let i = 0; i < word.length; i++) {
          const rr = r0 + dir.r * i;
          const cc = c0 + dir.c * i;
          matrix[rr][cc] = word[i];
        }
        placedWords.push(word);
        placed = true;
      }
      if (!placed) console.warn(`Could not place word ${word}`);
    }

    // Fill blanks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!matrix[r][c]) {
          matrix[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        }
      }
    }

    setGrid(matrix);
    setWords(placedWords);
  }, []);

  // Handle tap selection
  const handleTap = (r: number, c: number) => {
    const next = [...selection, { r, c }];
    const word = next.map(p => grid[p.r][p.c]).join('');
    // reset if not a valid prefix
    if (!words.some(w => w.startsWith(word))) {
      setSelection([]);
      return;
    }
    setSelection(next);
    // complete match
    if (words.includes(word)) {
      setFound(prev => {
        const updated = new Set(prev).add(word);
        if (updated.size === words.length) setCelebrate(true);
        return updated;
      });
      setSelection([]);
    }
  };

  const themeData = dailyThemes[(new Date().getDate() - 1) % dailyThemes.length];

  return (
    <div ref={containerRef} className="p-4 text-center">
      <h2 className="text-2xl font-bold mb-2">Word Find: {themeData.theme}</h2>
      <p className="text-sm mb-4">Tap letters in order. Wrong tap resets. Complete words strike through.</p>
      <div
        className="inline-grid gap-1"
        style={{ gridTemplateColumns: `repeat(${COLS}, 2.5rem)` }}
      >
        {grid.map((row, r) =>
          row.map((ch, c) => {
            const key = `${r},${c}`;
            const isSelected = selection.some(p => p.r === r && p.c === c);
            return (
              <div
                key={key}
                onClick={() => handleTap(r, c)}
                className={`w-10 h-10 flex items-center justify-center border cursor-pointer ${
                  isSelected ? 'bg-blue-500 text-white' : 'bg-white'
                }`}
              >
                {ch}
              </div>
            );
          })
        )}
      </div>
      <div className="mt-4 text-left inline-block">
        <h3 className="font-semibold mb-1">Find These Words:</h3>
        <ul>
          {words.map(w => (
            <li key={w} className={found.has(w) ? 'line-through text-green-600' : ''}>{w}</li>
          ))}
        </ul>
      </div>
      {celebrate && (
        <Confetti
          width={containerRef.current?.clientWidth || 300}
          height={containerRef.current?.clientHeight || 300}
        />
      )}
    </div>
  );
};

export default WordFind;

