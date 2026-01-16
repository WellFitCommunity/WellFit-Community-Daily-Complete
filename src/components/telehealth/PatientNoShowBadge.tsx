/**
 * PatientNoShowBadge - Visual indicator of patient no-show risk
 *
 * Purpose: Display patient no-show history and risk level to providers
 * Used by: Provider scheduler, patient profile, appointment details
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Ban, CheckCircle, Info as _Info } from 'lucide-react'; // _Info reserved for tooltips
import {
  NoShowDetectionService,
  type PatientNoShowStats,
  type RestrictionStatus,
} from '../../services/noShowDetectionService';

interface PatientNoShowBadgeProps {
  patientId: string;
  tenantId?: string;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PatientNoShowBadge: React.FC<PatientNoShowBadgeProps> = ({
  patientId,
  tenantId,
  showDetails = false,
  size = 'md',
  className = '',
}) => {
  const [stats, setStats] = useState<PatientNoShowStats | null>(null);
  const [restriction, setRestriction] = useState<RestrictionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [statsResult, restrictionResult] = await Promise.all([
        NoShowDetectionService.getPatientNoShowStats(patientId, tenantId),
        NoShowDetectionService.checkPatientRestriction(patientId, tenantId),
      ]);

      if (statsResult.success) {
        setStats(statsResult.data);
      }
      if (restrictionResult.success) {
        setRestriction(restrictionResult.data);
      }
      setLoading(false);
    };

    loadData();
  }, [patientId, tenantId]);

  if (loading) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className="animate-pulse bg-gray-200 rounded h-5 w-16" />
      </div>
    );
  }

  // No stats or clean record
  if (!stats || stats.noShowCount === 0) {
    if (!showDetails) return null;
    return (
      <div className={`inline-flex items-center gap-1 text-green-600 ${className}`}>
        <CheckCircle className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
        <span className={size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'}>
          Good standing
        </span>
      </div>
    );
  }

  // Determine risk level styling
  const getRiskStyles = () => {
    if (restriction?.isRestricted || stats.riskLevel === 'high') {
      return {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-200',
        icon: <Ban className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />,
        label: 'Restricted',
      };
    }
    if (stats.riskLevel === 'medium') {
      return {
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-200',
        icon: <AlertTriangle className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />,
        label: 'Warning',
      };
    }
    return {
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      borderColor: 'border-yellow-200',
      icon: <AlertCircle className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />,
      label: 'Attention',
    };
  };

  const styles = getRiskStyles();
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        className={`
          inline-flex items-center gap-1 rounded-full border
          ${styles.bgColor} ${styles.textColor} ${styles.borderColor}
          ${sizeClasses[size]}
          cursor-pointer hover:opacity-80 transition-opacity
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        aria-label={`No-show risk: ${styles.label}. ${stats.noShowCount} no-shows.`}
      >
        {styles.icon}
        <span>{stats.noShowCount} no-show{stats.noShowCount !== 1 ? 's' : ''}</span>
      </button>

      {/* Tooltip with details */}
      {showTooltip && (
        <div
          className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2
                     bg-gray-900 text-white text-sm rounded-lg shadow-lg p-3 min-w-[200px]"
        >
          <div className="space-y-2">
            <div className="font-semibold flex items-center gap-2">
              {styles.icon}
              <span>No-Show History</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-gray-400">Total Appointments:</span>
              <span>{stats.totalAppointments}</span>
              <span className="text-gray-400">Completed:</span>
              <span>{stats.completedAppointments}</span>
              <span className="text-gray-400">No-Shows:</span>
              <span className="text-red-400">{stats.noShowCount}</span>
              <span className="text-gray-400">No-Show Rate:</span>
              <span>{stats.noShowRate.toFixed(1)}%</span>
              {stats.consecutiveNoShows > 0 && (
                <>
                  <span className="text-gray-400">Consecutive:</span>
                  <span className="text-orange-400">{stats.consecutiveNoShows}</span>
                </>
              )}
            </div>
            {stats.lastNoShowDate && (
              <div className="text-xs text-gray-400 pt-1 border-t border-gray-700">
                Last no-show:{' '}
                {new Date(stats.lastNoShowDate).toLocaleDateString()}
              </div>
            )}
            {restriction?.isRestricted && (
              <div className="text-xs text-red-400 pt-1 border-t border-gray-700">
                Restricted until:{' '}
                {restriction.restrictionEndDate
                  ? new Date(restriction.restrictionEndDate).toLocaleDateString()
                  : 'Indefinitely'}
              </div>
            )}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-8 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}

      {/* Show expanded details if requested */}
      {showDetails && (
        <div className={`ml-3 ${styles.textColor} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          <span>
            {stats.noShowRate.toFixed(0)}% no-show rate
            {stats.consecutiveNoShows > 1 && (
              <span className="ml-2">({stats.consecutiveNoShows} consecutive)</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export default PatientNoShowBadge;
