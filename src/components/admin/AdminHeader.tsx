import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useBranding } from '../../BrandingContext';

interface AdminHeaderProps {
  title?: string;
  showRiskAssessment?: boolean;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({
  title = "Envision Atlus",
  showRiskAssessment = true
}) => {
  const navigate = useNavigate();
  const { adminRole, logoutAdmin } = useAdminAuth();
  const { branding } = useBranding(); // Get dynamic branding from database
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Initialize from localStorage
    const savedTheme = localStorage.getItem('admin_theme');
    if (savedTheme === 'dark') return true;
    if (savedTheme === 'light') return false;
    // Auto mode - check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply theme on mount and when darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Listen for theme changes from localStorage (e.g., from AdminSettingsPanel)
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

    // Save to localStorage to persist across sessions
    localStorage.setItem('admin_theme', newMode ? 'dark' : 'light');

    // Apply theme to document
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const navigateTo = (path: string) => {
    navigate(path);
  };

  // Envision Atlus branding - Deep Teal, Black, Silver
  const headerBackground = '#006D75'; // Deep teal

  return (
    <div
      className="text-white shadow-2xl border-b-4 border-black"
      style={{
        background: headerBackground
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left section - Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div>
                <h1 className="text-2xl font-bold text-white drop-shadow-md">{title}</h1>
              </div>
            </div>
          </div>

          {/* Center section - Navigation buttons */}
          <div className="hidden lg:flex items-center space-x-2">
            {/* WellFit Community Button */}
            <button
              onClick={() => navigateTo('/dashboard')}
              className="inline-flex items-center px-3 py-2 border border-black rounded-md text-sm font-medium bg-silver hover:bg-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all duration-200 shadow-md"
              style={{ backgroundColor: '#C0C0C0' }}
              title="View WellFit Community"
            >
              <span className="mr-2">🏠</span>
              WellFit
            </button>

            {showRiskAssessment && (
              <button
                onClick={() => navigateTo('/admin-questions')}
                className="inline-flex items-center px-3 py-2 border border-black rounded-md text-sm font-medium bg-silver hover:bg-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all duration-200 shadow-md"
                style={{ backgroundColor: '#C0C0C0' }}
              >
                <span className="mr-2">📋</span>
                Risk Assessment
              </button>
            )}

            {/* Super Admin API Keys */}
            {adminRole === 'super_admin' && (
              <button
                onClick={() => navigateTo('/admin/api-keys')}
                className="inline-flex items-center px-3 py-2 border border-black rounded-md text-sm font-medium bg-silver hover:bg-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all duration-200 shadow-md"
                style={{ backgroundColor: '#C0C0C0' }}
              >
                <span className="mr-2">🔑</span>
                API Keys
              </button>
            )}

            {/* Billing */}
            <button
              onClick={() => navigateTo('/billing')}
              className="inline-flex items-center px-3 py-2 border border-black rounded-md text-sm font-medium bg-silver hover:bg-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all duration-200 shadow-md"
              style={{ backgroundColor: '#C0C0C0' }}
            >
              <span className="mr-2">💳</span>
              Billing
            </button>

            {/* System Status Indicator */}
            <div className="inline-flex items-center px-3 py-2 text-sm font-medium">
              <span className="mr-2 text-green-300 animate-pulse">●</span>
              <span className="text-xs">Online</span>
            </div>
          </div>

          {/* Right section - Settings dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className="inline-flex items-center px-3 py-2 border border-white border-opacity-20 rounded-md text-sm font-medium bg-white bg-opacity-10 hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all duration-200"
            >
              <span className="mr-2">⚙️</span>
              <span className="hidden sm:inline">Settings</span>
              <span className="ml-2">⋯</span>
            </button>

            {/* Settings Dropdown */}
            {showSettingsDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <div className="py-2">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-900">
                      {adminRole === 'super_admin' ? 'Super Administrator' : 'Administrator'}
                    </div>
                    <div className="text-xs text-gray-500">Session Active</div>
                  </div>

                  {/* Theme Toggle */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="mr-3">{darkMode ? '🌙' : '☀️'}</span>
                        <span className="text-sm text-gray-700">Dark Mode</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDarkMode();
                        }}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          darkMode ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            darkMode ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="py-2">
                    {/* Super Admin Only: Cross-Panel Navigation */}
                    {adminRole === 'super_admin' && (
                      <>
                        <button
                          onClick={() => {
                            navigateTo('/dashboard');
                            setShowSettingsDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                        >
                          <span className="mr-3">🏠</span>
                          Senior Dashboard
                        </button>

                        <button
                          onClick={() => {
                            navigateTo('/caregiver-dashboard');
                            setShowSettingsDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                          title="View caregiver dashboard"
                        >
                          <span className="mr-3">👨‍👩‍👧</span>
                          Caregiver Portal
                        </button>

                        <button
                          onClick={() => {
                            navigateTo('/nurse-dashboard');
                            setShowSettingsDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                          title="View nurse dashboard"
                        >
                          <span className="mr-3">👩‍⚕️</span>
                          Nurse Dashboard
                        </button>

                        <button
                          onClick={() => {
                            navigateTo('/physician-dashboard');
                            setShowSettingsDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                          title="View physician dashboard"
                        >
                          <span className="mr-3">🩺</span>
                          Physician Dashboard
                        </button>

                        <div className="border-t border-gray-100 my-2" />
                      </>
                    )}

                    <button
                      onClick={() => {
                        navigateTo('/admin/settings');
                        setShowSettingsDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                    >
                      <span className="mr-3">⚙️</span>
                      Admin Settings
                    </button>

                    <button
                      onClick={() => {
                        navigateTo('/admin/audit-logs');
                        setShowSettingsDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                    >
                      <span className="mr-3">📜</span>
                      Audit Logs
                    </button>

                    {adminRole === 'super_admin' && (
                      <button
                        onClick={() => {
                          navigateTo('/admin/system');
                          setShowSettingsDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                      >
                        <span className="mr-3">🔧</span>
                        System Admin
                      </button>
                    )}
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-100 pt-2">
                    <button
                      onClick={() => {
                        setShowSettingsDropdown(false);
                        logoutAdmin();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                    >
                      <span className="mr-3">🚪</span>
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu for quick actions */}
        <div className="lg:hidden pb-3">
          <div className="flex space-x-2 overflow-x-auto">
            <button
              onClick={() => navigateTo('/dashboard')}
              className="flex-shrink-0 inline-flex items-center px-2 py-1 border border-black rounded text-xs font-medium bg-silver hover:bg-gray-300 text-black"
              style={{ backgroundColor: '#C0C0C0' }}
            >
              🏠 WellFit
            </button>
            {showRiskAssessment && (
              <button
                onClick={() => navigateTo('/admin-questions')}
                className="flex-shrink-0 inline-flex items-center px-2 py-1 border border-black rounded text-xs font-medium bg-silver hover:bg-gray-300 text-black"
                style={{ backgroundColor: '#C0C0C0' }}
              >
                📋 Assessment
              </button>
            )}
            {adminRole === 'super_admin' && (
              <button
                onClick={() => navigateTo('/admin/api-keys')}
                className="flex-shrink-0 inline-flex items-center px-2 py-1 border border-black rounded text-xs font-medium bg-silver hover:bg-gray-300 text-black"
                style={{ backgroundColor: '#C0C0C0' }}
              >
                🔑 API
              </button>
            )}
            <button
              onClick={() => navigateTo('/billing')}
              className="flex-shrink-0 inline-flex items-center px-2 py-1 border border-black rounded text-xs font-medium bg-silver hover:bg-gray-300 text-black"
              style={{ backgroundColor: '#C0C0C0' }}
            >
              💳 Billing
            </button>
          </div>
        </div>
      </div>

      {/* Click outside handler */}
      {showSettingsDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSettingsDropdown(false)}
        />
      )}
    </div>
  );
};

export default AdminHeader;