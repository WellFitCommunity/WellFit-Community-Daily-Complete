// src/components/Dashboard.tsx
import React from 'react';
import Card from './Card';

import WeatherWidget from './WeatherWidget';
import CheckInTracker from './CheckInTracker';
import DailyScripture from './DailyScripture';
import TechTip from './TechTip';
import DashMealOfTheDay from './DashMealOfTheDay';
import WordFind from './WordFind';
import EmergencyContact from './EmergencyContact';
import AdminPanel from './AdminPanel';

const Dashboard: React.FC = () => (
  <main className="space-y-6 mt-4 p-4">
    <Card><WeatherWidget /></Card>
    <Card><CheckInTracker /></Card>
    <Card><DailyScripture /></Card>
    <Card><TechTip /></Card>
    <Card><DashMealOfTheDay /></Card>
    <Card><WordFind /></Card>
    <Card><EmergencyContact /></Card>
    <Card><AdminPanel /></Card>
  </main>
);

export default Dashboard;

