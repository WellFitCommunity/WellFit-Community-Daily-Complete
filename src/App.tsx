import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

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
import LockScreenUser from './components/LockScreenUser';
import ConsentPhotoPage from './components/ConsentPhotoPage';
import ConsentPrivacyPage from './components/ConsentPrivacyPage';

// 👇 NEW import
import { requestNotificationPermission } from './utils/requestNotificationPermission';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const showHeaderFooter = location.pathname !== '/';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-r from-wellfit-blue to-wellfit-green text-white">
      {showHeaderFooter && <Header />}
      <main className="flex-grow p-4">{children}</main>
      {showHeaderFooter && <Footer />}
    </div>
  );
};

const App: React.FC = () => {
  // 👇 Add useEffect to request notification token
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
<Layout>
  <Routes>
    {/* Public pages */}
    <Route path="/" element={<WelcomePage />} />
    <Route path="/senior-enrollment" element={<SeniorEnrollmentPage />} />
    <Route path="/meal/:id" element={<MealDetailPage />} />
    <Route path="/lockscreen" element={<LockScreenUser />} />
    <Route path="/consent-photo" element={<ConsentPhotoPage />} />
    <Route path="/consent-privacy" element={<ConsentPrivacyPage />} />

    {/* Protected pages */}
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

    {/* Admin pages */}
    <Route path="/admin-panel" element={<AdminPanel />} />
    <Route path="/admin-profile-editor" element={<AdminProfileEditor />} />

    {/* Logout */}
    <Route path="/logout" element={<LogoutPage />} />

    {/* Fallback */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
</Layout>
  );
};

export default App;
