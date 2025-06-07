import { useEffect, useState } from 'react';
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

import AdminProfileEditor from './components/AdminProfileEditor'; // Added back
import ConsentPhotoPage from './components/ConsentPhotoPage';
import ConsentPrivacyPage from './components/ConsentPrivacyPage';
import DoctorsView from './components/DoctorsView'; // Added back
import RequireAuth from './components/RequireAuth';
import SelfReportingPage from './components/SelfReportingPage';

import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import NotFoundPage from './components/NotFoundPage'; // Import NotFoundPage

// Notifications & Demo Mode (optional)
import { requestNotificationPermission } from './utils/requestNotificationPermission';
import { DemoModeProvider } from './contexts/DemoModeContext';
import { SessionTimeoutProvider } from './contexts/SessionTimeoutContext';
import DemoBanner from './components/DemoBanner';

import LockScreenUser from './components/LockScreenUser'; // Import LockScreenUser
import { InactivityLockProvider, useInactivityLock } from './contexts/InactivityLockContext'; // Import InactivityLock

// Define which routes are "public" (no header or inactivity lock)
const publicRoutes = [
  '/',
  '/register',
  '/verify',
  '/lock-screen', // Lock screen itself should not be locked
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

// Main App component adjusted to include InactivityLockProvider and conditional rendering of LockScreenUser
const AppContent: React.FC = () => {
  const location = useLocation();
  const { isLocked } = useInactivityLock(); // Use the hook here

  // Show header only if NOT on a public route and not locked
  const showHeader = !isPublicRoute(location.pathname) && !isLocked;

  if (isLocked && location.pathname !== '/lock-screen') {
    // If locked, and not already on lock-screen, redirect or render LockScreenUser.
    // Navigating here ensures URL changes and LockScreenUser is the main view.
    // We are already navigating to /lock-screen in InactivityLockContext.
    // This logic block might be redundant if navigation in context is reliable.
    // However, ensuring LockScreenUser is rendered if isLocked is true is paramount.
    // This could also be a direct render: return <LockScreenUser />;
  }

  return (
    <>
      {showHeader && <Header />}
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<WelcomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<VerifyCodePage />} />
        <Route path="/lock-screen" element={<LockScreenUser />} />
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
            path="/self-reporting"
            element={
              <RequireAuth>
                <SelfReportingPage />
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
            path="/admin-profile-editor"
            element={
              <RequireAuth>
                <AdminProfileEditor />
              </RequireAuth>
            }
          />
          {/* WILDCARD - Render NotFoundPage */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Footer /> {/* Footer appears on every page */}
        </SessionTimeoutProvider>
      </BrandingContext.Provider>
    </DemoModeProvider>
  );
};

export default App;
