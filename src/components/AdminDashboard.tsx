import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useBranding } from '../BrandingContext';

interface ConsentRecord {
  user_id: string;
  first_name: string;
  last_name: string;
  file_path: string;
  consented_at: string;
}

interface MedicationRecord {
  user_id: string;
  first_name: string;
  last_name: string;
  medication_name: string;
  frequency: string;
  updated_at: string;
}

interface CheckInRecord {
  user_id: string;
  first_name: string;
  last_name: string;
  notes: string;
  created_at: string;
}

interface SelfReportRecord {
  user_id: string;
  first_name: string;
  last_name: string;
  mood: string;
  symptoms: string;
  activity: string;
  created_at: string;
}

interface UserQuestion {
  user_id: string;
  user_email: string;
  message_content: string;
  created_at: string;
}

interface ProfileRecord {
  user_id: string;
  first_name: string;
  last_name: string;
  address: string;
  birthdate: string;
  emergency_contact: string;
  email: string;
  created_at: string;
}

interface AlertRecord {
  id: string;  // Alerts table has its own PK called id
  user_id: string;
  user_full_name: string;
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
  const [newAlertCount, setNewAlertCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setLoading(true);
      setNewAlertCount(0);
      try {
        const [
          photoRes, privacyRes, medRes, checkInRes,
          reportRes, questionRes, profileRes, alertsRes
        ] = await Promise.all([
          supabase.from('photo_consent').select('user_id, first_name, last_name, file_path, consented_at'),
          supabase.from('privacy_consent').select('user_id, first_name, last_name, file_path, consented_at'),
          supabase.from('medications').select('user_id, first_name, last_name, medication_name, frequency, updated_at'),
          supabase.from('check_ins').select('user_id, first_name, last_name, notes, created_at'),
          supabase.from('self_reports').select('user_id, first_name, last_name, mood, symptoms, activity, created_at'),
          supabase.from('user_questions').select('user_id, user_email, message_content, created_at'),
          supabase.from('profiles_with_user_id').select('user_id, first_name, last_name, address, birthdate, emergency_contact, email, created_at'),
          supabase.from('alerts').select('id, user_id, alert_type, timestamp, details').order('timestamp', { ascending: false })
        ]);

        if (photoRes.error) throw photoRes.error;
        if (privacyRes.error) throw privacyRes.error;
        if (medRes.error) throw medRes.error;
        if (checkInRes.error) throw checkInRes.error;
        if (reportRes.error) throw reportRes.error;
        if (questionRes.error) throw questionRes.error;
        if (profileRes.error) throw profileRes.error;
        if (alertsRes.error) throw alertsRes.error;

        setPhotoConsents(photoRes.data || []);
        setPrivacyConsents(privacyRes.data || []);
        setMedications(medRes.data || []);
        setCheckIns(checkInRes.data || []);
        setSelfReports(reportRes.data || []);
        setUserQuestions(questionRes.data || []);
        const fetchedProfiles = profileRes.data || [];
        setProfiles(fetchedProfiles);

        const rawAlerts = alertsRes.data || [];
        const processedAlerts: AlertRecord[] = rawAlerts.map(alert => {
          const userProfile = fetchedProfiles.find(p => p.user_id === alert.user_id);
          return {
            ...alert,
            user_full_name: userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Unknown User',
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

  useEffect(() => {
    const channel = supabase
      .channel('alerts-realtime-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          const newAlert = payload.new as Omit<AlertRecord, 'user_full_name'>;
          const userProfile = profiles.find(p => p.user_id === newAlert.user_id);
          const processedNewAlert: AlertRecord = {
            ...newAlert,
            user_full_name: userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Unknown User',
            timestamp: newAlert.timestamp || new Date().toISOString()
          };
          setAlertHistory(prevAlerts => [processedNewAlert, ...prevAlerts]);
          setNewAlertCount(prevCount => prevCount + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profiles]);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

  const renderSimpleTable = (title: string, headers: string[], rows: React.ReactNode[][], badgeCount?: number) => (
    <div className="mb-8">
      <div className="flex items-center mb-2">
        <h3 className="text-xl font-semibold" style={{ color: branding.primaryColor }}>{title}</h3>
        {badgeCount && badgeCount > 0 && (
          <span
            className="ml-3 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: branding.secondaryColor }}
          >
            {badgeCount} New
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-300">
          <thead className="bg-gray-100 text-left">
            <tr>{headers.map((h, i) => <th key={i} className="p-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t">{row.map((cell, j) => <td key={j} className="p-2">{cell}</td>)}</tr>
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
    return diff <= 7;
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: branding.secondaryColor }}>
        Admin Consent Dashboard
      </h2>

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
                {recentEnrollees.map(e => <li key={e.user_id}>{e.first_name} {e.last_name}</li>)}
              </ul>
            </div>
          )}

          {renderSimpleTable('Photo/Story Consent Records', ['Name', 'Date', 'Signature'],
            photoConsents.map(d => [
              `${d.first_name} ${d.last_name}`,
              formatDate(d.consented_at),
              <a href={`https://xkybsjnvuohpqpbkikyn.supabase.co/storage/v1/object/public/consent-signatures/${d.file_path}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
            ]))}

          {renderSimpleTable('Privacy Consent Records', ['Name', 'Date', 'Signature'],
            privacyConsents.map(d => [
              `${d.first_name} ${d.last_name}`,
              formatDate(d.consented_at),
              <a href={`https://xkybsjnvuohpqpbkikyn.supabase.co/storage/v1/object/public/consent-signatures/${d.file_path}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
            ]))}

                  {renderSimpleTable('Medication Records', ['Name', 'Medication', 'Frequency', 'Last Updated'],
                    medications.map(m => [
                      `${m.first_name} ${m.last_name}`,
                      m.medication_name,
                      m.frequency,
                      formatDate(m.updated_at)
                    ]))}
                </>
              )}
            </div>
          );
        };
        
        export default AdminDashboard;
