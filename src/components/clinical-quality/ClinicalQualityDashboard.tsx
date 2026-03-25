/**
 * ClinicalQualityDashboard - Tabbed Clinical Quality & Public Health Hub
 *
 * Purpose: Consolidates quality measures, clinical validation,
 * and public health reporting into a single tabbed interface.
 * Used by: /clinical-quality route (admin, physician, nurse roles)
 *
 * Tab structure:
 *   Quality Measures → Clinical Validation → Public Health
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
  Award,
  CheckCircle,
  Globe,
} from 'lucide-react';

const QualityMeasuresDashboard = lazy(() => import('../admin/quality-measures'));
const ClinicalValidationDashboard = lazy(() => import('../admin/clinical-validation'));
const PublicHealthReportingDashboard = lazy(() => import('../admin/PublicHealthReportingDashboard'));

const TabLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-[var(--ea-primary,#00857a)]" />
      <span className="text-sm text-slate-400">Loading...</span>
    </div>
  </div>
);

export const ClinicalQualityDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('quality');

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Clinical Quality</h1>
          <p className="text-slate-400 mt-1">
            Quality measures, AI validation monitoring, and public health reporting
          </p>
        </div>

        <EATabs defaultValue="quality" value={activeTab} onValueChange={setActiveTab}>
          <EATabsList className="flex-wrap gap-1 overflow-x-auto">
            <EATabsTrigger value="quality">
              <Award className="h-4 w-4 mr-2" />
              Quality Measures
            </EATabsTrigger>
            <EATabsTrigger value="validation">
              <CheckCircle className="h-4 w-4 mr-2" />
              Clinical Validation
            </EATabsTrigger>
            <EATabsTrigger value="public-health">
              <Globe className="h-4 w-4 mr-2" />
              Public Health
            </EATabsTrigger>
          </EATabsList>

          <EATabsContent value="quality">
            <Suspense fallback={<TabLoadingFallback />}>
              <QualityMeasuresDashboard />
            </Suspense>
          </EATabsContent>

          <EATabsContent value="validation">
            <Suspense fallback={<TabLoadingFallback />}>
              <ClinicalValidationDashboard />
            </Suspense>
          </EATabsContent>

          <EATabsContent value="public-health">
            <Suspense fallback={<TabLoadingFallback />}>
              <PublicHealthReportingDashboard />
            </Suspense>
          </EATabsContent>
        </EATabs>
      </div>
    </div>
  );
};

export default ClinicalQualityDashboard;
