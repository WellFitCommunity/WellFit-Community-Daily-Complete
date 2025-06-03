import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface PhotoGalleryProps {
  recordId: string;  // the meal.id
  context: string;   // e.g. "meal"
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ context, recordId }) => {
  const [urls, setUrls] = useState<string[]>([]);
  const bucketName = `${context}-photos`;

  useEffect(() => {
    supabase.storage
      .from(bucketName)
      .list(recordId, { limit: 100 })
      .then(({ data, error }) => {
        if (error) {
          console.error('List error:', error.message);
          return;
        }
        if (data) {
          const publicUrls = data.map(file =>
            supabase.storage.from(bucketName).getPublicUrl(`${recordId}/${file.name}`).data.publicUrl
          );
          setUrls(publicUrls);
        }
      });
  }, [bucketName, recordId]);

  if (!urls.length) {
    return <p className="text-gray-500 italic">No photos yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {urls.map(url => (
        <img key={url} src={url} alt="Uploaded" className="w-full rounded shadow-sm" />
      ))}
    </div>
  );
};

export default PhotoGallery;
