import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { BrandingConfig, getCurrentBranding } from './branding.config';
import { BrandingContext } from './BrandingContext';

import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

import WelcomePage from './pages/WelcomePage';
import RegisterPage from './pages/RegisterPage';
import VerifyCodePage from './pages/VerifyCodePage';

import Dashboard from './pages/DashboardPage';
import CheckInTracker from './pages/CheckInPage';
import WordFind from './pages/WordFindPage';
import MealDetailPage from './pages/MealDetailPage';
import LogoutPage from './pages/LogoutPage';

import RequireAuth from './components/auth/RequireAuth';
import AdminPanel from './components/admin/AdminPanel';
import AdminProfileEditor from './pages/AdminProfileEditorPage';
import LockScreenUser from './components/auth/LockScreenUser';
import ConsentPhotoPage from './pages/ConsentPhotoPage';
import ConsentPrivacyPage from './pages/ConsentPrivacyPage';
import DoctorsView from './pages/DoctorsViewPage';
import SelfReportingPage from './pages/SelfReportingPage';

import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';

// Notifications & Demo Mode (optional)
import { requestNotificationPermission } from './utils/requestNotificationPermission';
import { DemoModeProvider } from './contexts/DemoModeContext';
import DemoBanner from './components/layout/DemoBanner';

// Define which routes are "public" (no header)
const publicRoutes = [
  '/',
  '/register',
  '/verify',
  '/privacy-policy',
  '/terms'
];

// Helper: Check if current path is public route (handles dynamic params)
function isPublicRoute(pathname) {
  // For exact matches (static pages)
  if (publicRoutes.includes(pathname)) return true;
  // Add logic here for other patterns if needed
  return false;
}

const App: React.FC = () => {
  const [branding, setBranding] = useState<BrandingConfig>(getCurrentBranding());
  const location = useLocation();

  useEffect(() => {
    setBranding(getCurrentBranding());
  }, []);

  // Show header only if NOT on a public route
  const showHeader = !isPublicRoute(location.pathname);

  return (
    <DemoModeProvider>
      <BrandingContext.Provider value={branding}>
        <DemoBanner />
        {showHeader && <Header />}
        <Routes>
          {/* PUBLIC ROUTES */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<VerifyCodePage />} />
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
        <Footer /> {/* Footer appears on every page */}
      </BrandingContext.Provider>
    </DemoModeProvider>
  );
};

export default App;
