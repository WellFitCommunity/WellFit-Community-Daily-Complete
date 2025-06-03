import React, { useState, useEffect } from 'react';
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
  const [selfReports, setSelfReports] = useState<any[]>([]);

  const moodOptions = ['Happy', 'Okay', 'Sad', 'Anxious', 'Tired'];

  useEffect(() => {
    const getUser = async () => {
      setIsLoading(true);
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) setErrorMessage('Error fetching user: ' + error.message);
        setCurrentUser(user || null);
        if (!user) setErrorMessage('You must be logged in to submit a report.');
      } catch (e: any) {
        setErrorMessage('Unexpected error: ' + e.message);
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
    const fetchReports = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('self_reports')   // <-- Change to your table name
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
      if (error) {
        setErrorMessage('Error loading reports: ' + error.message);
        setSelfReports([]);
      } else {
        // Add source_type for color coding
        setSelfReports(data.map((r: any) => ({
          ...r,
          source_type: r.user_id === r.submitted_by ? 'self' : 'staff'
        })));
      }
      setIsLoading(false);
    };
    fetchReports();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
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
      if (currentUser) {
        const { data } = await supabase
          .from('self_reports')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });
        setSelfReports(data.map((r: any) => ({
          ...r,
          source_type: r.user_id === r.submitted_by ? 'self' : 'staff'
        })));
      }
    } catch (error: any) {
      setErrorMessage('Error saving report: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Color helper
  const colorForSource = (type: string) => {
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
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center" style={{ color: branding.primaryColor }}>
        Self Health Report
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* (Your form fields here) */}
        {/* ... */}
        {/* Feedback messages */}
        {feedbackMessage && (
          <p className="text-green-600 bg-green-100 p-3 rounded-lg text-lg text-center">{feedbackMessage}</p>
        )}
        {errorMessage && !feedbackMessage && (
          <p className="text-red-600 bg-red-100 p-3 rounded-lg text-lg text-center">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={isLoading || (!currentUser && !isLoading)}
          className="w-full text-white font-semibold py-3 px-6 rounded-lg text-xl shadow-md transition-opacity duration-300 disabled:opacity-50"
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
        <h2 className="text-xl font-semibold mb-4" style={{ color: branding.primaryColor }}>Your Previous Reports</h2>
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

