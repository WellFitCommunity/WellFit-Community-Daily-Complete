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
const ExploreTimer = ({ minutes }) => {
    const navigate = (0, react_router_dom_1.useNavigate)();
    const [secondsLeft, setSecondsLeft] = (0, react_1.useState)(minutes * 60);
    (0, react_1.useEffect)(() => {
        const timer = setInterval(() => {
            setSecondsLeft((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);
    (0, react_1.useEffect)(() => {
        if (secondsLeft <= 0) {
            alert('Your 15-minute preview has ended. Please complete enrollment to continue.');
            navigate('/senior-enrollment');
        }
    }, [secondsLeft, navigate]);
    const displayMinutes = Math.floor(secondsLeft / 60);
    const displaySeconds = secondsLeft % 60;
    return (<div className="bg-yellow-100 text-gray-800 p-3 text-sm rounded shadow-md mb-4 text-center">
      <p>
        You have {displayMinutes}:{displaySeconds.toString().padStart(2, '0')} minutes to explore the app.
      </p>
      <p>You’ll be redirected back to enrollment when time is up.</p>
      <button className="mt-2 px-3 py-1 bg-wellfit-blue text-white rounded hover:bg-wellfit-green transition" onClick={() => navigate('/senior-enrollment')}>
        Back to Enrollment Now
      </button>
    </div>);
};
exports.default = ExploreTimer;
