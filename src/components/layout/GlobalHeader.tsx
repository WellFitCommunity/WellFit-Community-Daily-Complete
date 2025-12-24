// src/components/layout/GlobalHeader.tsx - Complete Updated Header for Senior-Focused Navigation
// UPDATED: Added all health features, games submenu, caregiver access
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  ChevronDown,
  Heart,
  Gamepad2,
  Calendar,
  Pill,
  Stethoscope,
  Activity,
  Watch,
  Syringe,
  ClipboardList,
  AlertCircle,
  Users,
  MessageCircle,
  User,
  Settings,
  HelpCircle,
  LogOut,
  ExternalLink,
  UserCheck,
  Phone,
  Home,
  Smile,
  BookOpen,
} from 'lucide-react';
import { useBranding } from '../../BrandingContext';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useLanguage } from '../../contexts/LanguageContext';

const WELLFIT_BLUE = '#003865';
const WELLFIT_GREEN = '#8cc63f';
const MID_GLINT = 'rgba(255,255,255,0.12)';

// Complete route definitions
const ROUTES = {
  // Main
  dashboard: '/dashboard',
  logout: '/logout',

  // Health Hub
  myHealth: '/my-health',
  healthInsights: '/health-insights',
  checkIn: '/check-in',
  telehealth: '/telehealth-appointments',
  medicineCabinet: '/medicine-cabinet',
  carePlans: '/care-plans',
  conditions: '/conditions',
  allergies: '/allergies',
  healthObservations: '/health-observations',
  immunizations: '/immunizations',
  wearables: '/wearables',

  // Games & Activities
  selfReport: '/self-reporting',
  trivia: '/memory-lane-trivia',
  wordFind: '/word-find',

  // Community & Support
  community: '/community',
  questions: '/questions',
  doctorsView: '/doctors-view',
  help: '/help',

  // Profile & Settings
  profile: '/profile',
  demographics: '/demographics',
  settings: '/settings',
  caregiverPin: '/set-caregiver-pin',

  // Admin (conditional)
  adminPanel: '/admin',
  adminQuestions: '/admin-questions',
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
  const [healthOpen, setHealthOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const healthRef = useRef<HTMLDivElement>(null);
  const gamesRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const { branding } = useBranding();
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const { t } = useLanguage();

  const primary = branding?.primaryColor || WELLFIT_BLUE;
  const secondary = branding?.secondaryColor || WELLFIT_GREEN;
  const textHex = branding?.textColor || readableTextOn(primary);
  const textColor = useMemo(() => (textHex === '#000000' ? 'text-gray-800' : 'text-white'), [textHex]);

  const linkBase = `${textColor} hover:opacity-90 transition`;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const headerBackground = branding?.gradient
    ? branding.gradient
    : `linear-gradient(90deg, ${secondary} 0%, ${MID_GLINT} 48%, ${primary} 100%)`;

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (healthRef.current && !healthRef.current.contains(event.target as Node)) {
        setHealthOpen(false);
      }
      if (gamesRef.current && !gamesRef.current.contains(event.target as Node)) {
        setGamesOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close all dropdowns on route change
  useEffect(() => {
    setHealthOpen(false);
    setGamesOpen(false);
    setMoreOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="shadow-md relative z-30 backdrop-blur-sm" style={{ background: headerBackground, color: textHex }}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white text-[#003865] px-3 py-1 rounded-sm"
      >
        Skip to content
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand */}
          <Link to={ROUTES.dashboard} className={`flex items-center ${textColor} text-xl font-semibold tracking-tight hover:opacity-90`}>
            {branding?.logoUrl && (
              <img src={branding.logoUrl} alt="WellFit Logo" className="h-10 w-auto mr-3 rounded-md" />
            )}
            {branding?.appName || 'WellFit Community'}
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-1">
            {/* Home */}
            <HeaderLink to={ROUTES.dashboard} active={isActive(ROUTES.dashboard)} className={linkBase}>
              <Home className="w-4 h-4 mr-1.5 inline" />
              {t.nav.home}
            </HeaderLink>

            {/* My Health Dropdown */}
            <div className="relative" ref={healthRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={healthOpen}
                onClick={() => {
                  setHealthOpen(!healthOpen);
                  setGamesOpen(false);
                  setMoreOpen(false);
                }}
                className={`flex items-center px-3 py-2 rounded-lg ${textColor} hover:bg-white/10 focus:outline-hidden focus:ring-2 focus:ring-white font-medium`}
              >
                <Heart className="w-4 h-4 mr-1.5" />
                My Health
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${healthOpen ? 'rotate-180' : ''}`} />
              </button>
              {healthOpen && (
                <div
                  role="menu"
                  className="absolute left-0 mt-2 w-72 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10 z-50"
                >
                  <div className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Health Hub</div>
                    <DropdownItem to={ROUTES.myHealth} icon={<Activity className="w-4 h-4 text-blue-500" />}>
                      My Health Hub
                    </DropdownItem>
                    <DropdownItem to={ROUTES.checkIn} icon={<Smile className="w-4 h-4 text-green-500" />}>
                      Daily Check-In
                    </DropdownItem>
                    <DropdownItem to={ROUTES.healthInsights} icon={<Stethoscope className="w-4 h-4 text-purple-500" />}>
                      Health Insights
                    </DropdownItem>
                    <DropdownItem to={ROUTES.telehealth} icon={<Phone className="w-4 h-4 text-teal-500" />}>
                      Telehealth Appointments
                    </DropdownItem>

                    <div className="border-t my-2" />
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Medical Records</div>
                    <DropdownItem to={ROUTES.medicineCabinet} icon={<Pill className="w-4 h-4 text-orange-500" />}>
                      Medicine Cabinet
                    </DropdownItem>
                    <DropdownItem to={ROUTES.carePlans} icon={<ClipboardList className="w-4 h-4 text-indigo-500" />}>
                      Care Plans
                    </DropdownItem>
                    <DropdownItem to={ROUTES.conditions} icon={<Heart className="w-4 h-4 text-red-500" />}>
                      My Conditions
                    </DropdownItem>
                    <DropdownItem to={ROUTES.allergies} icon={<AlertCircle className="w-4 h-4 text-yellow-500" />}>
                      Allergies
                    </DropdownItem>
                    <DropdownItem to={ROUTES.immunizations} icon={<Syringe className="w-4 h-4 text-cyan-500" />}>
                      Immunizations
                    </DropdownItem>
                    <DropdownItem to={ROUTES.healthObservations} icon={<Activity className="w-4 h-4 text-pink-500" />}>
                      Health Observations
                    </DropdownItem>
                    <DropdownItem to={ROUTES.wearables} icon={<Watch className="w-4 h-4 text-gray-500" />}>
                      Wearable Devices
                    </DropdownItem>
                  </div>
                </div>
              )}
            </div>

            {/* Games & Activities Dropdown */}
            <div className="relative" ref={gamesRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={gamesOpen}
                onClick={() => {
                  setGamesOpen(!gamesOpen);
                  setHealthOpen(false);
                  setMoreOpen(false);
                }}
                className={`flex items-center px-3 py-2 rounded-lg ${textColor} hover:bg-white/10 focus:outline-hidden focus:ring-2 focus:ring-white font-medium`}
              >
                <Gamepad2 className="w-4 h-4 mr-1.5" />
                Games
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${gamesOpen ? 'rotate-180' : ''}`} />
              </button>
              {gamesOpen && (
                <div
                  role="menu"
                  className="absolute left-0 mt-2 w-64 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10 z-50"
                >
                  <div className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Brain Games</div>
                    <DropdownItem to={ROUTES.trivia} icon={<BookOpen className="w-4 h-4 text-purple-500" />}>
                      {t.nav.memoryLane}
                    </DropdownItem>
                    <DropdownItem to={ROUTES.wordFind} icon={<Gamepad2 className="w-4 h-4 text-blue-500" />}>
                      {t.nav.wordFind}
                    </DropdownItem>

                    <div className="border-t my-2" />
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Wellness</div>
                    <DropdownItem to={ROUTES.selfReport} icon={<Smile className="w-4 h-4 text-green-500" />}>
                      {t.nav.selfReport}
                    </DropdownItem>
                  </div>
                </div>
              )}
            </div>

            {/* Community */}
            <HeaderLink to={ROUTES.community} active={isActive(ROUTES.community)} className={linkBase}>
              <Users className="w-4 h-4 mr-1.5 inline" />
              {t.nav.community}
            </HeaderLink>

            {/* More Menu */}
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => {
                  setMoreOpen(!moreOpen);
                  setHealthOpen(false);
                  setGamesOpen(false);
                }}
                className={`flex items-center px-3 py-2 rounded-lg ${textColor} hover:bg-white/10 focus:outline-hidden focus:ring-2 focus:ring-white font-medium`}
              >
                {t.nav.more}
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10 z-50"
                >
                  <div className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Support</div>
                    <DropdownItem to={ROUTES.questions} icon={<MessageCircle className="w-4 h-4 text-blue-500" />}>
                      {t.nav.askNurse}
                    </DropdownItem>
                    <DropdownItem to={ROUTES.doctorsView} icon={<Stethoscope className="w-4 h-4 text-purple-500" />}>
                      {t.nav.doctorsView}
                    </DropdownItem>
                    <DropdownItem to={ROUTES.help} icon={<HelpCircle className="w-4 h-4 text-gray-500" />}>
                      Help Center
                    </DropdownItem>

                    <div className="border-t my-2" />
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Family Access</div>
                    <DropdownItem to={ROUTES.caregiverPin} icon={<UserCheck className="w-4 h-4 text-green-500" />}>
                      Set Caregiver PIN
                    </DropdownItem>

                    <div className="border-t my-2" />
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">My Account</div>
                    <DropdownItem to={ROUTES.profile} icon={<User className="w-4 h-4 text-blue-500" />}>
                      My Profile
                    </DropdownItem>
                    <DropdownItem to={ROUTES.demographics} icon={<ClipboardList className="w-4 h-4 text-indigo-500" />}>
                      {t.nav.myInformation}
                    </DropdownItem>
                    <DropdownItem to={ROUTES.settings} icon={<Settings className="w-4 h-4 text-gray-500" />}>
                      {t.nav.settings}
                    </DropdownItem>

                    {isAdmin === true && (
                      <>
                        <div className="border-t my-2" />
                        <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</div>
                        <DropdownItem to={ROUTES.adminPanel} icon={<Settings className="w-4 h-4 text-orange-500" />}>
                          Admin Panel
                        </DropdownItem>
                        <DropdownItem to={ROUTES.adminQuestions} icon={<MessageCircle className="w-4 h-4 text-orange-500" />}>
                          Nurse Questions
                        </DropdownItem>
                      </>
                    )}

                    <div className="border-t my-2" />
                    <a
                      href="https://www.TheWellFitCommunity.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                      role="menuitem"
                    >
                      <ExternalLink className="w-4 h-4 mr-3 text-gray-400" />
                      {t.nav.visitWebsite}
                    </a>
                    <Link
                      to={ROUTES.logout}
                      className="flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-semibold"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      {t.nav.logout}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`md:hidden ${textColor} focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-white p-2`}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav - Complete reorganization */}
      {menuOpen && (
        <nav className="md:hidden px-4 pb-6 space-y-1 max-h-[80vh] overflow-y-auto">
          {/* Home */}
          <MobileItem to={ROUTES.dashboard} icon={<Home className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            {t.nav.home}
          </MobileItem>

          {/* Health Section */}
          <div className="pt-3 pb-1">
            <div className="text-white/60 text-xs uppercase tracking-wider font-semibold px-2">My Health</div>
          </div>
          <MobileItem to={ROUTES.myHealth} icon={<Activity className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            Health Hub
          </MobileItem>
          <MobileItem to={ROUTES.checkIn} icon={<Smile className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            Daily Check-In
          </MobileItem>
          <MobileItem to={ROUTES.telehealth} icon={<Phone className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            Telehealth
          </MobileItem>
          <MobileItem to={ROUTES.medicineCabinet} icon={<Pill className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            Medicine Cabinet
          </MobileItem>
          <MobileItem to={ROUTES.carePlans} icon={<ClipboardList className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            Care Plans
          </MobileItem>
          <MobileItem to={ROUTES.healthInsights} icon={<Stethoscope className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            Health Insights
          </MobileItem>

          {/* Games Section */}
          <div className="pt-3 pb-1">
            <div className="text-white/60 text-xs uppercase tracking-wider font-semibold px-2">Games & Activities</div>
          </div>
          <MobileItem to={ROUTES.trivia} icon={<BookOpen className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            {t.nav.memoryLane}
          </MobileItem>
          <MobileItem to={ROUTES.wordFind} icon={<Gamepad2 className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            {t.nav.wordFind}
          </MobileItem>
          <MobileItem to={ROUTES.selfReport} icon={<Smile className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            {t.nav.selfReport}
          </MobileItem>

          {/* Community Section */}
          <div className="pt-3 pb-1">
            <div className="text-white/60 text-xs uppercase tracking-wider font-semibold px-2">Community & Support</div>
          </div>
          <MobileItem to={ROUTES.community} icon={<Users className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            {t.nav.community}
          </MobileItem>
          <MobileItem to={ROUTES.questions} icon={<MessageCircle className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            {t.nav.askNurse}
          </MobileItem>
          <MobileItem to={ROUTES.doctorsView} icon={<Stethoscope className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            {t.nav.doctorsView}
          </MobileItem>

          {/* Family Access */}
          <div className="pt-3 pb-1">
            <div className="text-white/60 text-xs uppercase tracking-wider font-semibold px-2">Family Access</div>
          </div>
          <MobileItem to={ROUTES.caregiverPin} icon={<UserCheck className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            Set Caregiver PIN
          </MobileItem>

          {/* Admin Section (if applicable) */}
          {isAdmin === true && (
            <>
              <div className="pt-3 pb-1">
                <div className="text-white/60 text-xs uppercase tracking-wider font-semibold px-2">Admin</div>
              </div>
              <MobileItem to={ROUTES.adminPanel} icon={<Settings className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
                Admin Panel
              </MobileItem>
              <MobileItem to={ROUTES.adminQuestions} icon={<MessageCircle className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
                Nurse Questions
              </MobileItem>
            </>
          )}

          {/* Account Section */}
          <div className="pt-3 pb-1">
            <div className="text-white/60 text-xs uppercase tracking-wider font-semibold px-2">My Account</div>
          </div>
          <MobileItem to={ROUTES.profile} icon={<User className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            My Profile
          </MobileItem>
          <MobileItem to={ROUTES.demographics} icon={<ClipboardList className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            {t.nav.myInformation}
          </MobileItem>
          <MobileItem to={ROUTES.settings} icon={<Settings className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            {t.nav.settings}
          </MobileItem>
          <MobileItem to={ROUTES.help} icon={<HelpCircle className="w-5 h-5" />} onDone={() => setMenuOpen(false)}>
            Help Center
          </MobileItem>

          {/* External Link & Logout */}
          <div className="pt-4 space-y-3">
            <a
              href="https://www.TheWellFitCommunity.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg font-semibold text-white shadow-md"
              style={{ backgroundColor: WELLFIT_GREEN }}
              onClick={() => setMenuOpen(false)}
            >
              <ExternalLink className="w-4 h-4" />
              {t.nav.visitWebsite}
            </a>

            <Link
              to={ROUTES.logout}
              className="flex items-center justify-center gap-2 text-red-200 hover:text-red-100 transition py-3"
              onClick={() => setMenuOpen(false)}
            >
              <LogOut className="w-4 h-4" />
              {t.nav.logout}
            </Link>
          </div>
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
    <Link to={to} className={`${className} relative px-3 py-2 rounded-lg hover:bg-white/10 font-medium flex items-center`}>
      {children}
      {active && <span className="absolute -bottom-1 left-3 right-3 h-0.5 bg-white/80 rounded-full" />}
    </Link>
  );
}

function DropdownItem({
  to,
  icon,
  children
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      role="menuitem"
    >
      <span className="mr-3">{icon}</span>
      {children}
    </Link>
  );
}

function MobileItem({
  to,
  icon,
  onDone,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  onDone: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onDone}
      className="flex items-center gap-3 text-white/90 hover:text-white hover:bg-white/10 transition px-3 py-2.5 rounded-lg"
    >
      <span className="text-white/70">{icon}</span>
      <span className="text-base">{children}</span>
    </Link>
  );
}
