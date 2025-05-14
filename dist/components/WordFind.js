"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/components/WordFind.tsx
const react_1 = __importStar(require("react"));
const react_confetti_1 = __importDefault(require("react-confetti"));
const wordThemes_1 = require("../data/wordThemes");
const ROWS = 10;
const COLS = 12;
const DIRECTIONS = [
    { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: -1, c: 0 },
    { r: 1, c: 1 }, { r: 1, c: -1 }, { r: -1, c: 1 }, { r: -1, c: -1 }
];
const WordFind = () => {
    const [grid, setGrid] = (0, react_1.useState)([]);
    const [words, setWords] = (0, react_1.useState)([]);
    const [selection, setSelection] = (0, react_1.useState)([]);
    const [found, setFound] = (0, react_1.useState)(new Set());
    const [celebrate, setCelebrate] = (0, react_1.useState)(false);
    const containerRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        const themeData = wordThemes_1.dailyThemes[(new Date().getDate() - 1) % wordThemes_1.dailyThemes.length];
        const matrix = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
        const placedWords = [];
        const list = [...themeData.words]
            .sort(() => Math.random() - 0.5)
            .slice(0, 8)
            .map(w => w.toUpperCase());
        for (const word of list) {
            let placed = false;
            for (let tries = 0; tries < 100 && !placed; tries++) {
                const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
                const r0 = Math.floor(Math.random() * ROWS);
                const c0 = Math.floor(Math.random() * COLS);
                const endR = r0 + dir.r * (word.length - 1);
                const endC = c0 + dir.c * (word.length - 1);
                if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS)
                    continue;
                let conflict = false;
                for (let i = 0; i < word.length; i++) {
                    const rr = r0 + dir.r * i;
                    const cc = c0 + dir.c * i;
                    if (matrix[rr][cc] && matrix[rr][cc] !== word[i]) {
                        conflict = true;
                        break;
                    }
                }
                if (conflict)
                    continue;
                for (let i = 0; i < word.length; i++) {
                    const rr = r0 + dir.r * i;
                    const cc = c0 + dir.c * i;
                    matrix[rr][cc] = word[i];
                }
                placedWords.push(word);
                placed = true;
            }
        }
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
    const handleTap = (r, c) => {
        const next = [...selection, { r, c }];
        const word = next.map(p => grid[p.r][p.c]).join('');
        if (!words.some(w => w.startsWith(word))) {
            setSelection([]);
            return;
        }
        setSelection(next);
        if (words.includes(word)) {
            setFound(prev => {
                const updated = new Set(prev).add(word);
                if (updated.size === words.length)
                    setCelebrate(true);
                return updated;
            });
            setSelection([]);
        }
    };
    const themeData = wordThemes_1.dailyThemes[(new Date().getDate() - 1) % wordThemes_1.dailyThemes.length];
    return (<div ref={containerRef} className="p-4 text-center">
      <h2 className="text-2xl font-bold mb-2">{themeData.theme} Word Find</h2>
      <p className="text-sm mb-4">Tap letters to select. Incorrect taps reset.</p>

      <div className="overflow-x-auto -mx-4 px-4">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
          {grid.map((row, r) => row.map((ch, c) => {
            const key = `${r},${c}`;
            const isSel = selection.some(p => p.r === r && p.c === c);
            return (<div key={key} onClick={() => handleTap(r, c)} className={`border rounded cursor-pointer flex items-center justify-center sm:w-8 sm:h-8 text-xs sm:text-base ${isSel ? 'bg-blue-500 text-white' : 'bg-white text-black'}`} style={{
                    width: `calc(100vw/${COLS} - 8px)`,
                    height: `calc(100vw/${COLS} - 8px)`,
                }}>
                  {ch}
                </div>);
        }))}
        </div>
      </div>

      <div className="mt-4 text-left mx-auto" style={{ maxWidth: '10rem' }}>
        <h3 className="font-semibold mb-1">Words:</h3>
        <ul>
          {words.map(w => (<li key={w} className={found.has(w) ? 'line-through text-green-600' : ''}>
              {w}
            </li>))}
        </ul>
      </div>

      {celebrate && (<react_confetti_1.default width={containerRef.current?.clientWidth || 300} height={containerRef.current?.clientHeight || 300}/>)}
    </div>);
};
exports.default = WordFind;
