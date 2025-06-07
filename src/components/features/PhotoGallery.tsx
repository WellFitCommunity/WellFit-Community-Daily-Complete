import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface PhotoGalleryProps {
  recordId: string;  // the meal.id
  context: string;   // e.g. "meal"
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ context, recordId }) => {
  const [urls, setUrls] = useState<{ url: string, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bucketName = `${context}-photos`;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    supabase.storage
      .from(bucketName)
      .list(recordId, { limit: 100 })
      .then(async ({ data, error }: { data: { name: string }[] | null; error: { message: string } | null }) => {
        if (!isMounted) return;

        if (error) {
          setError(`Error loading photos: ${error.message}`);
          setUrls([]);
          setLoading(false);
          return;
        }
        if (!data || data.length === 0) {
          setUrls([]);
          setLoading(false);
          return;
        }

        // For public buckets:
        const filesWithUrls = data.map(file => ({
          url: supabase.storage.from(bucketName).getPublicUrl(`${recordId}/${file.name}`).data.publicUrl,
          name: file.name,
        }));

        setUrls(filesWithUrls);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [bucketName, recordId]);

  if (loading) return <p className="text-gray-500 italic">Loading photos…</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!urls.length) return <p className="text-gray-500 italic">No photos yet.</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {urls.map(({ url, name }) => (
        <img
          key={name}
          src={url}
          alt="Uploaded"
          className="w-full rounded shadow-sm"
          onError={e => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ))}
    </div>
  );
};

export default PhotoGallery;
