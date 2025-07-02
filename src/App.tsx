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
import WelcomePage from './pages/WelcomePage';
import RegisterPage from './pages/RegisterPage';
import VerifyCodePage from './pages/VerifyCodePage';
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
import AdminPanel from './components/admin/AdminPanel'; // Import AdminPanel
import AdminProfileEditor from './components/AdminProfileEditor';
import RequireAdminAuth from './components/auth/RequireAdminAuth'; // Import RequireAdminAuth

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

            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<WelcomePage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify" element={<VerifyCodePage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />

              {/* Protected Routes */}
              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/check-in" element={<RequireAuth><CheckInTracker /></RequireAuth>} />
              <Route path="/word-find" element={<RequireAuth><WordFind /></RequireAuth>} />
              <Route path="/meals/:id" element={<RequireAuth><MealDetailPage /></RequireAuth>} />
              <Route path="/logout" element={<RequireAuth><LogoutPage /></RequireAuth>} />
              <Route path="/consent-photo" element={<RequireAuth><ConsentPhotoPage /></RequireAuth>} />
              <Route path="/consent-privacy" element={<RequireAuth><ConsentPrivacyPage /></RequireAuth>} />
              <Route path="/self-reporting" element={<RequireAuth><SelfReportingPage /></RequireAuth>} />
              <Route path="/doctors-view" element={<RequireAuth><DoctorsView /></RequireAuth>} />

              {/* Admin Routes */}
              {/* /admin is where an admin would go to enter their PIN via AdminPanel */}
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    {/* AdminPanel now uses AdminAuthContext to show login or content */}
                    <AdminPanel />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin-profile-editor"
                element={
                  <RequireAuth>
                    <RequireAdminAuth>
                      <AdminProfileEditor />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              {/* Add other admin routes here, wrapped similarly with RequireAdminAuth */}

              {/* Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>

              <Footer />
            </SessionTimeoutProvider>
          </AdminAuthProvider>
        </BrandingContext.Provider>
      </DemoModeProvider>
    </AuthProvider>
  );
};

export default App;
