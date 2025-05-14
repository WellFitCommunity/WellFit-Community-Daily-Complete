"use strict";
// src/components/ReportsSection.tsx
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const ReportsSection = () => {
    // Simulated data — later replace with live fetch from Supabase
    const stats = {
        totalCheckIns: 312,
        mealsPrepared: 118,
        techTipsViewed: 207,
        activeUsers: 52,
    };
    return (<div className="bg-white rounded-xl shadow p-4 space-y-3">
      <h3 className="text-xl font-bold text-wellfit-blue">Engagement Summary</h3>
      <div className="grid grid-cols-2 gap-4 text-center text-lg font-semibold">
        <div>
          ✅ <span className="block text-sm font-normal text-gray-500">Total Check-Ins</span>
          {stats.totalCheckIns}
        </div>
        <div>
          🍽️ <span className="block text-sm font-normal text-gray-500">Meals Prepared</span>
          {stats.mealsPrepared}
        </div>
        <div>
          💡 <span className="block text-sm font-normal text-gray-500">Tech Tips Viewed</span>
          {stats.techTipsViewed}
        </div>
        <div>
          🧓 <span className="block text-sm font-normal text-gray-500">Active Users</span>
          {stats.activeUsers}
        </div>
      </div>
    </div>);
};
exports.default = ReportsSection;
