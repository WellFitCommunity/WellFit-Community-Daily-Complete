import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useBranding } from '../BrandingContext';
import { User } from '@supabase/supabase-js';

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

const DoctorsView: React.FC = () => {
  const branding = useBranding();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [latestCheckIn, setLatestCheckIn] = useState<CheckInData | null>(null);
  const [recentHealthEntries, setRecentHealthEntries] = useState<HealthDataEntry[]>([]);
  const [careTeamReview, setCareTeamReview] = useState<CareTeamReview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState<boolean>(false);
  const [questionSubmitFeedback, setQuestionSubmitFeedback] = useState<string | null>(null);

  const fetchData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled([
        supabase
          .from('check_ins')
          .select('id, user_id, notes, created_at, reviewed_at, reviewed_by_name')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('health_entries')
          .select('id, user_id, entry_type, data, created_at, reviewed_at, reviewed_by_name')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      const [checkInResult, healthEntriesResult] = results;

      if (checkInResult.status === 'fulfilled' && checkInResult.value.data) {
        setLatestCheckIn(checkInResult.value.data as CheckInData);
      } else if (checkInResult.status === 'rejected' || checkInResult.value.error) {
        console.warn('Error fetching latest check-in:', checkInResult.status === 'rejected' ? checkInResult.reason : checkInResult.value.error);
      }

      if (healthEntriesResult.status === 'fulfilled' && healthEntriesResult.value.data) {
        setRecentHealthEntries(healthEntriesResult.value.data as HealthDataEntry[]);
      } else if (healthEntriesResult.status === 'rejected' || healthEntriesResult.value.error) {
        console.warn('Error fetching recent health entries:', healthEntriesResult.status === 'rejected' ? healthEntriesResult.reason : healthEntriesResult.value.error);
      }
      
      const checkInForReview = checkInResult.status === 'fulfilled' ? checkInResult.value.data as CheckInData : null;
      const healthEntriesForReview = healthEntriesResult.status === 'fulfilled' ? healthEntriesResult.value.data as HealthDataEntry[] : [];
      
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
          .filter(entry => entry.reviewed_at)
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

    } catch (e: any) {
      console.error('Error fetching data for DoctorsView:', e);
      setError('Failed to load some or all data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const getUserAndFetchData = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError?.message) {
        setError('Failed to get user information. Please re-login.');
        console.error("Auth error:", authError.message);
        setLoading(false);
        return;
      }
      if (user) {
        setCurrentUser(user);
        fetchData(user.id);
      } else {
        setError('No user logged in. This view requires authentication.');
        setLoading(false);
      }
    };
    getUserAndFetchData();
  }, [fetchData]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  
  const renderHealthEntryData = (entry: HealthDataEntry) => {
    if (entry.entry_type === 'self_report' && entry.data) {
      const { mood, symptoms, activity_description } = entry.data;
      let reportParts = [];
      if (mood) reportParts.push(`Mood: ${mood}`);
      if (symptoms) reportParts.push(`Symptoms: ${symptoms}`);
      if (activity_description) reportParts.push(`Activity: ${activity_description}`);
      
      return reportParts.length > 0 
        ? `Self Report - ${reportParts.join(', ')}` 
        : "Self Report - (No details provided)";
    } else {
      let displayData = `Type: ${entry.entry_type}`;
      if (entry.data) {
        const dataEntries = Object.entries(entry.data)
          .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
          .join(', ');
        if (dataEntries) displayData += ` - ${dataEntries}`;
      }
      return displayData;
    }
  };

  const handleQuestionSubmit = async () => {
    if (!currentUser) {
      setQuestionSubmitFeedback('You must be logged in to submit a question.');
      return;
    }
    
    setIsSubmittingQuestion(true);
    setQuestionSubmitFeedback(null);

    try {
      const { error: insertError } = await supabase
        .from('user_questions')
        .insert({
          user_id: currentUser.id,
          user_email: currentUser.email,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        throw insertError;
      }
      setQuestionSubmitFeedback('Your question has been sent. The care team will get back to you soon.');
    } catch (error: any) {
      console.error('Error submitting question:', error);
      setQuestionSubmitFeedback(error.message || 'Failed to submit question. Please try again.');
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-600" style={{ color: branding.secondaryColor }}>Loading doctor's view data...</div>;
  }

  if (error && !currentUser) {
    return <div className="p-4 text-red-600 bg-red-100 border border-red-400 rounded-md">{error}</div>;
  }
  
  return (
    <div className="p-4 border-gray-200 rounded-lg bg-gray-50 space-y-6">
      {error && currentUser && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">Notice: {error}</p>}

      <div>
        <h4 className="font-semibold text-md mb-1" style={{ color: branding.primaryColor }}>Latest Check-in:</h4>
        {latestCheckIn ? (
          <div className="text-sm text-gray-700 bg-white p-3 rounded-md shadow-sm">
            <p><strong>Date:</strong> {formatDateTime(latestCheckIn.created_at)}</p>
            <p><strong>Notes:</strong> {latestCheckIn.notes || "No notes provided."}</p>
            {latestCheckIn.reviewed_at && (
                <p className="mt-1 text-xs text-green-700">Reviewed by {latestCheckIn.reviewed_by_name || 'Care Team'} on {formatDateTime(latestCheckIn.reviewed_at)}.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No check-in data available.</p>
        )}
      </div>

      <div>
        <h4 className="font-semibold text-md mb-1" style={{ color: branding.primaryColor }}>
          Recent Self-reported Health Data ({recentHealthEntries.length})
        </h4>
        {recentHealthEntries.length > 0 ? (
          <ul className="space-y-2">
            {recentHealthEntries.map(entry => (
              <li key={entry.id} className="text-sm text-gray-700 bg-white p-3 rounded-md shadow-sm">
                <p><strong>Date:</strong> {formatDateTime(entry.created_at)}</p>
                <p>{renderHealthEntryData(entry)}</p>
                 {entry.reviewed_at && (
                    <p className="mt-1 text-xs text-green-700">Reviewed by {entry.reviewed_by_name || 'Care Team'} on {formatDateTime(entry.reviewed_at)}.</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No self-reported health data available.</p>
        )}
      </div>

      <div>
        <h4 className="font-semibold text-md mb-1" style={{ color: branding.primaryColor }}>Overall Care Team Review Status:</h4>
        {careTeamReview ? (
          <div className="text-sm text-gray-700 bg-white p-3 rounded-md shadow-sm">
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
          <p className="text-sm text-gray-500">
            Note: This section depends on `reviewed_at` and `reviewed_by_name` fields being present in both `check_ins` and `health_entries`.
          </p>
        )}
      </div>
      
      {!loading && !latestCheckIn && recentHealthEntries.length === 0 && !careTeamReview && !error && (
         <p className="text-sm text-gray-500 mt-2">No data available yet. Data will appear here once submitted and processed.</p>
      )}

      {currentUser && (
        <div className="mt-6 pt-6 border-t border-gray-300">
          <h4 className="font-semibold text-md mb-2" style={{ color: branding.primaryColor }}>Need Help or Have Questions?</h4>
          <button
            onClick={handleQuestionSubmit}
            disabled={isSubmittingQuestion || loading}
            className="px-6 py-2 text-white font-semibold rounded-md shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70"
            style={{ 
              backgroundColor: branding.secondaryColor,
              color: (() => {
                try {
                  const color = branding.secondaryColor.startsWith('#') ? branding.secondaryColor.substring(1) : branding.secondaryColor;
                  const r = parseInt(color.substring(0, 2), 16);
                  const g = parseInt(color.substring(2, 4), 16);
                  const b = parseInt(color.substring(4, 6), 16);
                  return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? '#000000' : '#FFFFFF';
                } catch (e) { return '#FFFFFF'; }
              })()
            }}
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