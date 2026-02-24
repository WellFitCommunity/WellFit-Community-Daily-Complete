/**
 * TenantSuspensionBanner — Shows a prominent warning when tenant is suspended
 *
 * Purpose: Displays suspension status, reason, and date for tenant admins
 * Used by: TenantSecurityDashboard
 */

import React, { useState, useEffect } from 'react';
import { ShieldOff, Clock, AlertTriangle } from 'lucide-react';
import { tenantSecurityService } from '../../../services/tenantSecurityService';
import { auditLogger } from '../../../services/auditLogger';
import type { TenantSuspensionStatus, TenantSuspensionBannerProps } from './types';

export const TenantSuspensionBanner: React.FC<TenantSuspensionBannerProps> = ({ tenantId }) => {
  const [status, setStatus] = useState<TenantSuspensionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      setLoading(true);
      const result = await tenantSecurityService.getTenantSuspensionStatus(tenantId);
      if (!cancelled) {
        if (result.success) {
          setStatus(result.data);
        }
        setLoading(false);
      }
    };

    loadStatus().catch(async (err: unknown) => {
      await auditLogger.error('SUSPENSION_BANNER_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId }
      ).catch(() => {});
    });

    return () => { cancelled = true; };
  }, [tenantId]);

  if (loading || !status) {
    return null;
  }

  // Not suspended — show green status
  if (!status.is_suspended) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4" data-testid="suspension-status-active">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <ShieldOff className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-900">Tenant Active</p>
            <p className="text-sm text-green-700">No suspension on record. All services are operational.</p>
          </div>
        </div>
      </div>
    );
  }

  // Suspended — show red alert banner
  const suspendedDate = status.suspended_at
    ? new Date(status.suspended_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown date';

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5" data-testid="suspension-status-suspended">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-red-100 rounded-lg flex-shrink-0">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-red-900 mb-2">Tenant Suspended</h3>
          <p className="text-sm text-red-800 mb-3">
            This tenant has been suspended. Some services may be restricted. Contact your platform administrator to resolve.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Reason */}
            <div className="bg-white/60 rounded-md p-3">
              <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm text-red-900">{status.suspension_reason || 'No reason provided'}</p>
            </div>

            {/* Date */}
            <div className="bg-white/60 rounded-md p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-red-600" />
                <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Suspended On</p>
              </div>
              <p className="text-sm text-red-900">{suspendedDate}</p>
            </div>

            {/* Suspended By */}
            <div className="bg-white/60 rounded-md p-3">
              <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Suspended By</p>
              <p className="text-sm text-red-900">{status.suspended_by_name || 'Platform Administrator'}</p>
            </div>
          </div>

          <div className="mt-3 text-xs text-red-700">
            To appeal this suspension, contact your platform administrator or email support.
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantSuspensionBanner;
