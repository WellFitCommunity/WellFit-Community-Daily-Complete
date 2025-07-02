import React, { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

import { AuthProvider } from './contexts/AuthContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext'; // Import AdminAuthProvider
import { SessionTimeoutProvider } from './contexts/SessionTimeoutContext';
import { DemoModeProvider } from './contexts/DemoModeContext';
import { BrandingConfig, getCurrentBranding } from './branding.config';
import { BrandingContext } from './BrandingContext';

import DemoBanner from './components/layout/DemoBanner';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

import RequireAuth from './components/auth/RequireAuth';

// Default import for WelcomePage
// import WelcomePage from './pages/WelcomePage'; // Lazy loaded
// import RegisterPage from './pages/RegisterPage'; // Lazy loaded
// import VerifyCodePage from './pages/VerifyCodePage'; // Lazy loaded
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import NotFoundPage from './components/NotFoundPage';

import Dashboard from './pages/DashboardPage';
import CheckInTracker from './pages/CheckInPage';
import WordFind from './pages/WordFindPage';
import MealDetailPage from './pages/MealDetailPage';
import LogoutPage from './pages/LogoutPage';
import ConsentPhotoPage from './pages/ConsentPhotoPage';
import ConsentPrivacyPage from './pages/ConsentPrivacyPage';
import SelfReportingPage from './pages/SelfReportingPage';
import DoctorsView from './pages/DoctorsViewPage';

// Admin components/pages
// import AdminPanel from './components/admin/AdminPanel'; // Lazy loaded
// import AdminProfileEditor from './components/AdminProfileEditor'; // Lazy loaded
import RequireAdminAuth from './components/auth/RequireAdminAuth'; // Import RequireAdminAuth

// Lazy load pages/components
const WelcomePage = React.lazy(() => import('./pages/WelcomePage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const VerifyCodePage = React.lazy(() => import('./pages/VerifyCodePage'));
// const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy')); // Not strictly needed for lazy load unless large
// const TermsOfService = React.lazy(() => import('./pages/TermsOfService')); // Not strictly needed for lazy load unless large
// const NotFoundPage = React.lazy(() => import('./components/NotFoundPage')); // Usually small

const DashboardPage = React.lazy(() => import('./pages/DashboardPage')); // Renamed Dashboard to DashboardPage for clarity
const CheckInPage = React.lazy(() => import('./pages/CheckInPage')); // Renamed CheckInTracker for consistency
const WordFindPage = React.lazy(() => import('./pages/WordFindPage')); // Renamed WordFind for consistency
const MealDetailPage = React.lazy(() => import('./pages/MealDetailPage'));
const LogoutPage = React.lazy(() => import('./pages/LogoutPage'));
const ConsentPhotoPage = React.lazy(() => import('./pages/ConsentPhotoPage'));
const ConsentPrivacyPage = React.lazy(() => import('./pages/ConsentPrivacyPage'));
const SelfReportingPage = React.lazy(() => import('./pages/SelfReportingPage'));
const DoctorsViewPage = React.lazy(() => import('./pages/DoctorsViewPage')); // Renamed DoctorsView

// Admin components/pages for lazy loading
const AdminPanel = React.lazy(() => import('./components/admin/AdminPanel'));
const AdminProfileEditorPage = React.lazy(() => import('./pages/AdminProfileEditorPage')); // Assuming AdminProfileEditor is a page

// TriviaGame is a component, not a page, might be part of Dashboard or another page.
// If TriviaGame is substantial and used conditionally, it can be lazy loaded where it's used.
// For now, focusing on page-level lazy loading.
// const TriviaGame = React.lazy(() => import('./components/TriviaGame'));


const PUBLIC_ROUTES = ['/', '/register', '/verify', '/privacy-policy', '/terms'];

const App: React.FC = () => {
  const [branding, setBranding] = useState<BrandingConfig>(getCurrentBranding());
  const location = useLocation();

  // Update branding on route change
  useEffect(() => {
    setBranding(getCurrentBranding());
  }, [location.pathname]);

  const isPublic = PUBLIC_ROUTES.includes(location.pathname);

  return (
    <AuthProvider>
      <DemoModeProvider>
        <BrandingContext.Provider value={branding}>
          <AdminAuthProvider> {/* Wrap with AdminAuthProvider */}
            <SessionTimeoutProvider>
              <DemoBanner />
              {!isPublic && <Header />}
              <React.Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<WelcomePage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/verify" element={<VerifyCodePage />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} /> {/* Not lazy loaded, assumed small */}
                  <Route path="/terms" element={<TermsOfService />} /> {/* Not lazy loaded, assumed small */}

                  {/* Protected Routes */}
                  <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
                  <Route path="/check-in" element={<RequireAuth><CheckInPage /></RequireAuth>} />
                  <Route path="/word-find" element={<RequireAuth><WordFindPage /></RequireAuth>} />
                  <Route path="/meals/:id" element={<RequireAuth><MealDetailPage /></RequireAuth>} />
                  <Route path="/logout" element={<RequireAuth><LogoutPage /></RequireAuth>} />
                  <Route path="/consent-photo" element={<RequireAuth><ConsentPhotoPage /></RequireAuth>} />
                  <Route path="/consent-privacy" element={<RequireAuth><ConsentPrivacyPage /></RequireAuth>} />
                  <Route path="/self-reporting" element={<RequireAuth><SelfReportingPage /></RequireAuth>} />
                  <Route path="/doctors-view" element={<RequireAuth><DoctorsViewPage /></RequireAuth>} />

                  {/* Admin Routes */}
                  <Route
                    path="/admin"
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
                        <RequireAdminAuth>
                          <AdminProfileEditorPage />
                        </RequireAdminAuth>
                      </RequireAuth>
                    }
                  />
                  {/* Add other admin routes here, wrapped similarly with RequireAdminAuth */}

                  {/* Fallback */}
                  <Route path="*" element={<NotFoundPage />} /> {/* Not lazy loaded, assumed small */}
                </Routes>
              </React.Suspense>
              <Footer />
            </SessionTimeoutProvider>
          </AdminAuthProvider>
        </BrandingContext.Provider>
      </DemoModeProvider>
    </AuthProvider>
  );
};

export default App;
