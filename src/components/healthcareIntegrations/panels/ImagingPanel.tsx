/**
 * ImagingPanel - PACS connections and critical imaging findings
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
import type { PACSConnection, ImagingReport } from '../../../types/healthcareIntegrations';

const ImagingIcon = () => <span className="text-2xl">📷</span>;
const AlertIcon = () => <span className="text-lg">⚠️</span>;

interface ImagingPanelProps {
  connections: PACSConnection[];
  criticalFindings: ImagingReport[];
  onRefresh: () => void;
}

export const ImagingPanel: React.FC<ImagingPanelProps> = ({
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
                <EAButton variant="secondary" size="sm">
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
          <EAButton variant="ghost" size="sm" onClick={onRefresh}>
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
                    {conn.dicomwebUrl && <EABadge variant="info">DICOMweb</EABadge>}
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
