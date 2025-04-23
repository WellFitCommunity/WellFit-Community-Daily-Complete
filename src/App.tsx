// src/App.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import WelcomePage from './components/WelcomePage';
import Dashboard from './components/Dashboard';

const App: React.FC = () => (
  // The gradient background lives here:
  <div className="min-h-screen bg-gradient-to-b from-wellfit-blue to-wellfit-green p-4">
    <Header />

    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>

    <Footer />
  </div>
);

export default App;

