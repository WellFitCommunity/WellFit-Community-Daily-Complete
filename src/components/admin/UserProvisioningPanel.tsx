/**
 * UserProvisioningPanel — Admin panel for inviting new users and managing pending registrations
 *
 * Purpose: Create users via admin_register edge function, manage pending registrations
 * Used by: IntelligentAdminPanel (admin category section)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { userProvisioningService } from '../../services/userProvisioningService';
import { auditLogger } from '../../services/auditLogger';
import { InviteUserForm, PendingInvitationsTable } from './user-provisioning';
import type { InviteUserInput, InviteUserResult, PendingRegistration } from './user-provisioning';
import { UserPlus, Clock, ShieldAlert } from 'lucide-react';

type TabId = 'invite' | 'pending';

export const UserProvisioningPanel: React.FC = () => {
  const { isAdminAuthenticated } = useAdminAuth();

  const [activeTab, setActiveTab] = useState<TabId>('invite');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<InviteUserResult | null>(null);

  // Pending registrations state
  const [pendingInvitations, setPendingInvitations] = useState<PendingRegistration[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const roles = userProvisioningService.getRoles();

  const loadPendingRegistrations = useCallback(async () => {
    setLoadingPending(true);
    const result = await userProvisioningService.getPendingRegistrations();
    if (result.success) {
      setPendingInvitations(result.data);
    }
    setLoadingPending(false);
  }, []);

  useEffect(() => {
    if (isAdminAuthenticated && activeTab === 'pending') {
      loadPendingRegistrations();
    }
  }, [isAdminAuthenticated, activeTab, loadPendingRegistrations]);

  const handleInvite = async (input: InviteUserInput) => {
    setSaving(true);
    setError(null);
    setLastResult(null);

    const result = await userProvisioningService.inviteUser(input);
    if (result.success) {
      setLastResult(result.data);
    } else {
      setError(result.error.message);
    }
    setSaving(false);
  };

  const handleDeletePending = async (id: string) => {
    const result = await userProvisioningService.deletePendingRegistration(id);
    if (result.success) {
      setPendingInvitations(prev => prev.filter(p => p.id !== id));
    } else {
      setError(result.error.message);
      await auditLogger.error('PENDING_DELETE_UI_ERROR',
        new Error(result.error.message),
        { registrationId: id }
      ).catch(() => {});
    }
  };

  if (!isAdminAuthenticated) {
    return (
      <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-md">
        <ShieldAlert className="w-5 h-5 text-amber-600" />
        <p className="text-sm text-amber-800">Admin authentication required to manage user provisioning.</p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'invite', label: 'Invite User', icon: <UserPlus className="w-4 h-4" /> },
    { id: 'pending', label: 'Pending Registrations', icon: <Clock className="w-4 h-4" />, count: pendingInvitations.length },
  ];

  return (
    <div className="space-y-4">
      {/* Tab navigation */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setError(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'invite' && (
        <InviteUserForm
          roles={roles}
          saving={saving}
          onInvite={handleInvite}
          lastResult={lastResult}
          onClearResult={() => setLastResult(null)}
        />
      )}

      {activeTab === 'pending' && (
        <PendingInvitationsTable
          invitations={pendingInvitations}
          loading={loadingPending}
          onRefresh={loadPendingRegistrations}
          onDelete={handleDeletePending}
        />
      )}

      {/* Info footer */}
      <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        <p>
          Users created here receive a base role. Use <strong>Staff Role Management</strong> to assign clinical roles
          (physician, nurse practitioner, pharmacist, etc.) after account creation.
        </p>
      </div>
    </div>
  );
};

export default UserProvisioningPanel;
