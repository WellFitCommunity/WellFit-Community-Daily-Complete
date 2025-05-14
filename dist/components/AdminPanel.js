"use strict";
// src/components/AdminPanel.tsx
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
const react_1 = __importStar(require("react"));
const UsersList_1 = __importDefault(require("./UsersList"));
const ReportsSection_1 = __importDefault(require("./ReportsSection"));
const ExportCheckIns_1 = __importDefault(require("./ExportCheckIns"));
const AdminPanel = () => {
    const [pin, setPin] = (0, react_1.useState)('');
    const [authed, setAuthed] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)('');
    const handleUnlock = () => {
        if (pin === '1234') { // TODO: replace with secure backend check
            setAuthed(true);
            setError('');
        }
        else {
            setError('Incorrect PIN');
        }
    };
    return authed ? (<section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow space-y-6">
      <h2 className="text-xl font-semibold text-[#003865] mb-2">Admin Panel ✅</h2>

      <UsersList_1.default />
      <ReportsSection_1.default />
      <ExportCheckIns_1.default />
    </section>) : (<section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow">
      <h2 className="text-xl font-semibold text-[#003865] mb-2">Admin Panel 🔒</h2>
      <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter staff PIN" className="border p-1 rounded"/>
      <button onClick={handleUnlock} className="ml-2 px-3 py-1 bg-[#003865] text-white rounded">
        Unlock
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </section>);
};
exports.default = AdminPanel;
