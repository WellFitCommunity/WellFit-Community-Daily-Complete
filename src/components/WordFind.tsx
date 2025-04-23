import React, { useState, useEffect, useRef } from "react";
import Confetti from "react-confetti";

// Ten daily themes (12 words each)
const dailyThemes = [
  ["HEART","EXERCISE","SALMON","OATMEAL","KALE","WALK","STRESS","SLEEP","VITAMIN","TRACK","BLOOD","HYDRATE"],
  ["CALCIUM","MILK","YOGURT","TOFU","SUNSHINE","WEIGHTS","CHEESE","BROCCOLI","SWIM","YOGA","MAGNESIUM","VITD"],
  ["WATER","HYDRATE","FLUID","ALOE","CUCUMBER","ELECTROLYTE","DRINK","CUP","MOIST","BALANCE","SWEAT","CLEAR"],
  ["MINDFUL","MEDITATE","BREATHE","POSITIVE","HAPPY","FOCUS","CALM","YOGA","READ","JOURNAL","SLEEP","REFLECT"],
  ["PROTEIN","CARBS","VEGAN","FRUITS","NUTRIENT","FIBER","SALAD","GRAINS","OATS","NUTS","YOGURT","LEAN"],
  ["RUNNING","CYCLING","SWIM","YOGA","WALKING","STRETCH","LIFT","SPRINT","SKIPPING","DANCE","CARDIO","SQUAT"],
  ["SLEEP","PILLOW","DREAM","NIGHT","REST","ROUTINE","DARK","SILENCE","ALARM","BLINDS","MATTRESS","PEACE"],
  ["CALM","YOGA","MEDITATE","MUSIC","BREATHE","WALK","NATURE","MASSAGE","LAUGH","JOURNAL","TIMEOUT","REFLECT"],
  ["VITAMINC","VITD","ZINC","YOGURT","PROBIOTIC","GARLIC","ORANGE","BERRIES","ALMOND","HONEY","ECHINACEA","PREBIOTIC"],
  ["DIGEST","PROBIOTIC","YOGURT","BANANA","FIBER","GINGER","OATMEAL","LEGUME","APPLE","WHOLEGRAIN","SALAD","ENZYME"],
];
const themeNames = [
  "Heart Health","Strong Bones","Hydration","Mental Wellness","Balanced Eating",
  "Daily Exercise","Sleep Hygiene","Stress Relief","Immune Support","Digestive Health"
];

const GRID_SIZE = 12;
const makeEmptyGrid = () =>
  Array.from({ length: GRID_SIZE }, () => Array<string>(GRID_SIZE).fill(""));

const WordFind: React.FC = () => {
  const [grid, setGrid] = useState<string[][]>(makeEmptyGrid());
  const [selection, setSelection] = useState<{ r: number; c: number }[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate puzzle with collision-safe placement
  useEffect(() => {
    const day = new Date().getDate() % dailyThemes.length;
    const words = dailyThemes[day];
    const newGrid = makeEmptyGrid();
    const directions = [
      { dr: 0, dc: 1 },   // right
      { dr: 1, dc: 0 },   // down
      { dr: 1, dc: 1 },   // down-right
      { dr: -1, dc: 1 },  // up-right
    ];

    words.forEach((w) => {
      let placed = false;
      while (!placed) {
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const r0 = Math.floor(Math.random() * GRID_SIZE);
        const c0 = Math.floor(Math.random() * GRID_SIZE);
        const endR = r0 + dir.dr * (w.length - 1);
        const endC = c0 + dir.dc * (w.length - 1);

        if (
          endR >= 0 && endR < GRID_SIZE &&
          endC >= 0 && endC < GRID_SIZE
        ) {
          // Check collisions
          let canPlace = true;
          for (let i = 0; i < w.length; i++) {
            const rr = r0 + dir.dr * i;
            const cc = c0 + dir.dc * i;
            const existing = newGrid[rr][cc];
            if (existing && existing !== w[i]) {
              canPlace = false;
              break;
            }
          }
          if (canPlace) {
            for (let i = 0; i < w.length; i++) {
              newGrid[r0 + dir.dr * i][c0 + dir.dc * i] = w[i];
            }
            placed = true;
          }
        }
      }
    });

    // Fill empty cells
    const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!newGrid[r][c]) {
          newGrid[r][c] = alpha[Math.floor(Math.random() * alpha.length)];
        }
      }
    }

    setGrid(newGrid);
  }, []);

  const day = new Date().getDate() % dailyThemes.length;
  const words = dailyThemes[day];

  // On mouse up, evaluate selection
  const handleMouseUp = () => {
    const word = selection.map(p => grid[p.r][p.c]).join("");
    const rev = word.split("").reverse().join("");
    let match = "";
    if (words.includes(word) && !found.has(word)) match = word;
    else if (words.includes(rev) && !found.has(rev)) match = rev;

    if (match) {
      setFound(f => new Set(f).add(match));
      if (found.size + 1 === words.length) setShowConfetti(true);
    }
    setSelection([]);
  };

  // Global mouse up listener
  useEffect(() => {
    const up = () => {
      isDragging.current = false;
      if (selection.length) handleMouseUp();
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [selection, found, grid]);

  const handleMouseDown = (r: number, c: number) => {
    isDragging.current = true;
    setSelection([{ r, c }]);
  };
  const handleMouseEnter = (r: number, c: number) => {
    if (isDragging.current) {
      setSelection(sel => [...sel, { r, c }]);
    }
  };

  return (
    <div ref={containerRef} className="p-4">
      <h2 className="text-xl font-semibold text-wellfit-blue mb-2 text-center">
        Word Find: {themeNames[day]}
      </h2>

      {/* Grid */}
      <div className="grid grid-cols-12 gap-1 select-none mb-4">
        {grid.map((row, r) =>
          row.map((letter, c) => {
            const isSel = selection.some(p => p.r === r && p.c === c);
            const isFoundChar = Array.from(found).some(w => w.includes(letter));
            return (
              <div
                key={`${r}-${c}`}
                onMouseDown={() => handleMouseDown(r, c)}
                onMouseEnter={() => handleMouseEnter(r, c)}
                className={`
                  w-8 h-8 flex items-center justify-center font-mono border
                  ${isSel ? "bg-wellfit-green text-white" : "bg-white text-black"}
                  ${isFoundChar ? "opacity-50" : ""}
                  transition-colors duration-150
                `}
              >
                {letter}
              </div>
            );
          })
        )}
      </div>

      {/* Word Bank */}
      <div className="p-2 bg-white border-2 border-wellfit-green rounded mb-4">
        <h3 className="font-semibold text-wellfit-blue mb-2">Word Bank</h3>
        <ul className="columns-2 gap-2 list-disc list-inside text-gray-800">
          {words.map(w => (
            <li
              key={w}
              className={`cursor-pointer ${
                found.has(w) ? "line-through text-gray-400" : ""
              }`}
            >
              {w}
            </li>
          ))}
        </ul>
      </div>

      {/* Confetti & Affirmation */}
      {showConfetti && (
        <>
          <Confetti
            width={containerRef.current?.clientWidth}
            height={containerRef.current?.clientHeight}
          />
          <p className="mt-4 text-center text-wellfit-green font-bold">
            🎉 You found them all! “Every step is progress.” 🎉
          </p>
        </>
      )}
    </div>
  );
};

export default WordFind;
