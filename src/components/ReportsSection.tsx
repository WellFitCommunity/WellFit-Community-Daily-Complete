// src/components/ReportsSection.tsx

import React, { useEffect, useState, useCallback } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { FaCheckCircle, FaUtensils, FaLightbulb, FaUsers, FaSync } from 'react-icons/fa';

interface EngagementStats {
  totalCheckIns: number | null;
  mealsPrepared: number | null;
  techTipsViewed: number | string | null; // Can be 'N/A' or a number
  activeUsers: number | null;
}

const ReportsSection: React.FC = () => {
  const supabase = useSupabaseClient();
  const [stats, setStats] = useState<EngagementStats>({
    totalCheckIns: null,
    mealsPrepared: null,
    techTipsViewed: null,
    activeUsers: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Total Check-ins
      const { count: checkInsCount, error: checkInsError } = await supabase
        .from('checkins')
        .select('*', { count: 'exact', head: true });
      if (checkInsError) throw new Error(`Fetching check-ins: ${checkInsError.message}`);

      // 2. Meals Prepared (total count from 'meals' table)
      let mealsCount: number | null = null;
      let mealsErrorMsg = null;
      try {
        const { count, error } = await supabase
          .from('meals')
          .select('*', { count: 'exact', head: true });
        mealsCount = count ?? 0;
        if (error) mealsErrorMsg = error.message;
      } catch (mealsError: any) {
        mealsErrorMsg = mealsError?.message ?? 'Unknown meals error';
        mealsCount = 0;
      }

      // 3. Tech Tips Viewed (static for now, as no tracking table identified)
      const techTipsCount = "N/A";

      // 4. Active Users (distinct users from checkins in the last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: activeUsersData, error: activeUsersError } = await supabase
        .from('checkins')
        .select('user_id')
        .gte('timestamp', sevenDaysAgo);
      if (activeUsersError) throw new Error(`Fetching active users: ${activeUsersError.message}`);

      const distinctActiveUsers = activeUsersData ? new Set(activeUsersData.map((item: any) => item.user_id)).size : 0;

      setStats({
        totalCheckIns: checkInsCount,
        mealsPrepared: mealsErrorMsg ? 0 : mealsCount,
        techTipsViewed: techTipsCount,
        activeUsers: distinctActiveUsers,
      });

      if (mealsErrorMsg) {
        setError("Could not fetch meals count. Table might not exist or RLS prevents access.");
      }

    } catch (e) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const StatCard: React.FC<{ icon: React.ReactElement; label: string; value: number | string | null; isLoading: boolean }> =
    ({ icon, label, value, isLoading }) => (
      <div className="bg-gray-50 p-4 rounded-lg shadow flex items-center space-x-3 hover:bg-gray-100 transition-colors">
        <div className="text-2xl text-wellfit-blue">{icon}</div>
        <div>
          <div className="text-sm font-medium text-gray-500">{label}</div>
          {isLoading ? (
            <div className="h-6 bg-gray-300 rounded w-12 animate-pulse"></div>
          ) : (
            <div className="text-2xl font-bold text-gray-800">{value ?? '...'}</div>
          )}
        </div>
      </div>
    );

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-wellfit-purple">Engagement Summary</h3>
        <button
          onClick={fetchReportData}
          disabled={loading}
          className="p-2 rounded-full hover:bg-gray-200 transition disabled:opacity-50"
          aria-label="Refresh data"
        >
          <FaSync className={`text-xl text-wellfit-blue ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<FaCheckCircle />} label="Total Check-Ins" value={stats.totalCheckIns} isLoading={loading && stats.totalCheckIns === null} />
        <StatCard icon={<FaUtensils />} label="Meals Logged" value={stats.mealsPrepared} isLoading={loading && stats.mealsPrepared === null} />
        <StatCard icon={<FaLightbulb />} label="Tech Tips Viewed" value={stats.techTipsViewed} isLoading={loading && stats.techTipsViewed === null} />
        <StatCard icon={<FaUsers />} label="Active Users (7 days)" value={stats.activeUsers} isLoading={loading && stats.activeUsers === null} />
      </div>
    </div>
  );
};

export default ReportsSection;
