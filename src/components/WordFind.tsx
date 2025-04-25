// src/components/WordFind.tsx
import React, { useEffect, useRef, useState } from 'react';
import Confetti from 'react-confetti';
import { dailyThemes } from '../data/wordThemes';

interface Point { r: number; c: number; }
const ROWS = 10;
const COLS = 12;
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

    // shuffle and pick 8 words
    const list = [...themeData.words]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8)
      .map(w => w.toUpperCase());

    // place words
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
    }
    // fill blanks
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!matrix[r][c]) matrix[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    setGrid(matrix);
    setWords(placedWords);
  }, []);

  // Handle tap selection
  const handleTap = (r: number, c: number) => {
    const next = [...selection, { r, c }];
    const word = next.map(p => grid[p.r][p.c]).join('');
    if (!words.some(w => w.startsWith(word))) { setSelection([]); return; }
    setSelection(next);
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
      <h2 className="text-2xl font-bold mb-2">{themeData.theme} Word Find</h2>
      <p className="text-sm mb-4">Tap letters to select. Incorrect taps reset.</p>

      {/* Responsive grid for mobile */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {grid.map((row, r) =>
            row.map((ch, c) => {
              const key = `${r},${c}`;
              const isSel = selection.some(p => p.r === r && p.c === c);
              return (
                <div
                  key={key}
                  onClick={() => handleTap(r, c)}
                  className={`border rounded cursor-pointer flex items-center justify-center
                    w-[calc(100vw/${COLS}-8px)] h-[calc(100vw/${COLS}-8px)] sm:w-8 sm:h-8
                    text-xs sm:text-base
                    ${isSel ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}
                >
                  {ch}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Word list */}
      <div className="mt-4 text-left mx-auto" style={{ maxWidth: '10rem' }}>
        <h3 className="font-semibold mb-1">Words:</h3>
        <ul>
          {words.map(w => (
            <li key={w} className={found.has(w) ? 'line-through text-green-600' : ''}>
              {w}
            </li>
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
