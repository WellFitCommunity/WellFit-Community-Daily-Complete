import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UploadYourPlateProps {
  recipeName: string;
}

const UploadYourPlate: React.FC<UploadYourPlateProps> = ({ recipeName }) => {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleYesClick = () => {
    setShowUpload(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setMessage('');

    const fileExt = selectedFile.name.split('.').pop();
    const fileName = `${recipeName}-${Date.now()}.${fileExt}`;
    const filePath = `plate_photos/${fileName}`;

    const { error } = await supabase.storage
      .from('public-plates')
      .upload(filePath, selectedFile, { upsert: false });

    if (error) {
      setMessage('⚠️ Upload failed. Please try again.');
    } else {
      setMessage('✅ Upload successful! Thank you for sharing.');
    }

    setUploading(false);
  };

  return (
    <div className="mt-8 p-6 bg-white border border-[#8cc63f] rounded-xl shadow-md text-center space-y-4">
      {!showUpload ? (
        <>
          <h3 className="text-xl font-semibold text-[#003865]">
            🍽️ Do you plan to make this meal?
          </h3>
          <button
            onClick={handleYesClick}
            className="mt-2 bg-[#8cc63f] text-white text-lg px-6 py-2 rounded-full shadow hover:bg-[#76b533]"
          >
            Yes, I do!
          </button>
        </>
      ) : (
        <>
          <h4 className="text-lg font-semibold text-gray-800">📸 Upload your finished plate!</h4>
          <p className="text-sm text-gray-600 italic mb-2">
            Your photo might be featured on WellFit Daily! 🎉
          </p>

          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block mx-auto mb-2 text-sm"
          />

          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              className="mx-auto w-48 h-auto rounded shadow-md border"
            />
          )}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`mt-3 px-5 py-2 rounded-full text-white text-base font-semibold ${
              uploading ? 'bg-gray-400' : 'bg-[#003865] hover:bg-[#00264d]'
            }`}
          >
            {uploading ? 'Uploading...' : 'Upload My Plate'}
          </button>

          {message && <p className="mt-2 text-sm">{message}</p>}
        </>
      )}
    </div>
  );
};

export default UploadYourPlate;
