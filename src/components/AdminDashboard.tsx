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

const AdminDashboard: React.FC = () => {
  const branding = useBranding();
  const [photoConsents, setPhotoConsents] = useState<ConsentRecord[]>([]);
  const [privacyConsents, setPrivacyConsents] = useState<ConsentRecord[]>([]);
  const [medications, setMedications] = useState<MedicationRecord[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [selfReports, setSelfReports] = useState<SelfReportRecord[]>([]);
  const [userQuestions, setUserQuestions] = useState<UserQuestion[]>([]);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setLoading(true);
      try {
        const [photoRes, privacyRes, medRes, checkInRes, reportRes, questionRes, profileRes] = await Promise.all([
          supabase.from('photo_consent').select('id, full_name, file_path, consented_at'),
          supabase.from('privacy_consent').select('id, full_name, file_path, consented_at'),
          supabase.from('medications').select('id, full_name, medication_name, frequency, updated_at'),
          supabase.from('check_ins').select('id, full_name, notes, created_at'),
          supabase.from('self_reports').select('id, full_name, mood, symptoms, activity, created_at'),
          supabase.from('user_questions').select('id, user_email, message_content, created_at'),
          supabase.from('profiles').select('id, full_name, address, birthdate, emergency_contact, email, created_at')
        ]);

        if (photoRes.error) throw photoRes.error;
        if (privacyRes.error) throw privacyRes.error;
        if (medRes.error) throw medRes.error;
        if (checkInRes.error) throw checkInRes.error;
        if (reportRes.error) throw reportRes.error;
        if (questionRes.error) throw questionRes.error;
        if (profileRes.error) throw profileRes.error;

        setPhotoConsents(photoRes.data || []);
        setPrivacyConsents(privacyRes.data || []);
        setMedications(medRes.data || []);
        setCheckIns(checkInRes.data || []);
        setSelfReports(reportRes.data || []);
        setUserQuestions(questionRes.data || []);
        setProfiles(profileRes.data || []);
      } catch (err: any) {
        console.error(err);
        setError('Failed to load dashboard records.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

  const renderSimpleTable = (title: string, headers: string[], rows: React.ReactNode[][]) => (
    <div className="mb-8">
      <h3 className="text-xl font-semibold mb-2" style={{ color: branding.primaryColor }}>{title}</h3>
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
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
