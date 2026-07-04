/**
 * useNativeSystemMode — detects whether the app is running in "native system mode"
 *
 * Purpose: Surface a senior-safe signal when the Claude AI layer is temporarily
 *   degraded so the UI can reassure the user that their data is still saving.
 * Signal: the Claude client's in-memory circuit-breaker state. When it trips OPEN
 *   (repeated AI failures), the app is in native system mode. This is the reliable
 *   runtime signal — `isAvailable()`/`isInitialized` is not, because in this app the
 *   Claude singleton is initialized lazily and would read "unavailable" at startup.
 * Used by: NativeModeBanner (and any surface that wants to react to AI degradation).
 */

import { useEffect, useState } from 'react';
import { claudeService } from '../services/claudeService';

/** Default poll cadence — the circuit-breaker state lives in memory, so this is cheap. */
export const NATIVE_MODE_POLL_MS = 15000;

function readDegraded(): boolean {
  return claudeService.getServiceStatus().circuitBreakerState === 'OPEN';
}

/**
 * Returns true when the Claude AI layer is degraded (circuit breaker OPEN).
 * Polls the in-memory status on an interval; no network calls are made.
 */
export function useNativeSystemMode(pollMs: number = NATIVE_MODE_POLL_MS): boolean {
  const [degraded, setDegraded] = useState<boolean>(readDegraded);

  useEffect(() => {
    const read = () => setDegraded(readDegraded());
    read();
    const id = setInterval(read, pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  return degraded;
}

export default useNativeSystemMode;
