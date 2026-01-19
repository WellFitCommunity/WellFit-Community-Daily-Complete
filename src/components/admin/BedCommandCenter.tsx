/**
 * Bed Command Center
 *
 * Network-wide bed visibility dashboard for multi-facility health systems.
 * Provides real-time occupancy monitoring, alerts, and capacity coordination.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useBedCommandCenter } from '../../hooks/useBedCommandCenter';
import {
  getAlertLevelColor,
  getAlertLevelLabel,
  getOccupancyHeatmapColor,
  getTrendIcon,
  sortFacilitiesByAlertLevel,
} from '../../types/healthSystem';
import type { CapacityAlertLevel, FacilityCapacitySnapshot } from '../../types/healthSystem';

// ============================================================================
// COMPONENT
// ============================================================================

export const BedCommandCenter: React.FC = () => {
  const [tenantId, setTenantId] = useState<string>('');

  // Fetch user's profile to get tenant_id
  useEffect(() => {
    const fetchTenantId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single();
        setTenantId(profile?.tenant_id || '');
      }
    };
    fetchTenantId();
  }, []);

  const {
    summary,
    facilities,
    alerts,
    isLoading,
    error,
    lastUpdated,
    refresh,
    acknowledgeAlert,
    setFacilityDivert,
    filterByAlertLevel,
    currentFilters,
  } = useBedCommandCenter({
    tenantId,
    autoRefreshInterval: 30000,
  });

  const [selectedFacility, setSelectedFacility] = useState<FacilityCapacitySnapshot | null>(null);

  // Sort facilities by alert level (most critical first)
  const sortedFacilities = sortFacilitiesByAlertLevel(facilities);

  // Loading state
  if (isLoading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error loading command center: {error}</p>
        <button
          onClick={refresh}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bed Command Center</h1>
          <p className="text-sm text-gray-500">
            Network-wide bed visibility | Last updated:{' '}
            {lastUpdated?.toLocaleTimeString() || 'Never'}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <span className="animate-spin">⟳</span>
          ) : (
            <span>⟳</span>
          )}
          Refresh
        </button>
      </div>

      {/* Network Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <SummaryCard
          label="Total Facilities"
          value={summary?.total_facilities || 0}
          color="blue"
        />
        <SummaryCard
          label="Total Beds"
          value={summary?.total_beds || 0}
          color="gray"
        />
        <SummaryCard
          label="Occupied"
          value={summary?.total_occupied || 0}
          color="orange"
        />
        <SummaryCard
          label="Available"
          value={summary?.total_available || 0}
          color="green"
        />
        <SummaryCard
          label="Network Occupancy"
          value={`${summary?.network_occupancy_percent || 0}%`}
          color={getOccupancyColorClass(summary?.network_occupancy_percent || 0)}
        />
        <SummaryCard
          label="ED Boarding"
          value={summary?.total_ed_boarding || 0}
          color={summary?.total_ed_boarding && summary.total_ed_boarding > 0 ? 'red' : 'gray'}
        />
      </div>

      {/* Alert Status Row */}
      <div className="grid grid-cols-4 gap-4">
        <AlertStatusCard
          label="On Divert"
          count={summary?.facilities_on_divert || 0}
          level="divert"
          onClick={() => filterByAlertLevel(currentFilters.alertLevel === 'divert' ? null : 'divert')}
          active={currentFilters.alertLevel === 'divert'}
        />
        <AlertStatusCard
          label="Critical"
          count={summary?.facilities_critical || 0}
          level="critical"
          onClick={() => filterByAlertLevel(currentFilters.alertLevel === 'critical' ? null : 'critical')}
          active={currentFilters.alertLevel === 'critical'}
        />
        <AlertStatusCard
          label="Warning"
          count={summary?.facilities_warning || 0}
          level="warning"
          onClick={() => filterByAlertLevel(currentFilters.alertLevel === 'warning' ? null : 'warning')}
          active={currentFilters.alertLevel === 'warning'}
        />
        <AlertStatusCard
          label="Active Alerts"
          count={alerts.filter((a) => !a.is_acknowledged).length}
          level="watch"
          onClick={() => {}}
          active={false}
        />
      </div>

      {/* Active Alerts Banner */}
      {alerts.filter((a) => !a.is_acknowledged).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-2">
            Unacknowledged Alerts ({alerts.filter((a) => !a.is_acknowledged).length})
          </h3>
          <div className="space-y-2">
            {alerts
              .filter((a) => !a.is_acknowledged)
              .slice(0, 5)
              .map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between bg-white rounded p-2 border border-red-100"
                >
                  <div>
                    <span className={`px-2 py-1 rounded text-xs ${getAlertLevelColor(alert.alert_level)}`}>
                      {getAlertLevelLabel(alert.alert_level)}
                    </span>
                    <span className="ml-2 text-sm text-gray-700">{alert.message}</span>
                  </div>
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Acknowledge
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Facilities Grid */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Facilities</h2>
          {currentFilters.alertLevel && (
            <span className="ml-2 text-sm text-gray-500">
              Filtered by: {getAlertLevelLabel(currentFilters.alertLevel)}
              <button
                onClick={() => filterByAlertLevel(null)}
                className="ml-2 text-blue-600 hover:underline"
              >
                Clear
              </button>
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {sortedFacilities.map((facility) => (
            <FacilityCard
              key={facility.facility_id}
              facility={facility}
              onClick={() => setSelectedFacility(facility)}
              onToggleDivert={(divert) =>
                setFacilityDivert(
                  facility.facility_id,
                  divert,
                  divert ? 'Manual divert activation' : undefined
                )
              }
            />
          ))}
          {sortedFacilities.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              No facilities match the current filter
            </div>
          )}
        </div>
      </div>

      {/* Facility Detail Modal */}
      {selectedFacility && (
        <FacilityDetailModal
          facility={selectedFacility}
          onClose={() => setSelectedFacility(null)}
          onToggleDivert={(divert) => {
            setFacilityDivert(
              selectedFacility.facility_id,
              divert,
              divert ? 'Manual divert activation' : undefined
            );
            setSelectedFacility(null);
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface SummaryCardProps {
  label: string;
  value: number | string;
  color: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, color }) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color] || colorClasses.gray}`}>
      <p className="text-xs uppercase tracking-wide opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
};

interface AlertStatusCardProps {
  label: string;
  count: number;
  level: CapacityAlertLevel;
  onClick: () => void;
  active: boolean;
}

const AlertStatusCard: React.FC<AlertStatusCardProps> = ({
  label,
  count,
  level,
  onClick,
  active,
}) => {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-all ${
        active ? 'ring-2 ring-blue-500' : ''
      } ${getAlertLevelColor(level)}`}
    >
      <p className="text-xs uppercase tracking-wide opacity-75">{label}</p>
      <p className="text-3xl font-bold mt-1">{count}</p>
    </button>
  );
};

interface FacilityCardProps {
  facility: FacilityCapacitySnapshot;
  onClick: () => void;
  onToggleDivert: (divert: boolean) => void;
}

const FacilityCard: React.FC<FacilityCardProps> = ({ facility, onClick, onToggleDivert }) => {
  const occupancyColor = getOccupancyHeatmapColor(facility.occupancy_percent);

  return (
    <div
      className={`rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow ${
        facility.divert_status ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{facility.facility_name}</h3>
          <p className="text-xs text-gray-500">{facility.facility_code}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs ${getAlertLevelColor(facility.alert_level)}`}>
          {getAlertLevelLabel(facility.alert_level)}
        </span>
      </div>

      <div className="mt-4">
        {/* Occupancy Bar */}
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">Occupancy</span>
          <span className="font-semibold" style={{ color: occupancyColor }}>
            {facility.occupancy_percent.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${Math.min(facility.occupancy_percent, 100)}%`,
              backgroundColor: occupancyColor,
            }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-semibold text-gray-900">{facility.occupied_beds}</p>
          <p className="text-xs text-gray-500">Occupied</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-green-600">{facility.available_beds}</p>
          <p className="text-xs text-gray-500">Available</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-600">
            {getTrendIcon(facility.trend_1h)}
          </p>
          <p className="text-xs text-gray-500">Trend</p>
        </div>
      </div>

      {/* ED Boarding */}
      {facility.ed_boarding > 0 && (
        <div className="mt-3 px-2 py-1 bg-yellow-100 rounded text-xs text-yellow-700">
          {facility.ed_boarding} ED boarding
        </div>
      )}

      {/* Divert Toggle */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {facility.is_accepting_transfers ? 'Accepting Transfers' : 'Not Accepting'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleDivert(!facility.divert_status);
          }}
          className={`px-3 py-1 rounded text-xs font-medium ${
            facility.divert_status
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {facility.divert_status ? 'End Divert' : 'Divert'}
        </button>
      </div>
    </div>
  );
};

interface FacilityDetailModalProps {
  facility: FacilityCapacitySnapshot;
  onClose: () => void;
  onToggleDivert: (divert: boolean) => void;
}

const FacilityDetailModal: React.FC<FacilityDetailModalProps> = ({
  facility,
  onClose,
  onToggleDivert,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{facility.facility_name}</h2>
            <p className="text-sm text-gray-500">{facility.facility_code}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Banner */}
          <div className={`p-4 rounded-lg ${getAlertLevelColor(facility.alert_level)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{getAlertLevelLabel(facility.alert_level)}</p>
                <p className="text-sm opacity-75">
                  {facility.occupancy_percent.toFixed(1)}% occupancy
                </p>
              </div>
              <button
                onClick={() => onToggleDivert(!facility.divert_status)}
                className={`px-4 py-2 rounded font-medium ${
                  facility.divert_status
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {facility.divert_status ? 'End Divert' : 'Activate Divert'}
              </button>
            </div>
          </div>

          {/* Bed Counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{facility.total_beds}</p>
              <p className="text-xs text-gray-500">Total Beds</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-700">{facility.occupied_beds}</p>
              <p className="text-xs text-orange-600">Occupied</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{facility.available_beds}</p>
              <p className="text-xs text-green-600">Available</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-700">{facility.reserved_beds}</p>
              <p className="text-xs text-blue-600">Reserved</p>
            </div>
          </div>

          {/* Unit Breakdown */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">By Unit Type</h3>
            <div className="grid grid-cols-2 gap-3">
              <UnitRow label="ICU" occupied={facility.icu_occupied} available={facility.icu_available} />
              <UnitRow label="Step Down" occupied={facility.step_down_occupied} available={facility.step_down_available} />
              <UnitRow label="Telemetry" occupied={facility.telemetry_occupied} available={facility.telemetry_available} />
              <UnitRow label="Med-Surg" occupied={facility.med_surg_occupied} available={facility.med_surg_available} />
            </div>
          </div>

          {/* ED Status */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Emergency Department</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-semibold text-gray-900">{facility.ed_census}</p>
                <p className="text-xs text-gray-500">ED Census</p>
              </div>
              <div className={`p-3 rounded-lg ${facility.ed_boarding > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                <p className={`text-lg font-semibold ${facility.ed_boarding > 0 ? 'text-yellow-700' : 'text-gray-900'}`}>
                  {facility.ed_boarding}
                </p>
                <p className="text-xs text-gray-500">ED Boarding</p>
              </div>
            </div>
          </div>

          {/* Predictions */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Predicted Availability</h3>
            <div className="grid grid-cols-4 gap-3">
              <PredictionBox label="4 hrs" value={facility.predicted_available_4h} />
              <PredictionBox label="8 hrs" value={facility.predicted_available_8h} />
              <PredictionBox label="12 hrs" value={facility.predicted_available_12h} />
              <PredictionBox label="24 hrs" value={facility.predicted_available_24h} />
            </div>
          </div>

          {/* Timestamp */}
          <p className="text-xs text-gray-400 text-right">
            Snapshot: {new Date(facility.snapshot_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

const UnitRow: React.FC<{ label: string; occupied: number; available: number }> = ({
  label,
  occupied,
  available,
}) => (
  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
    <span className="text-sm text-gray-700">{label}</span>
    <div className="flex gap-3 text-sm">
      <span className="text-orange-600">{occupied} occ</span>
      <span className="text-green-600">{available} avail</span>
    </div>
  </div>
);

const PredictionBox: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="text-center p-2 bg-blue-50 rounded">
    <p className="text-lg font-semibold text-blue-700">{value}</p>
    <p className="text-xs text-blue-600">{label}</p>
  </div>
);

// ============================================================================
// HELPERS
// ============================================================================

function getOccupancyColorClass(percent: number): string {
  if (percent < 70) return 'green';
  if (percent < 80) return 'orange';
  return 'red';
}

export default BedCommandCenter;
