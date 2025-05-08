// src/components/Dashboard.tsx
import React from 'react';
import Card from './Card';
import { useNavigate } from 'react-router-dom';

import WeatherWidget from './WeatherWidget';
import CheckInTracker from './CheckInTracker';
import DailyScripture from './DailyScripture';
import TechTip from './TechTip';
import EmergencyContact from './EmergencyContact';
import AdminPanel from './AdminPanel';
import DashMealOfTheDay from './DashMealOfTheDay';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="space-y-6 mt-4 p-4">
      <Card><WeatherWidget /></Card>
      <Card><CheckInTracker /></Card>
      <Card><DailyScripture /></Card>

      {/* Meal of the Day preview */}
      <Card>
        <DashMealOfTheDay onSeeDetails={(id) => navigate(`/meal/${id}`)} />
      </Card>

      <Card>
        <button
          className="w-full py-3 text-lg font-semibold bg-wellfitBlue text-white rounded-xl shadow hover:bg-wellfitGreen transition"
          onClick={() => navigate('/wordfind')}
        >
          🧠 Play Word Find Puzzle
        </button>
      </Card>

      <Card><TechTip /></Card>
      <Card><EmergencyContact /></Card>
      <Card><AdminPanel /></Card>
    </main>
  );
};

export default Dashboard;
