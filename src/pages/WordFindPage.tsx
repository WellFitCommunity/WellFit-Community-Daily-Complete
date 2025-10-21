// src/components/WordFind.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Confetti from 'react-confetti';
import { dailyThemes } from '../data/wordThemes';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { saveWordGameResult } from '../services/engagementTracking';
import { useBranding } from '../BrandingContext';

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
  const { branding } = useBranding();

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
  const [hintsUsed, setHintsUsed] = useState(0);
  const [revealedLetters, setRevealedLetters] = useState<Set<string>>(new Set());

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

  // Hint system - reveal first letter of an unfound word
  const handleHint = () => {
    const unfoundWords = words.filter(w => !found.has(w));
    if (unfoundWords.length === 0) return;

    // Pick a random unfound word
    const targetWord = unfoundWords[Math.floor(Math.random() * unfoundWords.length)];

    // Find first letter position in grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === targetWord[0]) {
          // Check if this is the start of the target word in any direction
          for (const dir of DIRECTIONS) {
            let match = true;
            for (let i = 0; i < targetWord.length; i++) {
              const nr = r + dir.r * i;
              const nc = c + dir.c * i;
              if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || grid[nr][nc] !== targetWord[i]) {
                match = false;
                break;
              }
            }
            if (match) {
              setRevealedLetters(prev => new Set(prev).add(toKey({ r, c })));
              setHintsUsed(h => h + 1);
              return;
            }
          }
        }
      }
    }
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
                  hints_used: hintsUsed,
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
      background: branding.gradient
    }}>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 max-w-6xl mx-auto">
          <div ref={containerRef} className="text-center">
      <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: branding.primaryColor }}>{themeData.theme} Word Find</h2>
      <p className="text-lg sm:text-xl mb-6 text-gray-700">Tap letters to select in a straight line. Backwards works too!</p>

      {/* Hint Button - BIG and FRIENDLY */}
      <div className="mb-6 flex justify-center gap-4">
        <button
          onClick={handleHint}
          disabled={found.size === words.length}
          className="px-6 py-3 bg-yellow-500 text-white rounded-xl font-bold text-xl shadow-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all transform hover:scale-105"
          aria-label="Get a hint to find a word"
          aria-disabled={found.size === words.length}
        >
          💡 Need a Hint?
        </button>
        {hintsUsed > 0 && (
          <div className="flex items-center text-lg text-gray-600" role="status" aria-live="polite">
            <span>Hints used: {hintsUsed}</span>
          </div>
        )}
      </div>

      {/* TWO-COLUMN LAYOUT: Grid on LEFT, Words on RIGHT (side-by-side on tablet/desktop, stacked on mobile) */}
      <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center">

        {/* LEFT SIDE: The Puzzle Grid - Responsive sizing */}
        <div className="flex-shrink-0 w-full max-w-md lg:max-w-none flex justify-center">
          <div
            className="inline-grid gap-1 sm:gap-2 select-none"
            role="grid"
            aria-label="Word search puzzle grid"
            style={{
              gridTemplateColumns: `repeat(${COLS}, minmax(32px, 1fr))`,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              maxWidth: '100%',
            }}
          >
            {grid.map((row, r) =>
              row.map((ch, c) => {
                const key = `${r},${c}`;
                const isSel = selection.some(p => p.r === r && p.c === c);
                const isHint = revealedLetters.has(key);
                return (
                  <div
                    key={key}
                    onClick={() => handleTap(r, c)}
                    className={`border-2 rounded-lg cursor-pointer flex items-center justify-center
                      text-base sm:text-xl md:text-2xl font-bold transition-all transform active:scale-95
                      ${isSel ? 'bg-blue-600 text-white border-blue-700 shadow-lg scale-105' :
                        isHint ? 'bg-yellow-200 text-gray-800 border-yellow-400 animate-pulse' :
                        'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}
                    `}
                    style={{
                      aspectRatio: '1 / 1',
                      minWidth: '32px',
                      minHeight: '32px',
                    }}
                    role="button"
                    aria-label={`Letter ${ch} at row ${r + 1}, column ${c + 1}${isHint ? ', hint' : ''}`}
                  >
                    {ch}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Word List Panel - ALWAYS VISIBLE! Responsive width */}
        <div className="w-full lg:w-auto flex-shrink-0 rounded-xl p-4 sm:p-6 shadow-lg border-2"
          role="complementary"
          aria-label="Words to find"
          style={{
            minWidth: '280px',
            maxWidth: '100%',
            background: `linear-gradient(to bottom right, ${branding.primaryColor}15, ${branding.secondaryColor}15)`,
            borderColor: branding.primaryColor
          }}>
          <h3 className="text-2xl font-bold mb-4 text-center" style={{ color: branding.primaryColor }}>📝 Find These Words</h3>

          {/* Progress Bar */}
          <div className="mb-4 bg-gray-200 rounded-full h-3 overflow-hidden" role="progressbar" aria-valuenow={found.size} aria-valuemin={0} aria-valuemax={words.length} aria-label="Words found progress">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${(found.size / words.length) * 100}%`,
                background: branding.secondaryColor
              }}
            />
          </div>
          <div className="text-center text-lg font-bold text-gray-700 mb-4" role="status" aria-live="polite">
            {found.size} / {words.length} Found
          </div>

          {/* Word List - Vertical Stack */}
          <div className="space-y-2" role="list" aria-label="Word list">
            {words.map(w => {
              const isFound = found.has(w);
              return (
                <div
                  key={w}
                  role="listitem"
                  aria-label={`${w}, ${isFound ? 'found' : 'not found yet'}`}
                  className={`px-4 py-3 rounded-lg text-center font-bold text-xl transition-all ${
                    isFound
                      ? 'text-white shadow-md'
                      : 'bg-white text-gray-800 border-2 border-gray-300'
                  }`}
                  style={isFound ? { background: branding.secondaryColor } : {}}
                >
                  {isFound && <span aria-hidden="true">✓ </span>}{isFound ? <s>{w}</s> : w}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Completion Stats - CELEBRATORY! */}
      {celebrate && completionTime !== null && (
        <div className="mt-6 p-6 rounded-2xl shadow-xl" role="alert" aria-live="assertive" style={{
          background: `linear-gradient(to right, ${branding.primaryColor}15, ${branding.secondaryColor}15)`,
          border: `4px solid ${branding.secondaryColor}`
        }}>
          <h3 className="font-bold text-3xl mb-3" style={{ color: branding.primaryColor }}>🎉 Fantastic Job! 🎉</h3>
          <p className="text-xl mb-2" style={{ color: branding.primaryColor }}>
            You found all {words.length} words!
          </p>
          <p className="text-lg" style={{ color: branding.primaryColor }}>
            ⏱️ Time: <span className="font-semibold">{Math.floor(completionTime / 60)}m {completionTime % 60}s</span>
          </p>
          {hintsUsed > 0 && (
            <p className="text-yellow-700 text-lg">
              💡 Hints used: {hintsUsed}
            </p>
          )}
          <p className="text-lg mt-2" style={{ color: branding.primaryColor }}>
            🏆 Games completed today: {gamesPlayedToday}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-3 text-white rounded-xl font-bold text-xl shadow-lg transition-all transform hover:scale-105"
            aria-label="Play a new word find puzzle"
            style={{
              background: branding.primaryColor
            }}
            onMouseEnter={(e) => {
              const primaryRGB = branding.primaryColor;
              e.currentTarget.style.background = primaryRGB + 'dd';
            }}
            onMouseLeave={(e) => e.currentTarget.style.background = branding.primaryColor}
          >
            🎮 Play Again
          </button>
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
