import React, { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

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

import AdminProfileEditor from './components/AdminProfileEditor';
import ConsentPhotoPage from './pages/ConsentPhotoPage';
import ConsentPrivacyPage from './pages/ConsentPrivacyPage';
import DoctorsView from './pages/DoctorsViewPage';
import RequireAuth from './components/auth/RequireAuth';
import SelfReportingPage from './pages/SelfReportingPage';

import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import NotFoundPage from './components/NotFoundPage';

import { DemoModeProvider } from './contexts/DemoModeContext';
import { SessionTimeoutProvider } from './contexts/SessionTimeoutContext';
import DemoBanner from './components/layout/DemoBanner';


// Public routes for which you do NOT want to show the header
const publicRoutes = [
  '/',
  '/register',
  '/verify',
  '/privacy-policy',
  '/terms',
];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.includes(pathname);
}

const App: React.FC = () => {
  const [branding, setBranding] = useState<BrandingConfig>(getCurrentBranding());
  const location = useLocation();

  useEffect(() => {
    setBranding(getCurrentBranding());
  }, []);

  const showHeader = !isPublicRoute(location.pathname);

  return (
    <DemoModeProvider>
      <BrandingContext.Provider value={branding}>
        <SessionTimeoutProvider>
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

            {/* WILDCARD */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Footer />
        </SessionTimeoutProvider>
      </BrandingContext.Provider>
    </DemoModeProvider>
  );
};

export default App;
