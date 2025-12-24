/**
 * AdminHeader - Envision Atlus Clinical Header
 *
 * Features:
 * - Envision Atlus dark theme design system
 * - Dynamic branding (white-label ready)
 * - WellFit Community access button
 * - Role-based navigation
 * - Dark mode toggle
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useBranding } from '../../BrandingContext';
import {
  Home,
  FileText,
  Key,
  CreditCard,
  Settings,
  LogOut,
  Moon,
  Sun,
  ChevronDown,
  Activity,
  Users,
  Shield,
  ClipboardList,
  Menu,
  X,
  Heart,
} from 'lucide-react';

interface AdminHeaderProps {
  title?: string;
  showRiskAssessment?: boolean;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({
  title,
  showRiskAssessment = true,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminRole, logoutAdmin } = useAdminAuth();
  const { branding } = useBranding();
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('admin_theme');
    if (savedTheme === 'dark') return true;
    if (savedTheme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Dynamic title - use prop, branding, or default
  const headerTitle = title || branding?.appName || 'Envision Atlus';

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'admin_theme') {
        const newTheme = e.newValue;
        if (newTheme === 'dark') {
          setDarkMode(true);
        } else if (newTheme === 'light') {
          setDarkMode(false);
        } else if (newTheme === 'auto') {
          setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('admin_theme', newMode ? 'dark' : 'light');
  };

  const navigateTo = (path: string) => {
    navigate(path);
    setShowSettingsDropdown(false);
    setShowMobileMenu(false);
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  // Navigation items
  const navItems = [
    {
      label: branding?.appName || 'Community',
      path: '/dashboard',
      icon: Home,
      show: true,
      accent: true, // Special styling for community button - uses branding colors
    },
    {
      label: 'Readmission Prevention',
      path: '/community-readmission',
      icon: Heart,
      show: true,
      methodist: true, // Methodist branding
    },
    {
      label: 'Risk Assessment',
      path: '/admin-questions',
      icon: ClipboardList,
      show: showRiskAssessment,
    },
    {
      label: 'Billing',
      path: '/billing',
      icon: CreditCard,
      show: true,
    },
    {
      label: 'API Keys',
      path: '/admin/api-keys',
      icon: Key,
      show: adminRole === 'super_admin',
    },
  ];

  // Settings dropdown items
  const settingsItems = [
    { label: 'Senior Dashboard', path: '/dashboard', icon: Home, show: adminRole === 'super_admin' },
    { label: 'Caregiver Portal', path: '/caregiver-dashboard', icon: Users, show: adminRole === 'super_admin' },
    { label: 'Nurse Dashboard', path: '/nurse-dashboard', icon: Activity, show: adminRole === 'super_admin' },
    { label: 'Physician Dashboard', path: '/physician-dashboard', icon: Shield, show: adminRole === 'super_admin' },
    { divider: true, show: adminRole === 'super_admin' },
    { label: 'Admin Settings', path: '/admin/settings', icon: Settings, show: true },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: FileText, show: true },
    { label: 'System Admin', path: '/admin/system', icon: Shield, show: adminRole === 'super_admin' },
  ];

  return (
    <>
      <header
        className="text-white shadow-xl border-b"
        style={{
          background: branding?.gradient || 'linear-gradient(to right, #003865, #8cc63f)',
          borderColor: branding?.primaryColor || '#002a4d'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo/Title */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                {branding?.logoUrl && (
                  <img
                    src={branding.logoUrl}
                    alt="Logo"
                    className="h-8 w-auto mr-3 rounded-sm"
                  />
                )}
                <div>
                  <h1 className="text-xl font-bold tracking-tight">{headerTitle}</h1>
                  <p className="text-xs text-white/70">Clinical Platform</p>
                </div>
              </div>
            </div>

            {/* Center: Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-2">
              {navItems
                .filter((item) => item.show)
                .map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigateTo(item.path)}
                    className={`
                      inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium
                      transition-all duration-200
                      ${
                        item.accent
                          ? 'text-white shadow-md hover:brightness-90'
                          : 'methodist' in item && item.methodist
                          ? 'bg-[#003087] hover:bg-[#002266] text-white shadow-md border border-blue-400/30'
                          : isActive(item.path)
                          ? 'bg-white/20 text-white'
                          : 'bg-white/10 hover:bg-white/20 text-white/90 hover:text-white'
                      }
                    `}
                    style={item.accent ? { backgroundColor: branding?.secondaryColor || '#8cc63f' } : undefined}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </button>
                ))}

              {/* System Status */}
              <div className="flex items-center px-3 py-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse mr-2" />
                <span className="text-xs text-white/80">Online</span>
              </div>
            </nav>

            {/* Right: Settings & Mobile Menu */}
            <div className="flex items-center space-x-2">
              {/* Dark Mode Toggle (Desktop) */}
              <button
                onClick={toggleDarkMode}
                className="hidden sm:flex items-center justify-center h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* Settings Dropdown (Desktop) */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                  className="inline-flex items-center px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Settings</span>
                  <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showSettingsDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showSettingsDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-800 rounded-lg shadow-xl border border-slate-700 z-50 overflow-hidden">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50">
                      <div className="text-sm font-medium text-white">
                        {adminRole === 'super_admin' ? 'Super Administrator' : 'Administrator'}
                      </div>
                      <div className="text-xs text-slate-400">Session Active</div>
                    </div>

                    {/* Dark Mode Toggle (in dropdown) */}
                    <div className="px-4 py-3 border-b border-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-slate-300">
                          {darkMode ? <Moon className="h-4 w-4 mr-2" /> : <Sun className="h-4 w-4 mr-2" />}
                          <span className="text-sm">Dark Mode</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDarkMode();
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            darkMode ? 'bg-[#00857a]' : 'bg-slate-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              darkMode ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Navigation Items */}
                    <div className="py-2">
                      {settingsItems
                        .filter((item) => item.show)
                        .map((item, idx) =>
                          'divider' in item ? (
                            <div key={`divider-${idx}`} className="border-t border-slate-700 my-2" />
                          ) : (
                            <button
                              key={item.path}
                              onClick={() => navigateTo(item.path!)}
                              className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white flex items-center transition-colors"
                            >
                              {item.icon && <item.icon className="h-4 w-4 mr-3 text-slate-400" />}
                              {item.label}
                            </button>
                          )
                        )}
                    </div>

                    {/* Logout */}
                    <div className="border-t border-slate-700">
                      <button
                        onClick={() => {
                          setShowSettingsDropdown(false);
                          logoutAdmin();
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center transition-colors"
                      >
                        <LogOut className="h-4 w-4 mr-3" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {showMobileMenu && (
          <div
            className="lg:hidden border-t backdrop-blur-sm"
            style={{
              borderColor: branding?.primaryColor || '#002a4d',
              backgroundColor: `${branding?.primaryColor || '#003865'}cc` // 80% opacity
            }}
          >
            <div className="px-4 py-3 space-y-2">
              {navItems
                .filter((item) => item.show)
                .map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigateTo(item.path)}
                    className={`
                      w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
                      ${
                        item.accent
                          ? 'text-white'
                          : 'methodist' in item && item.methodist
                          ? 'bg-[#003087] text-white border border-blue-400/30'
                          : 'bg-white/10 text-white/90 hover:bg-white/20'
                      }
                    `}
                    style={item.accent ? { backgroundColor: branding?.secondaryColor || '#8cc63f' } : undefined}
                  >
                    <item.icon className="h-4 w-4 mr-3" />
                    {item.label}
                  </button>
                ))}

              <div className="border-t border-white/20 pt-2 mt-2">
                <button
                  onClick={() => navigateTo('/admin/settings')}
                  className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm text-white/90 bg-white/10 hover:bg-white/20"
                >
                  <Settings className="h-4 w-4 mr-3" />
                  Admin Settings
                </button>
              </div>

              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-white/80">Dark Mode</span>
                <button
                  onClick={toggleDarkMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    darkMode ? 'bg-white/30' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      darkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  logoutAdmin();
                }}
                className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm text-red-300 bg-red-500/10 hover:bg-red-500/20"
              >
                <LogOut className="h-4 w-4 mr-3" />
                Logout
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Click outside handler for dropdown */}
      {showSettingsDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSettingsDropdown(false)}
        />
      )}
    </>
  );
};

export default AdminHeader;
