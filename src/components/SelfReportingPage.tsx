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

  const moodOptions = ['Happy', 'Okay', 'Sad', 'Anxious', 'Tired'];

  useEffect(() => {
    const getUser = async () => {
      setIsLoading(true);
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          setErrorMessage('Error fetching user: ' + error.message);
        }
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
      const { error } = await supabase.from('health_entries').insert({
        user_id: currentUser.id,
        entry_type: 'self_report',
        data: { mood, symptoms, activity_description: activity },
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      setFeedbackMessage('Report saved successfully!');
      setMood('');
      setSymptoms('');
      setActivity('');
    } catch (error: any) {
      setErrorMessage('Error saving report: ' + error.message);
    } finally {
      setIsLoading(false);
    }
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
        <div>
          <label htmlFor="mood" className="block text-lg font-medium mb-2" style={{ color: branding.primaryColor }}>
            How are you feeling today?
          </label>
          <select
            id="mood"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            className="w-full p-3 text-lg border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-offset-1"
            style={{
              backgroundColor: 'white',
              color: 'black',
              borderColor: branding.primaryColor,
              outlineColor: branding.secondaryColor,
            }}
            required
          >
            <option value="" disabled>Select your mood</option>
            {moodOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="symptoms" className="block text-lg font-medium mb-2" style={{ color: branding.primaryColor }}>
            Any symptoms to report?
          </label>
          <textarea
            id="symptoms"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            rows={4}
            className="w-full p-3 text-lg border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-offset-1"
            placeholder="e.g., headache, fatigue"
            style={{
              backgroundColor: 'white',
              color: 'black',
              borderColor: branding.primaryColor,
              outlineColor: branding.secondaryColor,
            }}
          />
        </div>

        <div>
          <label htmlFor="activity" className="block text-lg font-medium mb-2" style={{ color: branding.primaryColor }}>
            What physical activity did you do today?
          </label>
          <textarea
            id="activity"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            rows={4}
            className="w-full p-3 text-lg border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-offset-1"
            placeholder="e.g., walking, yoga, chores"
            style={{
              backgroundColor: 'white',
              color: 'black',
              borderColor: branding.primaryColor,
              outlineColor: branding.secondaryColor,
            }}
          />
        </div>

        {feedbackMessage && (
          <p className="text-green-600 bg-green-100 p-3 rounded-lg text-lg text-center">{feedbackMessage}</p>
        )}
        {errorMessage && !feedbackMessage && (
          <p className="text-red-600 bg-red-100 p-3 rounded-lg text-lg text-center">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={isLoading || (!currentUser && !isLoading)} // Disable if loading, or if not loading but still no user
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
    </div>
  );
};

export default SelfReportingPage;
