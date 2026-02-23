/**
 * useDoctorsViewData — Data-fetching hook for DoctorsViewPage
 *
 * Migrated (Phase 4): self_reports query now delegates to patientContextService.
 * Check-in and community engagement queries remain direct (per CLAUDE.md:
 * check-in needs raw fields the service doesn't provide; community engagement
 * is an aggregate query across all check-ins, not per-patient context).
 *
 * @module DoctorsView/useDoctorsViewData
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { patientContextService } from '../../services/patient-context';

export interface CheckInData {
  id: string;
  user_id: string;
  label: string | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  emotional_state?: string | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  heart_rate?: number | null;
  glucose_mg_dl?: number | null;
  pulse_oximeter?: number | null;
}

export interface HealthDataEntry {
  id: string;
  user_id: string;
  mood: string;
  symptoms?: string | null;
  activity_description?: string | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  heart_rate?: number | null;
  blood_sugar?: number | null;
  blood_oxygen?: number | null;
  weight?: number | null;
  physical_activity?: string | null;
  social_engagement?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  entry_type?: string;
}

export interface CareTeamReview {
  status: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  reviewed_item_type: string;
  reviewed_item_date: string | null;
}

export interface CommunityEngagementSummary {
  lastAttendedAt: string | null;
  countLast30Days: number;
}

const EVENT_LABEL = '⭐ Attending the event today';

/**
 * Build care team review status from check-in and health entries
 */
function buildCareTeamReview(
  checkIn: CheckInData | null,
  healthEntries: HealthDataEntry[]
): CareTeamReview | null {
  if (checkIn?.reviewed_at) {
    return {
      status: `Reviewed by ${checkIn.reviewed_by_name || 'Care Team'}`,
      reviewed_by_name: checkIn.reviewed_by_name || 'Care Team',
      reviewed_at: checkIn.reviewed_at,
      reviewed_item_type: 'Check-in',
      reviewed_item_date: checkIn.created_at,
    };
  }

  const mostRecentReviewed = healthEntries
    .filter((entry) => entry.reviewed_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  if (mostRecentReviewed) {
    return {
      status: `Reviewed by ${mostRecentReviewed.reviewed_by_name || 'Care Team'}`,
      reviewed_by_name: mostRecentReviewed.reviewed_by_name || 'Care Team',
      reviewed_at: mostRecentReviewed.reviewed_at ?? null,
      reviewed_item_type: 'Health Entry',
      reviewed_item_date: mostRecentReviewed.created_at,
    };
  }

  if (checkIn) {
    return {
      status: 'Awaiting Review',
      reviewed_by_name: null,
      reviewed_at: null,
      reviewed_item_type: 'Latest Check-in',
      reviewed_item_date: checkIn.created_at,
    };
  }

  return null;
}

export interface DoctorsViewData {
  latestCheckIn: CheckInData | null;
  recentHealthEntries: HealthDataEntry[];
  careTeamReview: CareTeamReview | null;
  communityEngagement: CommunityEngagementSummary | null;
  loading: boolean;
  error: string | null;
  userId: string | null;
  refresh: () => void;
}

/**
 * Hook that fetches all data for DoctorsViewPage.
 *
 * - self_reports: fetched via patientContextService (canonical)
 * - check_ins (latest): direct query (needs raw vital fields)
 * - community engagement: direct aggregate queries
 */
export function useDoctorsViewData(): DoctorsViewData {
  const supabase = useSupabaseClient();
  const user = useUser();
  const userId = user?.id ?? null;

  const [latestCheckIn, setLatestCheckIn] = useState<CheckInData | null>(null);
  const [recentHealthEntries, setRecentHealthEntries] = useState<HealthDataEntry[]>([]);
  const [careTeamReview, setCareTeamReview] = useState<CareTeamReview | null>(null);
  const [communityEngagement, setCommunityEngagement] = useState<CommunityEngagementSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const results = await Promise.allSettled([
        // 1. Latest check-in with vitals (direct — needs raw fields)
        supabase
          .from('check_ins')
          .select('id, user_id, label, emotional_state, bp_systolic, bp_diastolic, heart_rate, glucose_mg_dl, pulse_oximeter, created_at, reviewed_at, reviewed_by_name')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),

        // 2. Self-reports via patientContextService (canonical)
        patientContextService.getPatientContext(uid, {
          includeSelfReports: true,
          includeTimeline: false,
          includeContacts: false,
          includeRisk: false,
          includeCarePlan: false,
          includeHospitalDetails: false,
          maxSelfReports: 5,
        }),

        // 3. Community engagement: last event
        supabase
          .from('check_ins')
          .select('id, label, created_at, timestamp')
          .eq('user_id', uid)
          .eq('label', EVENT_LABEL)
          .order('created_at', { ascending: false })
          .limit(1),

        // 4. Community engagement: count in last 30 days
        supabase
          .from('check_ins')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('label', EVENT_LABEL)
          .gte('created_at', thirtyDaysAgo),
      ]);

      const [checkInResult, contextResult, lastEventResult, countResult] = results;

      // Process check-in
      if (checkInResult.status === 'fulfilled' && checkInResult.value.data) {
        setLatestCheckIn(checkInResult.value.data as CheckInData);
      } else {
        setLatestCheckIn(null);
      }

      // Process self-reports from patientContextService
      let healthEntries: HealthDataEntry[] = [];
      if (contextResult.status === 'fulfilled') {
        const ctxResult = contextResult.value;
        if (ctxResult.success && ctxResult.data.self_reports) {
          healthEntries = ctxResult.data.self_reports.recent_reports.map(report => ({
            id: report.id,
            user_id: report.user_id,
            mood: report.mood ?? '',
            symptoms: report.symptoms,
            activity_description: report.activity_description,
            bp_systolic: report.bp_systolic,
            bp_diastolic: report.bp_diastolic,
            heart_rate: report.heart_rate,
            blood_sugar: report.blood_sugar,
            blood_oxygen: report.blood_oxygen,
            weight: report.weight,
            physical_activity: report.physical_activity,
            social_engagement: report.social_engagement,
            created_at: report.created_at,
            reviewed_at: report.reviewed_at,
            reviewed_by_name: report.reviewed_by_name,
          }));
        }
      }
      setRecentHealthEntries(healthEntries);

      // Build care team review
      const checkIn = checkInResult.status === 'fulfilled'
        ? (checkInResult.value.data as CheckInData | null)
        : null;
      setCareTeamReview(buildCareTeamReview(checkIn, healthEntries));

      // Community engagement summary
      let lastAttendedAt: string | null = null;
      let countLast30Days = 0;
      if (lastEventResult.status === 'fulfilled' && Array.isArray(lastEventResult.value.data)) {
        const row = lastEventResult.value.data[0] as { created_at?: string; timestamp?: string } | undefined;
        if (row) lastAttendedAt = row.created_at || row.timestamp || null;
      }
      if (countResult.status === 'fulfilled' && typeof countResult.value.count === 'number') {
        countLast30Days = countResult.value.count;
      }
      setCommunityEngagement({ lastAttendedAt, countLast30Days });

    } catch (_e: unknown) {
      setError('Failed to load data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!userId) {
      setError('No user logged in. This view requires authentication.');
      setLoading(false);
      return;
    }
    fetchData(userId);
  }, [userId, fetchData, supabase.auth]);

  const refresh = useCallback(() => {
    if (userId) fetchData(userId);
  }, [userId, fetchData]);

  return {
    latestCheckIn,
    recentHealthEntries,
    careTeamReview,
    communityEngagement,
    loading,
    error,
    userId,
    refresh,
  };
}
