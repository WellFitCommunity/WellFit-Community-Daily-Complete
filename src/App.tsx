import React, { useEffect, useState, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

import { AuthProvider } from './contexts/AuthContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { SessionTimeoutProvider } from './contexts/SessionTimeoutContext';
import { DemoModeProvider } from './contexts/DemoModeContext';
import { BrandingConfig, getCurrentBranding } from './branding.config';
import { BrandingContext } from './BrandingContext';

import DemoBanner from './components/layout/DemoBanner';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

import RequireAuth from './components/auth/RequireAuth';
import RequireAdminAuth from './components/auth/RequireAdminAuth';

import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import NotFoundPage from './components/NotFoundPage';
import AdminLoginPage from './pages/AdminLoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';

// Lazy-loaded pages/components
const WelcomePage = React.lazy(() => import('./pages/WelcomePage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const VerifyCodePage = React.lazy(() => import('./pages/VerifyCodePage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
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

const PUBLIC_ROUTES = ['/', '/register', '/verify', '/privacy-policy', '/terms'];

const App: React.FC = () => {
  const [branding, setBranding] = useState<BrandingConfig>(getCurrentBranding());
  const location = useLocation();
  const isPublic = PUBLIC_ROUTES.includes(location.pathname);

  useEffect(() => {
    setBranding(getCurrentBranding());
  }, [location.pathname]);

  return (
    <AuthProvider>
      <DemoModeProvider>
        <BrandingContext.Provider value={branding}>
          <AdminAuthProvider>
            <SessionTimeoutProvider>
              <DemoBanner />
              {!isPublic && <Header />}
              <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<WelcomePage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/verify" element={<VerifyCodePage />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/change-password" element={<ChangePasswordPage />} />
                  <Route path="/admin-login" element={<AdminLoginPage />} />

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

                  {/* NEW: Community Moments (protected) */}
                  <Route path="/community" element={<RequireAuth><CommunityMoments /></RequireAuth>} />

                  {/* Admin Routes (guarded) */}
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
            </SessionTimeoutProvider>
          </AdminAuthProvider>
        </BrandingContext.Provider>
      </DemoModeProvider>
    </AuthProvider>
  );
};

export default App;     