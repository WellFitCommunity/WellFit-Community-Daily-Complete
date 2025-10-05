// src/components/admin/PatientEngagementDashboard.tsx
// Admin dashboard to view senior engagement metrics for risk assessment

import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { getAllPatientEngagementScores } from '../../services/engagementTracking';

interface EngagementScore {
  user_id: string;
  email: string;
  check_ins_30d: number;
  trivia_games_30d: number;
  word_games_30d: number;
  self_reports_30d: number;
  questions_asked_30d: number;
  check_ins_7d: number;
  trivia_games_7d: number;
  last_check_in: string | null;
  last_trivia_game: string | null;
  last_word_game: string | null;
  last_self_report: string | null;
  avg_trivia_score_pct: number | null;
  avg_trivia_completion_time: number | null;
  engagement_score: number;
}

const PatientEngagementDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const [engagementData, setEngagementData] = useState<EngagementScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'engagement_score' | 'last_activity'>('engagement_score');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low' | 'critical'>('all');

  useEffect(() => {
    loadEngagementData();
  }, []);

  const loadEngagementData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await getAllPatientEngagementScores(supabase);

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to load engagement data');
      }

      setEngagementData(data || []);
    } catch (err) {
      console.error('Failed to load engagement data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load engagement data');
    } finally {
      setLoading(false);
    }
  };

  const getEngagementLevel = (score: number): 'high' | 'medium' | 'low' | 'critical' => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'critical'; // 0-19 = CRITICAL
  };

  const getEngagementColor = (score: number): string => {
    const level = getEngagementLevel(score);
    return level === 'high' ? 'bg-green-100 text-green-800' :
           level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
           level === 'low' ? 'bg-orange-100 text-orange-800' :
           'bg-red-100 text-red-800 font-bold';
  };

  const getRiskIndicator = (score: number): string => {
    const level = getEngagementLevel(score);
    return level === 'high' ? 'Low Risk' :
           level === 'medium' ? 'Medium Risk' :
           level === 'low' ? 'High Risk' :
           '🚨 CRITICAL RISK';
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    if (daysAgo < 7) return `${daysAgo} days ago`;
    return date.toLocaleDateString();
  };

  const filteredAndSortedData = () => {
    let filtered = engagementData;

    // Filter by engagement level
    if (filterLevel !== 'all') {
      filtered = filtered.filter(item => getEngagementLevel(item.engagement_score) === filterLevel);
    }

    // Sort
    if (sortBy === 'engagement_score') {
      filtered = [...filtered].sort((a, b) => b.engagement_score - a.engagement_score);
    } else {
      filtered = [...filtered].sort((a, b) => {
        const aTime = Math.max(
          new Date(a.last_check_in || 0).getTime(),
          new Date(a.last_trivia_game || 0).getTime(),
          new Date(a.last_word_game || 0).getTime(),
          new Date(a.last_self_report || 0).getTime()
        );
        const bTime = Math.max(
          new Date(b.last_check_in || 0).getTime(),
          new Date(b.last_trivia_game || 0).getTime(),
          new Date(b.last_word_game || 0).getTime(),
          new Date(b.last_self_report || 0).getTime()
        );
        return bTime - aTime;
      });
    }

    return filtered;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading Engagement Data</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadEngagementData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = filteredAndSortedData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Patient Engagement Dashboard</h2>
        <p className="text-gray-600">
          Monitor senior activity levels to identify at-risk patients and improve care coordination
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600">Total Patients</div>
          <div className="text-2xl font-bold text-gray-800">{engagementData.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm text-gray-600">High Engagement</div>
          <div className="text-2xl font-bold text-green-600">
            {engagementData.filter(d => getEngagementLevel(d.engagement_score) === 'high').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-600">Medium Engagement</div>
          <div className="text-2xl font-bold text-yellow-600">
            {engagementData.filter(d => getEngagementLevel(d.engagement_score) === 'medium').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="text-sm text-gray-600">High Risk</div>
          <div className="text-2xl font-bold text-orange-600">
            {engagementData.filter(d => getEngagementLevel(d.engagement_score) === 'low').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-600 animate-pulse">
          <div className="text-sm text-gray-600 font-bold">🚨 CRITICAL</div>
          <div className="text-2xl font-bold text-red-600">
            {engagementData.filter(d => getEngagementLevel(d.engagement_score) === 'critical').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="engagement_score">Engagement Score</option>
              <option value="last_activity">Last Activity</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter Level</label>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Patients</option>
              <option value="high">High Engagement (Low Risk)</option>
              <option value="medium">Medium Engagement</option>
              <option value="low">Low Engagement (High Risk)</option>
              <option value="critical">🚨 CRITICAL RISK (0-19 Score)</option>
            </select>
          </div>
          <div className="flex-1"></div>
          <button
            onClick={loadEngagementData}
            className="self-end px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Engagement Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Engagement Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  30-Day Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No patients match the current filter
                  </td>
                </tr>
              ) : (
                data.map((patient) => (
                  <tr key={patient.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{patient.email}</div>
                      <div className="text-xs text-gray-500">{patient.user_id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-2xl font-bold text-gray-900 mr-2">
                          {patient.engagement_score}
                        </div>
                        <div className="text-xs text-gray-500">/ 100</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEngagementColor(patient.engagement_score)}`}>
                        {getRiskIndicator(patient.engagement_score)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Check-ins:</span>
                          <span className="font-medium">{patient.check_ins_30d}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Games:</span>
                          <span className="font-medium">{patient.trivia_games_30d + patient.word_games_30d}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Reports:</span>
                          <span className="font-medium">{patient.self_reports_30d}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Questions:</span>
                          <span className="font-medium">{patient.questions_asked_30d}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{formatDate(patient.last_check_in)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {patient.avg_trivia_score_pct !== null && (
                        <div className="space-y-1">
                          <div className="text-gray-700">
                            Trivia: <span className="font-medium">{Math.round(patient.avg_trivia_score_pct)}%</span>
                          </div>
                          {patient.avg_trivia_completion_time && (
                            <div className="text-gray-500 text-xs">
                              Avg: {Math.round(patient.avg_trivia_completion_time)}s
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Understanding Engagement Scores</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-blue-800">
          <div>
            <span className="font-medium text-green-700">High (70-100):</span> Active participation, <strong>LOW RISK</strong> 🟢
          </div>
          <div>
            <span className="font-medium text-yellow-700">Medium (40-69):</span> Moderate engagement, <strong>MEDIUM RISK</strong> 🟡
          </div>
          <div>
            <span className="font-medium text-orange-700">Low (20-39):</span> Limited activity, <strong>HIGH RISK</strong> 🟠
          </div>
          <div className="bg-red-100 px-2 py-1 rounded border border-red-300">
            <span className="font-bold text-red-800">🚨 CRITICAL (0-19):</span> <strong>IMMEDIATE INTERVENTION REQUIRED</strong>
          </div>
        </div>
        <div className="mt-3 text-xs text-blue-700">
          <strong>Scoring:</strong> Check-ins (2 pts), Games (5 pts), Self-reports (3 pts), Questions (2 pts), Meals (2 pts), Meal Photos (+3 bonus), Community Photos (3 pts) - Last 30 days
        </div>
      </div>
    </div>
  );
};

export default PatientEngagementDashboard;
