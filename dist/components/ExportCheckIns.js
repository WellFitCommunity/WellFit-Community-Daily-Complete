"use strict";
// src/components/ExportCheckIns.tsx
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const file_saver_1 = require("file-saver");
const ExportCheckIns = () => {
    const handleExport = () => {
        // Simulated CSV content – replace with real check-in data later
        const csvContent = [
            ['Full Name', 'Phone', 'Check-In Date', 'Status'],
            ['John Doe', '555-123-4567', '2025-05-07', 'Checked In'],
            ['Jane Smith', '555-987-6543', '2025-05-07', 'Missed'],
        ]
            .map((row) => row.join(','))
            .join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        (0, file_saver_1.saveAs)(blob, 'wellfit-checkins.csv');
    };
    return (<div className="text-center">
      <button onClick={handleExport} className="bg-wellfit-green text-white px-6 py-3 rounded-lg shadow hover:bg-wellfit-blue transition">
        📤 Export Check-In Data
      </button>
    </div>);
};
exports.default = ExportCheckIns;
