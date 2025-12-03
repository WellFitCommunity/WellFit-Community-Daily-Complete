/**
 * LabSystemsPanel - Lab provider connections and critical results
 */

import React from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
} from '../../envision-atlus';
import { ConnectionCard } from '../components/ConnectionCard';
import type { LabProviderConnection, LabResult } from '../../../types/healthcareIntegrations';

const LabIcon = () => <span className="text-2xl">🧪</span>;
const AlertIcon = () => <span className="text-lg">⚠️</span>;

interface LabSystemsPanelProps {
  connections: LabProviderConnection[];
  criticalResults: LabResult[];
  onRefresh: () => void;
}

export const LabSystemsPanel: React.FC<LabSystemsPanelProps> = ({
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
