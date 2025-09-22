// src/App.tsx
import React, { useEffect, useState, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

import { SessionTimeoutProvider } from './contexts/SessionTimeoutContext';
import { BrandingConfig, getCurrentBranding } from './branding.config';
import { BrandingContext } from './BrandingContext';

// ❌ Do NOT import or use AuthProvider here — it lives in index.tsx
// ❌ Do NOT import or use AdminAuthProvider here — it lives in index.tsx

import DemoBanner from './components/layout/DemoBanner';
import AppHeader from './components/layout/AppHeader';
import Footer from './components/layout/Footer';

import RequireAuth from './components/auth/RequireAuth';
import RequireAdminAuth from './components/auth/RequireAdminAuth';

import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import NotFoundPage from './components/NotFoundPage';
import AdminLoginPage from './pages/AdminLoginPage';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
// If your tsconfig doesn't set baseUrl to "src", change this to './pages/Home'
import Home from 'pages/Home';

// ✅ Gate wrapper (does not replace AuthProvider)
import AuthGate from './AuthGate';

// Lazy-loaded pages/components
const WelcomePage = React.lazy(() => import('./pages/WelcomePage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const VerifyCodePage = React.lazy(() => import('./pages/VerifyCodePage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const HealthTrackerPage = React.lazy(() => import('./pages/HealthTrackerPage'));
const HelpPage = React.lazy(() => import('./pages/AIHelpPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const CheckInPage = React.lazy(() => import('./pages/CheckInPage'));
const WordFindPage = React.lazy(() => import('./pages/WordFindPage'));
const MealDetailPage = React.lazy(() => import('./pages/MealDetailPage'));
const LogoutPage = React.lazy(() => import('./pages/LogoutPage'));
const ConsentPhotoPage = React.lazy(() => import('./pages/ConsentPhotoPage'));
const ConsentPrivacyPage = React.lazy(() => import('./pages/ConsentPrivacyPage'));
const SelfReportingPage = React.lazy(() => import('./pages/SelfReportingPage'));
const DoctorsViewPage = React.lazy(() => import('./pages/DoctorsViewPage'));
const AdminPanel = React.lazy(() => import('./components/admin/AdminPanel'));
const AdminProfileEditorPage = React.lazy(() => import('./pages/AdminProfileEditorPage'));
const CommunityMoments = React.lazy(() => import('./components/CommunityMoments'));
const DemographicsPage = React.lazy(() => import('./pages/DemographicsPage'));
const TriviaGame = React.lazy(() => import('./components/TriviaGame'));
const CaregiverDashboardPage = React.lazy(() => import('./pages/CaregiverDashboardPage'));
const HealthInsightsPage = React.lazy(() => import('./pages/HealthInsightsPage'));

const PUBLIC_ROUTES = [
  '/',
  '/register',
  '/verify',
  '/privacy-policy',
  '/terms',
  '/login',
  '/admin-login',
  '/change-password',
  '/reset-password',
  '/home',
];

function Shell() {
  const [branding, setBranding] = useState<BrandingConfig>(getCurrentBranding());
  const location = useLocation();
  const isPublic = PUBLIC_ROUTES.includes(location.pathname);

  useEffect(() => {
    setBranding(getCurrentBranding());
  }, [location.pathname]);

  return (
    <BrandingContext.Provider value={{ branding, setBranding }}>
      {/* SessionTimeout applies to the whole app */}
      <SessionTimeoutProvider>
        <AppHeader />

        <AuthGate>
          <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<WelcomePage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify" element={<VerifyCodePage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/admin-login" element={<AdminLoginPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/home" element={<Home />} />

              {/* Protected */}
              <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
              <Route path="/health-insights" element={<RequireAuth><HealthInsightsPage /></RequireAuth>} />
              <Route path="/health-dashboard" element={<RequireAuth><HealthTrackerPage /></RequireAuth>} />
              <Route path="/help" element={<RequireAuth><HelpPage /></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
              <Route path="/check-in" element={<RequireAuth><CheckInPage /></RequireAuth>} />
              <Route path="/word-find" element={<RequireAuth><WordFindPage /></RequireAuth>} />
              <Route path="/meals/:id" element={<RequireAuth><MealDetailPage /></RequireAuth>} />
              <Route path="/logout" element={<RequireAuth><LogoutPage /></RequireAuth>} />
              <Route path="/consent-photo" element={<RequireAuth><ConsentPhotoPage /></RequireAuth>} />
              <Route path="/consent-privacy" element={<RequireAuth><ConsentPrivacyPage /></RequireAuth>} />
              <Route path="/self-reporting" element={<RequireAuth><SelfReportingPage /></RequireAuth>} />
              <Route path="/doctors-view" element={<RequireAuth><DoctorsViewPage /></RequireAuth>} />
              <Route path="/community" element={<RequireAuth><CommunityMoments /></RequireAuth>} />
              <Route path="/trivia-game" element={<RequireAuth><TriviaGame /></RequireAuth>} />

              {/* Caregiver Dashboard */}
              <Route path="/caregiver-dashboard" element={<RequireAuth><CaregiverDashboardPage /></RequireAuth>} />

              {/* Post-login gated */}
              <Route path="/demographics" element={<RequireAuth><DemographicsPage /></RequireAuth>} />

              {/* Admin (requires user + admin pin) */}
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <RequireAdminAuth>
                      <AdminPanel />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin-profile-editor"
                element={
                  <RequireAuth>
                    <RequireAdminAuth>
                      <AdminProfileEditorPage />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>

          <Footer />
        </AuthGate>
      </SessionTimeoutProvider>
    </BrandingContext.Provider>
  );
}

const App: React.FC = () => {
  return <Shell />;
};

export default App;