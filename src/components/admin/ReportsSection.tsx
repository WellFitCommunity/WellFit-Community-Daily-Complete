// src/components/ReportsSection.tsx
import React, { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

interface EngagementStats {
  totalCheckIns: number;
  mealsPrepared: number; // Requires specific backend table/logic
  techTipsViewed: number; // Requires specific backend table/logic
  activeUsers: number; // Simplified to total registered users for now
}

const ReportsSection: React.FC = () => {
  const supabase = useSupabaseClient();
  const [stats, setStats] = useState<EngagementStats>({
    totalCheckIns: 0,
    mealsPrepared: 0, // Placeholder: Implement with actual data source
    techTipsViewed: 0, // Placeholder: Implement with actual data source
    activeUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReportStats = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch total check-ins (assuming a 'check_ins' table exists)
        // For count, Supabase returns [{ count: number }]
        const { data: checkInsData, error: checkInsError, count: totalCheckInsCount } = await supabase
          .from('check_ins') // Assumption: a table named 'check_ins' exists
          .select('*', { count: 'exact', head: true }); // Only fetch count

        if (checkInsError) {
          console.error('Error fetching total check-ins:', checkInsError.message);
          // Don't block other stats if this one fails, just report 0 or handle error
        }

        // Fetch total registered users (as a proxy for active users for now)
        const { count: totalUsersCount, error: usersError } = await supabase
          .from('profiles_with_user_id') // Using the same source as UsersList
          .select('user_id', { count: 'exact', head: true });

        if (usersError) {
          console.error('Error fetching total users:', usersError.message);
          // Don't block other stats if this one fails
        }

        setStats(prevStats => ({
          ...prevStats,
          totalCheckIns: totalCheckInsCount ?? 0,
          activeUsers: totalUsersCount ?? 0,
          // mealsPrepared and techTipsViewed remain 0 or could be fetched if tables existed
        }));

      } catch (e: any) {
        console.error('Error fetching report stats:', e.message);
        setError('Failed to load some report statistics.');
      } finally {
        setLoading(false);
      }
    };

    fetchReportStats();
  }, [supabase]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-4 space-y-3 text-center">
        <p className="text-gray-500">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3">
      <h3 className="text-xl font-bold text-wellfit-blue">Engagement Summary</h3>
      {error && <p className="text-red-500 bg-red-100 p-2 rounded-md text-center">{error}</p>}
      <div className="grid grid-cols-2 gap-4 text-center text-lg font-semibold">
        <div>
          ✅ <span className="block text-sm font-normal text-gray-500">Total Check-Ins</span>
          {stats.totalCheckIns}
        </div>
        <div>
          🍽️ <span className="block text-sm font-normal text-gray-500">Meals Prepared</span>
          {stats.mealsPrepared} <em className="text-xs text-gray-400">(requires setup)</em>
        </div>
        <div>
          💡 <span className="block text-sm font-normal text-gray-500">Tech Tips Viewed</span>
          {stats.techTipsViewed} <em className="text-xs text-gray-400">(requires setup)</em>
        </div>
        <div>
          🧓 <span className="block text-sm font-normal text-gray-500">Registered Users</span>
          {stats.activeUsers}
        </div>
      </div>
    </div>
  );
};

export default ReportsSection;
