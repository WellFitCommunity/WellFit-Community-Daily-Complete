/**
 * Community Moments — Main Orchestrator
 *
 * Senior-friendly photo gallery with daily affirmations, emoji reactions,
 * and community engagement. Composes MomentsHeader, MomentUploadForm,
 * and MomentCard sub-components.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useSupabaseClient, useSession, useUser } from '../../contexts/AuthContext';
import { useBranding } from '../../BrandingContext';
import MomentsHeader from './MomentsHeader';
import MomentUploadForm from './MomentUploadForm';
import MomentCard from './MomentCard';
import { normalizeMomentRows, useWindowSize } from './utils';
import { PAGE_SIZE, isBrowser } from './types';
import type { Affirmation, Moment } from './types';

// @ts-ignore
import { AnimatePresence } from 'framer-motion';

// @ts-ignore
const Confetti = lazy(() => import('react-confetti'));

const MOMENTS_SELECT = 'id, user_id, file_url, file_path, title, description, emoji, tags, is_gallery_high, approval_status, created_at, profile:profiles(first_name, last_name)';

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
  const [error, setError] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [userFirstName, setUserFirstName] = useState('');

  const formRef = useRef<HTMLDivElement>(null);
  const { width, height } = useWindowSize();

  const splitFeatured = (rows: Moment[]) => {
    setFeatured(rows.filter((m) => !!m.is_gallery_high));
    setRegular(rows.filter((m) => !m.is_gallery_high));
  };

  const buildOrFilter = (uid: string | null) =>
    `approval_status.eq.approved${uid ? `,and(approval_status.eq.pending,user_id.eq.${uid})` : ''}`;

  // Fetch user first name
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
      } catch (err: unknown) {
        // no-op
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, userId]);

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

  // Load pending count (admin only)
  useEffect(() => {
    let cancelled = false;
    if (!isAdmin) return;
    const loadPendingCount = async () => {
      try {
        const { data, error } = await supabase.rpc('get_pending_photo_count');
        if (!cancelled && !error) setPendingCount(data || 0);
      } catch (err: unknown) {
        // no-op
      }
    };
    loadPendingCount();
    const interval = setInterval(loadPendingCount, 30000);
    return () => { cancelled = true; clearInterval(interval); };
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
        setAffirmation(data[day % data.length] as Affirmation);
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
          .select(MOMENTS_SELECT, { count: 'exact' })
          .or(buildOrFilter(userId))
          .order('created_at', { ascending: false })
          .range(0, PAGE_SIZE - 1);

        if (error) throw error;
        if (cancelled) return;
        const normalized = normalizeMomentRows(data ?? []);
        setMoments(normalized);
        splitFeatured(normalized);
        setPage(1);
        setHasMore(((count ?? 0) as number) > normalized.length);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load moments. Please refresh the page.');
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, userId]);

  // Load more
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from('community_moments')
        .select(MOMENTS_SELECT)
        .or(buildOrFilter(userId))
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const normalized = normalizeMomentRows(data ?? []);
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

  const handleUploadComplete = (freshMoments: Moment[]) => {
    setMoments(freshMoments);
    splitFeatured(freshMoments);
    setPage(1);
    setHasMore(freshMoments.length === PAGE_SIZE);
    setError('');
    setInitialLoading(false);
  };

  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-12">
      {/* Confetti */}
      <AnimatePresence>
        {showConfetti && isBrowser && width > 0 && height > 0 && (
          <Suspense fallback={null}>
            <Confetti width={width} height={height} numberOfPieces={300} recycle={false} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Header */}
      <MomentsHeader
        userFirstName={userFirstName}
        affirmation={affirmation}
        isAdmin={isAdmin}
        pendingCount={pendingCount}
        onShareClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      {/* Featured Moments */}
      {featured.length > 0 && (
        <div className="mb-10">
          <h2 className="text-4xl font-bold mb-6 flex items-center gap-3" style={{ color: branding.primaryColor }}>
            <span className="text-5xl" aria-hidden>⭐</span>
            Featured Community Moments
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {featured.map((m) => (
              <MomentCard key={m.id} m={m} featured isAdmin={isAdmin} onFeatureChange={handleFeatureChange} supabase={supabase} />
            ))}
          </div>
        </div>
      )}

      {/* Upload Form */}
      <div ref={formRef}>
        <MomentUploadForm
          supabase={supabase}
          onUploadComplete={handleUploadComplete}
          onConfetti={triggerConfetti}
          onError={setError}
        />
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
              <div className="w-full h-80 bg-linear-to-br from-gray-100 to-gray-200 animate-pulse rounded-xl mb-4" />
              <div className="h-8 bg-gray-200 animate-pulse rounded-xl mb-3" />
              <div className="h-6 bg-gray-200 animate-pulse rounded-xl mb-2" />
              <div className="h-6 bg-gray-200 animate-pulse rounded-xl w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {error && (
            <div className="bg-red-100 border-4 border-red-400 text-red-800 p-5 rounded-2xl text-xl font-semibold mb-6" role="alert">
              ⚠️ {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2" role="feed" aria-label="Community moments gallery">
            {regular.map((m) => (
              <MomentCard key={m.id} m={m} isAdmin={isAdmin} onFeatureChange={handleFeatureChange} supabase={supabase} />
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
