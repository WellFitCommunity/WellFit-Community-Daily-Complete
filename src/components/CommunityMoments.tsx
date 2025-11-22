// src/components/CommunityMoments.tsx — SENIOR-FRIENDLY UX REDESIGN
// Larger text, bigger buttons, easier emoji selection, warm and encouraging!

import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useSupabaseClient, useSession, useUser } from '../contexts/AuthContext';
import AdminFeatureToggle from './admin/AdminFeatureToggle';
import { useBranding } from '../BrandingContext';
import { useSignedImageUrl } from '../hooks/useCommunityMoments';

// @ts-ignore
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

// Lazy load heavy components that are only used conditionally
// @ts-ignore
const Confetti = lazy(() => import('react-confetti'));
// @ts-ignore
const EmojiPicker = lazy(() => import('emoji-picker-react'));

const BUCKET = 'community-moments';
const PAGE_SIZE = 12;
const MAX_FILE_MB = 20;

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

// Popular emojis for seniors - easy to see and relatable
const QUICK_EMOJIS = ['😊', '❤️', '🎉', '👍', '🌸', '☀️', '🎂', '🏆', '📸', '🌈', '⭐', '🎵'];

interface Affirmation {
  text: string;
  author: string;
}

interface Profile {
  first_name?: string;
  last_name?: string;
}

interface Moment {
  id: string;
  user_id: string;
  file_url?: string;
  file_path?: string;
  title: string;
  description: string;
  emoji: string;
  tags: string;
  is_gallery_high: boolean;
  approval_status?: string;
  created_at: string;
  profile?: Profile;
}

function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!isBrowser) return;
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

function sanitizeTags(input: string): string {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10)
    .join(', ');
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

