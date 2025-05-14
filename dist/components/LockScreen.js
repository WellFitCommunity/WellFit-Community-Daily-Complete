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
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
const ADMIN_KEY = 'WF_ADMIN_KEY'; // localStorage key
const LockScreen = () => {
    const [input, setInput] = (0, react_1.useState)('');
    const [error, setError] = (0, react_1.useState)('');
    const navigate = (0, react_router_dom_1.useNavigate)();
    const handleUnlock = () => {
        // Replace this check with your own remote-validated value
        const validKey = process.env.REACT_APP_ADMIN_SECRET;
        if (input === validKey) {
            localStorage.setItem(ADMIN_KEY, input);
            navigate('/admin');
        }
        else {
            setError('Invalid key—access denied');
        }
    };
    return (<div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-sm">
        <h2 className="text-xl font-semibold text-wellfit-blue mb-4 text-center">
          Admin Access
        </h2>
        <input type="password" placeholder="Enter Admin Key" value={input} onChange={e => setInput(e.target.value)} className="w-full p-2 border rounded mb-2"/>
        {error && <p className="text-red-500 mb-2">{error}</p>}
        <button onClick={handleUnlock} className="w-full py-2 bg-wellfit-green text-white font-semibold rounded">
          Unlock
        </button>
      </div>
    </div>);
};
exports.default = LockScreen;
