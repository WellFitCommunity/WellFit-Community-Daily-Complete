/**
 * Admin Settings Page
 *
 * Personal preferences and configuration for admin users.
 * Separate from system-wide configuration (which is in SystemConfigurationPanel).
 */

import React from 'react';
import RequireAdminAuth from '../components/auth/RequireAdminAuth';
import AdminHeader from '../components/admin/AdminHeader';
import SmartBackButton from '../components/ui/SmartBackButton';
import AdminSettingsPanel from '../components/admin/AdminSettingsPanel';

const AdminSettingsPage: React.FC = () => {
  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
      <div className="min-h-screen bg-[#E8F8F7]">
        <AdminHeader title="Envision Atlus - Admin Settings" showRiskAssessment={false} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-4">
            <SmartBackButton />
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-bold text-black">Personal Admin Settings</h1>
            <p className="text-gray-600 mt-2">
              Configure your personal preferences, notifications, and dashboard defaults
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border-2 border-black p-6">
            <AdminSettingsPanel />
          </div>
        </div>
      </div>
    </RequireAdminAuth>
  );
};

export default AdminSettingsPage;
