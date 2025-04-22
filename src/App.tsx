// File: src/App.tsx
import React from 'react';

import Header from './components/Header';
import WelcomePage from './components/WelcomePage';

import WeatherWidget from './components/WeatherWidget';
import CheckInTracker from './components/CheckInTracker';

import DailyScripture from './components/DailyScripture';
import TechTip from './components/TechTip';
import DashMealOfTheDay from './components/DashMealOfTheDay';

import WordFind from './components/WordFind';
import Sudoku from './components/Sudoku';
import Crossword from './components/Crossword';

import EmergencyContact from './components/EmergencyContact';
import AdminPanel from './components/AdminPanel';

import Footer from './components/Footer';

const App = () => (
  <div className="min-h-screen bg-white text-gray-800">
    <Header />
    <main className="p-4 space-y-6">
      <WelcomePage />

      <WeatherWidget />
      <SmartWatchCheckIn />
      <CheckInTracker />

      <DailyScripture />
      <TechTip />
      <DashMealOfTheDay />

      <WordFind />
      <Sudoku />
      <Crossword />

      <EmergencyContact />
      <AdminPanel />
    </main>
    <Footer />
  </div>
);

export default App;

