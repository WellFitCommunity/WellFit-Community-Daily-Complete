import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface PhotoGalleryProps {
  /** e.g. "meal" or "community" */
  context: 'meal' | 'community';
  /** required for per-record contexts; ignored for community */
  recordId?: string;
  /** optional: limit number of photos displayed */
  limit?: number;
  /** optional: show grid size controls */
  showGridControls?: boolean;
  /** optional: enable lightbox/modal view */
  enableLightbox?: boolean;
}

type CommunityRow = {
  id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  user_id?: string;
  is_gallery_high?: boolean;
};

type GridSize = 1 | 2 | 3 | 4;

// Loading skeleton component
const PhotoSkeleton: React.FC = () => (
  <div className="bg-gray-200 animate-pulse rounded-sm overflow-hidden">
    <div className="w-full h-64 bg-gray-300"></div>
  </div>
);

// Lightbox modal component
const PhotoLightbox: React.FC<{
  isOpen: boolean;
  photo: { url: string; caption?: string | null; name?: string };
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  showNavigation?: boolean;
}> = ({ isOpen, photo, onClose, onPrevious, onNext, showNavigation }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrevious) onPrevious();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, onPrevious, onNext]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300 z-10"
        aria-label="Close lightbox"
      >
        ✕
      </button>

      {/* Navigation buttons */}
      {showNavigation && onPrevious && (
        <button
          onClick={onPrevious}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-3xl hover:text-gray-300 z-10"
          aria-label="Previous photo"
        >
          ←
        </button>
      )}

      {showNavigation && onNext && (
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-3xl hover:text-gray-300 z-10"
          aria-label="Next photo"
        >
          →
        </button>
      )}

      {/* Photo container */}
      <div className="max-w-full max-h-full flex flex-col items-center">
        <img
          src={photo.url}
          alt={photo.caption || photo.name || 'Photo'}
          className="max-w-full max-h-[80vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        
        {photo.caption && (
          <div className="mt-4 px-4 py-2 bg-black bg-opacity-50 text-white text-center rounded-sm max-w-md">
            <p className="text-sm">{photo.caption}</p>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
        aria-label="Close lightbox"
      />
    </div>
  );
};

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ 
  context, 
  recordId, 
  limit,
  showGridControls = true,
  enableLightbox = true
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>(2);
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    url: string;
    caption?: string | null;
    name?: string;
    index: number;
  } | null>(null);

  // For per-record
  const [urls, setUrls] = useState<{ url: string; name: string }[]>([]);

  // For community
  const [community, setCommunity] = useState<Array<{ 
    id: string; 
    url: string; 
    caption: string | null;
    is_featured?: boolean;
  }>>([]);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (context === 'community') {
        // Pull approved photos (global)
        const { data, error } = await supabase
          .from('community_photos')
          .select('id, storage_path, caption, created_at, is_gallery_high')
          .eq('approved', true)
          .order('is_gallery_high', { ascending: false }) // Featured photos first
          .order('created_at', { ascending: false })
          .limit(limit || 60);

        if (error) throw new Error(error.message);

        const out: Array<{ 
          id: string; 
          url: string; 
          caption: string | null;
          is_featured?: boolean;
        }> = [];

        for (const row of (data || []) as CommunityRow[]) {
          const { data: pub } = supabase.storage.from('community').getPublicUrl(row.storage_path);
          out.push({ 
            id: row.id, 
            url: pub.publicUrl, 
            caption: row.caption,
            is_featured: row.is_gallery_high
          });
        }
        
        setCommunity(out);
        return;
      }

      // Per-record (e.g., meals)
      if (!recordId) {
        throw new Error('Missing recordId for this gallery.');
      }
      
      const bucketName = `${context}-photos`; // e.g. "meal-photos"

      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(recordId, { limit: limit || 100 });
        
      if (error) throw new Error(error.message);

      const files = (data || [])
        .filter(file => file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) // Only image files
        .map((file) => ({
          url: supabase.storage.from(bucketName).getPublicUrl(`${recordId}/${file.name}`).data.publicUrl,
          name: file.name,
        }));

      setUrls(files);
      
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Failed to load photos.';
      setError(text);
      setUrls([]);
      setCommunity([]);
    } finally {
      setLoading(false);
    }
  }, [context, recordId, limit]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const openLightbox = (photo: { url: string; caption?: string | null; name?: string }, index: number) => {
    if (!enableLightbox) return;
    setLightboxPhoto({ ...photo, index });
  };

  const closeLightbox = () => {
    setLightboxPhoto(null);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (!lightboxPhoto) return;
    
    const photos = context === 'community' ? community : urls;
    const currentIndex = lightboxPhoto.index;
    let newIndex: number;
    
    if (direction === 'prev') {
      newIndex = currentIndex === 0 ? photos.length - 1 : currentIndex - 1;
    } else {
      newIndex = currentIndex === photos.length - 1 ? 0 : currentIndex + 1;
    }

    const newPhoto = photos[newIndex];
    if (newPhoto) {
      setLightboxPhoto({
        url: newPhoto.url,
        caption: 'caption' in newPhoto ? newPhoto.caption : undefined,
        name: 'name' in newPhoto ? newPhoto.name : undefined,
        index: newIndex
      });
    }
  };

  const getGridClasses = (size: GridSize): string => {
    const baseClasses = "grid gap-3";
    switch (size) {
      case 1: return `${baseClasses} grid-cols-1`;
      case 2: return `${baseClasses} grid-cols-1 sm:grid-cols-2`;
      case 3: return `${baseClasses} grid-cols-1 sm:grid-cols-2 md:grid-cols-3`;
      case 4: return `${baseClasses} grid-cols-2 sm:grid-cols-3 md:grid-cols-4`;
      default: return `${baseClasses} grid-cols-1 sm:grid-cols-2`;
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    img.style.display = 'none';
    
    // Optionally remove the photo from state to prevent empty spaces
    if (context === 'community') {
      setCommunity(prev => prev.filter(photo => photo.url !== img.src));
    } else {
      setUrls(prev => prev.filter(photo => photo.url !== img.src));
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={getGridClasses(gridSize)}>
        {Array.from({ length: 6 }, (_, i) => (
          <PhotoSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-2">⚠️ {error}</div>
        <button
          onClick={fetchPhotos}
          className="text-blue-600 hover:text-blue-800 underline text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  // Empty state
  const isEmpty = context === 'community' ? !community.length : !urls.length;
  if (isEmpty) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📷</div>
        <p className="text-gray-500 italic mb-2">
          {context === 'community' ? 'No community photos yet.' : 'No photos yet.'}
        </p>
        <p className="text-xs text-gray-400">
          {context === 'community' 
            ? 'Photos will appear here once they\'re approved by administrators.'
            : 'Upload some photos to get started!'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      {showGridControls && (community.length > 0 || urls.length > 0) && (
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Grid:</span>
            <div className="flex space-x-1">
              {([1, 2, 3, 4] as GridSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setGridSize(size)}
                  className={`w-8 h-8 text-xs rounded ${
                    gridSize === size
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                  title={`${size} column${size > 1 ? 's' : ''}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            {context === 'community' ? community.length : urls.length} photo{(context === 'community' ? community.length : urls.length) !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Photo Grid */}
      {context === 'community' ? (
        <div className={getGridClasses(gridSize)}>
          {community.map(({ id, url, caption, is_featured }, index) => (
            <figure 
              key={id} 
              className={`border rounded overflow-hidden transition-transform hover:scale-105 ${
                enableLightbox ? 'cursor-pointer' : ''
              } ${is_featured ? 'ring-2 ring-yellow-400' : ''}`}
              onClick={() => openLightbox({ url, caption }, index)}
            >
              {is_featured && (
                <div className="bg-yellow-400 text-yellow-900 text-xs px-2 py-1 text-center font-medium">
                  ⭐ Featured
                </div>
              )}
              <img
                src={url}
                alt={caption || 'Community photo'}
                className="w-full h-64 object-cover"
                onError={handleImageError}
                loading="lazy"
              />
              {caption && (
                <figcaption className="p-2 text-sm text-gray-700 bg-gray-50">
                  {caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      ) : (
        <div className={getGridClasses(gridSize)}>
          {urls.map(({ url, name }, index) => (
            <div
              key={name}
              className={`rounded overflow-hidden shadow-xs transition-transform hover:scale-105 ${
                enableLightbox ? 'cursor-pointer' : ''
              }`}
              onClick={() => openLightbox({ url, name }, index)}
            >
              <img
                src={url}
                alt={`Uploaded photo: ${name}`}
                className="w-full h-64 object-cover"
                onError={handleImageError}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <PhotoLightbox
          isOpen={true}
          photo={lightboxPhoto}
          onClose={closeLightbox}
          onPrevious={() => navigateLightbox('prev')}
          onNext={() => navigateLightbox('next')}
          showNavigation={(context === 'community' ? community.length : urls.length) > 1}
        />
      )}
    </div>
  );
};

export default PhotoGallery;
