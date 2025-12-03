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
  EAButton,
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

// Icons (using Unicode for simplicity)
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

// ============================================================================
// Sub-components
// ============================================================================

interface ConnectionStatusRowProps {
  icon: React.ReactNode;
  label: string;
  connections: Array<{ connectionStatus: string; enabled: boolean }>;
}

const ConnectionStatusRow: React.FC<ConnectionStatusRowProps> = ({ icon, label, connections }) => {
  const activeCount = connections.filter(c => c.connectionStatus === 'connected' && c.enabled).length;
  const errorCount = connections.filter(c => c.connectionStatus === 'error').length;
  const totalCount = connections.length;

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {totalCount === 0 ? (
          <EABadge variant="secondary">No connections</EABadge>
        ) : (
          <>
            <EABadge variant={activeCount > 0 ? 'success' : 'secondary'}>
              {activeCount}/{totalCount} active
            </EABadge>
            {errorCount > 0 && (
              <EABadge variant="error">{errorCount} errors</EABadge>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface ActionItemProps {
  type: 'critical' | 'warning';
  count: number;
  label: string;
  onClick: () => void;
}

const ActionItem: React.FC<ActionItemProps> = ({ type, count, label, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
      type === 'critical'
        ? 'bg-red-900/30 hover:bg-red-900/50 border border-red-700'
        : 'bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-700'
    }`}
  >
    <div className="flex items-center gap-2">
      <AlertIcon />
      <span>
        <span className="font-semibold">{count}</span> {label}
      </span>
    </div>
    <span className="text-slate-400">→</span>
  </button>
);

// ============================================================================
// Panel Components
// ============================================================================

interface LabSystemsPanelProps {
  connections: LabProviderConnection[];
  criticalResults: LabResult[];
  onRefresh: () => void;
}

const LabSystemsPanel: React.FC<LabSystemsPanelProps> = ({
  connections,
  criticalResults,
  onRefresh,
}) => (
  <div className="space-y-4">
    {/* Critical Results Alert */}
    {criticalResults.length > 0 && (
      <EACard className="border-red-700">
        <EACardHeader>
          <div className="flex items-center gap-2 text-red-400">
            <AlertIcon />
            <h3 className="text-lg font-semibold">Critical Lab Values</h3>
          </div>
        </EACardHeader>
        <EACardContent>
          <div className="space-y-2">
            {criticalResults.slice(0, 5).map(result => (
              <div
                key={result.id}
                className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
              >
                <div>
                  <p className="font-medium">{result.reportType || 'Lab Result'}</p>
                  <p className="text-sm text-slate-400">
                    Accession: {result.accessionNumber} | {new Date(result.reportedAt).toLocaleDateString()}
                  </p>
                </div>
                <EAButton variant="outline" size="sm">
                  Acknowledge
                </EAButton>
              </div>
            ))}
          </div>
        </EACardContent>
      </EACard>
    )}

    {/* Lab Connections */}
    <EACard>
      <EACardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Lab Provider Connections</h3>
          <EAButton variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </EAButton>
        </div>
      </EACardHeader>
      <EACardContent>
        {connections.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <LabIcon />
            <p className="mt-2">No lab connections configured</p>
            <EAButton variant="primary" className="mt-4">
              Add Lab Connection
            </EAButton>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map(conn => (
              <ConnectionCard
                key={conn.id}
                name={conn.providerName}
                type={conn.providerCode}
                status={conn.connectionStatus}
                lastSync={conn.lastConnectedAt}
                stats={{
                  sent: conn.ordersSent,
                  received: conn.resultsReceived,
                  errors: conn.errorsCount,
                }}
              />
            ))}
          </div>
        )}
      </EACardContent>
    </EACard>
  </div>
);

interface PharmacyPanelProps {
  connections: PharmacyConnection[];
  pendingRefills: RefillRequest[];
  onRefresh: () => void;
}

const PharmacyPanel: React.FC<PharmacyPanelProps> = ({
  connections,
  pendingRefills,
  onRefresh,
}) => (
  <div className="space-y-4">
    {/* Pending Refills */}
    {pendingRefills.length > 0 && (
      <EACard className="border-yellow-700">
        <EACardHeader>
          <div className="flex items-center gap-2 text-yellow-400">
            <AlertIcon />
            <h3 className="text-lg font-semibold">Pending Refill Requests</h3>
          </div>
        </EACardHeader>
        <EACardContent>
          <div className="space-y-2">
            {pendingRefills.slice(0, 5).map(refill => (
              <div
                key={refill.id}
                className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
              >
                <div>
                  <p className="font-medium">{refill.medicationName}</p>
                  <p className="text-sm text-slate-400">
                    Source: {refill.requestSource} | {new Date(refill.requestedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <EAButton variant="outline" size="sm">
                    Deny
                  </EAButton>
                  <EAButton variant="primary" size="sm">
                    Approve
                  </EAButton>
                </div>
              </div>
            ))}
          </div>
        </EACardContent>
      </EACard>
    )}

    {/* Pharmacy Connections */}
    <EACard>
      <EACardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Pharmacy Connections</h3>
          <EAButton variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </EAButton>
        </div>
      </EACardHeader>
      <EACardContent>
        {connections.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <PharmacyIcon />
            <p className="mt-2">No pharmacy connections configured</p>
            <EAButton variant="primary" className="mt-4">
              Add Pharmacy
            </EAButton>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map(conn => (
              <div
                key={conn.id}
                className="flex items-center justify-between p-4 bg-slate-800 rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{conn.pharmacyName}</p>
                    {conn.isPreferred && (
                      <EABadge variant="success">Preferred</EABadge>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">
                    {conn.pharmacyType} | {conn.protocol}
                    {conn.ncpdpId && ` | NCPDP: ${conn.ncpdpId}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <div className="flex gap-2">
                      {conn.supportsErx && <EABadge variant="secondary">eRx</EABadge>}
                      {conn.supportsControlledSubstances && <EABadge variant="secondary">EPCS</EABadge>}
                    </div>
                  </div>
                  <StatusBadge status={conn.connectionStatus} />
                </div>
              </div>
            ))}
          </div>
        )}
      </EACardContent>
    </EACard>
  </div>
);

