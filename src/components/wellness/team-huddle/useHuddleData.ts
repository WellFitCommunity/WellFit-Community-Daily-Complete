// ============================================================================
// Team Huddle - Data Loading Hook
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../../services/auditLogger';
import {
  categorizeProvider,
  type AuditDiscussedRow,
  type HuddleProvider,
  type PractitionerRow,
  type ProfileRow,
  type ProviderCheckin,
} from './types';

interface HuddleDataResult {
  providers: HuddleProvider[];
  discussedIds: Set<string>;
  loading: boolean;
  errorMessage: string | null;
  markDiscussedLocal: (userId: string) => void;
}

export function useHuddleData(): HuddleDataResult {
  const [providers, setProviders] = useState<HuddleProvider[]>([]);
  const [discussedIds, setDiscussedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadInFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    setErrorMessage(null);

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      const [practitionerResp, checkinResp, discussedResp] = await Promise.all([
        supabase
          .from('fhir_practitioners')
          .select('id, user_id')
          .eq('active', true),
        supabase
          .from('provider_daily_checkins')
          .select(
            'user_id, stress_level, energy_level, mood_rating, work_setting, shift_type, unsafe_staffing, felt_overwhelmed, missed_break, checkin_date'
          )
          .gte('checkin_date', sevenDaysAgo)
          .order('checkin_date', { ascending: false }),
        supabase
          .from('audit_logs')
          .select('metadata')
          .eq('event_type', 'HUDDLE_DISCUSSED')
          .gte('created_at', todayIso),
      ]);

      if (practitionerResp.error) throw practitionerResp.error;
      if (checkinResp.error) throw checkinResp.error;

      const practitioners: PractitionerRow[] = practitionerResp.data ?? [];
      const checkins: ProviderCheckin[] = checkinResp.data ?? [];
      const discussedRows: AuditDiscussedRow[] = discussedResp.data ?? [];

      const latestByUser = new Map<string, ProviderCheckin>();
      for (const c of checkins) {
        if (!latestByUser.has(c.user_id)) latestByUser.set(c.user_id, c);
      }

      const userIds = practitioners
        .map((p) => p.user_id)
        .filter((v): v is string => Boolean(v));

      let profiles: ProfileRow[] = [];
      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, role, department')
          .in('user_id', userIds);
        if (profileError) {
          await auditLogger.warn('TEAM_HUDDLE_PROFILE_FETCH_FAILED', {
            error: profileError.message,
          });
        } else {
          profiles = profileData ?? [];
        }
      }
      const profileByUser = new Map<string, ProfileRow>();
      for (const p of profiles) profileByUser.set(p.user_id, p);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const built: HuddleProvider[] = practitioners
        .filter((p): p is PractitionerRow & { user_id: string } => Boolean(p.user_id))
        .map((p) => {
          const signals = latestByUser.get(p.user_id) ?? null;
          const profile = profileByUser.get(p.user_id);
          const fullName =
            profile && (profile.first_name || profile.last_name)
              ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
              : 'Team member';
          const roleLabel =
            profile?.department || profile?.role || 'Care team';

          let daysSince: number | null = null;
          if (signals?.checkin_date) {
            const ci = new Date(signals.checkin_date);
            ci.setHours(0, 0, 0, 0);
            daysSince = Math.max(
              0,
              Math.round(
                (today.getTime() - ci.getTime()) / (24 * 60 * 60 * 1000)
              )
            );
          }

          return {
            userId: p.user_id,
            fullName,
            roleLabel,
            lastCheckinDate: signals?.checkin_date ?? null,
            daysSinceCheckin: daysSince,
            signals,
            bucket: categorizeProvider(signals, daysSince),
          };
        });

      const discussedSet = new Set<string>();
      for (const row of discussedRows) {
        const meta = row.metadata;
        if (meta && typeof meta === 'object') {
          const nurseId = (meta as Record<string, unknown>)['nurse_id'];
          if (typeof nurseId === 'string') discussedSet.add(nurseId);
        }
      }

      setProviders(built);
      setDiscussedIds(discussedSet);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TEAM_HUDDLE_LOAD_FAILED', error);
      setErrorMessage('Unable to load team data right now. Please try again.');
    } finally {
      setLoading(false);
      loadInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markDiscussedLocal = useCallback((userId: string) => {
    setDiscussedIds((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
  }, []);

  return { providers, discussedIds, loading, errorMessage, markDiscussedLocal };
}
