"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/components/Dashboard.tsx
const react_1 = __importDefault(require("react"));
const Card_1 = __importDefault(require("./Card"));
const react_router_dom_1 = require("react-router-dom");
const WeatherWidget_1 = __importDefault(require("./WeatherWidget"));
const CheckInTracker_1 = __importDefault(require("./CheckInTracker"));
const DailyScripture_1 = __importDefault(require("./DailyScripture"));
const TechTip_1 = __importDefault(require("./TechTip"));
const EmergencyContact_1 = __importDefault(require("./EmergencyContact"));
const AdminPanel_1 = __importDefault(require("./AdminPanel"));
const DashMealOfTheDay_1 = __importDefault(require("./DashMealOfTheDay"));
const Dashboard = () => {
    const navigate = (0, react_router_dom_1.useNavigate)();
    return (<main className="space-y-6 mt-4 p-4">
      {/* Return link */}
      <button onClick={() => navigate('/senior-enrollment')} className="text-sm text-wellfit-blue underline mb-4">
        ← Return to Enrollment
      </button>

      <Card_1.default><WeatherWidget_1.default /></Card_1.default>
      <Card_1.default><CheckInTracker_1.default /></Card_1.default>
      <Card_1.default><DailyScripture_1.default /></Card_1.default>

      {/* Meal of the Day preview */}
      <Card_1.default>
        <DashMealOfTheDay_1.default onSeeDetails={(id) => navigate(`/meal/${id}`)}/>
      </Card_1.default>

      <Card_1.default>
        <button className="w-full py-3 text-lg font-semibold bg-wellfit-blue text-white rounded-xl shadow hover:bg-wellfit-green transition" onClick={() => navigate('/wordfind')}>
          🧠 Play Word Find Puzzle
        </button>
      </Card_1.default>

      <Card_1.default><TechTip_1.default /></Card_1.default>
      <Card_1.default><EmergencyContact_1.default /></Card_1.default>
      <Card_1.default><AdminPanel_1.default /></Card_1.default>
    </main>);
};
exports.default = Dashboard;
