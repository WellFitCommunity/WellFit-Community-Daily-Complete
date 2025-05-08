import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface PhotoUploadProps {
  context: string;   // e.g. "meal"
  recordId: string;  // the meal.id
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ context, recordId }) => {
  const [uploading, setUploading] = useState(false);
  const bucketName = `${context}-photos`;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `${recordId}/${fileName}`;

    setUploading(true);
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, { upsert: false });

    setUploading(false);
    if (error) {
      alert('Error uploading: ' + error.message);
    } else {
      alert('Upload successful!');
    }

    e.target.value = '';
  };

  return (
    <div className="space-y-1">
      <label className="block font-medium text-gray-700">Upload Photo</label>
      <input
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={handleFileChange}
        className="block"
      />
      {uploading && <p className="text-gray-500 text-sm">Uploading…</p>}
    </div>
  );
};

export default PhotoUpload;
