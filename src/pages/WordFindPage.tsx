// src/components/WordFind.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Confetti from 'react-confetti';
import { dailyThemes } from '../data/wordThemes';

interface Point { r: number; c: number; }
const ROWS = 10;
const COLS = 12;
const DIRECTIONS: Point[] = [
  { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: -1, c: 0 },
  { r: 1, c: 1 }, { r: 1, c: -1 }, { r: -1, c: 1 }, { r: -1, c: -1 }
];

function same(p: Point, q: Point) { return p.r === q.r && p.c === q.c; }
function add(p: Point, d: Point): Point { return { r: p.r + d.r, c: p.c + d.c }; }
function clampDir(dr: number) { return dr === 0 ? 0 : dr > 0 ? 1 : -1; }
function dirFromTo(a: Point, b: Point): Point {
  return { r: clampDir(b.r - a.r), c: clampDir(b.c - a.c) };
}
function toKey(p: Point) { return `${p.r},${p.c}`; }

const WordFind: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const todayIndex = useMemo(() => (new Date().getDate() - 1) % dailyThemes.length, []);
  const themeData = dailyThemes[todayIndex];

  const [grid, setGrid] = useState<string[][]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [selection, setSelection] = useState<Point[]>([]);
  const [lockedDir, setLockedDir] = useState<Point | null>(null);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [celebrate, setCelebrate] = useState(false);

  // Build puzzle
  useEffect(() => {
    const matrix: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
    const placedWords: string[] = [];

    const list = [...themeData.words]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8)
      .map(w => w.toUpperCase());

    for (const word of list) {
      let placed = false;
      for (let tries = 0; tries < 120 && !placed; tries++) {
        const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        const r0 = Math.floor(Math.random() * ROWS);
        const c0 = Math.floor(Math.random() * COLS);
        const endR = r0 + dir.r * (word.length - 1);
        const endC = c0 + dir.c * (word.length - 1);
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;

        // Check conflict/overlap compatibility
        let ok = true;
        for (let i = 0; i < word.length; i++) {
          const rr = r0 + dir.r * i;
          const cc = c0 + dir.c * i;
          const existing = matrix[rr][cc];
          if (existing && existing !== word[i]) { ok = false; break; }
        }
        if (!ok) continue;

        for (let i = 0; i < word.length; i++) {
          const rr = r0 + dir.r * i;
          const cc = c0 + dir.c * i;
          matrix[rr][cc] = word[i];
        }
        placedWords.push(word);
        placed = true;
      }
    }

    // Fill empties
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!matrix[r][c]) {
          matrix[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        }
      }
    }

    setGrid(matrix);
    setWords(placedWords);
  }, [themeData.words]);

  // Helpers to evaluate current selection text
  const selectionText = useMemo(() => {
    if (selection.length === 0) return '';
    return selection.map(p => grid[p.r]?.[p.c] ?? '').join('');
  }, [selection, grid]);
  const selectionTextRev = useMemo(() => selectionText.split('').reverse().join(''), [selectionText]);

  const startsAny = (prefix: string) =>
    words.some(w => w.startsWith(prefix)) || words.some(w => w.startsWith(prefix.split('').reverse().join('')));
  const equalsAny = (s: string) =>
    words.includes(s) || words.includes(s.split('').reverse().join(''));

  const resetSelection = (seed?: Point) => {
    setSelection(seed ? [seed] : []);
    setLockedDir(null);
  };

  const handleTap = (r: number, c: number) => {
    const p: Point = { r, c };
    const ch = grid[r]?.[c];
    if (!ch) return;

    // If re-clicking the same cell as last, ignore
    if (selection.length > 0 && same(selection[selection.length - 1], p)) return;

    // First tap starts a new path
    if (selection.length === 0) {
      setSelection([p]);
      setLockedDir(null);
      return;
    }

    // Determine/validate direction
    let dir = lockedDir;
    const last = selection[selection.length - 1];
    const step = dirFromTo(last, p);

    // Must be adjacent
    if (Math.abs(p.r - last.r) > 1 || Math.abs(p.c - last.c) > 1) {
      // Not adjacent → start over from this cell
      resetSelection(p);
      return;
    }

    // Lock direction on 2nd tap
    if (!dir && selection.length === 1) {
      // Disallow staying on same cell (0,0)
      if (step.r === 0 && step.c === 0) return;
      dir = step;
      setLockedDir(dir);
    }

    // If direction is locked, the new point must be exactly next along that direction
    if (dir) {
      const expected = add(last, dir);
      if (!same(expected, p)) {
        // Wrong direction → restart from this cell
        resetSelection(p);
        return;
      }
    }

    // Provisional next selection
    const nextSel = [...selection, p];
    const candidate = nextSel.map(q => grid[q.r][q.c]).join('');

    // Check prefix (forward or backward)
    if (!startsAny(candidate)) {
      // If broken, restart from this cell
      resetSelection(p);
      return;
    }

    // Accept this step
    setSelection(nextSel);

    // Check full match
    if (equalsAny(candidate)) {
      setFound(prev => {
        const word = words.find(w => w === candidate || w === candidate.split('').reverse().join(''));
        if (!word || prev.has(word)) return prev;
        const updated = new Set(prev);
        updated.add(word);
        if (updated.size === words.length) setCelebrate(true);
        return updated;
      });
      // Start fresh path after a find
      resetSelection();
    }
  };

  return (
    <div ref={containerRef} className="p-2 sm:p-4 w-full max-w-2xl mx-auto text-center">
      <h2 className="text-2xl font-bold mb-2">{themeData.theme} Word Find</h2>
      <p className="text-sm mb-4">Tap letters to select in a straight line. Backwards works too.</p>

      {/* Responsive Grid */}
      <div className="overflow-x-auto flex justify-center w-full">
        <div
          className="inline-grid gap-1 w-full select-none"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(28px, 1fr))`,
            maxWidth: 480,
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
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
                    text-xs sm:text-base md:text-lg transition-colors
                    ${isSel ? 'bg-blue-500 text-white' : 'bg-white text-black'}
                  `}
                  style={{
                    minWidth: 28,
                    minHeight: 28,
                    width: '100%',
                    aspectRatio: '1 / 1',
                  }}
                  role="button"
                  aria-label={`Letter ${ch} at row ${r + 1}, column ${c + 1}`}
                >
                  {ch}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Horizontal Word Bank, responsive & scrollable */}
      <div className="mt-4 flex flex-col items-center w-full">
        <h3 className="font-semibold mb-1">Words:</h3>
        <div
          className="flex flex-row gap-2 overflow-x-auto pb-2 w-full max-w-xl"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {words.map(w => {
            const isFound = found.has(w);
            return (
              <div
                key={w}
                className={`px-3 py-1 rounded-full border text-base md:text-lg ${
                  isFound
                    ? 'bg-green-100 text-green-600 line-through border-green-400'
                    : 'bg-gray-100 text-gray-800 border-gray-300'
                }`}
                style={{ minWidth: 75, textAlign: 'center', scrollSnapAlign: 'center' }}
              >
                {w}
              </div>
            );
          })}
        </div>
      </div>

      {celebrate && (
        <Confetti
          width={containerRef.current?.clientWidth || 320}
          height={containerRef.current?.clientHeight || 480}
        />
      )}
    </div>
  );
};

export default WordFind;
