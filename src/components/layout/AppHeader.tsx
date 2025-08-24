import React from 'react';
import { useLocation } from 'react-router-dom';
import GlobalHeader from './GlobalHeader';
import WelcomeHeader from './WelcomeHeader';

const WELCOME_ROUTES = ['/welcome', '/']; // adjust if needed

export default function AppHeader() {
  const { pathname } = useLocation();
  const isWelcome = WELCOME_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return isWelcome ? <WelcomeHeader /> : <GlobalHeader />;
}
