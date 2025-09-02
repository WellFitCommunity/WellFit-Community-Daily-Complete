// src/components/CommunityMoments.tsx — SAFE BASELINE (TS no-red)
// Compiles in CRA/Vite. Pagination, safer uploads, signed URLs (file_path), SSR guards.

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import AdminFeatureToggle from './admin/AdminFeatureToggle';

// If your editor complains about typings, keep these ts-ignores OR add src/types/vendor.d.ts per the notes.
// @ts-ignore
import Confetti from 'react-confetti';
// @ts-ignore
import { motion, AnimatePresence } from 'framer-motion';
// @ts-ignore
import EmojiPicker from 'emoji-picker-react';
import { createPortal } from 'react-dom';

const BUCKET = 'community-moments';
const PAGE_SIZE = 12;
const MAX_FILE_MB = 5;
const SIGNED_URL_TTL_SEC = 3600; // 1 hour

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

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

async function getSignedUrlIfPossible(path?: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (!error && data?.signedUrl) return data.signedUrl;
  return null;
}

const CommunityMoments: React.FC = () => {
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

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const { width, height } = useWindowSize();

  // Split util
  const splitFeatured = (rows: Moment[]) => {
    setFeatured(rows.filter((m) => !!m.is_gallery_high));
    setRegular(rows.filter((m) => !m.is_gallery_high));
  };

  // Admin detect
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid) return;
      const { data } = await supabase.rpc('is_admin', { u: uid });
      if (!cancelled) setIsAdmin(Boolean(data));
    })();
    return () => { cancelled = true; };
  }, []);

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
  }, []);

  // Fetch page 1
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      try {
        const { data, error, count } = await supabase
          .from('community_moments')
          .select(
            'id, user_id, file_url, file_path, title, description, emoji, tags, is_gallery_high, created_at, profile:profiles(first_name, last_name)',
            { count: 'exact' }
          )
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
          created_at: r.created_at,
          profile: r.profile,
        }));
        setMoments(normalized);
        splitFeatured(normalized);
        setPage(1);
        setHasMore(((count ?? 0) as number) > normalized.length);
      } catch (e) {
        setError('Failed to load moments.');
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
          'id, user_id, file_url, file_path, title, description, emoji, tags, is_gallery_high, created_at, profile:profiles(first_name, last_name)'
        )
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

  // Parent handler to update UI immediately after toggle
  const handleFeatureChange = (id: string, next: boolean) => {
    const updated = moments.map(mm => (mm.id === id ? { ...mm, is_gallery_high: next } : mm));
    setMoments(updated);
    setFeatured(updated.filter(x => x.is_gallery_high));
    setRegular(updated.filter(x => !x.is_gallery_high));
  };

  // File input validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file.');
        return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`File too large. Max ${MAX_FILE_MB}MB.`);
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  // Emoji selection
  const handleEmojiClick = (emojiObj: any) => {
    setEmoji(emojiObj?.emoji ?? '');
    setShowEmojiPicker(false);
  };

  // Upload handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUploading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user_id = authData?.user?.id;
      if (!user_id) throw new Error('User not authenticated.');
      if (!selectedFile) throw new Error('Please select a photo to upload.');

      const t = title.trim();
      const d = description.trim();
      if (!t || !d) throw new Error('Title and description are required.');

      const cleanTags = sanitizeTags(tags);
      const now = Date.now();
      const safeName = safeFilename(selectedFile.name);
      const filePath = `${user_id}/${now}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: selectedFile.type,
        });

      if (uploadError) throw new Error('File upload failed. Make sure the file is an image and under 5MB.');

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

      const insertBody: any = {
        user_id,
        title: t,
        description: d,
        emoji,
        tags: cleanTags,
        is_gallery_high: false,
        file_path: filePath,
        file_url: publicUrlData?.publicUrl ?? '',
      };

      const { error: insertError } = await supabase
        .from('community_moments')
        .insert([insertBody]);

      if (insertError) throw new Error('Failed to save moment.');

      // Reset form
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setEmoji('');
      setTags('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1500);

      if (isBrowser) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Refresh first page
      setInitialLoading(true);
      const { data } = await supabase
        .from('community_moments')
        .select(
          'id, user_id, file_url, file_path, title, description, emoji, tags, is_gallery_high, created_at, profile:profiles(first_name, last_name)'
        )
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

  const _emojiVariants: any = {
    hidden: { scale: 0, opacity: 0, rotate: -90 },
    visible: { scale: 1.2, opacity: 1, rotate: 0, transition: { type: 'spring', stiffness: 300 } },
    tap: { scale: 1.4 },
  };

  // Moment Card (now accepts admin + callback)
  const MomentCard: React.FC<{
    m: Moment;
    featured?: boolean;
    isAdmin: boolean;
    onFeatureChange: (id: string, next: boolean) => void;
  }> = ({ m, featured, isAdmin, onFeatureChange }) => {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
      let cancelled = false;
      (async () => {
        const s = await getSignedUrlIfPossible(m.file_path);
        if (!cancelled) setUrl(s || m.file_url || null);
      })();
      return () => { cancelled = true; };
    }, [m.id, m.file_path, m.file_url]);

    const tagClass = featured ? 'bg-[#8cc63f] text-white' : 'bg-gray-300 text-[#003865]';
    return (
      <div className={`bg-white rounded-xl shadow p-4 flex flex-col items-center ${featured ? 'border-2 border-[#8cc63f]' : ''}`}>
        {url ? (
          <img
            src={url}
            alt={m.title || 'Community photo'}
            className="w-full max-w-xs rounded mb-2 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full max-w-xs h-56 bg-gray-100 animate-pulse rounded mb-2" aria-label="loading image" />
        )}
        <div className={`text-xl sm:text-2xl ${featured ? 'font-bold' : 'font-semibold'} text-[#003865]`}>
          {m.title} {m.emoji}
        </div>
        <div className="text-base sm:text-lg text-gray-800 text-center">{m.description}</div>
        {m.tags && (
          <div className="flex flex-wrap gap-1 mt-1 justify-center">
            {m.tags.split(',').map((tag) => (
              <span key={tag} className={`${tagClass} px-2 py-0.5 rounded-full text-base`}>
                {tag.trim()}
              </span>
            ))}
          </div>
        )}
        <div className="text-sm text-gray-400 mt-2">
          {m.profile?.first_name} {m.profile?.last_name} • {new Date(m.created_at).toLocaleString()}
        </div>

        {/* Admin Feature/Unfeature button */}
        {isAdmin && (
          <AdminFeatureToggle
            momentId={m.id}
            isFeatured={m.is_gallery_high}
            onChanged={(next) => onFeatureChange(m.id, next)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Confetti */}
      <AnimatePresence>
        {showConfetti && isBrowser && width > 0 && height > 0 && (
          <Confetti width={width} height={height} numberOfPieces={200} recycle={false} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#003865] to-[#8cc63f] p-5 rounded-t-xl shadow flex flex-col items-center mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden>🎉</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow">Community Moments</h1>
          <span className="text-4xl" aria-hidden>📸</span>
        </div>
        {affirmation && (
          <motion.div
            className="bg-[#8cc63f] text-white rounded-xl p-4 shadow mt-3 w-full max-w-xl text-center text-xl md:text-2xl font-semibold"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            aria-live="polite"
          >
            <span className="italic">“{affirmation.text}”</span>
            <div className="text-base font-bold text-white mt-2">— {affirmation.author}</div>
          </motion.div>
        )}
        <button
          className="mt-6 bg-white text-[#003865] font-bold px-6 py-2 rounded-xl shadow hover:bg-[#8cc63f] hover:text-white text-lg transition"
          onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
          aria-label="Share your moment"
        >
          + Share Your Moment
        </button>
      </div>

      {/* Featured */}
      {featured.length > 0 && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-3 text-[#8cc63f] flex items-center gap-2">
            <span className="text-2xl" aria-hidden>⭐</span>{' '}
            Featured Moments
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {featured.map((m) => (
              <MomentCard
                key={m.id}
                m={m}
                featured
                isAdmin={isAdmin}
                onFeatureChange={handleFeatureChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <div ref={formRef} className="mb-8 bg-white rounded-xl p-6 shadow border-2 border-[#003865]">
        <h2 className="text-2xl font-bold text-[#003865] mb-2">Share Your Community Moment</h2>
        <form onSubmit={handleSubmit}>
          <label className="block font-semibold mb-1 text-lg" htmlFor="cm-photo">Photo</label>
          <input
            id="cm-photo"
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="mb-3 text-lg"
            aria-required
          />

          <label className="block font-semibold mb-1 text-lg" htmlFor="cm-title">Title</label>
          <input
            id="cm-title"
            className="w-full border rounded p-2 mb-3 text-lg"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            required
          />

          <label className="block font-semibold mb-1 text-lg" htmlFor="cm-desc">Description</label>
          <textarea
            id="cm-desc"
            className="w-full border rounded p-2 mb-3 text-lg"
            placeholder="Share the story or memory behind this moment..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={240}
            required
          />

          <div className="flex items-center mb-3">
            <label className="font-semibold mr-3 text-lg" htmlFor="cm-emoji">Emoji:</label>
            <motion.button
              id="cm-emoji"
              type="button"
              className="px-3 py-1 border rounded bg-gray-100 text-3xl"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              variants={
                {
                  hidden: { scale: 0, opacity: 0, rotate: -90 },
                  visible: {
                    scale: 1.2,
                    opacity: 1,
                    rotate: 0,
                    transition: { type: 'spring', stiffness: 300 },
                  },
                  tap: { scale: 1.4 },
                } as any
              }
              initial="hidden"
              animate="visible"
              whileTap="tap"
              aria-haspopup="dialog"
              aria-expanded={showEmojiPicker}
              style={{ fontSize: '2rem' }}
            >
              {emoji || '😊'}
            </motion.button>
            {showEmojiPicker && isBrowser &&
              createPortal(
                <div
                  className="z-50 fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border rounded shadow p-2"
                  role="dialog"
                  aria-label="Choose an emoji"
                >
                  {/* onEmojiClick type varies by version; using any */}
                  {/* @ts-ignore */}
                  <EmojiPicker onEmojiClick={handleEmojiClick} searchDisabled height={350} width={320} />
                </div>,
                document.body
              )}
            <span className="text-gray-600 text-base ml-3">Tap to choose an emoji</span>
          </div>

          <label className="block font-semibold mb-1 text-lg" htmlFor="cm-tags">
            Tags <span className="text-gray-400 text-sm">(comma separated)</span>
          </label>
          <input
            id="cm-tags"
            className="w-full border rounded p-2 mb-3 text-lg"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="fun, family, sunday, event"
            maxLength={60}
          />

          <button
            type="submit"
            disabled={uploading}
            className="bg-[#003865] hover:bg-[#8cc63f] disabled:opacity-60 text-white px-6 py-2 rounded-xl font-bold w-full text-xl transition"
          >
            {uploading ? 'Uploading…' : 'Share Moment'}
          </button>
          {error && (
            <p className="text-red-600 text-lg mt-2" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>

      {/* All Moments */}
      <h2 className="text-2xl font-bold mb-3 text-[#003865]">All Community Moments</h2>
      {initialLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-4">
              <div className="w-full h-56 bg-gray-100 animate-pulse rounded mb-2" />
              <div className="h-6 bg-gray-100 animate-pulse rounded mb-2" />
              <div className="h-4 bg-gray-100 animate-pulse rounded mb-1" />
              <div className="h-4 bg-gray-100 animate-pulse rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {regular.map((m) => (
              <MomentCard
                key={m.id}
                m={m}
                isAdmin={isAdmin}
                onFeatureChange={handleFeatureChange}
              />
            ))}
            {regular.length === 0 && (
              <div className="text-gray-400 text-center text-xl py-8 col-span-full">
                No moments shared yet.
              </div>
            )}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="bg-white border border-[#003865] text-[#003865] hover:bg-[#8cc63f] hover:text-white font-semibold px-6 py-2 rounded-xl shadow-sm transition"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CommunityMoments;

