/**
 * AccountSections - SecuritySection (PIN/passkey/access history),
 * AccountSection (password/support), PrivacySection (consent/data download)
 *
 * Purpose: senior account-level settings; these navigate to dedicated flows
 * Used by: SettingsPage
 */
import React from 'react';
import { useNavigate } from 'react-router';
import type { User } from '@supabase/supabase-js';
import PasskeySetup from '../../components/PasskeySetup';
import CaregiverAccessHistory from '../../components/CaregiverAccessHistory';

interface SecuritySectionProps {
  user: User;
  preferredName: string;
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({ user, preferredName }) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 rounded-lg">
        <div className="font-semibold text-[#003865] dark:text-sky-300 mb-1">🔐 Caregiver PIN</div>
        <p className="text-gray-600 dark:text-slate-400 text-sm mb-3">
          Set a 4-digit PIN that caregivers can use to access your health information. This is
          different from your password and is only for caregiver access.
        </p>
        <button
          onClick={() => navigate('/set-caregiver-pin')}
          className="w-full mt-2 px-4 py-3 bg-[#003865] text-white rounded-lg hover:bg-[#8cc63f] transition font-semibold"
        >
          Set/Update Caregiver PIN
        </button>
      </div>

      <PasskeySetup
        userId={user.id}
        userName={user.email || user.phone || 'user'}
        displayName={preferredName || 'User'}
      />

      <CaregiverAccessHistory userId={user.id} />
    </div>
  );
};

interface AccountSectionProps {
  user: User | null;
}

export const AccountSection: React.FC<AccountSectionProps> = ({ user }) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-slate-800 p-4 rounded-lg">
        <h3 className="font-semibold text-[#003865] dark:text-sky-300 mb-2">Password Security</h3>
        <p className="text-gray-700 dark:text-slate-300 mb-4">
          Keep your account secure by using a strong password and changing it regularly.
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate('/change-password');
          }}
          className="bg-[#003865] text-white px-6 py-3 rounded-lg hover:bg-[#8cc63f] transition font-semibold"
        >
          🔒 Change Password
        </button>
      </div>

      <div className="bg-yellow-50 dark:bg-slate-800 p-4 rounded-lg">
        <h3 className="font-semibold text-[#003865] dark:text-sky-300 mb-2">Account Information</h3>
        <p className="text-gray-700 dark:text-slate-300 mb-2">
          <strong>Email:</strong> {user?.email}
        </p>
        <p className="text-gray-700 dark:text-slate-300 mb-4">
          <strong>Account Created:</strong>{' '}
          {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
        </p>
      </div>

      <div className="bg-red-50 dark:bg-slate-800 p-4 rounded-lg border border-red-200 dark:border-red-900">
        <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">⚠️ Need Help?</h3>
        <p className="text-red-700 dark:text-red-300 mb-4">
          If you're having trouble with your account or need to make changes, our support team is
          here to help.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href="tel:1-800-WELLFIT"
            onClick={(e) => e.stopPropagation()}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-center"
          >
            📞 Call Support
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate('/help');
            }}
            className="bg-[#003865] text-white px-4 py-2 rounded-lg hover:bg-[#8cc63f] transition"
          >
            📚 View Help Center
          </button>
        </div>
      </div>
    </div>
  );
};

export const PrivacySection: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-slate-800 p-4 rounded-lg">
        <h3 className="font-semibold text-[#003865] dark:text-sky-300 mb-2">Consent Management</h3>
        <p className="text-gray-700 dark:text-slate-300 mb-4">
          Control who can access your health information. View connected apps, manage provider
          access, and see who has viewed your data.
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate('/consent-management');
          }}
          className="bg-[#003865] text-white px-6 py-3 rounded-lg hover:bg-[#8cc63f] transition font-semibold"
        >
          🔒 Manage Data Access
        </button>
      </div>

      <div className="bg-green-50 dark:bg-slate-800 p-4 rounded-lg">
        <h3 className="font-semibold text-[#003865] dark:text-sky-300 mb-2">Download Your Data</h3>
        <p className="text-gray-700 dark:text-slate-300 mb-4">
          Download a complete copy of your health records in multiple formats including PDF, C-CDA,
          and JSON.
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate('/health-records-download');
          }}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-semibold"
        >
          📥 Download My Data
        </button>
      </div>

      <div className="bg-purple-50 dark:bg-slate-800 p-4 rounded-lg border border-purple-200 dark:border-purple-900">
        <h3 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">Your Data Rights</h3>
        <p className="text-purple-700 dark:text-purple-300 text-sm">
          Under the <strong>21st Century Cures Act</strong> and <strong>HIPAA Privacy Rule</strong>,
          you have the right to access all of your electronic health information without delay and
          at no charge.
        </p>
      </div>
    </div>
  );
};
