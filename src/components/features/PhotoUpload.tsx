<<<<<<< HEAD:src/components/PhotoUpload.tsx
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
=======
import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
>>>>>>> 0d60695e000b23b8b168752c2686ce686e47468f:src/components/features/PhotoUpload.tsx

interface PhotoUploadProps {
  context: string;   // e.g. "meal"
  recordId: string;  // the meal.id
  onSuccess?: () => void; // Optional: callback for parent to refresh data/gallery
}

const MAX_FILE_SIZE_MB = 5;

const PhotoUpload: React.FC<PhotoUploadProps> = ({ context, recordId, onSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type?: 'success' | 'error'; text?: string }>({});
  const bucketName = `${context}-photos`;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    if (!e.target.files?.length) return;
    setMessage({}); // Clear previous messages
    const file: File = e.target.files[0];

    // 1. File type validation
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Only image files are allowed.' });
      e.target.value = '';
      return;
    }
    // 2. File size validation (limit to 5MB)
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setMessage({ type: 'error', text: `File too large (max ${MAX_FILE_SIZE_MB}MB).` });
      e.target.value = '';
      return;
    }

    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `${recordId}/${fileName}`;

    setUploading(true);
    try {
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, { upsert: false });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Upload successful!' });
      if (onSuccess) onSuccess();
    } catch (error) {
      const errMsg =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
          ? error
          : 'An unknown error occurred during upload.';
      setMessage({ type: 'error', text: `Error uploading: ${errMsg}` });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="photo-upload-input" className="block font-medium text-gray-700 text-base">Upload Photo</label>
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
