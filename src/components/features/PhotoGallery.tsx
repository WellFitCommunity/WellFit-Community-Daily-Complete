import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface PhotoGalleryProps {
  /** e.g. "meal" or "community" */
  context: 'meal' | 'community';
  /** required for per-record contexts; ignored for community */
  recordId?: string;
}

type CommunityRow = {
  id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
};

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ context, recordId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For per-record
  const [urls, setUrls] = useState<{ url: string; name: string }[]>([]);

  // For community
  const [community, setCommunity] = useState<Array<{ id: string; url: string; caption: string | null }>>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (context === 'community') {
          // Pull approved photos (global)
          const { data, error } = await supabase
            .from('community_photos')
            .select('id, storage_path, caption, created_at')
            .eq('approved', true)
            .order('created_at', { ascending: false })
            .limit(60);

          if (error) throw new Error(error.message);

          const out: Array<{ id: string; url: string; caption: string | null }> = [];
          for (const row of (data || []) as CommunityRow[]) {
            const { data: pub } = supabase.storage.from('community').getPublicUrl(row.storage_path);
            out.push({ id: row.id, url: pub.publicUrl, caption: row.caption });
          }
          if (!mounted) return;
          setCommunity(out);
          setLoading(false);
          return;
        }

        // Per-record (e.g., meals)
        if (!recordId) {
          throw new Error('Missing recordId for this gallery.');
        }
        const bucketName = `${context}-photos`; // e.g. "meal-photos"

        const { data, error } = await supabase.storage.from(bucketName).list(recordId, { limit: 100 });
        if (error) throw new Error(error.message);

        const files = (data || []).map((file) => ({
          url: supabase.storage.from(bucketName).getPublicUrl(`${recordId}/${file.name}`).data.publicUrl,
          name: file.name,
        }));

        if (!mounted) return;
        setUrls(files);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        const text = err instanceof Error ? err.message : 'Failed to load photos.';
        setError(text);
        setUrls([]);
        setCommunity([]);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [context, recordId]);

  if (loading) return <p className="text-gray-500 italic">Loading photos…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  if (context === 'community') {
    if (!community.length) return <p className="text-gray-500 italic">No community photos yet.</p>;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {community.map(({ id, url, caption }) => (
          <figure key={id} className="border rounded overflow-hidden">
            <img
              src={url}
              alt={caption ?? 'Community photo'}
              className="w-full h-64 object-cover"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
            {caption && <figcaption className="p-2 text-sm">{caption}</figcaption>}
          </figure>
        ))}
      </div>
    );
  }

  // per-record gallery
  if (!urls.length) return <p className="text-gray-500 italic">No photos yet.</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {urls.map(({ url, name }) => (
        <img
          key={name}
          src={url}
          alt="Uploaded"
          className="w-full rounded shadow-sm"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ))}
    </div>
  );
};

export default PhotoGallery;

