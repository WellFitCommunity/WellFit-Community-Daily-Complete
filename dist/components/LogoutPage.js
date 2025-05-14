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
// src/components/LogoutPage.tsx
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
const LogoutPage = () => {
    const navigate = (0, react_router_dom_1.useNavigate)();
    const [sec, setSec] = (0, react_1.useState)(5);
    // 1) Clear storage on mount
    (0, react_1.useEffect)(() => {
        localStorage.removeItem('wellfitPhone');
        localStorage.removeItem('wellfitPin');
    }, []);
    // 2) Countdown UI
    (0, react_1.useEffect)(() => {
        if (sec <= 0)
            return;
        const t = setTimeout(() => setSec(sec - 1), 1000);
        return () => clearTimeout(t);
    }, [sec]);
    // 3) Redirect when countdown finishes
    (0, react_1.useEffect)(() => {
        const t = setTimeout(() => {
            navigate('/', { replace: true });
        }, 5000);
        return () => clearTimeout(t);
    }, [navigate]);
    return (<div className="p-8 text-center">
      <h2 className="text-2xl mb-4">You’ve been logged out</h2>
      <p>Returning to the Welcome screen in {sec} second{sec !== 1 && 's'}…</p>
    </div>);
};
exports.default = LogoutPage;
