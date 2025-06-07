import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useBranding } from '../BrandingContext';
import { User } from '@supabase/supabase-js';

const SelfReportingPage: React.FC = () => {
  const branding = useBranding();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [mood, setMood] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [activity, setActivity] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // For report log (history)
interface SelfReportData { // Raw data from Supabase
  id: number;
  created_at: string; // ISO string
  mood: string;
  symptoms?: string;
  activity_description?: string;
  user_id: string;
  submitted_by: string; // User ID of who submitted it
  entry_type: string; // e.g., 'self_report'
}

interface SelfReportLog extends SelfReportData {
  source_type: 'self' | 'staff'; // Client-side added field
}

  const [selfReports, setSelfReports] = useState<SelfReportLog[]>([]);

  const moodOptions: string[] = ['Happy', 'Okay', 'Sad', 'Anxious', 'Tired']; // Explicitly type array

  useEffect(() => {
    const getUser = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          setErrorMessage('Error fetching user: ' + error.message);
          throw error; // Propagate error to stop further execution in try block
        }
        setCurrentUser(user || null);
        if (!user) {
          setErrorMessage('You must be logged in to submit a report.');
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error('An unexpected error occurred.');
        setErrorMessage(err.message);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    getUser();
  }, []);

  // Fetch report log for current user
  useEffect(() => {
    if (!currentUser) return;
    const fetchReports = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('self_reports')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (error) {
          setErrorMessage('Error loading reports: ' + error.message);
          setSelfReports([]);
          throw error;
        }
        if (data) {
          const reports: SelfReportLog[] = data.map((r: SelfReportData) => ({
            ...r,
            source_type: r.user_id === r.submitted_by ? 'self' : 'staff'
          }));
          setSelfReports(reports);
        } else {
          setSelfReports([]);
        }
      } catch (e) {
        // Error message already set or handled by previous throw
        if (!errorMessage) { // Avoid overwriting specific error from Supabase
            const err = e instanceof Error ? e : new Error('An unexpected error occurred while fetching reports.');
            setErrorMessage(err.message);
        }
        setSelfReports([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReports();
  }, [currentUser, errorMessage]); // Added errorMessage to deps to avoid potential issues if it changes

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFeedbackMessage(null);
    setErrorMessage(null);

    if (!currentUser) {
      setErrorMessage('You must be logged in to submit a report.');
      return;
    }

    if (!mood) {
      setErrorMessage('Please select your current mood.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.from('self_reports').insert({
        user_id: currentUser.id,
        submitted_by: currentUser.id,  // Add this if using submitted_by for color coding!
        entry_type: 'self_report',
        mood,
        symptoms,
        activity_description: activity,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      setFeedbackMessage('Report saved successfully!');
      setMood('');
      setSymptoms('');
      setActivity('');
      // Reload self-reports log
      if (currentUser) { // This check is good
        const { data, error: fetchError } = await supabase
          .from('self_reports')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });
        
        if (fetchError) {
            setErrorMessage('Error reloading reports: ' + fetchError.message);
        } else if (data) {
            const reports: SelfReportLog[] = data.map((r: SelfReportData) => ({
                ...r,
                source_type: r.user_id === r.submitted_by ? 'self' : 'staff'
            }));
            setSelfReports(reports);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setErrorMessage(`Error saving report: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Color helper
  const colorForSource = (type: 'self' | 'staff' | string): string => { // Made type more specific
    if (type === "self") return "#8cc63f";      // WellFit Green
    if (type === "staff") return "#ff9800";     // Orange for staff
    return "#bdbdbd";                           // Default gray
  };

  if (isLoading && !currentUser) {
    return <div className="text-center p-8 text-xl" style={{ color: branding.primaryColor }}>Loading...</div>;
  }

  if (!currentUser && errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-6 text-center">
        <p className="text-2xl font-semibold mb-4" style={{ color: branding.primaryColor }}>Access Denied</p>
        <p className="text-lg" style={{ color: branding.textColor }}>{errorMessage}</p>
        <p className="text-md mt-4" style={{ color: branding.textColor }}>
          Please <a href="/" className="underline" style={{ color: branding.secondaryColor }}>log in</a> to access this page.
        </p>
      </div>
    );
  }

  return (
    <div
      className="p-4 md:p-8 max-w-2xl mx-auto rounded-xl shadow-md"
      style={{
        background: branding.gradient || `linear-gradient(to bottom right, ${branding.primaryColor}, ${branding.secondaryColor})`,
        color: branding.textColor,
        border: `1px solid ${branding.primaryColor}`,
      }}
    >
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center" style={{ color: branding.primaryColor }}>
        Self Health Report
      </h1>

      {/* Form for submitting new report */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div>
          <label htmlFor="mood" className="block text-sm font-medium text-gray-700 mb-1">
            How are you feeling today?
          </label>
          <select
            id="mood"
            value={mood}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMood(e.target.value)}
            disabled={isLoading}
            aria-required="true"
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
          >
            <option value="" disabled>Select a mood...</option>
            {moodOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="symptoms" className="block text-sm font-medium text-gray-700 mb-1">
            Any symptoms you're experiencing? (optional)
          </label>
          <textarea
            id="symptoms"
            value={symptoms}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSymptoms(e.target.value)}
            rows={3}
            disabled={isLoading}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
            placeholder="e.g., headache, fatigue"
          />
        </div>

        <div>
          <label htmlFor="activity" className="block text-sm font-medium text-gray-700 mb-1">
            Briefly describe your main activity today (optional)
          </label>
          <textarea
            id="activity"
            value={activity}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setActivity(e.target.value)}
            rows={3}
            disabled={isLoading}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
            placeholder="e.g., light walk, reading, gardening"
          />
        </div>
        
        {/* Feedback messages */}
        {feedbackMessage && (
          <p role="status" className="text-green-600 bg-green-100 p-3 rounded-lg text-base sm:text-lg text-center font-medium">{feedbackMessage}</p>
        )}
        {errorMessage && !feedbackMessage && (
          <p role="alert" className="text-red-600 bg-red-100 p-3 rounded-lg text-base sm:text-lg text-center font-medium">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={isLoading || (!currentUser && !isLoading)}
          className="w-full text-white font-semibold py-3 px-6 rounded-lg text-xl shadow-md transition-opacity duration-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
          style={{
            background: branding.gradient || `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`,
            color: 'white',
            border: 'none',
          }}
        >
          {isLoading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>

      {/* Show previous reports with color-coding */}
      <div className="mt-8">
        <h2 className="text-lg sm:text-xl font-semibold mb-4" style={{ color: branding.primaryColor }}>Your Previous Reports</h2>
        {selfReports.length === 0 ? (
          <p style={{ color: branding.textColor }}>No reports yet.</p>
        ) : (
          selfReports.map((log) => (
            <div
              key={log.id}
              style={{
                borderLeft: `8px solid ${colorForSource(log.source_type)}`,
                padding: "8px",
                marginBottom: "4px",
                background: "#fff"
              }}
            >
              <strong>{new Date(log.created_at).toLocaleString()}</strong>
              <span
                style={{
                  color: colorForSource(log.source_type),
                  fontWeight: "bold",
                  marginLeft: 8,
                }}
              >
                {log.source_type === "self" ? "Self" : "Staff"}
              </span>
              <br />
              Mood: {log.mood}
              <br />
              Symptoms: {log.symptoms}
              <br />
              Activity: {log.activity_description}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SelfReportingPage;

