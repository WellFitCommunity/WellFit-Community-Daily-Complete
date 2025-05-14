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
const react_1 = __importDefault(require("react"));
const client_1 = __importDefault(require("react-dom/client"));
const react_router_dom_1 = require("react-router-dom");
require("./index.css");
const App_1 = __importDefault(require("./App"));
const serviceWorkerRegistration = __importStar(require("./serviceWorkerRegistration"));
// ✅ Supabase auth context
const auth_helpers_react_1 = require("@supabase/auth-helpers-react");
const supabaseClient_1 = require("./lib/supabaseClient");
// ✅ Corrected ErrorBoundary import
const ErrorBoundary_1 = __importDefault(require("./components/ErrorBoundary")); // ✅ matches your actual file location
// ✅ Get the root element safely
const rootElement = document.getElementById('root');
if (!rootElement)
    throw new Error('Root element not found');
// ✅ Create the root and render
const root = client_1.default.createRoot(rootElement);
root.render(<react_1.default.StrictMode>
    <auth_helpers_react_1.SessionContextProvider supabaseClient={supabaseClient_1.supabase}>
      <react_router_dom_1.BrowserRouter>
        <ErrorBoundary_1.default>
          <App_1.default />
        </ErrorBoundary_1.default>
      </react_router_dom_1.BrowserRouter>
    </auth_helpers_react_1.SessionContextProvider>
  </react_1.default.StrictMode>);
// ✅ Unregister the service worker to prevent white screen issues
serviceWorkerRegistration.unregister();
