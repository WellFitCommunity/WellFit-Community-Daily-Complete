/**
 * AdminToolsDashboard - Tabbed Administrative Tools Hub
 *
 * Purpose: Consolidates patient engagement monitoring, enrollment,
 * data export, paper form scanning, and alert consolidation tools.
 * Used by: /admin-tools route (admin, super_admin roles)
 *
 * Tab structure:
 *   Engagement → Enrollment → Export → Paper Forms → Alerts
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
  Activity,
  UserPlus,
  Download,
  ScanLine,
  Bell,
} from 'lucide-react';

const PatientEngagementDashboard = lazy(() => import('../admin/PatientEngagementDashboard'));
const HospitalPatientEnrollment = lazy(() => import('../admin/HospitalPatientEnrollment'));
const ExportCheckIns = lazy(() => import('../admin/ExportCheckIns'));
const PaperFormScanner = lazy(() => import('../admin/PaperFormScanner'));
const ConsolidatedAlertPanel = lazy(() => import('../admin/ConsolidatedAlertPanel'));

const TabLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-[var(--ea-primary,#00857a)]" />
      <span className="text-sm text-slate-400">Loading...</span>
    </div>
  </div>
);

export const AdminToolsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('engagement');

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Admin Tools</h1>
          <p className="text-slate-400 mt-1">
            Patient engagement monitoring, enrollment, data export, and utility tools
          </p>
        </div>

        <EATabs defaultValue="engagement" value={activeTab} onValueChange={setActiveTab}>
          <EATabsList className="flex-wrap gap-1 overflow-x-auto">
            <EATabsTrigger value="engagement">
              <Activity className="h-4 w-4 mr-2" />
              Engagement
            </EATabsTrigger>
            <EATabsTrigger value="enrollment">
              <UserPlus className="h-4 w-4 mr-2" />
              Enrollment
            </EATabsTrigger>
            <EATabsTrigger value="export">
              <Download className="h-4 w-4 mr-2" />
              Export
            </EATabsTrigger>
            <EATabsTrigger value="paper-forms">
              <ScanLine className="h-4 w-4 mr-2" />
              Paper Forms
            </EATabsTrigger>
            <EATabsTrigger value="alerts">
              <Bell className="h-4 w-4 mr-2" />
              Alerts
            </EATabsTrigger>
          </EATabsList>

          <EATabsContent value="engagement">
            <Suspense fallback={<TabLoadingFallback />}>
              <PatientEngagementDashboard />
            </Suspense>
          </EATabsContent>

          <EATabsContent value="enrollment">
            <Suspense fallback={<TabLoadingFallback />}>
              <HospitalPatientEnrollment />
            </Suspense>
          </EATabsContent>

          <EATabsContent value="export">
            <Suspense fallback={<TabLoadingFallback />}>
              <ExportCheckIns />
            </Suspense>
          </EATabsContent>

          <EATabsContent value="paper-forms">
            <Suspense fallback={<TabLoadingFallback />}>
              <PaperFormScanner />
            </Suspense>
          </EATabsContent>

          <EATabsContent value="alerts">
            <Suspense fallback={<TabLoadingFallback />}>
              <ConsolidatedAlertPanel />
            </Suspense>
          </EATabsContent>
        </EATabs>
      </div>
    </div>
  );
};

export default AdminToolsDashboard;
