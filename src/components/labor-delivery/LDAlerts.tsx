/**
 * LDAlerts - Renders L&D clinical alerts by severity with acknowledge/resolve actions
 *
 * Purpose: Display active alerts with ability to acknowledge and resolve
 * Used by: LaborDeliveryDashboard
 */

import React, { useState } from 'react';
import type { LDAlert, LDAlertSeverity } from '../../types/laborDelivery';
import { LDAlertService } from '../../services/laborDelivery';
import { auditLogger } from '../../services/auditLogger';

interface LDAlertsProps {
  alerts: LDAlert[];
  onAlertAction?: () => void;
}

const SEVERITY_STYLES: Record<LDAlertSeverity, { bg: string; text: string; border: string; icon: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', icon: '🚨' },
  high: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', icon: '⚠️' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', icon: '📋' },
  low: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', icon: 'ℹ️' },
};

const LDAlerts: React.FC<LDAlertsProps> = ({ alerts, onAlertAction }) => {
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-base">No active alerts</p>
      </div>
    );
  }

  const handleAcknowledge = async (alertId: string) => {
    setAcknowledging(alertId);
    try {
      const result = await LDAlertService.acknowledgeAlert(alertId, 'current-user');
      if (result.success) {
        onAlertAction?.();
      }
    } catch (err: unknown) {
      await auditLogger.error('LD_ALERT_ACK_UI_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { alertId }
      );
    } finally {
      setAcknowledging(null);
    }
  };

  const handleResolve = async (alertId: string) => {
    setResolving(alertId);
    try {
      const result = await LDAlertService.resolveAlert(alertId, 'current-user');
      if (result.success) {
        onAlertAction?.();
      }
    } catch (err: unknown) {
      await auditLogger.error('LD_ALERT_RESOLVE_UI_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { alertId }
      );
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity];
        return (
          <div
            key={alert.id}
            className={`${style.bg} ${style.border} border rounded-lg p-4 flex items-start gap-3`}
            role="alert"
          >
            <span className="text-xl flex-shrink-0" aria-hidden="true">{style.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase ${style.text}`}>
                  {alert.severity}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(alert.timestamp).toLocaleString()}
                </span>
                {alert.acknowledged && (
                  <span className="text-xs text-green-600 font-medium">Acknowledged</span>
                )}
              </div>
              <p className={`text-sm font-medium mt-1 ${style.text}`}>
                {alert.message}
              </p>
            </div>
            {onAlertAction && (
              <div className="flex gap-2 flex-shrink-0">
                {!alert.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={acknowledging === alert.id}
                    className="text-xs px-3 py-1.5 bg-white border border-gray-300 rounded font-medium
                      hover:bg-gray-50 min-h-[32px] disabled:opacity-50"
                  >
                    {acknowledging === alert.id ? 'Ack...' : 'Acknowledge'}
                  </button>
                )}
                <button
                  onClick={() => handleResolve(alert.id)}
                  disabled={resolving === alert.id}
                  className="text-xs px-3 py-1.5 bg-green-600 text-white rounded font-medium
                    hover:bg-green-700 min-h-[32px] disabled:opacity-50"
                >
                  {resolving === alert.id ? 'Resolving...' : 'Resolve'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default LDAlerts;
