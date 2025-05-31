import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

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
import SelfReportingPage from './components/SelfReportingPage'; // Added import
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';


// 👇 NEW import
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
        {/* Add your other pages here, for example: */}
        {/* <Route path="/register" element={<RegisterPage />} /> */}
        {/* <Route path="/demographics" element={<DemographicsPage />} /> */}
        {/* <Route path="/dashboard" element={<Dashboard />} /> */}
        {/* ...other routes... */}
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
      </Routes>
    </BrandingContext.Provider>
  );
};

export default App;