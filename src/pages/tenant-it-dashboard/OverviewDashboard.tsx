/**
 * OverviewDashboard — Quick stats, actions, and recent security events
 */

import React from 'react';
import {
  Users, Shield, Key, Settings, Activity, Clock,
  FileText, AlertTriangle, CheckCircle, RotateCcw
} from 'lucide-react';

export const OverviewDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-linear-to-br from-[#1BA39C] to-[#158A84] p-6 rounded-xl border-2 border-black text-white">
          <Users className="w-8 h-8 mb-2 text-[#C8E63D]" />
          <p className="text-3xl font-bold">127</p>
          <p className="text-white/80">Total Users</p>
        </div>
        <div className="bg-linear-to-br from-[#C8E63D] to-[#a8c633] p-6 rounded-xl border-2 border-black text-black">
          <Activity className="w-8 h-8 mb-2" />
          <p className="text-3xl font-bold">23</p>
          <p className="text-black/70">Active Sessions</p>
        </div>
        <div className="bg-linear-to-br from-purple-500 to-purple-600 p-6 rounded-xl border-2 border-black text-white">
          <Key className="w-8 h-8 mb-2 text-purple-200" />
          <p className="text-3xl font-bold">5</p>
          <p className="text-white/80">Active API Keys</p>
        </div>
        <div className="bg-linear-to-br from-blue-500 to-blue-600 p-6 rounded-xl border-2 border-black text-white">
          <Shield className="w-8 h-8 mb-2 text-blue-200" />
          <p className="text-3xl font-bold">98%</p>
          <p className="text-white/80">Security Score</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 border-2 border-black shadow-lg">
        <h3 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#1BA39C]" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="p-4 bg-[#E8F8F7] hover:bg-[#D1F2F0] rounded-lg border-2 border-black transition-all text-left">
            <Users className="w-6 h-6 text-[#1BA39C] mb-2" />
            <p className="font-bold text-black">Add New User</p>
            <p className="text-sm text-gray-600">Create user account</p>
          </button>
          <button className="p-4 bg-[#E8F8F7] hover:bg-[#D1F2F0] rounded-lg border-2 border-black transition-all text-left">
            <RotateCcw className="w-6 h-6 text-[#1BA39C] mb-2" />
            <p className="font-bold text-black">Reset Password</p>
            <p className="text-sm text-gray-600">Help user recover access</p>
          </button>
          <button className="p-4 bg-[#E8F8F7] hover:bg-[#D1F2F0] rounded-lg border-2 border-black transition-all text-left">
            <Key className="w-6 h-6 text-[#1BA39C] mb-2" />
            <p className="font-bold text-black">Generate API Key</p>
            <p className="text-sm text-gray-600">For integrations</p>
          </button>
          <button className="p-4 bg-[#E8F8F7] hover:bg-[#D1F2F0] rounded-lg border-2 border-black transition-all text-left">
            <FileText className="w-6 h-6 text-[#1BA39C] mb-2" />
            <p className="font-bold text-black">Export Audit Log</p>
            <p className="text-sm text-gray-600">Download CSV report</p>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl p-6 border-2 border-black shadow-lg">
        <h3 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6 text-[#C8E63D]" />
          Recent Security Events
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div className="flex-1">
              <p className="font-semibold text-red-800">Account Locked: nurse.jones@clinic.org</p>
              <p className="text-sm text-red-600">5 failed login attempts - 30 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <p className="font-semibold text-green-800">New API Key Created: EHR Integration</p>
              <p className="text-sm text-green-600">By dr.smith@clinic.org - 2 hours ago</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Shield className="w-5 h-5 text-blue-600" />
            <div className="flex-1">
              <p className="font-semibold text-blue-800">MFA Enabled: admin@clinic.org</p>
              <p className="text-sm text-blue-600">Enhanced security - 1 day ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
