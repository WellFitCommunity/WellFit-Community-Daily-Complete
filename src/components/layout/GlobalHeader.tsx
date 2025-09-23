// src/components/layout/GlobalHeader.tsx - Complete Updated Header for Senior-Focused Navigation
import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, MoreVertical } from 'lucide-react';
import { useBranding } from '../../BrandingContext';
import { useIsAdmin } from '../../hooks/useIsAdmin';

const WELLFIT_BLUE = '#003865';
const WELLFIT_GREEN = '#8cc63f';
const MID_GLINT = 'rgba(255,255,255,0.12)'; // subtle white shimmer

const ROUTES = {
  dashboard: '/dashboard',
  healthDashboard: '/health-insights',
  questions: '/questions',
  selfReport: '/self-reporting',
  wordFind: '/word-find',
  doctors: '/doctors-view',
  trivia: '/trivia-game',
  community: '/community',
  adminPanel: '/admin/panel',
  adminLogin: '/admin',
  logout: '/logout',
};

function readableTextOn(bgHex: string): '#000000' | '#ffffff' {
  const hex = (bgHex || WELLFIT_BLUE).replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

export default function GlobalHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const { branding } = useBranding();
  const location = useLocation();
  const isAdmin = useIsAdmin();

  const primary = branding?.primaryColor || WELLFIT_BLUE;
  const secondary = branding?.secondaryColor || WELLFIT_GREEN;

  // Prefer explicit textColor; else compute readable on primary
  const textHex = branding?.textColor || readableTextOn(primary);
  const textColor = useMemo(() => (textHex === '#000000' ? 'text-gray-800' : 'text-white'), [textHex]);

  const linkBase = `${textColor} hover:opacity-90 transition`;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  // Use tenant gradient if supplied; else fall back to WellFit + shimmer blend
  const headerBackground = branding?.gradient
    ? branding.gradient
    : `linear-gradient(90deg, ${secondary} 0%, ${MID_GLINT} 48%, ${primary} 100%)`;

  return (
    <header className="shadow-md relative z-30 backdrop-blur" style={{ background: headerBackground, color: textHex }}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white text-[#003865] px-3 py-1 rounded"
      >
        Skip to content
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand */}
          <div className={`flex items-center ${textColor} text-xl font-semibold tracking-tight`}>
            {branding?.logoUrl && (
              <img src={branding.logoUrl} alt="WellFit Logo" className="h-10 w-auto mr-3 rounded-md" />
            )}
            {branding?.appName || 'WellFit Community'}
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-4">
            <HeaderLink to={ROUTES.dashboard} active={isActive(ROUTES.dashboard)} className={linkBase}>
              Dashboard
            </HeaderLink>
            <HeaderLink to={ROUTES.healthDashboard} active={isActive(ROUTES.healthDashboard)} className={linkBase}>
              Health Tracker
            </HeaderLink>
            <HeaderLink to={ROUTES.questions} active={isActive(ROUTES.questions)} className={linkBase}>
              Ask Nurse
            </HeaderLink>
            <HeaderLink to={ROUTES.selfReport} active={isActive(ROUTES.selfReport)} className={linkBase}>
              Self-Report
            </HeaderLink>
            <HeaderLink to={ROUTES.doctors} active={isActive(ROUTES.doctors)} className={linkBase}>
              Doctor's View
            </HeaderLink>
            <HeaderLink to={ROUTES.wordFind} active={isActive(ROUTES.wordFind)} className={linkBase}>
              Word Find
            </HeaderLink>
            <HeaderLink to={ROUTES.trivia} active={isActive(ROUTES.trivia)} className={linkBase}>
              Memory Lane
            </HeaderLink>
            <HeaderLink to={ROUTES.community} active={isActive(ROUTES.community)} className={linkBase}>
              Community
            </HeaderLink>

            {/* Website button - Made more prominent */}
            <a
              href="https://www.TheWellFitCommunity.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 rounded-lg font-semibold text-white shadow-md hover:shadow-lg transition-all duration-200 ml-2"
              style={{ backgroundColor: '#8cc63f' }}
            >
              🌐 Visit Website
            </a>

            {/* Ellipsis menu */}
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
                className={`p-2 rounded ${textColor} hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white`}
                title="More"
              >
                <MoreVertical size={20} aria-hidden="true" />
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black/5 z-40"
                  onMouseLeave={() => setMoreOpen(false)}
                >
                  {isAdmin === true && (
                    <>
                      <MenuItem to={ROUTES.adminPanel}>Admin Panel</MenuItem>
                      <MenuItem to="/admin-questions">Nurse Questions</MenuItem>
                      <div className="border-t my-1" />
                    </>
                  )}
                  <MenuItem to="/demographics">My Information</MenuItem>
                  <MenuItem to="/settings">Settings</MenuItem>
                  <a
                    href="https://www.TheWellFitCommunity.org/support"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    role="menuitem"
                  >
                    Help Center
                  </a>
                  <div className="border-t my-1" />
                  <Link
                    to={ROUTES.logout}
                    className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                    role="menuitem"
                  >
                    Log Out
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`md:hidden ${textColor} focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white`}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {menuOpen && (
        <nav className="md:hidden px-4 pb-4 space-y-2" onClick={() => setMoreOpen(false)}>
          <MobileItem to={ROUTES.dashboard} onDone={() => setMenuOpen(false)}>
            Dashboard
          </MobileItem>
          <MobileItem to={ROUTES.healthDashboard} onDone={() => setMenuOpen(false)}>
            Health Tracker
          </MobileItem>
          <MobileItem to={ROUTES.questions} onDone={() => setMenuOpen(false)}>
            Ask Nurse
          </MobileItem>
          <MobileItem to={ROUTES.selfReport} onDone={() => setMenuOpen(false)}>
            Self-Report
          </MobileItem>
          <MobileItem to={ROUTES.doctors} onDone={() => setMenuOpen(false)}>
            Doctor's View
          </MobileItem>
          <MobileItem to={ROUTES.wordFind} onDone={() => setMenuOpen(false)}>
            Word Find
          </MobileItem>
          <MobileItem to={ROUTES.trivia} onDone={() => setMenuOpen(false)}>
            Memory Lane
          </MobileItem>
          <MobileItem to={ROUTES.community} onDone={() => setMenuOpen(false)}>
            Community
          </MobileItem>

          {isAdmin === true && (
            <>
              <MobileItem to={ROUTES.adminPanel} onDone={() => setMenuOpen(false)}>
                Admin Panel
              </MobileItem>
              <MobileItem to="/admin-questions" onDone={() => setMenuOpen(false)}>
                Nurse Questions
              </MobileItem>
            </>
          )}

          <MobileItem to="/demographics" onDone={() => setMenuOpen(false)}>
            My Information
          </MobileItem>

          <MobileItem to="/settings" onDone={() => setMenuOpen(false)}>
            Settings
          </MobileItem>

          <MobileItem to="/help" onDone={() => setMenuOpen(false)}>
            Help Center
          </MobileItem>

          <a
            href="https://www.TheWellFitCommunity.org"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center px-4 py-2 rounded-lg font-semibold text-white shadow-md mt-3"
            style={{ backgroundColor: '#8cc63f' }}
            onClick={() => setMenuOpen(false)}
          >
            🌐 Visit Website
          </a>

          <Link
            to={ROUTES.logout}
            className="block text-red-200 hover:text-red-400 transition"
            onClick={() => setMenuOpen(false)}
          >
            Log Out
          </Link>
        </nav>
      )}
    </header>
  );
}

/* Helpers */
function HeaderLink({
  to,
  active,
  className,
  children,
}: {
  to: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link to={to} className={`${className} relative`}>
      <span className="px-0.5">{children}</span>
      {active && <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-white/80 rounded-full" />}
    </Link>
  );
}

function MenuItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" role="menuitem">
      {children}
    </Link>
  );
}

function MobileItem({
  to,
  onDone,
  children,
}: {
  to: string;
  onDone: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link to={to} onClick={onDone} className="block text-white/90 hover:text-white transition">
      {children}
    </Link>
  );
}