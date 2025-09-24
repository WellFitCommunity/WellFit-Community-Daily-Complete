import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession, useUser } from '../contexts/AuthContext';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
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
  // ✅ get the client + user/session from hooks
  const supabase = useSupabaseClient();
  const session = useSession();
  const user = useUser();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Loading & feedback
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingAddNote, setIsLoadingAddNote] = useState(false);
  const [isLoadingEditNote, setIsLoadingEditNote] = useState(false);
  const [addNoteMessage, setAddNoteMessage] = useState<{ type?: 'success' | 'error'; text?: string }>({});
  const [editNoteMessage, setEditNoteMessage] = useState<{ type?: 'success' | 'error'; text?: string }>({});

  // derive userId from hook (faster, simpler)
  const userId = user?.id ?? session?.user?.id ?? '';

  useEffect(() => {
    // on mount: fetch profiles, restore selection
    (async () => {
      setIsLoadingProfiles(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, role, dob, phone, address')
          .eq('role', 'senior');
        if (error) throw error;
        setProfiles((data as Profile[]) || []);
      } catch (err) {
        console.error('Error fetching profiles:', err);
      } finally {
        setIsLoadingProfiles(false);
      }
    })();

    const storedId = localStorage.getItem('selectedSeniorId');
    if (storedId) setSelectedId(storedId);
  }, [supabase]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedProfile(null);
      setNotes([]);
      return;
    }

    const profile = profiles.find(p => p.user_id === selectedId) || null;
    setSelectedProfile(profile);

    (async () => {
      setIsLoadingNotes(true);
      try {
        const { data, error } = await supabase
          .from('admin_notes')
          .select('*')
          .eq('senior_id', selectedId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setNotes((data as AdminNote[]) || []);
      } catch (err) {
        console.error(`Error fetching notes for ${selectedId}:`, err);
      } finally {
        setIsLoadingNotes(false);
      }
    })();

    // persist selection
    localStorage.setItem('selectedSeniorId', selectedId);
  }, [selectedId, profiles, supabase]);

  const handleAddNote = async (): Promise<void> => {
    if (!newNote.trim() || !selectedId || !userId) return;
    setIsLoadingAddNote(true);
    setAddNoteMessage({});
    try {
      const { error } = await supabase.from('admin_notes').insert({
        senior_id: selectedId,
        created_by: userId,
        note: newNote.trim(),
      });
      if (error) throw error;
      setNewNote('');
      // refresh notes
      const { data, error: err2 } = await supabase
        .from('admin_notes')
        .select('*')
        .eq('senior_id', selectedId)
        .order('created_at', { ascending: false });
      if (err2) throw err2;
      setNotes((data as AdminNote[]) || []);
      setAddNoteMessage({ type: 'success', text: 'Note added successfully!' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setAddNoteMessage({ type: 'error', text: `Error adding note: ${message}` });
    } finally {
      setIsLoadingAddNote(false);
    }
  };

  const handleEditNote = async (noteId: number, updatedText: string): Promise<void> => {
    if (!updatedText.trim() || !userId) return;
    setIsLoadingEditNote(true);
    setEditNoteMessage({});
    try {
      const { error } = await supabase
        .from('admin_notes')
        .update({ note: updatedText.trim(), updated_at: new Date().toISOString(), updated_by: userId })
        .eq('id', noteId);
      if (error) throw error;

      // refresh notes
      const { data, error: err2 } = await supabase
        .from('admin_notes')
        .select('*')
        .eq('senior_id', selectedId)
        .order('created_at', { ascending: false });
      if (err2) throw err2;

      setNotes((data as AdminNote[]) || []);
      setEditingNoteId(null);
      setEditingNoteText('');
      setEditNoteMessage({ type: 'success', text: 'Note updated successfully!' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setEditNoteMessage({ type: 'error', text: `Error updating note: ${message}` });
    } finally {
      setIsLoadingEditNote(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <a href="/admin-panel" className="inline-block mb-4 text-sm text-blue-600 hover:underline">
        ← Back to Admin Panel
      </a>

      <h2 className="text-xl font-bold mb-4">Admin Profile Editor</h2>

      <div>
        <label htmlFor="senior-select" className="block text-sm font-medium text-gray-700 mb-1">
          Select Senior to View/Edit Notes:
        </label>

        <select
          id="senior-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          aria-required="true"
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">Select a Senior...</option>
          {profiles.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.first_name} {p.last_name}
            </option>
          ))}
        </select>

        {selectedProfile && (
          <div className="bg-gray-100 p-4 rounded shadow">
            <h3 className="font-semibold text-lg">
              {selectedProfile.first_name} {selectedProfile.last_name}
            </h3>
            <p>Role: {selectedProfile.role}</p>
            <p>Date of Birth: {selectedProfile.dob || '—'}</p>
            <p>Phone: {selectedProfile.phone || '—'}</p>
            <p>Address: {selectedProfile.address || '—'}</p>
          </div>
        )}

        {/* ✅ single notes list (removed duplicates & stray branch text) */}
        <div className="mt-6">
          <h4 className="text-lg font-bold">Admin Notes</h4>

          {isLoadingNotes && <p className="text-sm text-gray-500 mt-2">Loading notes…</p>}

          {editNoteMessage.text && (
            <div
              role="alert"
              className={`p-3 my-3 rounded-md text-sm text-white ${
                editNoteMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'
              }`}
            >
              {editNoteMessage.text}
            </div>
          )}

          {notes.map((note) => (
            <div key={note.id} className="border p-2 rounded my-2 bg-white">
              {editingNoteId === note.id ? (
                <div>
                  <label htmlFor={`edit-note-textarea-${note.id}`} className="sr-only">
                    Edit note content
                  </label>
                  <textarea
                    id={`edit-note-textarea-${note.id}`}
                    value={editingNoteText}
                    onChange={(e) => setEditingNoteText(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                    aria-required="true"
                  />
                  <button
                    onClick={() => handleEditNote(note.id, editingNoteText)}
                    className="mt-2 bg-blue-600 text-white px-4 py-1 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={isLoadingEditNote}
                  >
                    {isLoadingEditNote ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingNoteId(null);
                      setEditingNoteText('');
                      setEditNoteMessage({});
                    }}
                    className="mt-2 ml-2 text-gray-600 px-4 py-1 rounded-md border border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                    disabled={isLoadingEditNote}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <p className="whitespace-pre-wrap">{note.note}</p>
                  <p className="text-xs text-gray-500">
                    Created: {new Date(note.created_at).toLocaleString()} by {note.created_by}
                    {note.updated_at && ` | Updated: ${new Date(note.updated_at).toLocaleString()} by ${note.updated_by}`}
                  </p>
                  <button
                    onClick={() => {
                      setEditingNoteText(note.note);
                      setEditingNoteId(note.id);
                      setEditNoteMessage({});
                    }}
                    className="text-sm text-blue-500 mt-1 hover:underline disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isLoadingEditNote || isLoadingAddNote}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}

          <div className="mt-4">
            <label htmlFor="add-new-note-textarea" className="text-md font-semibold mb-2 block">
              Add New Note
            </label>
            <textarea
              id="add-new-note-textarea"
              placeholder="Type your note here…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
              aria-required="true"
              disabled={isLoadingAddNote}
            />
            {addNoteMessage.text && (
              <div
                role="alert"
                className={`mt-2 p-3 rounded-md text-sm ${
                  addNoteMessage.type === 'success'
                    ? 'text-green-700 bg-green-100'
                    : 'text-red-700 bg-red-100'
                }`}
              >
                {addNoteMessage.text}
              </div>
            )}
            <button
              onClick={handleAddNote}
              className="mt-2 bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:bg-green-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              disabled={isLoadingAddNote || !!editingNoteId || !selectedId || !userId || !newNote.trim()}
            >
              {isLoadingAddNote ? 'Adding Note…' : 'Add Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfileEditor;
