import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { BrandingConfig, getCurrentBranding } from './branding.config';
import { BrandingContext } from './BrandingContext';
import Header from './components/Header';
import Footer from './components/Footer';
import WelcomePage from './components/WelcomePage';
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

// Make sure you import your REAL registration page:
import RegisterPage from './components/RegisterPage';
// OR (if your file is named SeniorEnrollmentPage)
/// import SeniorEnrollmentPage from './components/SeniorEnrollmentPage';

// 👇 NEW import (if you use notifications)
import { requestNotificationPermission } from './utils/requestNotificationPermission';

const App: React.FC = () => {
  const [branding, setBranding] = useState<BrandingConfig>(getCurrentBranding());

  useEffect(() => {
    setBranding(getCurrentBranding());
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/check-in" element={<CheckInTracker />} />
        <Route path="/word-find" element={<WordFind />} />
        <Route path="/meals/:id" element={<MealDetailPage />} />
        <Route path="/logout" element={<LogoutPage />} />
        <Route path="/admin-panel" element={<AdminPanel />} />
        <Route path="/admin-profile-editor" element={<AdminProfileEditor />} />
        <Route path="/lockscreen" element={<LockScreenUser />} />
        <Route path="/consent-photo" element={<ConsentPhotoPage />} />
        <Route path="/consent-privacy" element={<ConsentPrivacyPage />} />
        <Route path="/doctors-view" element={<DoctorsView />} />
        <Route path="/self-reporting" element={<SelfReportingPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* You may want to add your Header/Footer here if it's not on every page already */}
    </BrandingContext.Provider>
  );
};

export default App;
