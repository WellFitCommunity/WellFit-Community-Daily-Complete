/**
 * React Query hooks for Wearable Services
 *
 * Provides cached, optimized data fetching for wearable device integration
 * (Apple Watch, Fitbit, Garmin).
 *
 * Follows the HIPAA-compliant caching strategy defined in queryClient.ts.
 *
 * @see src/lib/queryClient.ts for cache configuration
 * @see src/services/wearableService.ts for underlying service implementation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WearableService } from '../services/wearableService';
import { queryKeys, cacheTime } from '../lib/queryClient';
import type {
  WearableConnection,
  WearableVitalSign,
  WearableActivityData,
  WearableFallDetection,
  ConnectWearableRequest,
} from '../types/neuroSuite';

// ============================================================================
// DEVICE CONNECTION HOOKS
// ============================================================================

/**
 * Get all connected wearable devices for a user
 * Cache: 10 minutes (stable data, infrequent changes)
 */
export function useConnectedDevices(userId: string) {
  return useQuery<WearableConnection[]>({
    queryKey: [...queryKeys.wearable.connections(), userId],
    queryFn: async () => {
      const response = await WearableService.getConnectedDevices(userId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch connected devices');
      }
      return response.data || [];
    },
    staleTime: cacheTime.stable.staleTime,
    gcTime: cacheTime.stable.gcTime,
    enabled: !!userId,
  });
}

/**
 * Connect a new wearable device
 * Invalidates: connections
 */
export function useConnectDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: ConnectWearableRequest) => {
      const response = await WearableService.connectDevice(request);
      if (!response.success) {
        throw new Error(response.error || 'Failed to connect device');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wearable.connections() });
    },
  });
}

/**
 * Disconnect a wearable device
 * Invalidates: connections
 */
export function useDisconnectDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await WearableService.disconnectDevice(connectionId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to disconnect device');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wearable.connections() });
    },
  });
}

// ============================================================================
// VITAL SIGNS HOOKS
// ============================================================================

/**
 * Get vital signs trend for a user
 * Cache: 5 minutes (frequent updates)
 * @param vitalType - 'heart_rate', 'blood_pressure', 'spo2', etc.
 * @param days - Number of days to fetch (default: 7)
 */
export function useVitalsTrend(
  userId: string,
  vitalType: 'heart_rate' | 'blood_pressure' | 'spo2' | 'temperature' | 'respiratory_rate',
  days: number = 7
) {
  return useQuery<WearableVitalSign[]>({
    queryKey: [...queryKeys.wearable.vitals(), userId, vitalType, days],
    queryFn: async () => {
      const response = await WearableService.getVitalsTrend(userId, vitalType, days);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch vitals trend');
      }
      return response.data || [];
    },
    staleTime: cacheTime.frequent.staleTime,
    gcTime: cacheTime.frequent.gcTime,
    enabled: !!userId,
  });
}

// ============================================================================
// ACTIVITY DATA HOOKS
// ============================================================================

/**
 * Get activity summary for a date range
 * Cache: 10 minutes (stable data)
 */
export function useActivitySummary(userId: string, startDate: string, endDate: string) {
  return useQuery<WearableActivityData[]>({
    queryKey: [...queryKeys.wearable.activity(), userId, startDate, endDate],
    queryFn: async () => {
      const response = await WearableService.getActivitySummary(userId, startDate, endDate);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch activity summary');
      }
      return response.data || [];
    },
    staleTime: cacheTime.stable.staleTime,
    gcTime: cacheTime.stable.gcTime,
    enabled: !!userId && !!startDate && !!endDate,
  });
}

// ============================================================================
// FALL DETECTION HOOKS
// ============================================================================

/**
 * Get fall detection history for a user
 * Cache: 5 minutes (critical safety data)
 * @param days - Number of days to fetch (default: 30)
 */
export function useFallHistory(userId: string, days: number = 30) {
  return useQuery<WearableFallDetection[]>({
    queryKey: [...queryKeys.wearable.falls(), userId, days],
    queryFn: async () => {
      const response = await WearableService.getFallHistory(userId, days);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch fall history');
      }
      return response.data || [];
    },
    staleTime: cacheTime.frequent.staleTime,
    gcTime: cacheTime.frequent.gcTime,
    enabled: !!userId,
  });
}

/**
 * Update fall response (mark as "I'm OK")
 * Invalidates: falls
 */
export function useUpdateFallResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fallId,
      responded,
      responseTimeSeconds,
    }: {
      fallId: string;
      responded: boolean;
      responseTimeSeconds: number;
    }) => {
      const response = await WearableService.updateFallResponse(
        fallId,
        responded,
        responseTimeSeconds
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to update fall response');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wearable.falls() });
    },
  });
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Get latest heart rate for a user (convenience hook)
 * Cache: 5 minutes
 */
export function useLatestHeartRate(userId: string) {
  const { data: vitals = [] } = useVitalsTrend(userId, 'heart_rate', 1);
  return vitals[vitals.length - 1] || null;
}

/**
 * Get today's activity data (convenience hook)
 * Cache: 10 minutes
 */
export function useTodayActivity(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data: activities = [] } = useActivitySummary(userId, today, today);
  return activities[0] || null;
}

/**
 * Get unresponded falls (convenience hook)
 * Cache: 5 minutes
 */
export function useUnrespondedFalls(userId: string) {
  const { data: falls = [] } = useFallHistory(userId, 30);
  return falls.filter((fall) => !fall.user_responded);
}
