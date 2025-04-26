// src/App.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Header         from './components/Header';
import Footer         from './components/Footer';
import WelcomePage    from './components/WelcomePage';
import Dashboard      from './components/Dashboard';
import CheckInTracker from './components/CheckInTracker';
import WordFind       from './components/WordFind';
import LogoutPage     from './components/LogoutPage';
import RequireAuth    from './components/RequireAuth';

const App: React.FC = () => (
  <div className="min-h-screen flex flex-col bg-gradient-to-b from-wellfit-blue via-white to-wellfit-green">
    <Header />

    <main className="flex-grow">
      <Routes>
        {/* 1) Unprotected welcome/login */}
        <Route path="/" element={<WelcomePage />} />

        {/* 2) Protected screens */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/checkin"
          element={
            <RequireAuth>
              <CheckInTracker />
            </RequireAuth>
          }
        />
        <Route
          path="/wordfind"
          element={
            <RequireAuth>
              <WordFind />
            </RequireAuth>
          }
        />

        {/* 3) Logout (5s countdown → “/”) */}
        <Route path="/logout" element={<LogoutPage />} />

        {/* 4) Anything else → back to welcome */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>

    <Footer />
  </div>
);
export default App;

