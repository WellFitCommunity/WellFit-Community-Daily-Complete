/**
 * InteroperabilityDashboard - Tabbed FHIR/HL7 Interoperability Hub
 *
 * Purpose: Consolidates all FHIR, HL7, and data mapping dashboards
 * into a single tabbed interface for interoperability management.
 * Used by: /interoperability route (admin, super_admin roles)
 *
 * Tab structure:
 *   FHIR Analytics → Form Builder → Data Mapping → HL7 Testing
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
  FileEdit,
  ArrowLeftRight,
  Terminal,
  Network,
} from 'lucide-react';

// Lazy-load each dashboard
const FhirAiDashboard = lazy(() => import('../admin/FhirAiDashboard'));
const FHIRInteroperabilityDashboard = lazy(() => import('../admin/FHIRInteroperabilityDashboard'));
const FHIRFormBuilderEnhanced = lazy(() => import('../admin/FHIRFormBuilderEnhanced'));
const FHIRDataMapper = lazy(() => import('../admin/FHIRDataMapper'));
const HL7MessageTestPanel = lazy(() => import('../admin/HL7MessageTestPanel'));

/** Loading fallback for lazy-loaded tab content */
const TabLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-[var(--ea-primary,#00857a)]" />
      <span className="text-sm text-slate-400">Loading...</span>
    </div>
  </div>
);

export const InteroperabilityDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('fhir-analytics');

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Interoperability</h1>
          <p className="text-slate-400 mt-1">
            FHIR R4 analytics, questionnaire builder, data mapping, and HL7 v2.x testing
          </p>
        </div>

        {/* Tabs */}
        <EATabs defaultValue="fhir-analytics" value={activeTab} onValueChange={setActiveTab}>
          <EATabsList className="flex-wrap gap-1 overflow-x-auto">
            <EATabsTrigger value="fhir-analytics">
              <Activity className="h-4 w-4 mr-2" />
              FHIR Analytics
            </EATabsTrigger>
            <EATabsTrigger value="connections">
              <Network className="h-4 w-4 mr-2" />
              Connections
            </EATabsTrigger>
            <EATabsTrigger value="form-builder">
              <FileEdit className="h-4 w-4 mr-2" />
              Form Builder
            </EATabsTrigger>
            <EATabsTrigger value="data-mapper">
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Data Mapping
            </EATabsTrigger>
            <EATabsTrigger value="hl7-testing">
              <Terminal className="h-4 w-4 mr-2" />
              HL7 Testing
            </EATabsTrigger>
          </EATabsList>

          {/* ── Tab 1: FHIR Analytics ──────────────────────────────── */}
          <EATabsContent value="fhir-analytics">
            <Suspense fallback={<TabLoadingFallback />}>
              <FhirAiDashboard />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 2: Connections ──────────────────────────────────── */}
          <EATabsContent value="connections">
            <Suspense fallback={<TabLoadingFallback />}>
              <FHIRInteroperabilityDashboard />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 3: Form Builder ────────────────────────────────── */}
          <EATabsContent value="form-builder">
            <Suspense fallback={<TabLoadingFallback />}>
              <FHIRFormBuilderEnhanced />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 4: Data Mapping ────────────────────────────────── */}
          <EATabsContent value="data-mapper">
            <Suspense fallback={<TabLoadingFallback />}>
              <FHIRDataMapper />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 5: HL7 Testing ─────────────────────────────────── */}
          <EATabsContent value="hl7-testing">
            <Suspense fallback={<TabLoadingFallback />}>
              <HL7MessageTestPanel />
            </Suspense>
          </EATabsContent>
        </EATabs>
      </div>
    </div>
  );
};

export default InteroperabilityDashboard;
