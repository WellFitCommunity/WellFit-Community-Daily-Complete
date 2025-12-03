/**
 * Connection Quality Indicator
 *
 * Visual indicator showing network connection quality.
 * Designed for healthcare environments with spotty Wi-Fi coverage.
 */

import React, { useState } from 'react';
import { useConnectionQuality, getQualityColor, ConnectionQuality } from '../hooks/useConnectionQuality';

interface ConnectionQualityIndicatorProps {
  /** Show detailed info on click */
  showDetails?: boolean;
  /** Compact mode - just the icon */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

const WifiIcon: React.FC<{ quality: ConnectionQuality; size?: number }> = ({ quality, size = 20 }) => {
  const color = getQualityColor(quality);

  // SVG wifi icon with varying signal strength
  const getBars = () => {
    switch (quality) {
      case 'excellent':
        return 4;
      case 'good':
        return 3;
      case 'fair':
        return 2;
      case 'poor':
        return 1;
      case 'offline':
        return 0;
    }
  };

  const bars = getBars();

  if (quality === 'offline') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <path d="M1 1l22 22" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" opacity="0.3" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" opacity="0.3" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" opacity="0.3" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" opacity="0.3" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" opacity="0.3" />
        <circle cx="12" cy="20" r="1" fill={color} />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      {/* Outer arc - 4 bars */}
      <path
        d="M1.42 9a16 16 0 0 1 21.16 0"
        opacity={bars >= 4 ? 1 : 0.2}
      />
      {/* Third arc - 3 bars */}
      <path
        d="M5 12.55a11 11 0 0 1 14.08 0"
        opacity={bars >= 3 ? 1 : 0.2}
      />
      {/* Second arc - 2 bars */}
      <path
        d="M8.53 16.11a6 6 0 0 1 6.95 0"
        opacity={bars >= 2 ? 1 : 0.2}
      />
      {/* Center dot - always visible when online */}
      <circle cx="12" cy="20" r="1" fill={color} opacity={bars >= 1 ? 1 : 0.2} />
    </svg>
  );
};

export const ConnectionQualityIndicator: React.FC<ConnectionQualityIndicatorProps> = ({
  showDetails = true,
  compact = false,
  className = '',
}) => {
  const connection = useConnectionQuality();
  const [isExpanded, setIsExpanded] = useState(false);

  const qualityLabels: Record<ConnectionQuality, string> = {
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
    offline: 'Offline',
  };

  if (compact) {
    return (
      <div
        className={`inline-flex items-center ${className}`}
        title={connection.statusMessage}
      >
        <WifiIcon quality={connection.quality} size={16} />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => showDetails && setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-700/50 transition-colors"
        aria-label={`Connection: ${qualityLabels[connection.quality]}`}
      >
        <WifiIcon quality={connection.quality} />
        <span
          className="text-sm font-medium"
          style={{ color: getQualityColor(connection.quality) }}
        >
          {qualityLabels[connection.quality]}
        </span>
      </button>

      {showDetails && isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 z-50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Status</span>
              <span
                className="font-medium"
                style={{ color: getQualityColor(connection.quality) }}
              >
                {qualityLabels[connection.quality]}
              </span>
            </div>

            {connection.effectiveType !== 'unknown' && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Connection Type</span>
                <span className="text-white font-medium uppercase">
                  {connection.effectiveType}
                </span>
              </div>
            )}

            {connection.rtt !== null && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Latency</span>
                <span className="text-white font-medium">
                  {connection.rtt}ms
                </span>
              </div>
            )}

            {connection.downlink !== null && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Speed</span>
                <span className="text-white font-medium">
                  {connection.downlink} Mbps
                </span>
              </div>
            )}

            {connection.saveData && (
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Data Saver Mode Active
              </div>
            )}

            <div className="border-t border-slate-700 pt-3 mt-3">
              <p className="text-slate-300 text-sm">{connection.statusMessage}</p>
              {connection.recommendation && (
                <p className="text-slate-400 text-xs mt-2">{connection.recommendation}</p>
              )}
            </div>

            <div className="text-slate-500 text-xs">
              Last checked: {connection.lastChecked.toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionQualityIndicator;
