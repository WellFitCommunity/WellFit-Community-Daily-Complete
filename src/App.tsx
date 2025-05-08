import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

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

const App: React.FC = () => (
  <Router>
    <Header />
    <main className="flex-grow">
      <Routes>
        {/* Unprotected */}
        <Route path="/" element={<WelcomePage />} />
        <Route path="/senior-enrollment" element={<SeniorEnrollmentPage />} />

        {/* Public meal detail */}
        <Route path="/meal/:id" element={<MealDetailPage />} />

        {/* Protected */}
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/checkin" element={<RequireAuth><CheckInTracker /></RequireAuth>} />
        <Route path="/wordfind" element={<RequireAuth><WordFind /></RequireAuth>} />

        {/* Admin tools */}
        <Route path="/admin-panel" element={<AdminPanel />} />
        <Route path="/admin-profile-editor" element={<AdminProfileEditor />} />

        {/* Logout */}
        <Route path="/logout" element={<LogoutPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
    <Footer />
  </Router>
);

export default App;
