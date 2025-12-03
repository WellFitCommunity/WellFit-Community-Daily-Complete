/**
 * Healthcare Integrations Dashboard
 *
 * Unified dashboard for managing external healthcare system integrations:
 * - Lab Systems (LabCorp, Quest)
 * - Pharmacy (Surescripts, PillPack)
 * - Imaging/PACS (DICOM)
 * - Insurance Verification (X12 270/271)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  EAPageLayout,
  EACard,
  EACardHeader,
  EACardContent,
  EATabs,
  EATabsList,
  EATabsTrigger,
  EATabsContent,
  EAMetricCard,
  EABadge,
  EAAlert,
} from '../envision-atlus';
import { HealthcareIntegrationsService } from '../../services/healthcareIntegrationsService';
import { auditLogger } from '../../services/auditLogger';
import type {
  HealthcareIntegrationStats,
  LabProviderConnection,
  LabResult,
  PharmacyConnection,
  RefillRequest,
  PACSConnection,
  ImagingReport,
  InsurancePayerConnection,
} from '../../types/healthcareIntegrations';

// Split components
import { ConnectionStatusRow, ActionItem } from './components';
import { LabSystemsPanel, PharmacyPanel, ImagingPanel, InsurancePanel } from './panels';

// Icons
const LabIcon = () => <span className="text-2xl">🧪</span>;
const PharmacyIcon = () => <span className="text-2xl">💊</span>;
const ImagingIcon = () => <span className="text-2xl">📷</span>;
const InsuranceIcon = () => <span className="text-2xl">🏥</span>;
const AlertIcon = () => <span className="text-lg">⚠️</span>;
const CheckIcon = () => <span className="text-lg">✓</span>;

export const HealthcareIntegrationsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<HealthcareIntegrationStats | null>(null);

  // Connections
  const [labConnections, setLabConnections] = useState<LabProviderConnection[]>([]);
  const [pharmacyConnections, setPharmacyConnections] = useState<PharmacyConnection[]>([]);
  const [pacsConnections, setPacsConnections] = useState<PACSConnection[]>([]);
  const [insuranceConnections, setInsuranceConnections] = useState<InsurancePayerConnection[]>([]);

  // Alerts
  const [criticalLabResults, setCriticalLabResults] = useState<LabResult[]>([]);
  const [criticalImagingFindings, setCriticalImagingFindings] = useState<ImagingReport[]>([]);
  const [pendingRefillRequests, setPendingRefillRequests] = useState<RefillRequest[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load stats
      const statsResult = await HealthcareIntegrationsService.getStats();
      if (statsResult.success) {
        setStats(statsResult.data);
      }

      // Load connections
      const [labConn, pharmacyConn, pacsConn, insuranceConn] = await Promise.all([
        HealthcareIntegrationsService.Lab.getConnections(),
        HealthcareIntegrationsService.Pharmacy.getConnections(),
        HealthcareIntegrationsService.Imaging.getConnections(),
        HealthcareIntegrationsService.Insurance.getPayerConnections(),
      ]);

      if (labConn.success) setLabConnections(labConn.data);
      if (pharmacyConn.success) setPharmacyConnections(pharmacyConn.data);
      if (pacsConn.success) setPacsConnections(pacsConn.data);
      if (insuranceConn.success) setInsuranceConnections(insuranceConn.data);

      // Load alerts
      const [criticalLabs, criticalImaging, refills] = await Promise.all([
        HealthcareIntegrationsService.Lab.getCriticalResults(),
        HealthcareIntegrationsService.Imaging.getCriticalFindings(),
        HealthcareIntegrationsService.Pharmacy.getPendingRefillRequests(),
      ]);

      if (criticalLabs.success) setCriticalLabResults(criticalLabs.data);
      if (criticalImaging.success) setCriticalImagingFindings(criticalImaging.data);
      if (refills.success) setPendingRefillRequests(refills.data);

    } catch (err) {
      await auditLogger.error('HEALTHCARE_DASHBOARD_LOAD_ERROR', { error: err });
      setError('Failed to load healthcare integrations data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalAlerts = criticalLabResults.length + criticalImagingFindings.length + pendingRefillRequests.length;

  if (loading) {
    return (
      <EAPageLayout title="Healthcare Integrations">
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-slate-700 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-slate-700 rounded-lg" />
        </div>
      </EAPageLayout>
    );
  }

  return (
    <EAPageLayout
      title="Healthcare Integrations"
      subtitle="Lab, Pharmacy, Imaging & Insurance systems"
    >
      {error && (
        <EAAlert variant="error" className="mb-4">
          {error}
        </EAAlert>
      )}

      {/* Alerts Banner */}
      {totalAlerts > 0 && (
        <EAAlert variant="warning" className="mb-4">
          <div className="flex items-center gap-2">
            <AlertIcon />
            <span className="font-medium">
              {totalAlerts} item{totalAlerts !== 1 ? 's' : ''} requiring attention
            </span>
            <span className="text-sm text-slate-300">
              ({criticalLabResults.length} critical labs, {criticalImagingFindings.length} critical imaging, {pendingRefillRequests.length} refill requests)
            </span>
          </div>
        </EAAlert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EAMetricCard
          title="Lab Results"
          value={stats?.labResultsReceived ?? 0}
          subtitle={`${stats?.labOrdersTotal ?? 0} orders placed`}
          icon={<LabIcon />}
          trend={stats?.labCriticalValues ? {
            value: stats.labCriticalValues,
            label: 'critical values',
            direction: 'neutral',
          } : undefined}
        />
        <EAMetricCard
          title="Prescriptions"
          value={stats?.prescriptionsSent ?? 0}
          subtitle="sent this month"
          icon={<PharmacyIcon />}
          trend={stats?.refillRequestsPending ? {
            value: stats.refillRequestsPending,
            label: 'pending refills',
            direction: 'neutral',
          } : undefined}
        />
        <EAMetricCard
          title="Imaging Studies"
          value={stats?.imagingStudiesTotal ?? 0}
          subtitle={`${stats?.imagingReportsFinal ?? 0} reports finalized`}
          icon={<ImagingIcon />}
        />
        <EAMetricCard
          title="Eligibility Checks"
          value={stats?.eligibilityChecks ?? 0}
          subtitle={`${stats?.eligibilityVerified ?? 0} verified active`}
          icon={<InsuranceIcon />}
        />
      </div>

      {/* Main Content Tabs */}
      <EATabs value={activeTab} onValueChange={setActiveTab}>
        <EATabsList>
          <EATabsTrigger value="overview">Overview</EATabsTrigger>
          <EATabsTrigger value="lab">
            Lab Systems
            {labConnections.length > 0 && (
              <EABadge variant="secondary" className="ml-2">{labConnections.length}</EABadge>
            )}
          </EATabsTrigger>
          <EATabsTrigger value="pharmacy">
            Pharmacy
            {pendingRefillRequests.length > 0 && (
              <EABadge variant="warning" className="ml-2">{pendingRefillRequests.length}</EABadge>
            )}
          </EATabsTrigger>
          <EATabsTrigger value="imaging">
            Imaging/PACS
            {criticalImagingFindings.length > 0 && (
              <EABadge variant="error" className="ml-2">{criticalImagingFindings.length}</EABadge>
            )}
          </EATabsTrigger>
          <EATabsTrigger value="insurance">Insurance</EATabsTrigger>
        </EATabsList>

        {/* Overview Tab */}
        <EATabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Connection Status */}
            <EACard>
              <EACardHeader>
                <h3 className="text-lg font-semibold">Connection Status</h3>
              </EACardHeader>
              <EACardContent>
                <div className="space-y-3">
                  <ConnectionStatusRow
                    icon={<LabIcon />}
                    label="Lab Providers"
                    connections={labConnections}
                  />
                  <ConnectionStatusRow
                    icon={<PharmacyIcon />}
                    label="Pharmacies"
                    connections={pharmacyConnections}
                  />
                  <ConnectionStatusRow
                    icon={<ImagingIcon />}
                    label="PACS Systems"
                    connections={pacsConnections}
                  />
                  <ConnectionStatusRow
                    icon={<InsuranceIcon />}
                    label="Insurance Payers"
                    connections={insuranceConnections}
                  />
                </div>
              </EACardContent>
            </EACard>

            {/* Action Items */}
            <EACard>
              <EACardHeader>
                <h3 className="text-lg font-semibold">Action Items</h3>
              </EACardHeader>
              <EACardContent>
                {totalAlerts === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <CheckIcon />
                    <p className="mt-2">No action items at this time</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {criticalLabResults.length > 0 && (
                      <ActionItem
                        type="critical"
                        count={criticalLabResults.length}
                        label="critical lab values need acknowledgment"
                        onClick={() => setActiveTab('lab')}
                      />
                    )}
                    {criticalImagingFindings.length > 0 && (
                      <ActionItem
                        type="critical"
                        count={criticalImagingFindings.length}
                        label="critical imaging findings need communication"
                        onClick={() => setActiveTab('imaging')}
                      />
                    )}
                    {pendingRefillRequests.length > 0 && (
                      <ActionItem
                        type="warning"
                        count={pendingRefillRequests.length}
                        label="refill requests pending review"
                        onClick={() => setActiveTab('pharmacy')}
                      />
                    )}
                  </div>
                )}
              </EACardContent>
            </EACard>
          </div>
        </EATabsContent>

        {/* Lab Systems Tab */}
        <EATabsContent value="lab">
          <LabSystemsPanel
            connections={labConnections}
            criticalResults={criticalLabResults}
            onRefresh={loadData}
          />
        </EATabsContent>

        {/* Pharmacy Tab */}
        <EATabsContent value="pharmacy">
          <PharmacyPanel
            connections={pharmacyConnections}
            pendingRefills={pendingRefillRequests}
            onRefresh={loadData}
          />
        </EATabsContent>

        {/* Imaging Tab */}
        <EATabsContent value="imaging">
          <ImagingPanel
            connections={pacsConnections}
            criticalFindings={criticalImagingFindings}
            onRefresh={loadData}
          />
        </EATabsContent>

        {/* Insurance Tab */}
        <EATabsContent value="insurance">
          <InsurancePanel
            connections={insuranceConnections}
            onRefresh={loadData}
          />
        </EATabsContent>
      </EATabs>
    </EAPageLayout>
  );
};

export default HealthcareIntegrationsDashboard;
