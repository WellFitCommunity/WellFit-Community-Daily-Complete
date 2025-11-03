// Professional Medical Dashboard for Healthcare Providers
import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import { Link } from 'react-router-dom';
import { Activity, Heart, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock, Users, FileText, Calendar } from 'lucide-react';

interface CheckInData {
  id: string;
  user_id: string;
  notes: string | null;
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

interface HealthDataEntry {
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

interface VitalMetric {
  label: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
  icon: any;
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

// Vital status indicator component
const VitalCard: React.FC<{ metric: VitalMetric }> = ({ metric }) => {
  const statusColors = {
    normal: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    critical: 'bg-red-50 border-red-200'
  };

  const statusTextColors = {
    normal: 'text-green-700',
    warning: 'text-yellow-700',
    critical: 'text-red-700'
  };

  const statusBadgeColors = {
    normal: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800'
  };

  const Icon = metric.icon;

  return (
    <div className={`p-4 rounded-lg border-2 ${statusColors[metric.status]} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Icon className={`w-5 h-5 ${statusTextColors[metric.status]}`} />
          <span className="text-sm font-medium text-gray-700">{metric.label}</span>
        </div>
        {metric.trend && (
          <div className="flex items-center">
            {metric.trend === 'up' && <TrendingUp className="w-4 h-4 text-red-500" />}
            {metric.trend === 'down' && <TrendingDown className="w-4 h-4 text-blue-500" />}
            {metric.trend === 'stable' && <div className="w-4 h-0.5 bg-gray-400"></div>}
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between">
        <div>
          <span className={`text-2xl font-bold ${statusTextColors[metric.status]}`}>
            {metric.value}
          </span>
          <span className="text-sm text-gray-500 ml-1">{metric.unit}</span>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${statusBadgeColors[metric.status]}`}>
          {metric.status.toUpperCase()}
        </span>
      </div>
    </div>
  );
};

// Timeline item component
const TimelineItem: React.FC<{
  date: string;
  title: string;
  content: string;
  reviewed: boolean;
  type: 'checkin' | 'health';
}> = ({ date, title, content, reviewed, type }) => {
  const typeColors = {
    checkin: 'bg-blue-100 text-blue-800',
    health: 'bg-purple-100 text-purple-800'
  };

  return (
    <div className="relative pl-8 pb-6 border-l-2 border-gray-200 last:border-l-0 last:pb-0">
      <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 border-white ${reviewed ? 'bg-green-500' : 'bg-gray-300'}`}></div>
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${typeColors[type]}`}>
                {type === 'checkin' ? 'Check-in' : 'Health Report'}
              </span>
              {reviewed && (
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Reviewed
                </span>
              )}
            </div>
            <h4 className="font-medium text-gray-900">{title}</h4>
          </div>
          <span className="text-xs text-gray-500 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {new Date(date).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm text-gray-700">{content}</p>
      </div>
    </div>
  );
};

// Stats card component
const StatsCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  color: string;
  trend?: { value: string; positive: boolean };
}> = ({ title, value, subtitle, icon: Icon, color, trend }) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center mt-2 text-xs ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {trend.value}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
};

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

  const fetchData = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const results = await Promise.allSettled([
        // Latest check-in with vitals
        supabase
          .from('check_ins')
          .select('id, user_id, notes, emotional_state, bp_systolic, bp_diastolic, heart_rate, glucose_mg_dl, pulse_oximeter, created_at, reviewed_at, reviewed_by_name')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),

        // Recent health entries
        supabase
          .from('self_reports')
          .select('id, user_id, mood, symptoms, activity_description, bp_systolic, bp_diastolic, heart_rate, blood_sugar, blood_oxygen, weight, physical_activity, social_engagement, created_at, reviewed_at, reviewed_by_name')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(5),

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

      // Care team review processing
      const checkInForReview = checkInResult.status === 'fulfilled' ? (checkInResult.value.data as CheckInData | null) : null;
      const healthEntriesForReview = healthEntriesResult.status === 'fulfilled' ? ((healthEntriesResult.value.data as HealthDataEntry[]) ?? []) : [];

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
            reviewed_at: mostRecentReviewedHealthEntry.reviewed_at ?? null,
            reviewed_item_type: `Health Entry`,
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
  }, [userId, fetchData]);

  // Helper functions
  const getVitalStatus = (type: string, value: number): 'normal' | 'warning' | 'critical' => {
    if (type === 'bp_systolic') {
      if (value >= 180 || value < 90) return 'critical';
      if (value >= 140 || value < 100) return 'warning';
      return 'normal';
    }
    if (type === 'bp_diastolic') {
      if (value >= 120 || value < 60) return 'critical';
      if (value >= 90 || value < 65) return 'warning';
      return 'normal';
    }
    if (type === 'heart_rate') {
      if (value >= 120 || value < 50) return 'critical';
      if (value >= 100 || value < 60) return 'warning';
      return 'normal';
    }
    if (type === 'glucose') {
      if (value >= 250 || value < 70) return 'critical';
      if (value >= 180 || value < 80) return 'warning';
      return 'normal';
    }
    if (type === 'oxygen') {
      if (value < 90) return 'critical';
      if (value < 95) return 'warning';
      return 'normal';
    }
    return 'normal';
  };

  const extractVitals = (): VitalMetric[] => {
    const vitals: VitalMetric[] = [];

    // Check latest check-in first (most recent)
    if (latestCheckIn) {
      if (latestCheckIn.bp_systolic && latestCheckIn.bp_diastolic) {
        vitals.push({
          label: 'Blood Pressure',
          value: `${latestCheckIn.bp_systolic}/${latestCheckIn.bp_diastolic}`,
          unit: 'mmHg',
          status: getVitalStatus('bp_systolic', latestCheckIn.bp_systolic),
          icon: Activity
        });
      }
      if (latestCheckIn.heart_rate) {
        vitals.push({
          label: 'Heart Rate',
          value: latestCheckIn.heart_rate,
          unit: 'bpm',
          status: getVitalStatus('heart_rate', latestCheckIn.heart_rate),
          icon: Heart
        });
      }
      if (latestCheckIn.glucose_mg_dl) {
        vitals.push({
          label: 'Blood Glucose',
          value: latestCheckIn.glucose_mg_dl,
          unit: 'mg/dL',
          status: getVitalStatus('glucose', latestCheckIn.glucose_mg_dl),
          icon: Activity
        });
      }
      if (latestCheckIn.pulse_oximeter) {
        vitals.push({
          label: 'Oxygen Saturation',
          value: latestCheckIn.pulse_oximeter,
          unit: '%',
          status: getVitalStatus('oxygen', latestCheckIn.pulse_oximeter),
          icon: Activity
        });
      }
    }

    // Fallback to self-reports if no check-in vitals
    if (vitals.length === 0 && recentHealthEntries.length > 0) {
      const latest = recentHealthEntries[0];
      if (latest.bp_systolic && latest.bp_diastolic) {
        vitals.push({
          label: 'Blood Pressure',
          value: `${latest.bp_systolic}/${latest.bp_diastolic}`,
          unit: 'mmHg',
          status: getVitalStatus('bp_systolic', latest.bp_systolic),
          icon: Activity
        });
      }
      if (latest.heart_rate) {
        vitals.push({
          label: 'Heart Rate',
          value: latest.heart_rate,
          unit: 'bpm',
          status: getVitalStatus('heart_rate', latest.heart_rate),
          icon: Heart
        });
      }
      if (latest.blood_sugar) {
        vitals.push({
          label: 'Blood Glucose',
          value: latest.blood_sugar,
          unit: 'mg/dL',
          status: getVitalStatus('glucose', latest.blood_sugar),
          icon: Activity
        });
      }
      if (latest.blood_oxygen) {
        vitals.push({
          label: 'Oxygen Saturation',
          value: latest.blood_oxygen,
          unit: '%',
          status: getVitalStatus('oxygen', latest.blood_oxygen),
          icon: Activity
        });
      }
    }

    return vitals;
  };

  const formatDateTime = (dateString?: string | null) =>
    dateString ? new Date(dateString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A';

  const renderHealthEntryContent = (entry: HealthDataEntry) => {
    const parts: string[] = [];
    if (entry.mood) parts.push(`Mood: ${entry.mood}`);
    if (entry.symptoms) parts.push(`Symptoms: ${entry.symptoms}`);
    if (entry.physical_activity) parts.push(`Activity: ${entry.physical_activity}`);
    if (entry.social_engagement) parts.push(`Social: ${entry.social_engagement}`);
    return parts.join(' • ') || 'No details provided';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg text-gray-600">Loading patient dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !userId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-800 text-center font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const vitals = extractVitals();
  const hasReviewPending = careTeamReview?.status === 'Awaiting Review';
  const totalDataPoints = (latestCheckIn ? 1 : 0) + recentHealthEntries.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Patient Health Dashboard</h1>
                <p className="text-gray-600">Real-time health monitoring and insights</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => userId && fetchData(userId)}
                  className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors flex items-center space-x-2"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  <Activity className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
                <Link
                  to="/questions"
                  className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors flex items-center space-x-2"
                  style={{ backgroundColor: branding.secondaryColor }}
                >
                  <FileText className="w-4 h-4" />
                  <span>Ask Care Team</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Key Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatsCard
              title="Total Data Points"
              value={totalDataPoints}
              subtitle="Last 30 days"
              icon={FileText}
              color="bg-blue-600"
            />
            <StatsCard
              title="Pending Reviews"
              value={hasReviewPending ? 1 : 0}
              subtitle={hasReviewPending ? 'Needs attention' : 'All caught up'}
              icon={AlertCircle}
              color={hasReviewPending ? 'bg-orange-600' : 'bg-green-600'}
            />
            <StatsCard
              title="Community Events"
              value={communityEngagement?.countLast30Days || 0}
              subtitle="Last 30 days"
              icon={Users}
              color="bg-purple-600"
            />
            <StatsCard
              title="Last Activity"
              value={latestCheckIn ? new Date(latestCheckIn.created_at).toLocaleDateString() : 'N/A'}
              subtitle={latestCheckIn ? 'Check-in completed' : 'No recent data'}
              icon={Calendar}
              color="bg-blue-600"
            />
          </div>

          {/* Alert Banner */}
          {error && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-3" />
                <p className="text-yellow-800">{error}</p>
              </div>
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Column - Vitals */}
            <div className="lg:col-span-2 space-y-6">

              {/* Vital Signs */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <Heart className="w-6 h-6 mr-2 text-red-500" />
                    Latest Vital Signs
                  </h2>
                  <span className="text-sm text-gray-500">
                    {latestCheckIn ? formatDateTime(latestCheckIn.created_at) : 'No data'}
                  </span>
                </div>

                {vitals.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vitals.map((vital, idx) => (
                      <VitalCard key={idx} metric={vital} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No vital signs recorded yet</p>
                    <p className="text-sm mt-1">Encourage patient to complete a health check-in</p>
                  </div>
                )}

                {/* Emotional State */}
                {latestCheckIn?.emotional_state && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Emotional State</span>
                      <span className="text-lg font-semibold text-blue-700">{latestCheckIn.emotional_state}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Activity Timeline */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <Clock className="w-6 h-6 mr-2 text-blue-500" />
                  Recent Activity Timeline
                </h2>

                <div className="space-y-0">
                  {latestCheckIn && (
                    <TimelineItem
                      date={latestCheckIn.created_at}
                      title="Daily Check-in"
                      content={latestCheckIn.notes || 'No notes provided'}
                      reviewed={!!latestCheckIn.reviewed_at}
                      type="checkin"
                    />
                  )}

                  {recentHealthEntries.slice(0, 4).map((entry) => (
                    <TimelineItem
                      key={entry.id}
                      date={entry.created_at}
                      title="Health Self-Report"
                      content={renderHealthEntryContent(entry)}
                      reviewed={!!entry.reviewed_at}
                      type="health"
                    />
                  ))}

                  {!latestCheckIn && recentHealthEntries.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No recent activity</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Summary Cards */}
            <div className="space-y-6">

              {/* Review Status */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  {hasReviewPending ? (
                    <>
                      <AlertCircle className="w-5 h-5 mr-2 text-orange-500" />
                      Review Status
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                      Review Status
                    </>
                  )}
                </h3>

                {careTeamReview ? (
                  <div className={`p-4 rounded-lg ${hasReviewPending ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
                    <p className={`font-semibold mb-2 ${hasReviewPending ? 'text-orange-900' : 'text-green-900'}`}>
                      {careTeamReview.status}
                    </p>
                    {careTeamReview.reviewed_at && careTeamReview.reviewed_by_name && (
                      <p className="text-sm text-gray-700 mb-1">
                        By {careTeamReview.reviewed_by_name}
                      </p>
                    )}
                    <p className="text-xs text-gray-600">
                      {careTeamReview.reviewed_item_type}{careTeamReview.reviewed_item_date && ` • ${new Date(careTeamReview.reviewed_item_date).toLocaleDateString()}`}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No review data available</p>
                )}
              </div>

              {/* Community Engagement */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-purple-500" />
                  Community Engagement
                </h3>

                {communityEngagement ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                      <p className="text-sm text-gray-700 mb-1">Events Attended (30 days)</p>
                      <p className="text-3xl font-bold text-purple-700">{communityEngagement.countLast30Days}</p>
                    </div>

                    {communityEngagement.lastAttendedAt ? (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Last Event</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(communityEngagement.lastAttendedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">No events attended yet</p>
                    )}

                    {/* Engagement Level Indicator */}
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-700">Engagement Level</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          (communityEngagement.countLast30Days || 0) >= 10 ? 'bg-green-100 text-green-800' :
                          (communityEngagement.countLast30Days || 0) >= 5 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {(communityEngagement.countLast30Days || 0) >= 10 ? 'High' :
                           (communityEngagement.countLast30Days || 0) >= 5 ? 'Moderate' : 'Low'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            (communityEngagement.countLast30Days || 0) >= 10 ? 'bg-green-500' :
                            (communityEngagement.countLast30Days || 0) >= 5 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, (communityEngagement.countLast30Days || 0) * 10)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No engagement data available</p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="rounded-2xl shadow-lg p-6 text-white" style={{ background: branding.gradient }}>
                <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Link
                    to="/daily-checkin"
                    className="block w-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all rounded-lg p-3 text-center font-medium"
                  >
                    Complete Check-in
                  </Link>
                  <Link
                    to="/questions"
                    className="block w-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all rounded-lg p-3 text-center font-medium"
                  >
                    Ask Care Team
                  </Link>
                  <Link
                    to="/health-insights"
                    className="block w-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all rounded-lg p-3 text-center font-medium"
                  >
                    View Health Insights
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorsView;
