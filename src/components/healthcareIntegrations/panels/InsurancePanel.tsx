/**
 * InsurancePanel - Insurance payer connections
 */

import React from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
} from '../../envision-atlus';
import { StatusBadge } from '../components/StatusBadge';
import type { InsurancePayerConnection } from '../../../types/healthcareIntegrations';

const InsuranceIcon = () => <span className="text-2xl">🏥</span>;

interface InsurancePanelProps {
  connections: InsurancePayerConnection[];
  onRefresh: () => void;
}

export const InsurancePanel: React.FC<InsurancePanelProps> = ({
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
