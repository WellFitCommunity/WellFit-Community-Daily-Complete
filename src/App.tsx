import React from 'react';
import { Routes, Route } from 'react-router-dom';
import WelcomePage from './components/WelcomePage';
import Dashboard from './components/Dashboard';
import WordFind from './components/WordFind';
import Header from './components/Header';
import Footer from './components/Footer';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-wellfit-blue via-white to-wellfit-green">
      <Header />

      <main className="flex-grow p-4">
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/wordfind" element={<WordFind />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
};

export default App;


