/**
 * Connection Quality Hook
 *
 * Monitors network connectivity and quality for healthcare environments
 * where spotty coverage is common (hospitals, rural areas, large facilities).
 *
 * Features:
 * - Detects online/offline status
 * - Measures connection speed (when Network Information API available)
 * - Estimates latency via lightweight pings
 * - Provides quality tier (excellent/good/fair/poor/offline)
 * - Auto-updates on network changes
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

export interface ConnectionInfo {
  /** Current online/offline status */
  isOnline: boolean;
  /** Quality tier based on speed and latency */
  quality: ConnectionQuality;
  /** Effective connection type (4g, 3g, 2g, slow-2g) if available */
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  /** Estimated downlink speed in Mbps */
  downlink: number | null;
  /** Round-trip time in ms (measured via ping) */
  rtt: number | null;
  /** Whether data saver mode is enabled */
  saveData: boolean;
  /** Human-readable status message */
  statusMessage: string;
  /** Recommendation for user */
  recommendation: string | null;
  /** Last time connection was checked */
  lastChecked: Date;
}

interface NetworkInformation {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  downlink: number;
  rtt: number;
  saveData: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

const getNetworkInfo = (): NetworkInformation | undefined => {
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection;
};

const calculateQuality = (
  isOnline: boolean,
  effectiveType: string,
  rtt: number | null,
  downlink: number | null
): ConnectionQuality => {
  if (!isOnline) return 'offline';

  // Use RTT as primary indicator if available
  if (rtt !== null) {
    if (rtt < 100) return 'excellent';
    if (rtt < 300) return 'good';
    if (rtt < 700) return 'fair';
    return 'poor';
  }

  // Fall back to effective type
  switch (effectiveType) {
    case '4g':
      return downlink && downlink > 5 ? 'excellent' : 'good';
    case '3g':
      return 'fair';
    case '2g':
    case 'slow-2g':
      return 'poor';
    default:
      return 'good'; // Assume good if unknown
  }
};

const getStatusMessage = (quality: ConnectionQuality, effectiveType: string): string => {
  switch (quality) {
    case 'offline':
      return 'No internet connection. Your data will sync when you reconnect.';
    case 'poor':
      return `Slow connection (${effectiveType}). Some features may be delayed.`;
    case 'fair':
      return 'Moderate connection. Large files may load slowly.';
    case 'good':
      return 'Good connection.';
    case 'excellent':
      return 'Excellent connection.';
  }
};

const getRecommendation = (quality: ConnectionQuality): string | null => {
  switch (quality) {
    case 'offline':
      return 'Move closer to a Wi-Fi access point or check your network settings.';
    case 'poor':
      return 'Consider enabling Low-Bandwidth Mode in settings for better performance.';
    case 'fair':
      return 'Videos and large images may load slowly. Text and basic features work normally.';
    default:
      return null;
  }
};

/**
 * Measure actual latency by pinging a lightweight endpoint
 */
const measureLatency = async (): Promise<number | null> => {
  try {
    const start = performance.now();
    // Use a tiny request to measure RTT - favicon is usually cached and small
    await fetch('/favicon.ico', {
      method: 'HEAD',
      cache: 'no-store',
      mode: 'no-cors'
    });
    const end = performance.now();
    return Math.round(end - start);
  } catch {
    return null;
  }
};

export interface UseConnectionQualityOptions {
  /** How often to check connection (ms). Default: 30000 (30s) */
  pollInterval?: number;
  /** Whether to measure latency via ping. Default: true */
  measureLatency?: boolean;
}

/**
 * Hook to monitor connection quality
 *
 * @example
 * ```tsx
 * const { isOnline, quality, statusMessage, recommendation } = useConnectionQuality();
 *
 * if (quality === 'poor' || quality === 'offline') {
 *   return <OfflineBanner message={statusMessage} />;
 * }
 * ```
 */
export function useConnectionQuality(options: UseConnectionQualityOptions = {}): ConnectionInfo {
  const { pollInterval = 30000, measureLatency: shouldMeasureLatency = true } = options;

  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>(() => {
    const networkInfo = getNetworkInfo();
    const isOnline = navigator.onLine;
    const effectiveType = networkInfo?.effectiveType || 'unknown';
    const quality = calculateQuality(isOnline, effectiveType, null, networkInfo?.downlink || null);

    return {
      isOnline,
      quality,
      effectiveType: effectiveType as ConnectionInfo['effectiveType'],
      downlink: networkInfo?.downlink || null,
      rtt: networkInfo?.rtt || null,
      saveData: networkInfo?.saveData || false,
      statusMessage: getStatusMessage(quality, effectiveType),
      recommendation: getRecommendation(quality),
      lastChecked: new Date(),
    };
  });

  const mountedRef = useRef(true);

  const updateConnectionInfo = useCallback(async () => {
    if (!mountedRef.current) return;

    const networkInfo = getNetworkInfo();
    const isOnline = navigator.onLine;
    const effectiveType = networkInfo?.effectiveType || 'unknown';

    // Measure actual latency if online and enabled
    let rtt = networkInfo?.rtt || null;
    if (isOnline && shouldMeasureLatency) {
      const measuredRtt = await measureLatency();
      if (measuredRtt !== null) {
        rtt = measuredRtt;
      }
    }

    const quality = calculateQuality(isOnline, effectiveType, rtt, networkInfo?.downlink || null);

    if (!mountedRef.current) return;

    setConnectionInfo({
      isOnline,
      quality,
      effectiveType: effectiveType as ConnectionInfo['effectiveType'],
      downlink: networkInfo?.downlink || null,
      rtt,
      saveData: networkInfo?.saveData || false,
      statusMessage: getStatusMessage(quality, effectiveType),
      recommendation: getRecommendation(quality),
      lastChecked: new Date(),
    });
  }, [shouldMeasureLatency]);

  useEffect(() => {
    mountedRef.current = true;

    // Listen for online/offline events
    const handleOnline = () => updateConnectionInfo();
    const handleOffline = () => updateConnectionInfo();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for Network Information API changes
    const networkInfo = getNetworkInfo();
    const handleNetworkChange = () => updateConnectionInfo();

    if (networkInfo) {
      networkInfo.addEventListener('change', handleNetworkChange);
    }

    // Poll periodically
    const intervalId = setInterval(updateConnectionInfo, pollInterval);

    // Initial check
    updateConnectionInfo();

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (networkInfo) {
        networkInfo.removeEventListener('change', handleNetworkChange);
      }
      clearInterval(intervalId);
    };
  }, [pollInterval, updateConnectionInfo]);

  return connectionInfo;
}

/**
 * Get a color for the connection quality indicator
 */
export function getQualityColor(quality: ConnectionQuality): string {
  switch (quality) {
    case 'excellent':
      return '#10B981'; // green-500
    case 'good':
      return '#22C55E'; // green-400
    case 'fair':
      return '#F59E0B'; // amber-500
    case 'poor':
      return '#EF4444'; // red-500
    case 'offline':
      return '#6B7280'; // gray-500
  }
}

/**
 * Get an icon name for the connection quality
 */
export function getQualityIcon(quality: ConnectionQuality): string {
  switch (quality) {
    case 'excellent':
      return 'wifi'; // Full bars
    case 'good':
      return 'wifi'; // 3 bars
    case 'fair':
      return 'wifi-low'; // 2 bars
    case 'poor':
      return 'wifi-off'; // 1 bar
    case 'offline':
      return 'wifi-off'; // X
  }
}

export default useConnectionQuality;
