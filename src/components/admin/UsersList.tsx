// src/components/UsersList.tsx (patched)
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSupabaseClient, useAuth } from '../../contexts/AuthContext';


type Profile = {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  dob?: string;
  address?: string | null;
  created_at?: string;
  last_check_in?: string;
  total_check_ins?: number;
  emergency_check_ins?: number;
};

type SortField = keyof Profile;
type SortDirection = 'asc' | 'desc';

interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

// Toast Component - Memoized to prevent unnecessary re-renders
const Toast: React.FC<{ toast: ToastData; onDismiss: (id: string) => void }> = React.memo(({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  } as const;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  } as const;

  return (
    <div className={`${bgColors[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex justify-between items-center min-w-[20rem] max-w-md`}>
      <div className="flex items-center space-x-2">
        <span className="font-bold">{icons[toast.type]}</span>
        <span className="text-sm">{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-4 text-white hover:text-gray-200 font-bold text-lg"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
});

// Toast Container - Memoized
const ToastContainer: React.FC<{ toasts: ToastData[]; onDismiss: (id: string) => void }> = React.memo(({ toasts, onDismiss }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite">
    {toasts.map(toast => (
      <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
    ))}
  </div>
));

// Loading Spinner - Memoized
const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = React.memo(({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-6 w-6'
  } as const;

  return (
    <svg className={`animate-spin ${sizeClasses[size]} text-current`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
});

// User Card Component - Memoized for list rendering performance
const UserCard: React.FC<{
  user: Profile;
  onUserClick?: (user: Profile) => void;
  isSelected?: boolean;
}> = React.memo(({ user, onUserClick, isSelected }) => {
  const getActivityStatus = (lastCheckIn?: string) => {
    if (!lastCheckIn) return { status: 'inactive', color: 'text-gray-500', label: 'No activity' } as const;
    const daysSince = (Date.now() - new Date(lastCheckIn).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 1) return { status: 'active', color: 'text-green-600', label: 'Active today' } as const;
    if (daysSince <= 7) return { status: 'recent', color: 'text-blue-600', label: 'Active this week' } as const;
    if (daysSince <= 30) return { status: 'moderate', color: 'text-yellow-600', label: 'Active this month' } as const;
    return { status: 'inactive', color: 'text-red-600', label: 'Inactive' } as const;
  };

  const activityStatus = getActivityStatus(user.last_check_in);
  const hasEmergencies = (user.emergency_check_ins ?? 0) > 0;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not available';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch {
      return null;
    }
  };

  const age = calculateAge(user.dob);

  return (
    <div 
      className={`bg-white border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${
        onUserClick ? 'cursor-pointer hover:border-blue-300' : ''
      } ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'}`}
      onClick={() => onUserClick?.(user)}
      role={onUserClick ? 'button' : undefined}
      tabIndex={onUserClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onUserClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onUserClick(user);
        }
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">
            {user.first_name} {user.last_name}
            {hasEmergencies && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                ⚠️ Emergency
              </span>
            )}
          </h4>
          <p className="text-sm text-gray-500 truncate">ID: {user.user_id.slice(0, 8)}...</p>
        </div>
        
        <div className={`text-xs font-medium px-2 py-1 rounded-full ${
          activityStatus.status === 'active' ? 'bg-green-100 text-green-800' :
          activityStatus.status === 'recent' ? 'bg-blue-100 text-blue-800' :
          activityStatus.status === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          <span className={`w-2 h-2 rounded-full mr-1 inline-block ${
            activityStatus.status === 'active' ? 'bg-green-400' :
            activityStatus.status === 'recent' ? 'bg-blue-400' :
            activityStatus.status === 'moderate' ? 'bg-yellow-400' :
            'bg-gray-400'
          }`}></span>
          {activityStatus.label}
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center space-x-2">
          <span className="text-gray-400">📞</span>
          <span className="text-gray-700 font-mono">{user.phone || 'Not provided'}</span>
        </div>

        {user.dob && (
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">🎂</span>
            <span className="text-gray-700">
              {formatDate(user.dob)}
              {age !== null && <span className="text-gray-500 ml-1">({age} years old)</span>}
            </span>
          </div>
        )}

        {user.address && (
          <div className="flex items-start space-x-2">
            <span className="text-gray-400 mt-0.5">📍</span>
            <span className="text-gray-700 flex-1">{user.address}</span>
          </div>
        )}
      </div>

      {/* Activity Stats */}
      {(user.total_check_ins ?? 0) > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex justify-between items-center text-xs">
            <div className="flex space-x-4">
              <span className="text-gray-600">
                <span className="font-medium">{user.total_check_ins}</span> check-ins
              </span>
              {hasEmergencies && (
                <span className="text-red-600">
                  <span className="font-medium">{user.emergency_check_ins}</span> emergency
                </span>
              )}
            </div>
            {user.last_check_in && (
              <span className="text-gray-500">
                Last: {formatDate(user.last_check_in)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

const UsersList: React.FC = () => {
  const supabase = useSupabaseClient();
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  // Debounced search
  const [rawSearch, setRawSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setSearchTerm(rawSearch), 200);
    return () => clearTimeout(id);
  }, [rawSearch]);

  const [sortField, setSortField] = useState<SortField>('first_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'emergency'>('all');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  const addToast = useCallback((type: ToastData['type'], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // HIPAA AUDIT LOGGING: Log PHI access when viewing user details
  const logPhiAccess = useCallback(async (patientUserId: string, accessType: 'READ' | 'VIEW_LIST') => {
    if (!currentUser?.id) return;

    try {
      await supabase.rpc('log_phi_access', {
        p_accessor_user_id: currentUser.id,
        p_accessor_role: 'admin', // This is the admin panel
        p_phi_type: 'patient_profile',
        p_phi_resource_id: patientUserId,
        p_patient_id: patientUserId,
        p_access_type: accessType,
        p_access_method: 'UI',
        p_purpose: 'administrative_review',
        p_ip_address: 'client_side' // Client-side IP not available; Edge Functions log server IP
      });
    } catch (logError) {

      // Don't block UI for logging failures
    }
  }, [currentUser, supabase]);

  const fetchProfiles = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      // Profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, phone, dob, address, created_at');

      if (profilesError) {
        throw new Error(`Failed to load users: ${profilesError.message}`);
      }

      if (!profilesData || profilesData.length === 0) {
        setProfiles([]);
        return;
      }

      const userIds: string[] = profilesData.map(p => p.user_id);

      // Try RPC first (preferred)
      const { data: checkInStats, error: statsError } = await supabase
        .rpc('get_user_check_in_stats', { user_ids: userIds });

      // Build stats map
      let statsMap: Record<string, { total_check_ins: number; emergency_check_ins: number; last_check_in: string | null }> = {};

      if (!statsError && checkInStats) {
        statsMap = (checkInStats as any[]).reduce((acc, stat: any) => {
          acc[stat.user_id] = {
            total_check_ins: stat.total_check_ins ?? 0,
            emergency_check_ins: stat.emergency_check_ins ?? 0,
            last_check_in: stat.last_check_in ?? null,
          };
          return acc;
        }, {} as Record<string, any>);
      } else {
        // Fallback: manual aggregation with batching to avoid URL/row limits
        const chunk = (arr: string[], size = 200) =>
          Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
        const chunks = chunk(userIds);

        const allCheckIns: { user_id: string; created_at: string; is_emergency: boolean }[] = [];

        for (const ids of chunks) {
          const { data: checkIns, error: checkInsError } = await supabase
            .from('check_ins')
            .select('user_id, created_at, is_emergency')
            .in('user_id', ids);
          if (checkInsError) {

            continue;
          }
          if (checkIns) allCheckIns.push(...checkIns);
        }

        statsMap = allCheckIns.reduce((acc, ci) => {
          const cur = acc[ci.user_id] ?? { total_check_ins: 0, emergency_check_ins: 0, last_check_in: null as string | null };
          cur.total_check_ins++;
          if (ci.is_emergency) cur.emergency_check_ins++;
          if (!cur.last_check_in || new Date(ci.created_at) > new Date(cur.last_check_in)) {
            cur.last_check_in = ci.created_at;
          }
          acc[ci.user_id] = cur;
          return acc;
        }, {} as Record<string, { total_check_ins: number; emergency_check_ins: number; last_check_in: string | null }>);
      }

      // Combine profile data with stats
      const enrichedProfiles: Profile[] = (profilesData as any[]).map((profile: any) => ({
        ...profile,
        phone: profile.phone ?? null,
        address: profile.address ?? null,
        total_check_ins: statsMap[profile.user_id]?.total_check_ins ?? 0,
        emergency_check_ins: statsMap[profile.user_id]?.emergency_check_ins ?? 0,
        last_check_in: statsMap[profile.user_id]?.last_check_in ?? undefined
      }));

      setProfiles(enrichedProfiles);
      if (showToast) addToast('success', `Refreshed ${enrichedProfiles.length} users`);

      // HIPAA AUDIT LOGGING: Log bulk PHI access when viewing user list
      if (currentUser?.id && enrichedProfiles.length > 0) {
        try {
          await supabase.from('audit_logs').insert({
            event_type: 'ADMIN_VIEW_USER_LIST',
            event_category: 'ADMIN',
            actor_user_id: currentUser.id,
            operation: 'VIEW',
            resource_type: 'user_list',
            success: true,
            metadata: {
              user_count: enrichedProfiles.length,
              has_emergency_users: enrichedProfiles.some(p => (p.emergency_check_ins ?? 0) > 0),
              filter_status: filterStatus
            }
          });
        } catch (logError) {

        }
      }
    } catch (error) {

      const message = error instanceof Error ? error.message : 'Failed to load users';
      addToast('error', message);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, addToast, currentUser, filterStatus]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Filtered and sorted profiles
  const filteredAndSortedProfiles = useMemo(() => {
    const filtered = profiles.filter(profile => {
      const searchBlob = `${profile.first_name} ${profile.last_name} ${profile.phone ?? ''} ${profile.user_id}`
        .toLowerCase();
      const matchesSearch = searchBlob.includes(searchTerm.toLowerCase());

      const matchesFilter = (() => {
        switch (filterStatus) {
          case 'active':
            return (
              !!profile.last_check_in &&
              Date.now() - new Date(profile.last_check_in).getTime() <= 7 * 24 * 60 * 60 * 1000
            );
          case 'inactive':
            return (
              !profile.last_check_in ||
              Date.now() - new Date(profile.last_check_in).getTime() > 30 * 24 * 60 * 60 * 1000
            );
          case 'emergency':
            return (profile.emergency_check_ins ?? 0) > 0;
          default:
            return true;
        }
      })();

      return matchesSearch && matchesFilter;
    });

    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'last_check_in' || sortField === 'created_at' || sortField === 'dob') {
        const aTime = a[sortField] ? Date.parse(String(a[sortField])) : 0;
        const bTime = b[sortField] ? Date.parse(String(b[sortField])) : 0;
        cmp = aTime - bTime;
      } else if (sortField === 'total_check_ins' || sortField === 'emergency_check_ins') {
        const aNum = Number(a[sortField] ?? 0);
        const bNum = Number(b[sortField] ?? 0);
        cmp = aNum - bNum;
      } else {
        const aStr = String(a[sortField] ?? '').toLowerCase();
        const bStr = String(b[sortField] ?? '').toLowerCase();
        cmp = aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [profiles, searchTerm, sortField, sortDirection, filterStatus]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const stats = useMemo(() => ({
    total: profiles.length,
    active: profiles.filter(p => {
      if (!p.last_check_in) return false;
      const daysSince = (Date.now() - new Date(p.last_check_in).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    }).length,
    emergency: profiles.filter(p => (p.emergency_check_ins ?? 0) > 0).length,
    newThisMonth: profiles.filter(p => {
      if (!p.created_at) return false;
      const monthsSince = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsSince <= 1;
    }).length
  }), [profiles]);

  if (loading && profiles.length === 0) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="bg-white rounded-xl shadow p-6 space-y-4 text-center">
          <LoadingSpinner size="lg" />
          <p className="text-gray-500">Loading users...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      <div className="bg-white rounded-xl shadow p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
          <div>
            <h3 className="text-2xl font-bold text-wellfit-blue">Registered Users</h3>
            <p className="text-sm text-gray-500 mt-1">
              {stats.total} total users • {stats.active} active this week • {stats.emergency} with emergencies
            </p>
          </div>
          
          {/* Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchProfiles(true)}
              disabled={loading}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-1 text-sm"
            >
              {loading ? <LoadingSpinner size="sm" /> : <span>🔄</span>}
              <span>Refresh</span>
            </button>
            
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 text-sm ${
                  viewMode === 'grid' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                📱 Grid
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-sm border-l border-gray-300 ${
                  viewMode === 'table' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                📋 Table
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-blue-800">Total Users</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-sm text-green-800">Active This Week</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.emergency}</div>
            <div className="text-sm text-red-800">Emergency Users</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{stats.newThisMonth}</div>
            <div className="text-sm text-purple-800">New This Month</div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search Users
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search by name, phone, or user ID..."
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label htmlFor="filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Status
            </label>
            <select
              id="filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Users</option>
              <option value="active">Active (7 days)</option>
              <option value="inactive">Inactive (30+ days)</option>
              <option value="emergency">Emergency Users</option>
            </select>
          </div>

          {viewMode === 'table' && (
            <div>
              <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                id="sort"
                value={`${sortField}-${sortDirection}`}
                onChange={(e) => {
                  const [field, direction] = e.target.value.split('-');
                  setSortField(field as SortField);
                  setSortDirection(direction as SortDirection);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="first_name-asc">Name A-Z</option>
                <option value="first_name-desc">Name Z-A</option>
                <option value="last_check_in-desc">Recent Activity</option>
                <option value="total_check_ins-desc">Most Check-ins</option>
                <option value="created_at-desc">Newest Users</option>
              </select>
            </div>
          )}
        </div>

        {/* Results Summary */}
        {(searchTerm || filterStatus !== 'all') && (
          <div className="text-sm text-gray-600">
            Showing {filteredAndSortedProfiles.length} of {profiles.length} users
            {searchTerm && ` matching "${searchTerm}"`}
            {filterStatus !== 'all' && ` (${filterStatus} only)`}
            <button
              onClick={() => {
                setRawSearch('');
                setSearchTerm('');
                setFilterStatus('all');
              }}
              className="ml-2 text-blue-600 hover:text-blue-800 underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Empty State */}
        {filteredAndSortedProfiles.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👥</div>
            {profiles.length === 0 ? (
              <div>
                <p className="text-gray-600 mb-2">No users found.</p>
                <p className="text-sm text-gray-500">Users will appear here once they register.</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">No users match your current filters.</p>
                <button
                  onClick={() => {
                    setRawSearch('');
                    setSearchTerm('');
                    setFilterStatus('all');
                  }}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Users Display */}
        {filteredAndSortedProfiles.length > 0 && (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAndSortedProfiles.map((user) => (
                  <UserCard
                    key={user.user_id}
                    user={user}
                    onUserClick={(selectedUser) => {
                      setSelectedUser(selectedUser);
                      // HIPAA: Log PHI access when viewing user details
                      logPhiAccess(selectedUser.user_id, 'READ');
                    }}
                    isSelected={selectedUser?.user_id === user.user_id}
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('first_name')}
                      >
                        <div className="flex items-center justify-between">
                          <span>Name</span>
                          <span className="text-xs">{getSortIcon('first_name')}</span>
                        </div>
                      </th>
                      <th className="border border-gray-300 px-4 py-3 text-left">Contact</th>
                      <th className="border border-gray-300 px-4 py-3 text-left">Age</th>
                      <th 
                        className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('total_check_ins')}
                      >
                        <div className="flex items-center justify-between">
                          <span>Activity</span>
                          <span className="text-xs">{getSortIcon('total_check_ins')}</span>
                        </div>
                      </th>
                      <th 
                        className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('last_check_in')}
                      >
                        <div className="flex items-center justify-between">
                          <span>Last Seen</span>
                          <span className="text-xs">{getSortIcon('last_check_in')}</span>
                        </div>
                      </th>
                      <th className="border border-gray-300 px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedProfiles.map((user, index) => {
                      const age = user.dob ? (() => {
                        try {
                          const birthDate = new Date(user.dob);
                          const today = new Date();
                          let age = today.getFullYear() - birthDate.getFullYear();
                          const monthDiff = today.getMonth() - birthDate.getMonth();
                          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                          }
                          return age;
                        } catch {
                          return null;
                        }
                      })() : null;

                      const daysSinceLastCheckIn = user.last_check_in 
                        ? (Date.now() - new Date(user.last_check_in).getTime()) / (1000 * 60 * 60 * 24)
                        : null;

                      const activityStatus = (() => {
                        if (!daysSinceLastCheckIn) return { label: 'No activity', color: 'bg-gray-100 text-gray-800' } as const;
                        if (daysSinceLastCheckIn <= 1) return { label: 'Active today', color: 'bg-green-100 text-green-800' } as const;
                        if (daysSinceLastCheckIn <= 7) return { label: 'Active this week', color: 'bg-blue-100 text-blue-800' } as const;
                        if (daysSinceLastCheckIn <= 30) return { label: 'Active this month', color: 'bg-yellow-100 text-yellow-800' } as const;
                        return { label: 'Inactive', color: 'bg-red-100 text-red-800' } as const;
                      })();

                      return (
                        <tr 
                          key={user.user_id}
                          className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                        >
                          <td className="border border-gray-300 px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                              {(user.emergency_check_ins ?? 0) > 0 && (
                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  ⚠️
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">ID: {user.user_id.slice(0, 8)}...</div>
                          </td>
                          <td className="border border-gray-300 px-4 py-3">
                            <div className="text-sm font-mono">{user.phone || 'Not provided'}</div>
                            {user.address && (
                              <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">{user.address}</div>
                            )}
                          </td>
                          <td className="border border-gray-300 px-4 py-3">
                            {age !== null ? (
                              <div className="text-sm">
                                <div className="font-medium">{age} years</div>
                                <div className="text-xs text-gray-500">
                                  {user.dob ? new Date(user.dob).toLocaleDateString() : ''}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Not provided</span>
                            )}
                          </td>
                          <td className="border border-gray-300 px-4 py-3">
                            <div className="text-sm">
                              <div className="font-medium">{user.total_check_ins ?? 0} check-ins</div>
                              {(user.emergency_check_ins ?? 0) > 0 && (
                                <div className="text-xs text-red-600">{user.emergency_check_ins} emergency</div>
                              )}
                            </div>
                          </td>
                          <td className="border border-gray-300 px-4 py-3">
                            {user.last_check_in && daysSinceLastCheckIn !== null ? (
                              <div className="text-sm">
                                <div className="font-medium">
                                  {new Date(user.last_check_in).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {Math.floor(daysSinceLastCheckIn!)} days ago
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Never</span>
                            )}
                          </td>
                          <td className="border border-gray-300 px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${activityStatus.color}`}>
                              {activityStatus.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* User Detail Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Close modal"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      {selectedUser.first_name} {selectedUser.last_name}
                      {(selectedUser.emergency_check_ins ?? 0) > 0 && (
                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ⚠️ Has Emergency Check-ins
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-gray-500">ID: {selectedUser.user_id}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900 font-mono">{selectedUser.phone || 'Not provided'}</p>
                    </div>

                    {selectedUser.dob && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {new Date(selectedUser.dob).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                          {(() => {
                            try {
                              const birthDate = new Date(selectedUser.dob);
                              const today = new Date();
                              let age = today.getFullYear() - birthDate.getFullYear();
                              const monthDiff = today.getMonth() - birthDate.getMonth();
                              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                                age--;
                              }
                              return ` (${age} years old)`;
                            } catch {
                              return '';
                            }
                          })()}
                        </p>
                      </div>
                    )}

                    {selectedUser.address && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedUser.address}</p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Activity Summary</label>
                      <div className="mt-1 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Total Check-ins:</span>
                          <span className="font-medium">{selectedUser.total_check_ins ?? 0}</span>
                        </div>
                        {(selectedUser.emergency_check_ins ?? 0) > 0 && (
                          <div className="flex justify-between text-sm text-red-600">
                            <span>Emergency Check-ins:</span>
                            <span className="font-medium">{selectedUser.emergency_check_ins}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span>Last Check-in:</span>
                          <span className="font-medium">
                            {selectedUser.last_check_in 
                              ? new Date(selectedUser.last_check_in).toLocaleDateString()
                              : 'Never'
                            }
                          </span>
                        </div>
                        {selectedUser.created_at && (
                          <div className="flex justify-between text-sm">
                            <span>Registered:</span>
                            <span className="font-medium">
                              {new Date(selectedUser.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              Displaying {filteredAndSortedProfiles.length} of {profiles.length} users
            </div>
            <div>
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UsersList;
