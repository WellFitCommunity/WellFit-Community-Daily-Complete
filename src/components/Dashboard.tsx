// src/components/Dashboard.tsx
import React from 'react';
import Card from './Card';
import { useNavigate } from 'react-router-dom';

import WeatherWidget from './WeatherWidget';
import CheckInTracker from './CheckInTracker';
import DailyScripture from './DailyScripture';
import TechTip from './TechTip';
import DashMealOfTheDay from './DashMealOfTheDay';
import WordFind from './WordFind';
import EmergencyContact from './EmergencyContact';
import AdminPanel from './AdminPanel';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="space-y-6 mt-4 p-4">
      <Card><WeatherWidget /></Card>
      <Card><CheckInTracker /></Card>
      <Card><DailyScripture /></Card>

      <Card>
        <button
          className="w-full py-3 text-lg font-semibold bg-wellfit-blue text-white rounded-xl shadow hover:bg-wellfit-green transition"
          onClick={() => navigate('/wordfind')}
        >
          🧠 Play Word Find Puzzle
        </button>
      </Card>

      <Card><TechTip /></Card>
      {/* Remove WordFind from here, it's on its own page now */}
      <Card><EmergencyContact /></Card>
      <Card><AdminPanel /></Card>
    </main>
  );
};

export default Dashboard;

