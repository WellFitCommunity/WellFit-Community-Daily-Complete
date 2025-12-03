/**
 * PharmacyPanel - Pharmacy connections and pending refill requests
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
import type { PharmacyConnection, RefillRequest } from '../../../types/healthcareIntegrations';

const PharmacyIcon = () => <span className="text-2xl">💊</span>;
const AlertIcon = () => <span className="text-lg">⚠️</span>;

interface PharmacyPanelProps {
  connections: PharmacyConnection[];
  pendingRefills: RefillRequest[];
  onRefresh: () => void;
}

export const PharmacyPanel: React.FC<PharmacyPanelProps> = ({
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
                  <EAButton variant="ghost" size="sm">
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
          <EAButton variant="ghost" size="sm" onClick={onRefresh}>
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
                      <EABadge variant="normal">Preferred</EABadge>
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
                      {conn.supportsErx && <EABadge variant="info">eRx</EABadge>}
                      {conn.supportsControlledSubstances && <EABadge variant="info">EPCS</EABadge>}
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
