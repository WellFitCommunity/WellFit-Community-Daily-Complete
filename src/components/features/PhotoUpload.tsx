import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface PhotoUploadProps {
  /** e.g. "meal" (per-record gallery) or "community" (global, moderated) */
  context: 'meal' | 'community';
  /** required for per-record contexts like "meal"; ignored for "community" */
  recordId?: string;
  onSuccess?: () => void;
}

const MAX_FILE_SIZE_MB = 5;

const PhotoUpload: React.FC<PhotoUploadProps> = ({ context, recordId, onSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type?: 'success' | 'error'; text?: string }>({});
  const [caption, setCaption] = useState(''); // used for community uploads only

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    if (!e.target.files?.length) return;
    setMessage({}); // Clear previous messages
    const file: File = e.target.files[0];

    // 1) Type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Only image files are allowed.' });
      e.target.value = '';
      return;
    }
    // 2) Size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setMessage({ type: 'error', text: `File too large (max ${MAX_FILE_SIZE_MB}MB).` });
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      if (context === 'community') {
        // ---- Community Moments path ----
        const { data: authData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !authData?.user) {
          setMessage({ type: 'error', text: 'Please sign in first.' });
          return;
        }
        const uid = authData.user.id;
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const filename = crypto.randomUUID() + '.' + ext;
        const storagePath = `community/${uid}/${filename}`;

        // Upload to 'community' bucket (public recommended for simplicity)
        const { error: upErr } = await supabase.storage
          .from('community')
          .upload(storagePath, file, { upsert: false });
        if (upErr) throw upErr;

        // Insert DB row for moderation workflow
        const { error: rowErr } = await supabase.from('community_photos').insert({
          user_id: uid,
          storage_path: storagePath,
          caption: caption || null,
          approved: false, // admin will approve
        });
        if (rowErr) throw rowErr;

        setCaption('');
        setMessage({ type: 'success', text: 'Uploaded! Pending admin approval.' });
        onSuccess?.();
      } else {
        // ---- Per-record path (e.g., meals) ----
        if (!recordId) {
          setMessage({ type: 'error', text: 'Missing recordId for this upload.' });
          return;
        }
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}.${ext}`;
        const filePath = `${recordId}/${fileName}`;
        const bucketName = `${context}-photos`; // e.g. "meal-photos"

        const { error } = await supabase.storage.from(bucketName).upload(filePath, file, { upsert: false });
        if (error) throw error;

        setMessage({ type: 'success', text: 'Upload successful!' });
        onSuccess?.();
      }
    } catch (err) {
      const text =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : 'An unknown error occurred during upload.';
      setMessage({ type: 'error', text: `Error uploading: ${text}` });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-3">
      {context === 'community' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Caption (optional)</label>
          <input
            className="border p-2 rounded w-full"
            placeholder="Say something about your photo"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>
      )}

      <label htmlFor="photo-upload-input" className="block font-medium text-gray-700 text-base">
        {context === 'community' ? 'Upload Community Photo' : 'Upload Photo'}
      </label>

      <input
        id="photo-upload-input"
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={handleFileChange}
        className="block w-full text-base text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
      />
      {uploading && <p className="text-base text-gray-600">Uploading…</p>}
      {message.text && (
        <p role="status" className={`text-base ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
};

export default PhotoUpload;
