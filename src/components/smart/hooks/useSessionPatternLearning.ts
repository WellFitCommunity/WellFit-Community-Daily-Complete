/**
 * useSessionPatternLearning — Session 3 (3.3) pattern tracking hook
 *
 * Loads a provider's recent scribe sessions and computes average encounter
 * duration. Surfaces "Your typical session: ~18 min" context to the physician
 * and informs adaptive behavior calibration.
 *
 * Part of Compass Riley Ambient Learning Session 3.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../../services/auditLogger';

// ============================================================================
// Types
// ============================================================================

export interface SessionPatternStats {
  avgDurationMinutes: number;
  sessionCount: number;
  isLoading: boolean;
}

interface ScribeSessionRow {
  recording_duration_seconds: number | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Load session pattern stats for a provider.
 * Queries the last 20 scribe sessions and computes average duration.
 * providerId is null until auth resolves — the hook is a no-op until set.
 */
export function useSessionPatternLearning(
  providerId: string | null
): SessionPatternStats {
  const [avgDurationMinutes, setAvgDurationMinutes] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!providerId) return;

    let cancelled = false;
    setIsLoading(true);

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('scribe_sessions')
          .select('recording_duration_seconds')
          .eq('provider_id', providerId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (cancelled) return;

        if (error) {
          auditLogger.error(
            'SESSION_PATTERN_LOAD_FAILED',
            error instanceof Error ? error : new Error(String(error)),
            { providerId }
          );
          return;
        }

        if (data && data.length > 0) {
          const rows = data as ScribeSessionRow[];
          const durations = rows
            .map(s => s.recording_duration_seconds ?? 0)
            .filter(d => d > 0);

          if (durations.length > 0) {
            const avgSeconds =
              durations.reduce((sum, d) => sum + d, 0) / durations.length;
            setAvgDurationMinutes(Math.round(avgSeconds / 60));
          }
          setSessionCount(data.length);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          auditLogger.error(
            'SESSION_PATTERN_LOAD_ERROR',
            err instanceof Error ? err : new Error(String(err)),
            { providerId }
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  return { avgDurationMinutes, sessionCount, isLoading };
}
