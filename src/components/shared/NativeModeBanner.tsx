/**
 * NativeModeBanner — senior-safe "native system mode" notice for AI outages
 *
 * Purpose: When the Claude AI layer is degraded, reassure the user (positive framing,
 *   §1.7 of the BLE/RPM tracker) that the system is still working and their data is
 *   saving normally. Never says "AI is down."
 * Trigger: useNativeSystemMode() (Claude circuit-breaker OPEN). Pass `forceVisible`
 *   to render regardless of AI state (used by tests and any manual override).
 * Used by: senior check-in + dashboard surfaces, and the clinician contraindication panel.
 */

import React from 'react';
import { useNativeSystemMode } from '../../hooks/useNativeSystemMode';

export interface NativeModeBannerProps {
  /** Force visibility regardless of live AI state. Omit to drive off circuit-breaker state. */
  forceVisible?: boolean;
  /** Extra classes for placement/spacing. */
  className?: string;
}

/** Positive-framing copy — Maria-approved (tracker §1.7). Do NOT reword to "AI is down." */
export const NATIVE_MODE_MESSAGE =
  'Currently running in native system mode — your information is saving normally.';

export const NativeModeBanner: React.FC<NativeModeBannerProps> = ({ forceVisible, className }) => {
  const degraded = useNativeSystemMode();
  const visible = forceVisible ?? degraded;

  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 ${className ?? ''}`}
    >
      <svg
        className="w-6 h-6 flex-shrink-0 text-blue-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      <p className="text-base font-medium">{NATIVE_MODE_MESSAGE}</p>
    </div>
  );
};

export default NativeModeBanner;
