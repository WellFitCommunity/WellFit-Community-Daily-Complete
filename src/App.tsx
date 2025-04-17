// File: src/App.tsx
import React from 'react';
import Header from './components/Header';
import WelcomePage from './components/WelcomePage';
import DailyScripture from './components/DailyScripture';
import TechTip from './components/TechTip';
import DashMealOfTheDay from './components/DashMealOfTheDay';
import WordFind from './components/WordFind';
import EmergencyContact from './components/EmergencyContact';
import Footer from './components/Footer';

const App = () => {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      <Header />
      <main className="p-4 space-y-6">
        <WelcomePage />
        <DailyScripture />
        <TechTip />
        <DashMealOfTheDay />
        <WordFind />
        <EmergencyContact />
      </main>
      <Footer />
    </div>
  );
};

export default App;
