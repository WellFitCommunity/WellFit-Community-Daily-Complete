import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { BrandingConfig, getCurrentBranding } from './branding.config';
import { BrandingContext } from './BrandingContext';
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
import DoctorsView from './components/DoctorsView';
import SelfReportingPage from './components/SelfReportingPage'; // Added import

// 👇 NEW import
import { requestNotificationPermission } from './utils/requestNotificationPermission';

const Layout: React.FC<{ children: React.ReactNode; branding: BrandingConfig }> = ({ children, branding }) => {
  const location = useLocation();
  const showHeaderFooter = location.pathname !== '/';

  return (
    <div 
      className="min-h-screen flex flex-col text-white"
      style={{ background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})` }}
    >
      {showHeaderFooter && <Header />}
      <main className="flex-grow p-4">{children}</main>
      {showHeaderFooter && <Footer />}
    </div>
  );
};

const App: React.FC = () => {
  const [branding, setBranding] = useState<BrandingConfig>(getCurrentBranding());

  useEffect(() => {
    // Potentially update branding if it can change dynamically, e.g., based on a user setting
    // For now, it's set once on init based on subdomain
    setBranding(getCurrentBranding());
  }, []);

  // 👇 Add useEffect to request notification token
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
<BrandingContext.Provider value={branding}>
  <Layout branding={branding}>
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
    <Route
      path="/doctors-view"
      element={
        <RequireAuth>
          <DoctorsView />
        </RequireAuth>
      }
    />
    <Route
      path="/self-reporting" // Added route
      element={
        <RequireAuth>
          <SelfReportingPage />
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
</BrandingContext.Provider>
  );
};

export default App;
