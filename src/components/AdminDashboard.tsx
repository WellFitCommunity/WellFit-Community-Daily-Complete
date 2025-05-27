// src/components/AdminDashboard.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useBranding } from '../BrandingContext';

interface ConsentRecord {
  id: string;
  full_name: string;
  file_path: string;
  consented_at: string;
}

interface MedicationRecord {
  id: string;
  full_name: string;
  medication_name: string;
  frequency: string;
  updated_at: string;
}

interface CheckInRecord {
  id: string;
  full_name: string;
  notes: string;
  created_at: string;
}

interface SelfReportRecord {
  id: string;
  full_name: string;
  mood: string;
  symptoms: string;
  activity: string;
  created_at: string;
}

interface UserQuestion {
  id: string;
  user_email: string;
  message_content: string;
  created_at: string;
}

interface ProfileRecord {
  id: string;
  full_name: string;
  address: string;
  birthdate: string;
  emergency_contact: string;
  email: string;
  created_at: string;
}

// New interface for Alert Records
interface AlertRecord {
  id: string;
  user_id: string;
  user_full_name: string; // To store fetched user name
  alert_type: string;
  timestamp: string;
  details: string | null;
}

const AdminDashboard: React.FC = () => {
  const branding = useBranding();
  const [photoConsents, setPhotoConsents] = useState<ConsentRecord[]>([]);
  const [privacyConsents, setPrivacyConsents] = useState<ConsentRecord[]>([]);
  const [medications, setMedications] = useState<MedicationRecord[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [selfReports, setSelfReports] = useState<SelfReportRecord[]>([]);
  const [userQuestions, setUserQuestions] = useState<UserQuestion[]>([]);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertRecord[]>([]); 
  const [newAlertCount, setNewAlertCount] = useState(0); // State for new alert notifications
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setLoading(true);
      setNewAlertCount(0); // Reset new alert count on data fetch
      try {
        // Fetch all data in parallel
        const [
          photoRes, 
          privacyRes, 
          medRes, 
          checkInRes, 
          reportRes, 
          questionRes, 
          profileRes, 
          alertsRes // Added alerts fetch
        ] = await Promise.all([
          supabase.from('photo_consent').select('id, full_name, file_path, consented_at'),
          supabase.from('privacy_consent').select('id, full_name, file_path, consented_at'),
          supabase.from('medications').select('id, full_name, medication_name, frequency, updated_at'),
          supabase.from('check_ins').select('id, full_name, notes, created_at'), // Assuming check_ins table has full_name of the user
          supabase.from('self_reports').select('id, full_name, mood, symptoms, activity, created_at'),
          supabase.from('user_questions').select('id, user_email, message_content, created_at'),
          supabase.from('profiles').select('id, full_name, address, birthdate, emergency_contact, email, created_at'),
          supabase.from('alerts').select('id, user_id, alert_type, timestamp, details').order('timestamp', { ascending: false }) // Fetch alerts
        ]);

        // Error handling for each response
        if (photoRes.error) throw photoRes.error;
        if (privacyRes.error) throw privacyRes.error;
        if (medRes.error) throw medRes.error;
        if (checkInRes.error) throw checkInRes.error;
        if (reportRes.error) throw reportRes.error;
        if (questionRes.error) throw questionRes.error;
        if (profileRes.error) throw profileRes.error;
        if (alertsRes.error) throw alertsRes.error; // Handle alerts error

        // Set states for existing data
        setPhotoConsents(photoRes.data || []);
        setPrivacyConsents(privacyRes.data || []);
        setMedications(medRes.data || []);
        setCheckIns(checkInRes.data || []);
        setSelfReports(reportRes.data || []);
        setUserQuestions(questionRes.data || []);
        
        const fetchedProfiles = profileRes.data || [];
        setProfiles(fetchedProfiles);

        // Process and set alert history
        const rawAlerts = alertsRes.data || [];
        const processedAlerts: AlertRecord[] = rawAlerts.map(alert => {
          const userProfile = fetchedProfiles.find(p => p.id === alert.user_id);
          return {
            ...alert,
            user_full_name: userProfile?.full_name || 'Unknown User', // Get user name from profiles
            timestamp: alert.timestamp
          };
        });
        setAlertHistory(processedAlerts);

      } catch (err: any) {
        console.error("Error during data fetching:", err);
        setError(`Failed to load dashboard records: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Realtime subscription for new alerts
  useEffect(() => {
    // Ensure profiles are loaded before attempting to subscribe or process alerts that need profile data
    if (!profiles || profiles.length === 0) {
        // console.log("Profiles not yet loaded, skipping alerts subscription setup.");
        // return; // Or handle differently if subscription should always be active
    }

    const channel = supabase
      .channel('alerts-realtime-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          console.log('New alert received:', payload);
          const newAlert = payload.new as Omit<AlertRecord, 'user_full_name'>; // Type assertion

          // Attempt to find user_full_name from existing profiles state
          const userProfile = profiles.find(p => p.id === newAlert.user_id);
          const processedNewAlert: AlertRecord = {
            ...newAlert,
            user_full_name: userProfile?.full_name || 'Unknown User', // Fallback
            timestamp: newAlert.timestamp || new Date().toISOString() // Ensure timestamp exists
          };
          
          setAlertHistory(prevAlerts => [processedNewAlert, ...prevAlerts]);
          setNewAlertCount(prevCount => prevCount + 1);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to alerts channel!');
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Alerts subscription error:', err);
          // Optionally, try to resubscribe or notify user
        }
      });

    return () => {
      supabase.removeChannel(channel);
      console.log('Unsubscribed from alerts channel.');
    };
  }, [profiles]); // Add profiles to dependency array to re-evaluate if profiles change

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

  // Modified to include an optional badge for new items
  const renderSimpleTable = (title: string, headers: string[], rows: React.ReactNode[][], badgeCount?: number) => (
    <div className="mb-8">
      <div className="flex items-center mb-2">
        <h3 className="text-xl font-semibold" style={{ color: branding.primaryColor }}>{title}</h3>
        {badgeCount && badgeCount > 0 && (
          <span 
            className="ml-3 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: branding.secondaryColor }} // Use secondaryColor for badge
          >
            {badgeCount} New
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-300">
          <thead className="bg-gray-100 text-left">
            <tr>
              {headers.map((h, i) => <th key={i} className="p-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                {row.map((cell, j) => <td key={j} className="p-2">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const recentEnrollees = profiles.filter(p => {
    const created = new Date(p.created_at);
    const now = new Date();
    const diff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7; // New if enrolled in the last 7 days
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: branding.secondaryColor }}>Admin Consent Dashboard</h2>
      {loading ? (
        <p className="text-center text-gray-500">Loading dashboard records...</p>
      ) : error ? (
        <p className="text-center text-red-600">{error}</p>
      ) : (
        <>
          {recentEnrollees.length > 0 && (
            <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-800 rounded">
              <h4 className="font-semibold">New Enrollees This Week:</h4>
              <ul className="list-disc ml-6 mt-2">
                {recentEnrollees.map(e => <li key={e.id}>{e.full_name}</li>)}
              </ul>
            </div>
          )}

          {renderSimpleTable('Photo/Story Consent Records', ['Name', 'Date', 'Signature'],
            photoConsents.map(d => [d.full_name, formatDate(d.consented_at), <a href={`https://YOUR_PROJECT.supabase.co/storage/v1/object/public/consent-signatures/${d.file_path}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>]))}

          {renderSimpleTable('Privacy Consent Records', ['Name', 'Date', 'Signature'],
            privacyConsents.map(d => [d.full_name, formatDate(d.consented_at), <a href={`https://YOUR_PROJECT.supabase.co/storage/v1/object/public/consent-signatures/${d.file_path}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>]))}

          {renderSimpleTable('Medication Records', ['Name', 'Medication', 'Frequency', 'Last Updated'],
            medications.map(m => [m.full_name, m.medication_name, m.frequency, formatDate(m.updated_at)]))}

          {renderSimpleTable('Check-In Records', ['Name', 'Notes', 'Date'],
            checkIns.map(c => [c.full_name, c.notes, formatDate(c.created_at)]))}

          {renderSimpleTable('Self Reports', ['Name', 'Mood', 'Symptoms', 'Activity', 'Date'],
            selfReports.map(r => [r.full_name, r.mood, r.symptoms, r.activity, formatDate(r.created_at)]))}

          {renderSimpleTable('User Questions', ['User Email', 'Message', 'Date'],
            userQuestions.map(q => [q.user_email, q.message_content, formatDate(q.created_at)]))}

          {renderSimpleTable('Profile Info', ['Name', 'Email', 'Address', 'Birthdate', 'Emergency Contact'],
            profiles.map(p => [p.full_name, p.email, p.address, p.birthdate, p.emergency_contact]))}

          {/* New Table for Emergency Alert History with badge */}
          {renderSimpleTable('Emergency Alert History', ['User Name', 'Alert Type', 'Timestamp', 'Details'],
            alertHistory.map(alert => [
              alert.user_full_name,
              alert.alert_type,
              formatDate(alert.timestamp),
              alert.details || 'N/A'
            ]),
            newAlertCount // Pass newAlertCount to display badge
          )}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
