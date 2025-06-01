import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { BrandingConfig, getCurrentBranding } from './branding.config';
import { BrandingContext } from './BrandingContext';

import Header from './components/Header';
import Footer from './components/Footer';

import WelcomePage from './components/WelcomePage';
import RegisterPage from './components/RegisterPage';
// import SeniorEnrollmentPage from './components/SeniorEnrollmentPage'; // Only use if this is your main flow

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
import SelfReportingPage from './components/SelfReportingPage';

import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';

// 👇 NEW import for notifications (if needed)
import { requestNotificationPermission } from './utils/requestNotificationPermission';

const App: React.FC = () => {
  const [branding, setBranding] = useState<BrandingConfig>(getCurrentBranding());

  useEffect(() => {
    setBranding(getCurrentBranding());
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      <Header />

      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<WelcomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* <Route path="/enroll" element={<SeniorEnrollmentPage />} /> */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />

        {/* PROTECTED ROUTES */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/check-in"
          element={
            <RequireAuth>
              <CheckInTracker />
            </RequireAuth>
          }
        />
        <Route
          path="/word-find"
          element={
            <RequireAuth>
              <WordFind />
            </RequireAuth>
          }
        />
        <Route
          path="/meals/:id"
          element={
            <RequireAuth>
              <MealDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/logout"
          element={
            <RequireAuth>
              <LogoutPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin-panel"
          element={
            <RequireAuth>
              <AdminPanel />
            </RequireAuth>
          }
        />
        <Route
          path="/admin-profile-editor"
          element={
            <RequireAuth>
              <AdminProfileEditor />
            </RequireAuth>
          }
        />
        <Route
          path="/lockscreen"
          element={
            <RequireAuth>
              <LockScreenUser />
            </RequireAuth>
          }
        />
        <Route
          path="/consent-photo"
          element={
            <RequireAuth>
              <ConsentPhotoPage />
            </RequireAuth>
          }
        />
        <Route
          path="/consent-privacy"
          element={
            <RequireAuth>
              <ConsentPrivacyPage />
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
          path="/self-reporting"
          element={
            <RequireAuth>
              <SelfReportingPage />
            </RequireAuth>
          }
        />

        {/* WILDCARD - fallback to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </BrandingContext.Provider>
  );
};

export default App;
