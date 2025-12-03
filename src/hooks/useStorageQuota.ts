/**
 * Storage Quota Hook
 *
 * Monitors available storage and warns before hitting limits.
 * Critical for offline-first healthcare apps that cache patient data.
 */

import { useState, useEffect, useCallback } from 'react';

export interface StorageQuotaInfo {
  /** Total storage quota in bytes */
  quota: number;
  /** Currently used storage in bytes */
  usage: number;
  /** Percentage of quota used (0-100) */
  percentUsed: number;
  /** Whether storage is running low (<20% remaining) */
  isLow: boolean;
  /** Whether storage is critically low (<5% remaining) */
  isCritical: boolean;
  /** Human-readable quota string */
  quotaFormatted: string;
  /** Human-readable usage string */
  usageFormatted: string;
  /** Human-readable remaining string */
  remainingFormatted: string;
  /** Whether Storage API is supported */
  isSupported: boolean;
  /** Last time quota was checked */
  lastChecked: Date;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const isStorageSupported = (): boolean => {
  return 'storage' in navigator && 'estimate' in navigator.storage;
};

export interface UseStorageQuotaOptions {
  /** How often to check quota (ms). Default: 60000 (1 min) */
  pollInterval?: number;
  /** Threshold for "low" warning (0-1). Default: 0.2 (20% remaining) */
  lowThreshold?: number;
  /** Threshold for "critical" warning (0-1). Default: 0.05 (5% remaining) */
  criticalThreshold?: number;
  /** Callback when storage becomes low */
  onLow?: (info: StorageQuotaInfo) => void;
  /** Callback when storage becomes critical */
  onCritical?: (info: StorageQuotaInfo) => void;
}

/**
 * Hook to monitor browser storage quota
 *
 * @example
 * ```tsx
 * const { percentUsed, isLow, isCritical, usageFormatted, remainingFormatted } = useStorageQuota({
 *   onCritical: () => toast.error('Storage almost full! Sync your data now.')
 * });
 *
 * if (isCritical) {
 *   return <StorageWarningBanner />;
 * }
 * ```
 */
export function useStorageQuota(options: UseStorageQuotaOptions = {}): StorageQuotaInfo {
  const {
    pollInterval = 60000,
    lowThreshold = 0.2,
    criticalThreshold = 0.05,
    onLow,
    onCritical,
  } = options;

  const [quotaInfo, setQuotaInfo] = useState<StorageQuotaInfo>(() => ({
    quota: 0,
    usage: 0,
    percentUsed: 0,
    isLow: false,
    isCritical: false,
    quotaFormatted: 'Unknown',
    usageFormatted: '0 B',
    remainingFormatted: 'Unknown',
    isSupported: isStorageSupported(),
    lastChecked: new Date(),
  }));

  const checkQuota = useCallback(async () => {
    if (!isStorageSupported()) {
      return;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      const remaining = quota - usage;
      const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;
      const remainingPercent = quota > 0 ? remaining / quota : 1;

      const isLow = remainingPercent < lowThreshold;
      const isCritical = remainingPercent < criticalThreshold;

      const newInfo: StorageQuotaInfo = {
        quota,
        usage,
        percentUsed: Math.round(percentUsed * 10) / 10,
        isLow,
        isCritical,
        quotaFormatted: formatBytes(quota),
        usageFormatted: formatBytes(usage),
        remainingFormatted: formatBytes(remaining),
        isSupported: true,
        lastChecked: new Date(),
      };

      setQuotaInfo((prev) => {
        // Trigger callbacks on state transitions
        if (!prev.isLow && newInfo.isLow && onLow) {
          onLow(newInfo);
        }
        if (!prev.isCritical && newInfo.isCritical && onCritical) {
          onCritical(newInfo);
        }
        return newInfo;
      });
    } catch {
      // Storage API failed, keep previous state
    }
  }, [lowThreshold, criticalThreshold, onLow, onCritical]);

  useEffect(() => {
    // Initial check
    checkQuota();

    // Poll periodically
    const intervalId = setInterval(checkQuota, pollInterval);

    return () => clearInterval(intervalId);
  }, [checkQuota, pollInterval]);

  return quotaInfo;
}

/**
 * Request persistent storage (survives browser cleanup)
 * Returns true if granted, false otherwise
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persist();
    return isPersisted;
  } catch {
    return false;
  }
}

/**
 * Check if storage is already persistent
 */
export async function isStoragePersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) {
    return false;
  }

  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

/**
 * Clear old cached data to free up space
 */
export async function clearOldCaches(keepLatest = 2): Promise<void> {
  if (!('caches' in window)) {
    return;
  }

  try {
    const cacheNames = await caches.keys();
    const sortedCaches = cacheNames.sort().reverse();
    const cachesToDelete = sortedCaches.slice(keepLatest);

    await Promise.all(cachesToDelete.map((name) => caches.delete(name)));
  } catch {
    // Cache API failed
  }
}

export default useStorageQuota;
