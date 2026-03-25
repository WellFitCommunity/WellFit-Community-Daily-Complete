/**
 * SystemAdminSuiteDashboard - Tabbed System Administration Hub
 *
 * Purpose: Consolidates user management, facility config, module toggles,
 * and clearinghouse setup into a single tabbed interface.
 * Used by: /system-admin route (admin, super_admin roles)
 *
 * Tab structure:
 *   Users → Roles → Facilities → Modules → Clearinghouse
 */

import React, { Suspense, useState, lazy } from 'react';
import {
  EATabs,
  EATabsList,
  EATabsTrigger,
  EATabsContent,
} from '../envision-atlus';
import AdminHeader from '../admin/AdminHeader';
import {
  Users,
  ShieldCheck,
  Building2,
  ToggleLeft,
  Plug,
} from 'lucide-react';

const UsersList = lazy(() => import('../admin/UsersList'));
const UserRoleManagementPanel = lazy(() => import('../admin/UserRoleManagementPanel'));
const UserProvisioningPanel = lazy(() => import('../admin/UserProvisioningPanel'));
const FacilityManagementPanel = lazy(() => import('../admin/FacilityManagementPanel'));
const TenantModuleConfigPanel = lazy(() =>
  import('../admin/TenantModuleConfigPanel').then(m => ({ default: m.TenantModuleConfigPanel }))
);
const ClearinghouseConfigPanel = lazy(() =>
  import('../admin/ClearinghouseConfigPanel').then(m => ({ default: m.ClearinghouseConfigPanel }))
);

const TabLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-[var(--ea-primary,#00857a)]" />
      <span className="text-sm text-slate-400">Loading...</span>
    </div>
  </div>
);

interface SubTabProps {
  tabs: Array<{ id: string; label: string; component: React.ReactNode }>;
}

const SubTabSelector: React.FC<SubTabProps> = ({ tabs }) => {
  const [activeSubTab, setActiveSubTab] = useState(tabs[0]?.id ?? '');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
              activeSubTab === tab.id
                ? 'bg-[var(--ea-primary,#00857a)] text-white shadow-sm'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) =>
        activeSubTab === tab.id ? (
          <div key={tab.id}>{tab.component}</div>
        ) : null
      )}
    </div>
  );
};

export const SystemAdminSuiteDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">System Administration</h1>
          <p className="text-slate-400 mt-1">
            User management, facility configuration, module toggles, and clearinghouse setup
          </p>
        </div>

        <EATabs defaultValue="users" value={activeTab} onValueChange={setActiveTab}>
          <EATabsList className="flex-wrap gap-1 overflow-x-auto">
            <EATabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </EATabsTrigger>
            <EATabsTrigger value="roles">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Roles
            </EATabsTrigger>
            <EATabsTrigger value="facilities">
              <Building2 className="h-4 w-4 mr-2" />
              Facilities
            </EATabsTrigger>
            <EATabsTrigger value="modules">
              <ToggleLeft className="h-4 w-4 mr-2" />
              Modules
            </EATabsTrigger>
            <EATabsTrigger value="clearinghouse">
              <Plug className="h-4 w-4 mr-2" />
              Clearinghouse
            </EATabsTrigger>
          </EATabsList>

          <EATabsContent value="users">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  { id: 'user-list', label: 'All Users', component: <UsersList /> },
                  { id: 'provisioning', label: 'Create User', component: <UserProvisioningPanel /> },
                ]}
              />
            </Suspense>
          </EATabsContent>

          <EATabsContent value="roles">
            <Suspense fallback={<TabLoadingFallback />}>
              <UserRoleManagementPanel />
            </Suspense>
          </EATabsContent>

          <EATabsContent value="facilities">
            <Suspense fallback={<TabLoadingFallback />}>
              <FacilityManagementPanel />
            </Suspense>
          </EATabsContent>

          <EATabsContent value="modules">
            <Suspense fallback={<TabLoadingFallback />}>
              <TenantModuleConfigPanel />
            </Suspense>
          </EATabsContent>

          <EATabsContent value="clearinghouse">
            <Suspense fallback={<TabLoadingFallback />}>
              <ClearinghouseConfigPanel />
            </Suspense>
          </EATabsContent>
        </EATabs>
      </div>
    </div>
  );
};

export default SystemAdminSuiteDashboard;
