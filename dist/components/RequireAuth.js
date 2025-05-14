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
// src/components/RequireAuth.tsx
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
const supabaseClient_1 = require("../lib/supabaseClient");
const RequireAuth = ({ children }) => {
    const location = (0, react_router_dom_1.useLocation)();
    // 1) Preview flag
    const isPreview = Boolean(localStorage.getItem('exploreStartTime'));
    // 2) Phone+PIN stored locally
    const phone = localStorage.getItem('wellfitPhone');
    const pin = localStorage.getItem('wellfitPin');
    // 3) (Optional) Supabase session—for email-based users
    const [session, setSession] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        supabaseClient_1.supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(!!session);
        });
    }, []);
    // If not a preview, and not phone+PIN, and not logged-in via email, block access
    if (!isPreview && !(phone && pin) && !session) {
        return <react_router_dom_1.Navigate to="/" state={{ from: location }} replace/>;
    }
    // Otherwise render the protected content
    return children;
};
exports.default = RequireAuth;