interface ImagingPanelProps {
  connections: PACSConnection[];
  criticalFindings: ImagingReport[];
  onRefresh: () => void;
}

const ImagingPanel: React.FC<ImagingPanelProps> = ({
  connections,
  criticalFindings,
  onRefresh,
}) => (
  <div className="space-y-4">
    {/* Critical Findings */}
    {criticalFindings.length > 0 && (
      <EACard className="border-red-700">
        <EACardHeader>
          <div className="flex items-center gap-2 text-red-400">
            <AlertIcon />
            <h3 className="text-lg font-semibold">Critical Imaging Findings</h3>
          </div>
        </EACardHeader>
        <EACardContent>
          <div className="space-y-2">
            {criticalFindings.slice(0, 5).map(finding => (
              <div
                key={finding.id}
                className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
              >
                <div>
                  <p className="font-medium">{finding.criticalFindingDescription || 'Critical Finding'}</p>
                  <p className="text-sm text-slate-400">
                    Accession: {finding.accessionNumber} | {new Date(finding.signedAt || finding.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <EAButton variant="outline" size="sm">
                  Mark Communicated
                </EAButton>
              </div>
            ))}
          </div>
        </EACardContent>
      </EACard>
    )}

    {/* PACS Connections */}
    <EACard>
      <EACardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">PACS Connections</h3>
          <EAButton variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </EAButton>
        </div>
      </EACardHeader>
      <EACardContent>
        {connections.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <ImagingIcon />
            <p className="mt-2">No PACS connections configured</p>
            <EAButton variant="primary" className="mt-4">
              Add PACS Connection
            </EAButton>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map(conn => (
              <div
                key={conn.id}
                className="flex items-center justify-between p-4 bg-slate-800 rounded-lg"
              >
                <div>
                  <p className="font-medium">{conn.pacsName}</p>
                  <p className="text-sm text-slate-400">
                    {conn.pacsVendor} | AE Title: {conn.aeTitle} | {conn.hostname}:{conn.port}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-slate-400">
                    {conn.dicomwebUrl && <EABadge variant="secondary">DICOMweb</EABadge>}
                  </div>
                  <StatusBadge status={conn.connectionStatus} />
                </div>
              </div>
            ))}
          </div>
        )}
      </EACardContent>
    </EACard>
  </div>
);

interface InsurancePanelProps {
  connections: InsurancePayerConnection[];
  onRefresh: () => void;
}

const InsurancePanel: React.FC<InsurancePanelProps> = ({
  connections,
  onRefresh,
}) => (
  <div className="space-y-4">
    <EACard>
      <EACardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Insurance Payer Connections</h3>
          <EAButton variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </EAButton>
        </div>
      </EACardHeader>
      <EACardContent>
        {connections.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <InsuranceIcon />
            <p className="mt-2">No insurance payer connections configured</p>
            <EAButton variant="primary" className="mt-4">
              Add Payer Connection
            </EAButton>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map(conn => (
              <div
                key={conn.id}
                className="flex items-center justify-between p-4 bg-slate-800 rounded-lg"
              >
                <div>
                  <p className="font-medium">{conn.payerName}</p>
                  <p className="text-sm text-slate-400">
                    {conn.payerType || 'Payer'} | {conn.connectionType}
                    {conn.payerId && ` | ID: ${conn.payerId}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                    {conn.supports270_271 && <EABadge variant="secondary">270/271</EABadge>}
                    {conn.supports276_277 && <EABadge variant="secondary">276/277</EABadge>}
                    {conn.supports278 && <EABadge variant="secondary">278</EABadge>}
                    {conn.supportsRealTime && <EABadge variant="success">Real-time</EABadge>}
                  </div>
                  <StatusBadge status={conn.connectionStatus} />
                </div>
              </div>
            ))}
          </div>
        )}
      </EACardContent>
    </EACard>
  </div>
);

// ============================================================================
// Helper Components
// ============================================================================

interface ConnectionCardProps {
  name: string;
  type: string;
  status: string;
  lastSync?: string;
  stats?: {
    sent: number;
    received: number;
    errors: number;
  };
}

const ConnectionCard: React.FC<ConnectionCardProps> = ({
  name,
  type,
  status,
  lastSync,
  stats,
}) => (
  <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
    <div>
      <p className="font-medium">{name}</p>
      <p className="text-sm text-slate-400">
        {type}
        {lastSync && ` | Last sync: ${new Date(lastSync).toLocaleString()}`}
      </p>
    </div>
    <div className="flex items-center gap-4">
      {stats && (
        <div className="text-right text-sm">
          <p className="text-slate-400">
            {stats.sent} sent | {stats.received} received
            {stats.errors > 0 && <span className="text-red-400"> | {stats.errors} errors</span>}
          </p>
        </div>
      )}
      <StatusBadge status={status} />
    </div>
  </div>
);

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const variant =
    status === 'connected' ? 'success' :
    status === 'error' ? 'error' :
    status === 'testing' ? 'warning' :
    'secondary';

  const label =
    status === 'connected' ? 'Connected' :
    status === 'error' ? 'Error' :
    status === 'testing' ? 'Testing' :
    'Disconnected';

  return <EABadge variant={variant}>{label}</EABadge>;
};

export default HealthcareIntegrationsDashboard;
