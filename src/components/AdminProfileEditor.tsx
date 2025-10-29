// src/components/AdminProfileEditor.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';


interface Profile {
  id: string;
  full_name: string;
  role: string;
  dob?: string;
  phone?: string;
  address?: string;
}

interface AdminNote {
  id: number;
  senior_id: string;
  created_by: string;
  note: string;
  created_at: string;
  updated_at?: string;
  updated_by?: string;
}

const AdminProfileEditor: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    fetchProfiles();
    fetchUserId();
    const storedId = localStorage.getItem('selectedSeniorId');
    if (storedId) {
      setSelectedId(storedId);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      const profile = profiles.find(p => p.id === selectedId) || null;
      setSelectedProfile(profile);
      fetchNotes(selectedId);

      // Log admin viewing a profile
      if (profile && userId) {
        logProfileView(userId, profile.id);
      }
    } else {
      setSelectedProfile(null);
      setNotes([]);
    }
  }, [selectedId, profiles, userId]); // Added userId to dependency array

  const logProfileView = async (adminUserId: string, viewedProfileId: string) => {
    try {
      // We don't have access to IP or User-Agent easily on the client-side without more setup.
      // These can be added later if required, possibly by calling a Supabase function
      // that can infer these from request headers.
      const { error } = await supabase.from('admin_profile_view_logs').insert({
        admin_user_id: adminUserId,
        viewed_profile_id: viewedProfileId,
        // ip_address and user_agent could be added here if available
      });
      if (error) {

      }
    } catch (err) {

    }
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'senior');
    if (!error && data) setProfiles(data);
  };

  const fetchNotes = async (seniorId: string) => {
    const { data, error } = await supabase
      .from('admin_notes')
      .select('*')
      .eq('senior_id', seniorId)
      .order('created_at', { ascending: false });
    if (!error && data) setNotes(data);
  };

  const fetchUserId = async () => {
    const { data } = await supabase.auth.getUser();
    setUserId(data?.user?.id || '');
  };

  const handleAddNote = async () => {
    if (!newNote || !selectedId || !userId) return;
    const { error } = await supabase.from('admin_notes').insert({
      senior_id: selectedId,
      created_by: userId,
      note: newNote,
    });
    if (!error) {
      setNewNote('');
      fetchNotes(selectedId);
    }
  };

  const handleEditNote = async (noteId: number, updatedText: string) => {
    const { error } = await supabase
      .from('admin_notes')
      .update({ note: updatedText, updated_at: new Date().toISOString(), updated_by: userId })
      .eq('id', noteId);
    if (!error) {
      setEditingNoteId(null);
      fetchNotes(selectedId);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <a href="/admin-panel" className="inline-block mb-4 text-sm text-blue-600 hover:underline">← Back to Admin Panel</a>

      <h2 className="text-xl font-bold mb-4">Admin Profile Editor</h2>

      <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full p-2 border rounded mb-4">
        <option value="">Select a Senior</option>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.full_name}
          </option>
        ))}
      </select>

      {selectedProfile && (
        <div className="bg-gray-100 p-4 rounded shadow">
          <h3 className="font-semibold text-lg">{selectedProfile.full_name}</h3>
          <p>Role: {selectedProfile.role}</p>
          <p>Date of Birth: {selectedProfile.dob}</p>
          <p>Phone: {selectedProfile.phone}</p>
          <p>Address: {selectedProfile.address}</p>
        </div>
      )}

      <div className="mt-6">
        <h4 className="text-lg font-bold">Admin Notes</h4>
        {notes.map((note) => (
          <div key={note.id} className="border p-2 rounded my-2 bg-white">
            {editingNoteId === note.id ? (
              <div>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full p-2 border rounded"
                />
                <button onClick={() => handleEditNote(note.id, newNote)} className="mt-2 bg-blue-600 text-white px-4 py-1 rounded">
                  Save
                </button>
              </div>
            ) : (
              <div>
                <p>{note.note}</p>
                <p className="text-xs text-gray-500">
                  Created: {new Date(note.created_at).toLocaleString()} by {note.created_by}
                  {note.updated_at && ` | Updated: ${new Date(note.updated_at).toLocaleString()} by ${note.updated_by}`}
                </p>
                <button
                  onClick={() => {
                    setNewNote(note.note);
                    setEditingNoteId(note.id);
                  }}
                  className="text-sm text-blue-500 mt-1"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}

        <div className="mt-4">
          <textarea
            placeholder="Add a new note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <button onClick={handleAddNote} className="mt-2 bg-green-600 text-white px-4 py-1 rounded">
            Add Note
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminProfileEditor;
