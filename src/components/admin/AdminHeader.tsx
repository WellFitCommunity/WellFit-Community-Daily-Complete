import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

interface AdminHeaderProps {
  title?: string;
  showRiskAssessment?: boolean;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({
  title = "Admin Panel",
  showRiskAssessment = true
}) => {
  const navigate = useNavigate();
  const { adminRole, logoutAdmin } = useAdminAuth();
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);

    // Apply theme to document (session only)
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const navigateTo = (path: string) => {
    console.log('[AdminHeader] Navigating to:', path, 'as role:', adminRole);
    navigate(path);
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left section - Title and role */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                <span className="text-sm font-bold">WF</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">{title}</h1>
                <div className="text-xs text-blue-100">
                  {adminRole === 'super_admin' ? 'Super Administrator' : 'Administrator'}
                </div>
              </div>
            </div>
          </div>

          {/* Center section - Navigation buttons */}
          <div className="hidden lg:flex items-center space-x-2">
            {/* Super Admin: View Senior Dashboard */}
            {adminRole === 'super_admin' && (
              <button
                onClick={() => navigateTo('/dashboard')}
                className="inline-flex items-center px-3 py-2 border border-white border-opacity-20 rounded-md text-sm font-medium bg-blue-500 bg-opacity-30 hover:bg-opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-200"
                title="View the senior-facing dashboard"
              >
                <span className="mr-2">👤</span>
                Senior View
              </button>
            )}

            {/* Quick Enroll */}
            <button
              onClick={() => navigateTo('/admin/enroll-senior')}
              className="inline-flex items-center px-3 py-2 border border-white border-opacity-20 rounded-md text-sm font-medium bg-green-500 bg-opacity-20 hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-opacity-50 transition-all duration-200"
            >
              <span className="mr-2">➕</span>
              Enroll Senior
            </button>

            {showRiskAssessment && (
              <button
                onClick={() => navigateTo('/admin-questions')}
                className="inline-flex items-center px-3 py-2 border border-white border-opacity-20 rounded-md text-sm font-medium bg-white bg-opacity-10 hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all duration-200"
              >
                <span className="mr-2">📋</span>
                Risk Assessment
              </button>
            )}

            {/* Super Admin API Keys */}
            {adminRole === 'super_admin' && (
              <button
                onClick={() => navigateTo('/admin/api-keys')}
                className="inline-flex items-center px-3 py-2 border border-white border-opacity-20 rounded-md text-sm font-medium bg-yellow-500 bg-opacity-20 hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-opacity-50 transition-all duration-200"
              >
                <span className="mr-2">🔑</span>
                API Keys
              </button>
            )}

            {/* Billing */}
            <button
              onClick={() => navigateTo('/billing')}
              className="inline-flex items-center px-3 py-2 border border-white border-opacity-20 rounded-md text-sm font-medium bg-white bg-opacity-10 hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all duration-200"
            >
              <span className="mr-2">💳</span>
              Billing
            </button>

            {/* Bulk Export */}
            <button
              onClick={() => navigateTo('/admin/bulk-export')}
              className="inline-flex items-center px-3 py-2 border border-white border-opacity-20 rounded-md text-sm font-medium bg-orange-500 bg-opacity-20 hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-opacity-50 transition-all duration-200"
            >
              <span className="mr-2">📤</span>
              Bulk Export
            </button>

            {/* Reports - Scrolls to Reports Section in Admin Panel */}
            <button
              onClick={() => navigateTo('/admin')}
              className="inline-flex items-center px-3 py-2 border border-white border-opacity-20 rounded-md text-sm font-medium bg-white bg-opacity-10 hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all duration-200"
            >
              <span className="mr-2">📊</span>
              Reports
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
            {/* Super Admin: View Senior Dashboard (mobile) */}
            {adminRole === 'super_admin' && (
              <button
                onClick={() => navigateTo('/dashboard')}
                className="flex-shrink-0 inline-flex items-center px-2 py-1 border border-white border-opacity-20 rounded text-xs font-medium bg-blue-500 bg-opacity-30 hover:bg-opacity-40"
              >
                👤 Senior View
              </button>
            )}
            <button
              onClick={() => navigateTo('/admin/enroll-senior')}
              className="flex-shrink-0 inline-flex items-center px-2 py-1 border border-white border-opacity-20 rounded text-xs font-medium bg-green-500 bg-opacity-20 hover:bg-opacity-30"
            >
              ➕ Enroll
            </button>
            {showRiskAssessment && (
              <button
                onClick={() => navigateTo('/admin-questions')}
                className="flex-shrink-0 inline-flex items-center px-2 py-1 border border-white border-opacity-20 rounded text-xs font-medium bg-white bg-opacity-10 hover:bg-opacity-20"
              >
                📋 Assessment
              </button>
            )}
            {adminRole === 'super_admin' && (
              <button
                onClick={() => navigateTo('/admin/api-keys')}
                className="flex-shrink-0 inline-flex items-center px-2 py-1 border border-white border-opacity-20 rounded text-xs font-medium bg-yellow-500 bg-opacity-20 hover:bg-opacity-30"
              >
                🔑 API
              </button>
            )}
            <button
              onClick={() => navigateTo('/billing')}
              className="flex-shrink-0 inline-flex items-center px-2 py-1 border border-white border-opacity-20 rounded text-xs font-medium bg-white bg-opacity-10 hover:bg-opacity-20"
            >
              💳 Billing
            </button>
            <button
              onClick={() => navigateTo('/admin/bulk-export')}
              className="flex-shrink-0 inline-flex items-center px-2 py-1 border border-white border-opacity-20 rounded text-xs font-medium bg-orange-500 bg-opacity-20 hover:bg-opacity-30"
            >
              📤 Export
            </button>
            <button
              onClick={() => navigateTo('/admin')}
              className="flex-shrink-0 inline-flex items-center px-2 py-1 border border-white border-opacity-20 rounded text-xs font-medium bg-white bg-opacity-10 hover:bg-opacity-20"
            >
              📊 Reports
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