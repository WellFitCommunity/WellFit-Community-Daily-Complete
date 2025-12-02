import React from 'react';
import { useLocation } from 'react-router-dom';
import GlobalHeader from './GlobalHeader';
import WelcomeHeader from './WelcomeHeader';

const WELCOME_ROUTES = ['/', '/welcome'];
const AUTH_ROUTES = ['/login', '/register', '/verify', '/admin-login', '/reset-password', '/change-password'];

// Routes that have their own AdminHeader (Envision Atlus clinical panels)
// These routes should NOT show the GlobalHeader to avoid double-header
const ENVISION_ATLUS_ROUTES = [
  '/admin',
  '/super-admin',
  '/tenant-selector',
  '/multi-tenant-monitor',
  '/nurse-dashboard',
  '/physician-dashboard',
  '/case-manager',
  '/social-worker',
  '/enroll-senior',
  '/admin-questions',
  '/billing',
  '/photo-approval',
  '/neuro-suite',
  '/physical-therapy',
  '/care-coordination',
  '/referrals',
  '/questionnaire-analytics',
  '/memory-clinic',
  '/mental-health',
  '/frequent-flyer',
  '/revenue-dashboard',
  '/shift-handoff',
  '/discharged-patients',
  '/specialist-dashboard',
  '/field-visit',
  '/fhir-conflicts',
  '/ems-metrics',
  '/coordinated-response',
  '/envision',
  '/time-clock-admin',
  '/tenant-it',
  '/admin-settings',
  '/audit-logs',
  '/system-admin',
  '/healthcare-algorithms',
  '/ai-revenue',
];

export default function AppHeader() {
  const { pathname } = useLocation();

  const isWelcome = WELCOME_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  const isAuthPage = AUTH_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  // Check if this is an Envision Atlus clinical route (has its own AdminHeader)
  const isEnvisionAtlus = ENVISION_ATLUS_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isWelcome) return <WelcomeHeader />;
  if (isAuthPage) return null;
  if (isEnvisionAtlus) return null; // Envision Atlus routes have their own header

  return <GlobalHeader />;
}
