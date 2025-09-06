// src/pages/DoctorsViewPage.tsx (hooks-based client)
import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser } from '../lib/supabaseClient';
import { useBranding } from '../BrandingContext';

interface CheckInData {
  id: string;
  user_id: string;
  notes: string | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
}

interface HealthDataEntry {
  id: string;
  user_id: string;
  entry_type: string;
  data: Record<string, any>;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
}

interface CareTeamReview {
  status: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  reviewed_item_type: string;
  reviewed_item_date: string | null;
}

interface CommunityEngagementSummary {
  lastAttendedAt: string | null;
  countLast30Days: number;
}

const EVENT_LABEL = '⭐ Attending the event today';

const DoctorsView: React.FC = () => {
  const { branding } = useBranding();
  const supabase = useSupabaseClient();
  const user = useUser();
  const userId = user?.id ?? null;

  const [latestCheckIn, setLatestCheckIn] = useState<CheckInData | null>(null);
  const [recentHealthEntries, setRecentHealthEntries] = useState<HealthDataEntry[]>([]);
  const [careTeamReview, setCareTeamReview] = useState<CareTeamReview | null>(null);
  const [communityEngagement, setCommunityEngagement] = useState<CommunityEngagementSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState<boolean>(false);
  const [questionSubmitFeedback, setQuestionSubmitFeedback] = useState<string | null>(null);

  const fetchData = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const results = await Promise.allSettled([
        supabase
          .from('check_ins')
          .select('id, user_id, notes, created_at, reviewed_at, reviewed_by_name')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('health_entries')
          .select('id, user_id, entry_type, data, created_at, reviewed_at, reviewed_by_name')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(3),

        // Community engagement: last event
        supabase
          .from('check_ins')
          .select('id, label, created_at, timestamp')
          .eq('user_id', uid)
          .eq('label', EVENT_LABEL)
          .order('created_at', { ascending: false })
          .limit(1),

        // Community engagement: count in last 30 days
        supabase
          .from('check_ins')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('label', EVENT_LABEL)
          .gte('created_at', thirtyDaysAgo),
      ]);

      const [checkInResult, healthEntriesResult, lastEventResult, countResult] = results;

      if (checkInResult.status === 'fulfilled' && checkInResult.value.data) {
        setLatestCheckIn(checkInResult.value.data as CheckInData);
      } else {
        setLatestCheckIn(null);
      }

      if (healthEntriesResult.status === 'fulfilled' && healthEntriesResult.value.data) {
        setRecentHealthEntries(healthEntriesResult.value.data as HealthDataEntry[]);
      } else {
        setRecentHealthEntries([]);
      }

      // Care team review
      const checkInForReview =
        checkInResult.status === 'fulfilled' ? (checkInResult.value.data as CheckInData | null) : null;
      const healthEntriesForReview =
        healthEntriesResult.status === 'fulfilled'
          ? ((healthEntriesResult.value.data as HealthDataEntry[]) ?? [])
          : [];

      let reviewToDisplay: CareTeamReview | null = null;

      if (checkInForReview && checkInForReview.reviewed_at) {
        reviewToDisplay = {
          status: `Reviewed by ${checkInForReview.reviewed_by_name || 'Care Team'}`,
          reviewed_by_name: checkInForReview.reviewed_by_name || 'Care Team',
          reviewed_at: checkInForReview.reviewed_at,
          reviewed_item_type: 'Check-in',
          reviewed_item_date: checkInForReview.created_at,
        };
      } else {
        const mostRecentReviewedHealthEntry = healthEntriesForReview
          .filter((entry) => entry.reviewed_at)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        if (mostRecentReviewedHealthEntry) {
          reviewToDisplay = {
            status: `Reviewed by ${mostRecentReviewedHealthEntry.reviewed_by_name || 'Care Team'}`,
            reviewed_by_name: mostRecentReviewedHealthEntry.reviewed_by_name || 'Care Team',
            reviewed_at: mostRecentReviewedHealthEntry.reviewed_at!,
            reviewed_item_type: `Health Entry (${mostRecentReviewedHealthEntry.entry_type})`,
            reviewed_item_date: mostRecentReviewedHealthEntry.created_at,
          };
        } else if (checkInForReview) {
          reviewToDisplay = {
            status: 'Awaiting Review',
            reviewed_by_name: null,
            reviewed_at: null,
            reviewed_item_type: 'Latest Check-in',
            reviewed_item_date: checkInForReview.created_at,
          };
        } else if (healthEntriesForReview.length > 0) {
          reviewToDisplay = {
            status: 'Awaiting Review',
            reviewed_by_name: null,
            reviewed_at: null,
            reviewed_item_type: 'Latest Health Entry',
            reviewed_item_date: healthEntriesForReview[0].created_at,
          };
        }
      }
      setCareTeamReview(reviewToDisplay);

      // Community engagement summary
      let lastAttendedAt: string | null = null;
      let countLast30Days = 0;

      if (lastEventResult.status === 'fulfilled' && Array.isArray(lastEventResult.value.data)) {
        const row = lastEventResult.value.data[0];
        if (row) lastAttendedAt = row.created_at || (row as any).timestamp || null;
      }
      if (countResult.status === 'fulfilled' && typeof countResult.value.count === 'number') {
        countLast30Days = countResult.value.count;
      }

      setCommunityEngagement({ lastAttendedAt, countLast30Days });
    } catch (e: any) {
      console.error('Error fetching data for DoctorsView:', e);
      setError('Failed to load some or all data. Please try again later.');
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
  }, [userId, fetchData]);

  const formatDate = (dateString?: string | null) =>
    dateString ? new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

  const formatDateTime = (dateString?: string | null) =>
    dateString ? new Date(dateString).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

  const renderHealthEntryData = (entry: HealthDataEntry) => {
    if (entry.entry_type === 'self_report' && entry.data) {
      const { mood, symptoms, activity_description } = entry.data;
      const parts: string[] = [];
      if (mood) parts.push(`Mood: ${mood}`);
      if (symptoms) parts.push(`Symptoms: ${symptoms}`);
      if (activity_description) parts.push(`Activity: ${activity_description}`);
      return parts.length > 0 ? `Self Report — ${parts.join(', ')}` : 'Self Report — (No details provided)';
    }
    if (entry.data) {
      const dataEntries = Object.entries(entry.data)
        .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
        .join(', ');
      return `${entry.entry_type} — ${dataEntries}`;
    }
    return entry.entry_type;
  };

  const handleQuestionSubmit = async () => {
    if (!userId) {
      setQuestionSubmitFeedback('You must be logged in to submit a question.');
      return;
    }
    setIsSubmittingQuestion(true);
    setQuestionSubmitFeedback(null);
    try {
      const { error: insertError } = await supabase.from('user_questions').insert({
        user_id: userId,
        user_email: user?.email ?? null,
        created_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;
      setQuestionSubmitFeedback('Your question has been sent. The care team will get back to you soon.');
    } catch (error: any) {
      setQuestionSubmitFeedback(error.message || 'Failed to submit question. Please try again.');
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-600" style={{ color: branding.secondaryColor }}>
        Loading doctor's view data...
      </div>
    );
  }

  if (error && !userId) {
    return <div className="p-4 text-red-600 bg-red-100 border border-red-400 rounded-md">{error}</div>;
  }

  return (
    <div className="p-4 border-gray-200 rounded-lg bg-gray-50 space-y-6">
      {error && userId && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">Notice: {error}</p>}

      {/* Latest Check-in */}
      <div>
        <h4 className="font-semibold text-md mb-1" style={{ color: branding.primaryColor }}>
          Latest Check-in:
        </h4>
        {latestCheckIn ? (
          <div className="text-base text-gray-700 bg-white p-3 rounded-md shadow-sm">
            <p><strong>Date:</strong> {formatDateTime(latestCheckIn.created_at)}</p>
            <p><strong>Notes:</strong> {latestCheckIn.notes || 'No notes provided.'}</p>
            {latestCheckIn.reviewed_at && (
              <p className="mt-1 text-xs text-green-700">
                Reviewed by {latestCheckIn.reviewed_by_name || 'Care Team'} on {formatDateTime(latestCheckIn.reviewed_at)}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-base text-gray-500">No check-in data available.</p>
        )}
      </div>

      {/* Recent Health Entries */}
      <div>
        <h4 className="font-semibold text-md mb-1" style={{ color: branding.primaryColor }}>
          Recent Self-reported Health Data ({recentHealthEntries.length})
        </h4>
        {recentHealthEntries.length > 0 ? (
          <ul className="space-y-2">
            {recentHealthEntries.map((entry) => (
              <li key={entry.id} className="text-base text-gray-700 bg-white p-3 rounded-md shadow-sm">
                <p><strong>Date:</strong> {formatDateTime(entry.created_at)}</p>
                <p>{renderHealthEntryData(entry)}</p>
                {entry.reviewed_at && (
                  <p className="mt-1 text-xs text-green-700">
                    Reviewed by {entry.reviewed_by_name || 'Care Team'} on {formatDateTime(entry.reviewed_at)}.
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-gray-500">No self-reported health data available.</p>
        )}
      </div>

      {/* Care Team Review */}
      <div>
        <h4 className="font-semibold text-md mb-1" style={{ color: branding.primaryColor }}>
          Overall Care Team Review Status:
        </h4>
        {careTeamReview ? (
          <div className="text-base text-gray-700 bg-white p-3 rounded-md shadow-sm">
            <p>
              <strong>Status:</strong> {careTeamReview.status}
              {careTeamReview.reviewed_at && careTeamReview.reviewed_by_name &&
                ` by ${careTeamReview.reviewed_by_name} on ${formatDateTime(careTeamReview.reviewed_at)}`}
            </p>
            <p className="text-xs text-gray-600">
              (Regarding {careTeamReview.reviewed_item_type} from {formatDate(careTeamReview.reviewed_item_date)})
            </p>
          </div>
        ) : (
          <p className="text-base text-gray-500">
            Note: This section depends on <code>reviewed_at</code> and <code>reviewed_by_name</code> in both <code>check_ins</code> and <code>health_entries</code>.
          </p>
        )}
      </div>

      {/* Community Engagement */}
      <div>
        <h4 className="font-semibold text-md mb-1" style={{ color: branding.primaryColor }}>
          Community Engagement:
        </h4>
        {communityEngagement ? (
          <div className="text-base text-gray-700 bg-white p-3 rounded-md shadow-sm">
            <p><strong>Last attended:</strong> {communityEngagement.lastAttendedAt ? formatDateTime(communityEngagement.lastAttendedAt) : 'No community events recorded'}</p>
            <p><strong>Events in last 30 days:</strong> {communityEngagement.countLast30Days}</p>
          </div>
        ) : (
          <p className="text-base text-gray-500">No community engagement data available.</p>
        )}
      </div>

      {/* Ask Care Team */}
      {userId && (
        <div className="mt-6 pt-6 border-t border-gray-300">
          <h4 className="font-semibold text-md mb-2" style={{ color: branding.primaryColor }}>
            Need Help or Have Questions?
          </h4>
          <button
            onClick={handleQuestionSubmit}
            disabled={isSubmittingQuestion || loading}
            className="px-6 py-2 text-white font-semibold rounded-md shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70"
            style={{ backgroundColor: branding.secondaryColor }}
          >
            {isSubmittingQuestion ? 'Submitting...' : 'I have a question for my Care Team'}
          </button>
          {questionSubmitFeedback && (
            <p className={`mt-3 text-sm ${questionSubmitFeedback.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
              {questionSubmitFeedback}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorsView;
