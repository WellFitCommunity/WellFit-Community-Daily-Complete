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
const supabaseClient_1 = require("../lib/supabaseClient");
const LoginPage = () => {
    const [phone, setPhone] = (0, react_1.useState)('');
    const [pin, setPin] = (0, react_1.useState)('');
    const [error, setError] = (0, react_1.useState)('');
    const navigate = (0, react_router_dom_1.useNavigate)();
    const handleLogin = async (e) => {
        e.preventDefault();
        if (!phone || !pin) {
            setError('Please enter both phone number and PIN.');
            return;
        }
        const { data, error } = await supabaseClient_1.supabase
            .from('phone_auth')
            .select('id')
            .eq('phone', phone)
            .eq('pin', pin)
            .single();
        if (error || !data) {
            setError('Invalid phone number or PIN.');
        }
        else {
            // Save ID in localStorage
            localStorage.setItem('wellfitUserId', data.id);
            setError('');
            navigate('/demographics');
        }
    };
    return (<div className="max-w-md mx-auto mt-16 p-8 bg-white rounded-xl shadow-md border-2 border-wellfitGreen text-center">
      <h1 className="text-2xl font-bold mb-4 text-wellfit-blue">Senior Login</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <input type="tel" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 border rounded"/>
        <input type="password" placeholder="4-digit PIN" value={pin} onChange={e => setPin(e.target.value)} maxLength={4} className="w-full p-2 border rounded"/>
        {error && <p className="text-red-500">{error}</p>}
        <button type="submit" className="w-full py-2 bg-wellfit-blue text-white font-semibold rounded">
          Log In
        </button>
      </form>
    </div>);
};
exports.default = LoginPage;
