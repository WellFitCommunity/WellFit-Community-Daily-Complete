/**
 * useBedCommandCenter Hook
 *
 * Real-time data hook for the Bed Command Center dashboard.
 * Provides network-wide bed visibility with automatic updates.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CommandCenterService } from '../services/commandCenterService';
import type {
  CommandCenterSummary,
  FacilityCapacitySnapshot,
  CapacityAlert,
  CapacityAlertLevel,
} from '../types/healthSystem';

// ============================================================================
// TYPES
// ============================================================================

export interface UseBedCommandCenterOptions {
  tenantId: string;
  autoRefreshInterval?: number; // milliseconds, default 30000 (30s)
  enableRealtime?: boolean;
}

export interface UseBedCommandCenterResult {
  // Data
  summary: CommandCenterSummary | null;
  facilities: FacilityCapacitySnapshot[];
  alerts: CapacityAlert[];

  // State
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;

  // Actions
  refresh: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  setFacilityDivert: (facilityId: string, divert: boolean, reason?: string) => Promise<void>;

  // Filters
  filterByAlertLevel: (level: CapacityAlertLevel | null) => void;
  filterByFacility: (facilityId: string | null) => void;
  currentFilters: {
    alertLevel: CapacityAlertLevel | null;
    facilityId: string | null;
  };
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useBedCommandCenter(
  options: UseBedCommandCenterOptions
): UseBedCommandCenterResult {
  const { tenantId, autoRefreshInterval = 30000 } = options;

  // State
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
  const [facilities, setFacilities] = useState<FacilityCapacitySnapshot[]>([]);
  const [alerts, setAlerts] = useState<CapacityAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filters
  const [alertLevelFilter, setAlertLevelFilter] = useState<CapacityAlertLevel | null>(null);
  const [facilityFilter, setFacilityFilter] = useState<string | null>(null);

  // Refs for interval management
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch command center data
  const fetchData = useCallback(async () => {
    try {
      setError(null);

      const [summaryResult, alertsResult] = await Promise.all([
        CommandCenterService.getCommandCenterSummary(tenantId),
        CommandCenterService.getActiveAlerts(),
      ]);

      if (summaryResult.success && summaryResult.data) {
        setSummary(summaryResult.data);

        // Extract facilities from summary
        let facilitiesData = summaryResult.data.facilities || [];

        // Apply filters
        if (alertLevelFilter) {
          facilitiesData = facilitiesData.filter(
            (f) => f.alert_level === alertLevelFilter
          );
        }
        if (facilityFilter) {
          facilitiesData = facilitiesData.filter(
            (f) => f.facility_id === facilityFilter
          );
        }

        setFacilities(facilitiesData);
      } else if (!summaryResult.success) {
        setError(summaryResult.error?.toString() || 'Failed to fetch command center data');
      }

      if (alertsResult.success && alertsResult.data) {
        setAlerts(alertsResult.data);
      }

      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, alertLevelFilter, facilityFilter]);

  // Refresh function exposed to consumers
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchData();
  }, [fetchData]);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    const result = await CommandCenterService.acknowledgeAlert(alertId, tenantId);
    if (result.success) {
      // Update local state
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, is_acknowledged: true, acknowledged_at: new Date().toISOString() }
            : a
        )
      );
    }
  }, [tenantId]);

  // Set facility divert status
  const setFacilityDivert = useCallback(
    async (facilityId: string, divert: boolean, reason?: string) => {
      const result = await CommandCenterService.setFacilityDivertStatus(
        facilityId,
        divert,
        reason
      );
      if (result.success) {
        // Refresh to get updated data
        await fetchData();
      }
    },
    [fetchData]
  );

  // Filter functions
  const filterByAlertLevel = useCallback((level: CapacityAlertLevel | null) => {
    setAlertLevelFilter(level);
  }, []);

  const filterByFacility = useCallback((facilityId: string | null) => {
    setFacilityFilter(facilityId);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      refreshIntervalRef.current = setInterval(fetchData, autoRefreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefreshInterval, fetchData]);

  // Note: Real-time updates are handled via polling (autoRefreshInterval)
  // For true real-time, integrate with useRealtimeSubscription when component is mounted
  // with proper filter for tenant isolation

  return {
    // Data
    summary,
    facilities,
    alerts,

    // State
    isLoading,
    error,
    lastUpdated,

    // Actions
    refresh,
    acknowledgeAlert,
    setFacilityDivert,

    // Filters
    filterByAlertLevel,
    filterByFacility,
    currentFilters: {
      alertLevel: alertLevelFilter,
      facilityId: facilityFilter,
    },
  };
}

export default useBedCommandCenter;
