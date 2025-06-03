import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { BrandingConfig, getCurrentBranding } from './branding.config';
import { BrandingContext } from './BrandingContext';

import Header from './components/Header';
import Footer from './components/Footer';

import WelcomePage from './components/WelcomePage';
import RegisterPage from './components/RegisterPage';
import VerifyCodePage from './components/VerifyCodePage';

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
import NotFoundPage from './components/NotFoundPage'; // Import NotFoundPage

// Notifications & Demo Mode (optional)
import { requestNotificationPermission } from './utils/requestNotificationPermission';
import { DemoModeProvider } from './contexts/DemoModeContext';
import DemoBanner from './components/DemoBanner';

// Define which routes are "public" (no header)
const publicRoutes = [
  '/',
  '/register',
  '/verify',
  '/privacy-policy',
  '/terms'
];

// Helper: Check if current path is public route (handles dynamic params)
function isPublicRoute(pathname: string): boolean {
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
          {/* WILDCARD - Render NotFoundPage */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Footer /> {/* Footer appears on every page */}
      </BrandingContext.Provider>
    </DemoModeProvider>
  );
};

export default App;
