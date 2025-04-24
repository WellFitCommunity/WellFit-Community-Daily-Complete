import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { dailyThemes } from '../data/wordThemes';

interface Point {
  r: number;
  c: number;
}

const gridSize = 12;

const WordFind: React.FC = () => {
  const navigate = useNavigate();
  const [grid, setGrid] = useState<string[][]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [selection, setSelection] = useState<Point[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const day = new Date().getDate() % dailyThemes.length;
  const { theme, words: dailyWords } = dailyThemes[day];

  const generateGrid = useCallback(() => {
    const tempGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(''));
    const placedWords: string[] = [];

    for (const word of dailyWords) {
      const upper = word.toUpperCase();
      const len = upper.length;
      let placed = false;

      for (let attempt = 0; attempt < 50 && !placed; attempt++) {
        const dir = Math.floor(Math.random() * 8);
        const dr = [0, 1, 1, 1, 0, -1, -1, -1][dir];
        const dc = [1, 1, 0, -1, -1, -1, 0, 1][dir];
        const r = Math.floor(Math.random() * gridSize);
        const c = Math.floor(Math.random() * gridSize);

        if (
          r + dr * (len - 1) < 0 || r + dr * (len - 1) >= gridSize ||
          c + dc * (len - 1) < 0 || c + dc * (len - 1) >= gridSize
        ) continue;

        let canPlace = true;
        for (let i = 0; i < len; i++) {
          const ch = tempGrid[r + dr * i][c + dc * i];
          if (ch !== '' && ch !== upper[i]) {
            canPlace = false;
            break;
          }
        }

        if (canPlace) {
          for (let i = 0; i < len; i++) {
            tempGrid[r + dr * i][c + dc * i] = upper[i];
          }
          placedWords.push(upper);
          placed = true;
        }
      }
    }

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (!tempGrid[r][c]) {
          tempGrid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        }
      }
    }

    setGrid(tempGrid);
    setWords(placedWords);
  }, [dailyWords]);

  useEffect(() => {
    generateGrid();
  }, [generateGrid]);

  const handleMouseUp = useCallback(() => {
    if (selection.length > 0) {
      const coords = selection.map(p => `${p.r},${p.c}`);
      const word = coords.map(coord => {
        const [r, c] = coord.split(',').map(Number);
        return grid[r][c];
      }).join('');

      const reversed = word.split('').reverse().join('');
      if (words.includes(word) || words.includes(reversed)) {
        setFound(prev => new Set([...Array.from(prev), word, reversed]));
        if (found.size + 1 === words.length) setShowConfetti(true);
      }
      setSelection([]);
    }
    isDragging.current = false;
  }, [selection, grid, words, found]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const handleMouseDown = (r: number, c: number) => {
    isDragging.current = true;
    setSelection([{ r, c }]);
  };

  const handleMouseEnter = (r: number, c: number) => {
    if (!isDragging.current) return;
    setSelection(prev => [...prev, { r, c }]);
  };

  return (
    <div className="min-h-screen p-4 bg-white text-center" ref={containerRef}>
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-4 text-wellfit-blue underline text-sm"
      >
        ← Back to Dashboard
      </button>

      <h2 className="text-xl font-semibold text-wellfit-blue mb-2">🔤 Word Find: {theme}</h2>
      <div className="grid grid-cols-12 gap-1 select-none">
        {grid.map((row, r) =>
          row.map((letter, c) => {
            const isSelected = selection.some(p => p.r === r && p.c === c);
            const key = `${r},${c}`;
            return (
              <div
                key={key}
                className={`w-8 h-8 flex items-center justify-center border font-semibold rounded ${
                  isSelected ? 'bg-wellfit-green text-white' : 'bg-white text-gray-800'
                }`}
                onMouseDown={() => handleMouseDown(r, c)}
                onMouseEnter={() => handleMouseEnter(r, c)}
              >
                {letter}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2 text-wellfit-blue">🔍 Word Bank</h3>
        <ul className="grid grid-cols-2 gap-1 text-gray-800">
          {words.map((w, idx) => (
            <li key={idx} className={found.has(w) ? 'line-through text-wellfit-green' : ''}>
              {w}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Found {found.size} of {words.length} words
        </p>
        {showConfetti && (
          <>
            <Confetti
              width={containerRef.current?.clientWidth || 300}
              height={containerRef.current?.clientHeight || 300}
            />
            <p className="mt-4 text-center text-green-700 font-bold">
              🎉 You found them all! “Every step is progress.” 🎉
            </p>
          </>
        )}
      </div>
    </div>
  ); // ✅ closes the return block
}; // ✅ closes the WordFind function

export default WordFind;
