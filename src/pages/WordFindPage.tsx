// src/components/WordFind.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Confetti from 'react-confetti';
import { dailyThemes } from '../data/wordThemes';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { saveWordGameResult } from '../services/engagementTracking';

interface Point { r: number; c: number; }
const ROWS = 12;
const COLS = 10;
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
  const supabase = useSupabaseClient();
  const user = useUser();

  const todayIndex = useMemo(() => (new Date().getDate() - 1) % dailyThemes.length, []);
  const themeData = dailyThemes[todayIndex];

  const [grid, setGrid] = useState<string[][]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [selection, setSelection] = useState<Point[]>([]);
  const [lockedDir, setLockedDir] = useState<Point | null>(null);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [celebrate, setCelebrate] = useState(false);
  const [gamesPlayedToday, setGamesPlayedToday] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [completionTime, setCompletionTime] = useState<number | null>(null);

  const GAMES_PLAYED_KEY = 'wordFindGamesPlayed';
  const TIME_TRACKING_KEY = 'wordFindTimeTracking';

  // Check games played today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(GAMES_PLAYED_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === today) {
        setGamesPlayedToday(data.count || 0);
      } else {
        setGamesPlayedToday(0);
        localStorage.setItem(GAMES_PLAYED_KEY, JSON.stringify({ date: today, count: 0 }));
      }
    } else {
      localStorage.setItem(GAMES_PLAYED_KEY, JSON.stringify({ date: today, count: 0 }));
    }
  }, []);

  // Build puzzle
  useEffect(() => {
    setStartTime(Date.now()); // Start tracking time when puzzle is built
    setCompletionTime(null);
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

        // Check if game is complete
        if (updated.size === words.length) {
          setCelebrate(true);

          // Calculate completion time
          if (startTime) {
            const timeInSeconds = Math.round((Date.now() - startTime) / 1000);
            setCompletionTime(timeInSeconds);

            // Save time tracking to localStorage
            try {
              const today = new Date().toISOString().split('T')[0];
              const stored = localStorage.getItem(TIME_TRACKING_KEY);
              let timeData: any = {};

              if (stored) {
                timeData = JSON.parse(stored);
              }

              if (!timeData[today]) {
                timeData[today] = [];
              }

              timeData[today].push({
                timestamp: new Date().toISOString(),
                completionTime: timeInSeconds,
                wordsFound: updated.size,
                theme: themeData.theme
              });

              localStorage.setItem(TIME_TRACKING_KEY, JSON.stringify(timeData));

              // Update games played count
              const gamesStored = localStorage.getItem(GAMES_PLAYED_KEY);
              if (gamesStored) {
                const gamesData = JSON.parse(gamesStored);
                if (gamesData.date === today) {
                  const newCount = (gamesData.count || 0) + 1;
                  setGamesPlayedToday(newCount);
                  localStorage.setItem(GAMES_PLAYED_KEY, JSON.stringify({ date: today, count: newCount }));
                }
              }

              // ✅ SAVE TO DATABASE (the fix!)
              if (user?.id) {
                saveWordGameResult(supabase, {
                  user_id: user.id,
                  started_at: new Date(startTime).toISOString(),
                  completed_at: new Date().toISOString(),
                  completion_time_seconds: timeInSeconds,
                  words_found: updated.size,
                  total_words: words.length,
                  hints_used: 0,
                  difficulty_level: themeData.theme || 'medium',
                  completion_status: 'completed',
                  puzzle_id: `${today}-${todayIndex}`
                }).catch((error) => {
                  console.error('Failed to save word game result to database:', error);
                });
              }
            } catch (error) {
              console.error('Failed to save time tracking:', error);
            }
          }
        }
        return updated;
      });
      // Start fresh path after a find
      resetSelection();
    }
  };

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(to bottom right, #003865, #8cc63f)'
    }}>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 max-w-2xl mx-auto">
          <div ref={containerRef} className="text-center">
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
                className={`px-3 py-2 text-base md:text-lg font-medium ${
                  isFound
                    ? 'text-green-600 line-through'
                    : 'text-gray-800'
                }`}
                style={{ minWidth: 75, textAlign: 'center', scrollSnapAlign: 'center' }}
              >
                {w}
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion Stats */}
      {celebrate && completionTime !== null && (
        <div className="mt-4 p-4 bg-green-50 border-2 border-green-400 rounded-lg">
          <h3 className="font-bold text-green-800 text-xl mb-2">🎉 Puzzle Complete!</h3>
          <p className="text-green-700">
            Completion time: <span className="font-semibold">{Math.floor(completionTime / 60)}m {completionTime % 60}s</span>
          </p>
          <p className="text-green-600 text-sm mt-1">
            Games played today: {gamesPlayedToday}
          </p>
        </div>
      )}

      {celebrate && (
        <Confetti
          width={containerRef.current?.clientWidth || 320}
          height={containerRef.current?.clientHeight || 480}
        />
      )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordFind;
