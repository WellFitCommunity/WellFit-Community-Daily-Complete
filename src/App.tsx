// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import Header from './components/Header';
import Footer from './components/Footer';
import WelcomePage from './components/WelcomePage';
import SeniorEnrollmentPage from './components/SeniorEnrollmentPage';
import Dashboard from './components/Dashboard';
import CheckInTracker from './components/CheckInTracker';
import WordFind from './components/WordFind';
import MealDetailPage from './pages/MealDetailPage';
import LogoutPage from './components/LogoutPage';
import RequireAuth from './components/RequireAuth';
import AdminPanel from './components/AdminPanel';
import AdminProfileEditor from './components/AdminProfileEditor';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const showHeaderFooter = location.pathname !== '/';

  return (
    <>
      {showHeaderFooter && <Header />}
      <main className="flex-grow">{children}</main>
      {showHeaderFooter && <Footer />}
    </>
  );
};

const App: React.FC = () => (
  <Router>
    <Layout>
      <Routes>
        {/* Public pages */}
        <Route path="/" element={<WelcomePage />} />
        <Route path="/senior-enrollment" element={<SeniorEnrollmentPage />} />
        <Route path="/meal/:id" element={<MealDetailPage />} />

        {/* Protected pages */}
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/checkin" element={<RequireAuth><CheckInTracker /></RequireAuth>} />
        <Route path="/wordfind" element={<RequireAuth><WordFind /></RequireAuth>} />

        {/* Admin pages */}
        <Route path="/admin-panel" element={<AdminPanel />} />
        <Route path="/admin-profile-editor" element={<AdminProfileEditor />} />

        {/* Logout */}
        <Route path="/logout" element={<LogoutPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  </Router>
);

export default App;
