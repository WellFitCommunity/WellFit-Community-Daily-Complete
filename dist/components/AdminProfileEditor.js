"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/components/AdminProfileEditor.tsx
const react_1 = __importStar(require("react"));
const supabaseClient_1 = require("../lib/supabaseClient");
const AdminProfileEditor = () => {
    const [profiles, setProfiles] = (0, react_1.useState)([]);
    const [selectedId, setSelectedId] = (0, react_1.useState)('');
    const [selectedProfile, setSelectedProfile] = (0, react_1.useState)(null);
    const [notes, setNotes] = (0, react_1.useState)([]);
    const [newNote, setNewNote] = (0, react_1.useState)('');
    const [editingNoteId, setEditingNoteId] = (0, react_1.useState)(null);
    const [userId, setUserId] = (0, react_1.useState)('');
    (0, react_1.useEffect)(() => {
        fetchProfiles();
        fetchUserId();
        const storedId = localStorage.getItem('selectedSeniorId');
        if (storedId) {
            setSelectedId(storedId);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        if (selectedId) {
            const profile = profiles.find(p => p.id === selectedId) || null;
            setSelectedProfile(profile);
            fetchNotes(selectedId);
        }
        else {
            setSelectedProfile(null);
            setNotes([]);
        }
    }, [selectedId, profiles]);
    const fetchProfiles = async () => {
        const { data, error } = await supabaseClient_1.supabase.from('profiles').select('*').eq('role', 'senior');
        if (!error && data)
            setProfiles(data);
    };
    const fetchNotes = async (seniorId) => {
        const { data, error } = await supabaseClient_1.supabase
            .from('admin_notes')
            .select('*')
            .eq('senior_id', seniorId)
            .order('created_at', { ascending: false });
        if (!error && data)
            setNotes(data);
    };
    const fetchUserId = async () => {
        const { data } = await supabaseClient_1.supabase.auth.getUser();
        setUserId(data?.user?.id || '');
    };
    const handleAddNote = async () => {
        if (!newNote || !selectedId || !userId)
            return;
        const { error } = await supabaseClient_1.supabase.from('admin_notes').insert({
            senior_id: selectedId,
            created_by: userId,
            note: newNote,
        });
        if (!error) {
            setNewNote('');
            fetchNotes(selectedId);
        }
    };
    const handleEditNote = async (noteId, updatedText) => {
        const { error } = await supabaseClient_1.supabase
            .from('admin_notes')
            .update({ note: updatedText, updated_at: new Date().toISOString(), updated_by: userId })
            .eq('id', noteId);
        if (!error) {
            setEditingNoteId(null);
            fetchNotes(selectedId);
        }
    };
    return (<div className="max-w-4xl mx-auto p-4">
      <a href="/admin-panel" className="inline-block mb-4 text-sm text-blue-600 hover:underline">← Back to Admin Panel</a>

      <h2 className="text-xl font-bold mb-4">Admin Profile Editor</h2>

      <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full p-2 border rounded mb-4">
        <option value="">Select a Senior</option>
        {profiles.map((profile) => (<option key={profile.id} value={profile.id}>
            {profile.full_name}
          </option>))}
      </select>

      {selectedProfile && (<div className="bg-gray-100 p-4 rounded shadow">
          <h3 className="font-semibold text-lg">{selectedProfile.full_name}</h3>
          <p>Role: {selectedProfile.role}</p>
          <p>Date of Birth: {selectedProfile.dob}</p>
          <p>Phone: {selectedProfile.phone}</p>
          <p>Address: {selectedProfile.address}</p>
        </div>)}

      <div className="mt-6">
        <h4 className="text-lg font-bold">Admin Notes</h4>
        {notes.map((note) => (<div key={note.id} className="border p-2 rounded my-2 bg-white">
            {editingNoteId === note.id ? (<div>
                <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} className="w-full p-2 border rounded"/>
                <button onClick={() => handleEditNote(note.id, newNote)} className="mt-2 bg-blue-600 text-white px-4 py-1 rounded">
                  Save
                </button>
              </div>) : (<div>
                <p>{note.note}</p>
                <p className="text-xs text-gray-500">
                  Created: {new Date(note.created_at).toLocaleString()} by {note.created_by}
                  {note.updated_at && ` | Updated: ${new Date(note.updated_at).toLocaleString()} by ${note.updated_by}`}
                </p>
                <button onClick={() => {
                    setNewNote(note.note);
                    setEditingNoteId(note.id);
                }} className="text-sm text-blue-500 mt-1">
                  Edit
                </button>
              </div>)}
          </div>))}

        <div className="mt-4">
          <textarea placeholder="Add a new note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="w-full p-2 border rounded"/>
          <button onClick={handleAddNote} className="mt-2 bg-green-600 text-white px-4 py-1 rounded">
            Add Note
          </button>
        </div>
      </div>
    </div>);
};
exports.default = AdminProfileEditor;