const CommunityMoments: React.FC = () => {
  const supabase = useSupabaseClient();
  const session = useSession();
  const user = useUser();
  const userId = user?.id ?? session?.user?.id ?? null;
  const { branding } = useBranding();

  // Data state
  const [affirmation, setAffirmation] = useState<Affirmation | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [featured, setFeatured] = useState<Moment[]>([]);
  const [regular, setRegular] = useState<Moment[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('😊');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const { width, height } = useWindowSize();

  // Get user's first name for personalized greeting
  const [userFirstName, setUserFirstName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('user_id', userId)
          .single();
        if (!cancelled && data?.first_name) {
          setUserFirstName(data.first_name);
        }
      } catch (err) {

      }
    })();
    return () => { cancelled = true; };
  }, [supabase, userId]);

  const splitFeatured = (rows: Moment[]) => {
    setFeatured(rows.filter((m) => !!m.is_gallery_high));
    setRegular(rows.filter((m) => !m.is_gallery_high));
  };

  // Admin detect
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    (async () => {
      try {
        const { data } = await supabase.rpc('is_admin', { u: userId });
        if (!cancelled) setIsAdmin(Boolean(data));
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, userId]);

  // Load pending count
  useEffect(() => {
    let cancelled = false;
    if (!isAdmin) return;

    const loadPendingCount = async () => {
      try {
        const { data, error } = await supabase.rpc('get_pending_photo_count');
        if (!cancelled && !error) {
          setPendingCount(data || 0);
        }
      } catch (err) {

      }
    };

    loadPendingCount();
    const interval = setInterval(loadPendingCount, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [supabase, isAdmin]);

  // Affirmations
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('affirmations')
          .select('text, author')
          .order('id', { ascending: true });
        if (cancelled || !data || data.length === 0) return;
        const day = new Date().getDate();
        const index = day % data.length;
        setAffirmation(data[index] as Affirmation);
      } catch {
        // no-op
      }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  // Fetch page 1
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      try {
        const { data, error, count } = await supabase
          .from('community_moments')
          .select(
            'id, user_id, file_url, file_path, title, description, emoji, tags, is_gallery_high, approval_status, created_at, profile:profiles(first_name, last_name)',
            { count: 'exact' }
          )
          .eq('approval_status', 'approved')
          .order('created_at', { ascending: false })
          .range(0, PAGE_SIZE - 1);

        if (error) throw error;
        if (cancelled) return;
        const rows = (data ?? []) as any[];
        const normalized: Moment[] = rows.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          file_url: r.file_url,
          file_path: r.file_path,
          title: r.title,
          description: r.description,
          emoji: r.emoji,
          tags: r.tags,
          is_gallery_high: !!r.is_gallery_high,
          approval_status: r.approval_status,
          created_at: r.created_at,
          profile: r.profile,
        }));
        setMoments(normalized);
        splitFeatured(normalized);
        setPage(1);
        setHasMore(((count ?? 0) as number) > normalized.length);
      } catch (e) {

        setError(e instanceof Error ? e.message : 'Failed to load moments. Please refresh the page.');
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  // Load more
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('community_moments')
        .select(
          'id, user_id, file_url, file_path, title, description, emoji, tags, is_gallery_high, approval_status, created_at, profile:profiles(first_name, last_name)'
        )
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const normalized: Moment[] = rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        file_url: r.file_url,
        file_path: r.file_path,
        title: r.title,
        description: r.description,
        emoji: r.emoji,
        tags: r.tags,
        is_gallery_high: !!r.is_gallery_high,
        approval_status: r.approval_status,
        created_at: r.created_at,
        profile: r.profile,
      }));
      const next = [...moments, ...normalized];
      setMoments(next);
      splitFeatured(next);
      setPage((p) => p + 1);
      setHasMore(normalized.length === PAGE_SIZE);
    } catch {
      setError('Could not load more.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFeatureChange = (id: string, next: boolean) => {
    const updated = moments.map((mm) => (mm.id === id ? { ...mm, is_gallery_high: next } : mm));
    setMoments(updated);
    setFeatured(updated.filter((x) => x.is_gallery_high));
    setRegular(updated.filter((x) => !x.is_gallery_high));
  };

  // File input with preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file (JPG, PNG, etc.)');
        return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`File too large. Maximum size is ${MAX_FILE_MB}MB.`);
        return;
      }
      setSelectedFile(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Quick emoji selection with celebration!
  const selectQuickEmoji = (e: string) => {
    setEmoji(e);
    // Mini confetti burst when selecting emoji
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 800);
  };

  const handleEmojiClick = (emojiObj: any) => {
    setEmoji(emojiObj?.emoji ?? '');
    setShowEmojiPicker(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUploading(true);

    try {
      if (!userId) throw new Error('User not authenticated.');
      if (!selectedFile) throw new Error('Please select a photo to upload.');

      const t = title.trim();
      const d = description.trim();
      if (!t || !d) throw new Error('Title and description are required.');

      const cleanTags = sanitizeTags(tags);
      const now = Date.now();
      const safeName = safeFilename(selectedFile.name);
      const filePath = `${userId}/${now}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: selectedFile.type,
        });

      if (uploadError) {

        throw new Error(`File upload failed: ${uploadError.message || 'Please try a different photo.'}`);
      }

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

      const insertBody: any = {
        user_id: userId,
        title: t,
        description: d,
        emoji,
        tags: cleanTags,
        is_gallery_high: false,
        approval_status: 'pending',
        file_path: filePath,
        file_url: publicUrlData?.publicUrl ?? '',
      };

      const { error: insertError } = await supabase.from('community_moments').insert([insertBody]);
      if (insertError) {

        throw new Error(`Failed to save moment: ${insertError.message || 'Unknown error'}`);
      }

      // Success!
      setSelectedFile(null);
      setPreviewUrl(null);
      setTitle('');
      setDescription('');
      setEmoji('😊');
      setTags('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);

      if (isBrowser) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Show success message
      alert('🎉 Your photo has been uploaded! Our team will review it and it will appear here soon. Thank you for sharing!');

      // Refresh
      setInitialLoading(true);
      const { data } = await supabase
        .from('community_moments')
        .select(
          'id, user_id, file_url, file_path, title, description, emoji, tags, is_gallery_high, approval_status, created_at, profile:profiles(first_name, last_name)'
        )
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      const rows = (data ?? []) as any[];
      const normalized: Moment[] = rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        file_url: r.file_url,
        file_path: r.file_path,
        title: r.title,
        description: r.description,
        emoji: r.emoji,
        tags: r.tags,
        is_gallery_high: !!r.is_gallery_high,
        approval_status: r.approval_status,
        created_at: r.created_at,
        profile: r.profile,
      }));
      setMoments(normalized);
      splitFeatured(normalized);
      setPage(1);
      setHasMore(normalized.length === PAGE_SIZE);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Unexpected error.');
    } finally {
      setUploading(false);
      setInitialLoading(false);
    }
  };

  const MomentCard: React.FC<{
    m: Moment;
    featured?: boolean;
    isAdmin: boolean;
    onFeatureChange: (id: string, next: boolean) => void;
  }> = ({ m, featured, isAdmin, onFeatureChange }) => {
    // Use cached signed URL hook - prevents redundant Supabase Storage API calls
    const { data: signedUrl } = useSignedImageUrl(supabase, m.file_path);
    const url = signedUrl || m.file_url || null;

    return (
      <motion.div
        className={`bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center transition-all hover:shadow-2xl ${featured ? 'border-4 border-yellow-400' : 'border-2 border-gray-200'}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {featured && (
          <div className="bg-yellow-400 text-gray-900 font-bold px-4 py-2 rounded-full mb-3 text-xl flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            <span>Featured</span>
          </div>
        )}

        {url ? (
          <img
            src={url}
            alt={m.title || 'Community photo'}
            className="w-full max-w-md rounded-xl mb-4 object-cover shadow-lg"
            style={{ maxHeight: '400px' }}
            loading="lazy"
          />
        ) : (
          <div className="w-full max-w-md h-80 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse rounded-xl mb-4 flex items-center justify-center" aria-label="loading image">
            <span className="text-6xl">📸</span>
          </div>
        )}

        <div className="text-3xl font-bold text-center mb-2" style={{ color: branding.primaryColor }}>
          <span className="text-4xl mr-2">{m.emoji}</span>
          {m.title}
        </div>

        <div className="text-xl text-gray-700 text-center mb-3 leading-relaxed">{m.description}</div>

        {m.tags && (
          <div className="flex flex-wrap gap-2 mb-3 justify-center">
            {m.tags.split(',').map((tag) => (
              <span
                key={tag}
                className={`${featured ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-400' : 'bg-blue-100 text-blue-800 border-2 border-blue-300'} px-4 py-2 rounded-full text-lg font-semibold`}
              >
                #{tag.trim()}
              </span>
            ))}
          </div>
        )}

        <div className="text-lg text-gray-500 mt-2 flex items-center gap-2">
          <span className="text-2xl">👤</span>
          <span className="font-semibold">
            {m.profile?.first_name} {m.profile?.last_name}
          </span>
          <span className="mx-2">•</span>
          <span>{new Date(m.created_at).toLocaleDateString()}</span>
        </div>

        {isAdmin && (
          <div className="mt-4">
            <AdminFeatureToggle
              momentId={m.id}
              isFeatured={m.is_gallery_high}
              onChanged={(next) => onFeatureChange(m.id, next)}
            />
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-12">
      {/* Confetti - Lazy loaded */}
      <AnimatePresence>
        {showConfetti && isBrowser && width > 0 && height > 0 && (
          <Suspense fallback={null}>
            <Confetti width={width} height={height} numberOfPieces={300} recycle={false} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Header - Warm and Inviting */}
      <div
        className="p-8 rounded-3xl shadow-2xl flex flex-col items-center mb-8"
        style={{
          background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor || '#8cc63f'})`
        }}
      >
        {/* Personalized Greeting */}
        {userFirstName && (
          <motion.div
            className="bg-white/30 backdrop-blur-sm px-8 py-4 rounded-2xl mb-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center drop-shadow-lg">
              {(() => {
                const hour = new Date().getHours();
                if (hour < 12) return `Good morning, ${userFirstName}! ☀️`;
                if (hour < 17) return `Good afternoon, ${userFirstName}! 🌤️`;
                return `Good evening, ${userFirstName}! 🌙`;
              })()}
            </h2>
          </motion.div>
        )}

        <motion.div
          className="flex items-center gap-4 mb-4"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-6xl" aria-hidden>🎉</span>
          <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-lg">Community Moments</h1>
          <span className="text-6xl" aria-hidden>📸</span>
        </motion.div>

        <p className="text-2xl text-white text-center mb-6 font-medium">
          Share your memories, celebrate together!
        </p>

        {affirmation && (
          <motion.div
            className="bg-white/20 backdrop-blur-sm text-white rounded-2xl p-6 shadow-xl mb-6 w-full max-w-2xl text-center border-2 border-white/30"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            aria-live="polite"
          >
            <span className="text-3xl md:text-4xl font-semibold italic block mb-3">
              "{affirmation.text}"
            </span>
            <div className="text-xl font-bold">— {affirmation.author}</div>
          </motion.div>
        )}

        <button
          className="bg-white font-bold px-10 py-5 rounded-2xl shadow-xl hover:scale-105 text-2xl transition-all duration-200 hover:shadow-2xl"
          style={{ color: branding.primaryColor }}
          onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
          aria-label="Share your moment"
        >
          <span className="text-3xl mr-2">📷</span>
          Share Your Moment
        </button>

        {isAdmin && pendingCount > 0 && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-6 bg-yellow-400 text-gray-900 rounded-2xl p-5 shadow-lg w-full max-w-2xl text-center border-4 border-yellow-500"
          >
            <div className="flex items-center justify-center gap-3 font-bold text-2xl">
              <span className="text-3xl">📸</span>
              <span>{pendingCount} photo{pendingCount > 1 ? 's' : ''} awaiting approval</span>
            </div>
            <a
              href="/admin"
              className="mt-3 inline-block text-lg underline hover:text-blue-800 font-semibold"
            >
              View in Admin Panel
            </a>
          </motion.div>
        )}
      </div>

      {/* Featured Moments */}
      {featured.length > 0 && (
        <div className="mb-10">
          <h2 className="text-4xl font-bold mb-6 flex items-center gap-3" style={{ color: branding.primaryColor }}>
            <span className="text-5xl" aria-hidden>⭐</span>
            Featured Community Moments
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {featured.map((m) => (
              <MomentCard key={m.id} m={m} featured isAdmin={isAdmin} onFeatureChange={handleFeatureChange} />
            ))}
          </div>
        </div>
      )}

      {/* Upload Form - BIG and CLEAR */}
      <div
        ref={formRef}
        className="mb-10 rounded-3xl p-8 shadow-2xl border-4"
        style={{
          borderColor: branding.primaryColor,
          background: `linear-gradient(to bottom right, ${branding.primaryColor}10, ${branding.secondaryColor}10)`
        }}
      >
        <h2
          className="text-4xl font-bold mb-2 flex items-center gap-3"
          style={{ color: branding.primaryColor }}
        >
          <span className="text-5xl">✨</span>
          Share Your Community Moment
        </h2>
        <p className="text-xl text-gray-600 mb-6">Upload a photo and tell us your story!</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo Upload */}
          <div>
            <label className="block font-bold mb-3 text-2xl" htmlFor="cm-photo" style={{ color: branding.primaryColor }}>
              📷 Choose a Photo
            </label>
            <style>{`
              #cm-photo::file-selector-button {
                background: ${branding.primaryColor};
                color: white;
              }
              #cm-photo::file-selector-button:hover {
                background: ${branding.secondaryColor};
              }
            `}</style>
            <input
              id="cm-photo"
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="w-full text-xl p-4 bg-white rounded-xl border-4 border-gray-300 focus:outline-none cursor-pointer file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-xl file:font-bold file:text-white file:cursor-pointer"
              onFocus={(e) => e.currentTarget.style.borderColor = branding.secondaryColor}
              onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
              aria-required
            />
            {previewUrl && (
              <motion.div
                className="mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p className="text-lg font-semibold text-green-600 mb-2">✓ Photo selected! Preview:</p>
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-md rounded-xl shadow-lg border-4 border-green-400"
                />
              </motion.div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block font-bold mb-3 text-2xl" htmlFor="cm-title" style={{ color: branding.primaryColor }}>
              ✏️ Give it a Title
            </label>
            <input
              id="cm-title"
              className="w-full border-4 border-gray-300 rounded-xl p-4 text-2xl focus:outline-none"
              onFocus={(e) => e.currentTarget.style.borderColor = branding.secondaryColor}
              onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Example: Sunday Family Picnic"
              maxLength={50}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold mb-3 text-2xl" htmlFor="cm-desc" style={{ color: branding.primaryColor }}>
              💬 Tell Your Story
            </label>
            <textarea
              id="cm-desc"
              className="w-full border-4 border-gray-300 rounded-xl p-4 text-2xl focus:outline-none"
              onFocus={(e) => e.currentTarget.style.borderColor = branding.secondaryColor}
              onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
              placeholder="Share the memory behind this photo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={240}
              required
            />
          </div>

          {/* Emoji - LARGE and EASY */}
          <div>
            <label className="block font-bold mb-3 text-2xl" style={{ color: branding.primaryColor }}>
              😊 Pick an Emoji (Optional)
            </label>
            <div className="flex flex-wrap gap-3 mb-4">
              {QUICK_EMOJIS.map((e) => (
                <motion.button
                  key={e}
                  type="button"
                  onClick={() => selectQuickEmoji(e)}
                  className={`text-6xl p-4 rounded-2xl transition-all ${emoji === e ? 'shadow-2xl scale-110' : 'bg-white shadow-lg'}`}
                  style={{
                    backgroundColor: emoji === e ? branding.secondaryColor : 'white'
                  }}
                  whileHover={{ scale: 1.15, rotate: [0, -5, 5, -5, 0] }}
                  whileTap={{ scale: 1.2, rotate: 15 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  aria-label={`Select ${e} emoji`}
                >
                  {e}
                </motion.button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-xl font-semibold underline"
              style={{ color: branding.primaryColor }}
              onMouseEnter={(e) => e.currentTarget.style.color = branding.secondaryColor}
              onMouseLeave={(e) => e.currentTarget.style.color = branding.primaryColor}
            >
              Or browse more emojis...
            </button>

            {showEmojiPicker && isBrowser && createPortal(
              <div
                className="z-50 fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-4 rounded-2xl shadow-2xl p-4"
                style={{ borderColor: branding.primaryColor }}
                role="dialog"
                aria-label="Choose an emoji"
              >
                <button
                  onClick={() => setShowEmojiPicker(false)}
                  className="absolute top-2 right-2 text-3xl font-bold text-gray-600 hover:text-red-600 px-3"
                  aria-label="Close emoji picker"
                >
                  ✕
                </button>
                {/* Lazy loaded EmojiPicker */}
                <Suspense fallback={<div className="text-center p-8 text-gray-600">Loading emoji picker...</div>}>
                  {/* @ts-ignore */}
                  <EmojiPicker onEmojiClick={handleEmojiClick} searchDisabled={false} height={450} width={400} />
                </Suspense>
              </div>,
              document.body
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block font-bold mb-3 text-2xl" htmlFor="cm-tags" style={{ color: branding.primaryColor }}>
              🏷️ Add Tags (Optional)
            </label>
            <input
              id="cm-tags"
              className="w-full border-4 border-gray-300 rounded-xl p-4 text-2xl focus:outline-none"
              onFocus={(e) => e.currentTarget.style.borderColor = branding.secondaryColor}
              onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="family, fun, celebration"
              maxLength={60}
            />
          </div>

          {/* Submit Button - HUGE */}
          <button
            type="submit"
            disabled={uploading}
            aria-label={uploading ? "Uploading your moment, please wait" : "Share your moment"}
            aria-disabled={uploading}
            className="disabled:opacity-60 disabled:cursor-not-allowed text-white px-12 py-6 rounded-2xl font-bold w-full text-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105"
            style={{
              background: uploading ? '#999' : `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor || '#8cc63f'})`
            }}
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="animate-spin text-4xl">⏳</span>
                Uploading Your Moment...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-3">
                <span className="text-4xl">🚀</span>
                Share My Moment!
              </span>
            )}
          </button>

          {error && (
            <div className="bg-red-100 border-4 border-red-400 text-red-800 p-5 rounded-2xl text-xl font-semibold" role="alert">
              ⚠️ {error}
            </div>
          )}
        </form>
      </div>

      {/* All Moments Gallery */}
      <h2
        className="text-4xl font-bold mb-6 flex items-center gap-3"
        style={{ color: branding.primaryColor }}
      >
        <span className="text-5xl" aria-hidden="true">🖼️</span>
        All Community Moments
      </h2>

      {initialLoading ? (
        <div className="grid gap-6 md:grid-cols-2" role="status" aria-label="Loading community moments">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-xl p-6" aria-hidden="true">
              <div className="w-full h-80 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse rounded-xl mb-4" />
              <div className="h-8 bg-gray-200 animate-pulse rounded-xl mb-3" />
              <div className="h-6 bg-gray-200 animate-pulse rounded-xl mb-2" />
              <div className="h-6 bg-gray-200 animate-pulse rounded-xl w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2" role="feed" aria-label="Community moments gallery">
            {regular.map((m) => (
              <MomentCard key={m.id} m={m} isAdmin={isAdmin} onFeatureChange={handleFeatureChange} />
            ))}
            {regular.length === 0 && (
              <div className="text-gray-400 text-center text-2xl py-12 col-span-full bg-white rounded-2xl shadow-lg">
                <p className="text-6xl mb-4">📸</p>
                <p className="font-semibold">No moments shared yet.</p>
                <p className="text-xl mt-2">Be the first to share!</p>
              </div>
            )}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                aria-label={loadingMore ? "Loading more moments" : "Load more moments"}
                aria-disabled={loadingMore}
                className="bg-white border-4 font-bold px-10 py-5 rounded-2xl shadow-xl text-2xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed hover:text-white"
                style={{
                  borderColor: branding.primaryColor,
                  color: branding.primaryColor
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = branding.secondaryColor;
                  e.currentTarget.style.borderColor = branding.secondaryColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = branding.primaryColor;
                }}
              >
                {loadingMore ? (
                  <span className="flex items-center gap-3">
                    <span className="animate-spin">⏳</span>
                    Loading...
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <span>👇</span>
                    Load More Moments
                  </span>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CommunityMoments;
