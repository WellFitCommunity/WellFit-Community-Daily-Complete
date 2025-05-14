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
Object.defineProperty(exports, "__esModule", { value: true });
// src/components/CheckInTracker.tsx
const react_1 = __importStar(require("react"));
const XLSX = __importStar(require("xlsx"));
const file_saver_1 = require("file-saver");
const supabaseClient_1 = require("../lib/supabaseClient");
const STORAGE_KEY = 'wellfitCheckIns';
const CheckInTracker = () => {
    const [history, setHistory] = (0, react_1.useState)([]);
    const [showEmergencyModal, setShowEmergencyModal] = (0, react_1.useState)(false);
    // Load from localStorage on mount
    (0, react_1.useEffect)(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try {
                setHistory(JSON.parse(raw));
            }
            catch {
                setHistory([]);
            }
        }
    }, []);
    // Save to localStorage on change
    (0, react_1.useEffect)(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }, [history]);
    // Handle new check-in
    const handleCheckIn = async (label) => {
        const isEmergency = label === '🚨 Fallen down & injured' || label === '🤒 Not Feeling Well';
        const timestamp = new Date().toISOString();
        const newEntry = { label, timestamp, is_emergency: isEmergency };
        setHistory((prev) => [...prev, newEntry]);
        // Show red emergency modal if needed
        if (isEmergency) {
            setShowEmergencyModal(true);
            setTimeout(() => setShowEmergencyModal(false), 5000);
        }
        // Get Supabase user
        const { data: { user }, } = await supabaseClient_1.supabase.auth.getUser();
        if (!user)
            return;
        // Insert check-in into Supabase
        await supabaseClient_1.supabase.from('checkins').insert({
            user_id: user.id,
            timestamp,
            label,
            is_emergency: isEmergency,
        });
    };
    // Export Supabase history as Excel
    const exportXlsx = async () => {
        const { data: { user }, } = await supabaseClient_1.supabase.auth.getUser();
        if (!user)
            return;
        const { data, error } = await supabaseClient_1.supabase
            .from('checkins')
            .select('*')
            .eq('user_id', user.id);
        if (error || !data)
            return;
        const records = data.map((item, i) => ({
            'Check-In #': i + 1,
            Activity: item.label,
            'Timestamp (ISO)': item.timestamp,
            'Timestamp (Local)': new Date(item.timestamp).toLocaleString(),
            'Emergency': item.is_emergency ? 'Yes' : 'No',
        }));
        const ws = XLSX.utils.json_to_sheet(records);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'CheckIns');
        const summary = XLSX.utils.aoa_to_sheet([
            ['Total Check-Ins', data.length],
            ['Exported At', new Date().toLocaleString()],
        ]);
        XLSX.utils.book_append_sheet(wb, summary, 'Summary');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        (0, file_saver_1.saveAs)(new Blob([wbout], { type: 'application/octet-stream' }), `WellFit-CheckIns_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };
    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = evt.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            const imported = rows
                .map((r) => ({
                timestamp: r['Timestamp (ISO)'] || r['Timestamp'] || '',
                label: r['Activity'] || 'Unknown',
                is_emergency: r['Emergency'] === 'Yes',
            }))
                .filter((r) => Boolean(r.timestamp));
            setHistory(imported);
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };
    const checkInButtons = [
        '😊 Feeling Great Today',
        '📅 Feeling fine & have a Dr. Appt today',
        '🏥 In the hospital',
        '🚨 Fallen down & injured',
        '🤒 Not Feeling Well',
        '🧭 Need Healthcare Navigation Assistance',
        '⭐ Attending the event today',
    ];
    return (<div className="relative max-w-xl mx-auto p-6 bg-white rounded-xl shadow-md border-2 border-wellfitGreen">
      <h2 className="text-2xl font-bold mb-4 text-center text-wellfit-blue">Check-In Center</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {checkInButtons.map((label) => (<button key={label} onClick={(e) => {
                handleCheckIn(label);
                const btn = e.currentTarget;
                btn.style.backgroundColor = '#003865';
                setTimeout(() => {
                    btn.style.backgroundColor = '#8cc63f';
                }, 2000);
            }} className="w-full py-3 px-4 bg-[#8cc63f] border-2 border-[#003865] text-white font-semibold rounded-lg shadow-md hover:bg-[#77aa36] transition">
            {label}
          </button>))}
      </div>

      {history.length > 0 && (<>
          <h3 className="text-lg font-semibold mb-2 text-center">Your Check-In History</h3>
          <ul className="mb-4 space-y-1 text-sm text-gray-700 max-h-40 overflow-y-auto">
            {history.map((h, i) => (<li key={i}>
                <strong>{h.label}</strong> — {new Date(h.timestamp).toLocaleString()}
              </li>))}
          </ul>
          <button onClick={exportXlsx} className="w-full py-2 mb-4 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition text-sm">
            Export History from Supabase (.xlsx)
          </button>
        </>)}

      <div className="mt-4">
        <label className="block mb-1 font-medium">Import from file:</label>
        <input type="file" accept=".xlsx,.xls,.ods" onChange={handleFile} className="w-full p-2 border rounded"/>
      </div>

      {/* Emergency Modal */}
      {showEmergencyModal && (<div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-red-600 text-white p-6 rounded-xl shadow-lg max-w-sm text-center animate-pulse">
            <h3 className="text-xl font-bold mb-2">🚨 Emergency Alert</h3>
            <p className="mb-4">If this is an emergency, please call <strong>911</strong> immediately.</p>
          </div>
        </div>)}
    </div>);
};
exports.default = CheckInTracker;
