import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface CommunityMoment {
  id: string;
  user_id: string;
  file_url: string;
  title: string;
  description: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  } | null;
}

export default function PhotoApprovalPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pendingMoments, setPendingMoments] = useState<CommunityMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const fetchMoments = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('community_moments')
        .select(`
          id,
          user_id,
          file_url,
          title,
          description,
          approval_status,
          created_at,
          profiles(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('approval_status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform the data to match our interface (profiles is returned as array from Supabase)
      const transformedData = (data || []).map((moment: any) => ({
        ...moment,
        profiles: Array.isArray(moment.profiles) ? moment.profiles[0] : moment.profiles
      }));

      setPendingMoments(transformedData);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchMoments();
  }, [fetchMoments]);

  const handleApprove = async (momentId: string) => {
    try {
      const { error } = await supabase
        .from('community_moments')
        .update({
          approval_status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', momentId);

      if (error) throw error;
      fetchMoments();
    } catch (error) {

      alert('Failed to approve photo');
    }
  };

  const handleReject = async (momentId: string) => {
    const reason = prompt('Reason for rejection (optional):');
    try {
      const { error } = await supabase
        .from('community_moments')
        .update({
          approval_status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason || 'No reason provided',
        })
        .eq('id', momentId);

      if (error) throw error;
      fetchMoments();
    } catch (error) {

      alert('Failed to reject photo');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
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

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Photo Approval Dashboard</h1>

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'rejected'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Rejected
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading photos...</p>
          </div>
        ) : pendingMoments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg">
              {filter === 'pending' ? 'No pending photos to review' : `No ${filter} photos`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingMoments.map((moment) => (
              <div key={moment.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <img
                  src={moment.file_url}
                  alt={moment.title}
                  className="w-full h-64 object-cover"
                />
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-2">{moment.title}</h3>
                  <p className="text-gray-600 text-sm mb-2">{moment.description}</p>
                  <p className="text-gray-500 text-xs mb-1">
                    By: {moment.profiles?.first_name} {moment.profiles?.last_name}
                  </p>
                  <p className="text-gray-400 text-xs mb-3">
                    {new Date(moment.created_at).toLocaleDateString()}
                  </p>

                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        moment.approval_status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : moment.approval_status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {moment.approval_status.toUpperCase()}
                    </span>
                  </div>

                  {moment.approval_status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(moment.id)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleReject(moment.id)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
