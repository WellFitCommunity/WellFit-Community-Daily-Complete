/**
 * DoctorsViewPage — Patient Health Dashboard for Healthcare Providers
 *
 * Migrated (Phase 4): self_reports data now fetched via patientContextService
 * through the useDoctorsViewData hook. Check-in and community engagement
 * queries remain direct per CLAUDE.md governance boundaries.
 *
 * @module DoctorsView/DoctorsViewPage
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { useNavigate, Link } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';
import Activity from 'lucide-react/dist/esm/icons/activity';
import Heart from 'lucide-react/dist/esm/icons/heart';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Users from 'lucide-react/dist/esm/icons/users';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Calendar from 'lucide-react/dist/esm/icons/calendar';

import { useDoctorsViewData } from './useDoctorsViewData';
import { VitalCard } from './VitalCard';
import { TimelineItem } from './TimelineItem';
import { StatsCard } from './StatsCard';
import { extractVitals, formatDateTime, renderHealthEntryContent } from './vitalUtils';

const DoctorsViewPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();

  const {
    latestCheckIn,
    recentHealthEntries,
    careTeamReview,
    communityEngagement,
    loading,
    error,
    userId,
    refresh,
  } = useDoctorsViewData();

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50">
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
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-800 text-center font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const vitals = extractVitals(latestCheckIn, recentHealthEntries);
  const hasReviewPending = careTeamReview?.status === 'Awaiting Review';
  const totalDataPoints = (latestCheckIn ? 1 : 0) + recentHealthEntries.length;

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>

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
                  onClick={refresh}
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

            {/* Left Column - Vitals + Timeline */}
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
                      content={latestCheckIn.label || latestCheckIn.emotional_state || 'No notes provided'}
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
                      {careTeamReview.reviewed_item_type}{careTeamReview.reviewed_item_date && ` \u2022 ${new Date(careTeamReview.reviewed_item_date).toLocaleDateString()}`}
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

export default DoctorsViewPage;
