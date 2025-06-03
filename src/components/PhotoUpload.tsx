import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface PhotoUploadProps {
  context: string;   // e.g. "meal"
  recordId: string;  // the meal.id
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ context, recordId }) => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type?: 'success' | 'error'; text?: string }>({});
  const bucketName = `${context}-photos`;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    if (!e.target.files?.length) return;
    setMessage({}); // Clear previous messages
    const file: File = e.target.files[0]; // Explicitly type File
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `${recordId}/${fileName}`;

    setUploading(true);
    try {
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, { upsert: false });

      if (error) throw error; // Supabase error object might have more specific type
      setMessage({ type: 'success', text: 'Upload successful!' });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : typeof error === 'string' ? error : 'An unknown error occurred during upload.';
      setMessage({ type: 'error', text: `Error uploading: ${errMsg}` });
    } finally {
      setUploading(false);
      // Clear the file input so the same file can be re-uploaded if needed
      e.target.value = ''; 
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="photo-upload-input" className="block font-medium text-gray-700 text-sm">Upload Photo</label>
      <input
        id="photo-upload-input"
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={handleFileChange}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
      />
      {uploading && <p className="text-sm text-gray-600">Uploading…</p>}
      {message.text && (
        <p role="status" className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
};

export default PhotoUpload;
