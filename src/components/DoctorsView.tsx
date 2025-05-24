import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useBranding } from '../BrandingContext';
import { User } from '@supabase/supabase-js';

// RLS Note: Ensure Row Level Security is enabled on 'check_ins' and 'health_entries' tables.
// Policies should restrict users to only access their own data.
// Example policy for 'check_ins': CREATE POLICY "Users can read their own check_ins" ON check_ins FOR SELECT USING (auth.uid() = user_id);

interface CheckInData {
  id: string;
  user_id: string;
  notes: string | null;
  created_at: string; // TIMESTAMPTZ
  reviewed_at?: string | null; // TIMESTAMPTZ, nullable
  reviewed_by_name?: string | null; // TEXT, nullable
}

interface HealthDataEntry {
  id: string;
  user_id: string;
  entry_type: string; // e.g., 'mood', 'activity', 'symptoms', 'blood_pressure'
  data: Record<string, any>; // JSONB, e.g., {"value": "good"}, {"level": "high"}, {"details": "headache"}, {"systolic": 120, "diastolic": 80}
  created_at: string; // TIMESTAMPTZ
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
}

interface CareTeamReview {
  status: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  reviewed_item_type: string; // e.g., 'Check-in' or 'Health Entry'
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
    setError(null); // Clear previous general errors before new fetch
    // setQuestionSubmitFeedback(null); // Clear question feedback when re-fetching data

    try {
      const results = await Promise.allSettled([
        // Fetch Latest Check-in
        supabase
          .from('check_ins')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        // Fetch Recent Health Entries
        supabase
          .from('health_entries')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(3), // Fetch last 3 health entries
      ]);

      const [checkInResult, healthEntriesResult] = results;

      if (checkInResult.status === 'fulfilled' && checkInResult.value.data) {
        setLatestCheckIn(checkInResult.value.data as CheckInData);
      } else if (checkInResult.status === 'rejected' || checkInResult.value.error) {
        console.warn('Error fetching latest check-in:', checkInResult.status === 'rejected' ? checkInResult.reason : checkInResult.value.error);
        // Don't set global error for individual fetch failure, allow other data to load
      }

      if (healthEntriesResult.status === 'fulfilled' && healthEntriesResult.value.data) {
        setRecentHealthEntries(healthEntriesResult.value.data as HealthDataEntry[]);
      } else if (healthEntriesResult.status === 'rejected' || healthEntriesResult.value.error) {
        console.warn('Error fetching recent health entries:', healthEntriesResult.status === 'rejected' ? healthEntriesResult.reason : healthEntriesResult.value.error);
      }
      
      // Determine Care Team Review Status
      // Prioritize review status from the latest check-in if available
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
        // If check-in isn't reviewed, check the most recent health entry
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
      if (authError) {
        setError('Failed to get user information. Please re-login.');
        console.error("Auth error:", authError);
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
      if (mood) {
        reportParts.push(`Mood: ${mood}`);
      }
      if (symptoms) {
        reportParts.push(`Symptoms: ${symptoms}`);
      }
      if (activity_description) {
        reportParts.push(`Activity: ${activity_description}`);
      }
      
      if (reportParts.length > 0) {
        return `Self Report - ${reportParts.join(', ')}`;
      }
      return "Self Report - (No details provided)"; // Fallback if all fields are empty
    } else {
      // Existing generic data rendering logic
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

  if (loading) {
    return <div className="p-4 text-center text-gray-600" style={{ color: branding.secondaryColor }}>Loading doctor's view data...</div>;
  }

  if (error && !currentUser) { // If error is critical (e.g. no user or initial auth error)
    return <div className="p-4 text-red-600 bg-red-100 border border-red-400 rounded-md">{error}</div>;
  }
  
  const handleQuestionSubmit = async () => {
    if (!currentUser) {
      setQuestionSubmitFeedback('You must be logged in to submit a question.');
      return;
    }
    setIsSubmittingQuestion(true);
    setQuestionSubmitFeedback(null);

    try {
      const { error: insertError } = await supabase
        .from('user_questions') // Ensure this table name matches your migration
        .insert({
          user_id: currentUser.id,
          user_email: currentUser.email,
          // message_content can be defaulted in the DB or set here
          // status can be defaulted in the DB
        });

      if (insertError) {
        console.error('Error submitting question:', insertError);
        setQuestionSubmitFeedback(`Failed to submit question: ${insertError.message}. Please ensure RLS is configured correctly for user_questions table.`);
      } else {
        setQuestionSubmitFeedback('Your question has been sent. The care team will get back to you soon.');
      }
    } catch (e: any) {
      console.error('Unexpected error submitting question:', e);
      setQuestionSubmitFeedback('An unexpected error occurred while submitting your question.');
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  return (
    <div className="p-4 border-gray-200 rounded-lg bg-gray-50 space-y-6">
      {/* Display general error if it's not a user auth issue already handled */}
      {error && currentUser && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">Notice: {error}</p>}

      {/* Latest Check-in */}
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

      {/* Self-reported Health Data */}
      <div>
        <h4 className="font-semibold text-md mb-1" style={{ color: branding.primaryColor }}>Recent Self-reported Health Data:</h4>
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

      {/* Care Team Review Status */}
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
            No specific overall review status available. Check individual items or await care team follow-up. 
            If `check_ins` or `health_entries` tables do not have `reviewed_at` and `reviewed_by_name` fields, this section cannot populate accurately.
          </p>
        )}
      </div>
       {!loading && !latestCheckIn && recentHealthEntries.length === 0 && !careTeamReview && !error && (
         <p className="text-sm text-gray-500 mt-2">No data available yet. Data will appear here once submitted and processed.</p>
       )}

      {/* Question Submission Section */}
      {currentUser && ( // Only show if user is logged in
        <div className="mt-6 pt-6 border-t border-gray-300">
          <h4 className="font-semibold text-md mb-2" style={{ color: branding.primaryColor }}>Need Help or Have Questions?</h4>
          <button
            onClick={handleQuestionSubmit}
            disabled={isSubmittingQuestion || loading} // Disable if main view is loading too
            className="px-6 py-2 text-white font-semibold rounded-md shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70"
            style={{ 
              backgroundColor: branding.secondaryColor,
              // Determine text color based on secondaryColor's darkness for better contrast
              color: (() => {
                try {
                  const color = branding.secondaryColor.startsWith('#') ? branding.secondaryColor.substring(1) : branding.secondaryColor;
                  const r = parseInt(color.substring(0, 2), 16);
                  const g = parseInt(color.substring(2, 4), 16);
                  const b = parseInt(color.substring(4, 6), 16);
                  return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? '#000000' : '#FFFFFF';
                } catch (e) { return '#FFFFFF'; } // Default to white on error
              })()
            }}
          >
            {isSubmittingQuestion ? 'Submitting...' : 'I have a question for my Care Team'}
          </button>
          {questionSubmitFeedback && (
            <p className={`mt-3 text-sm ${questionSubmitFeedback.startsWith('Failed') || questionSubmitFeedback.startsWith('An unexpected') ? 'text-red-600' : 'text-green-600'}`}>
              {questionSubmitFeedback}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorsView;
