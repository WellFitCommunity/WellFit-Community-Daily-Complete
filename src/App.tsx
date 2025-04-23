// src/App.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import WelcomePage from './components/WelcomePage';
import Dashboard from './components/Dashboard';
import Footer from './components/Footer';

const App: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-gray-100 p-4">
    <Header />
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<WelcomePage />} />

      {/* Main app after login */}
      <Route path="/dashboard" element={<Dashboard />} />

      {/* Catch-all redirects back to welcome */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <Footer />
  </div>
);

export default App;


