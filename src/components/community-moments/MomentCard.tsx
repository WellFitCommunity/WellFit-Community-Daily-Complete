/**
 * Community Moments — Individual Moment Card
 *
 * Displays a single community moment with image, title, description,
 * tags, author info, and admin feature toggle.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React from 'react';
import { useBranding } from '../../BrandingContext';
import { useSignedImageUrl } from '../../hooks/useCommunityMoments';
import AdminFeatureToggle from '../admin/AdminFeatureToggle';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Moment } from './types';

// @ts-ignore
import { motion } from 'framer-motion';

interface MomentCardProps {
  m: Moment;
  featured?: boolean;
  isAdmin: boolean;
  onFeatureChange: (id: string, next: boolean) => void;
  supabase: SupabaseClient;
}

const MomentCard: React.FC<MomentCardProps> = ({ m, featured, isAdmin, onFeatureChange, supabase }) => {
  const { branding } = useBranding();
  // Use cached signed URL hook - prevents redundant Supabase Storage API calls
  const { data: signedUrl } = useSignedImageUrl(supabase, m.file_path);
  const url = signedUrl || m.file_url || null;
  const isPending = m.approval_status === 'pending';

  return (
    <motion.div
      className={`bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center transition-all hover:shadow-2xl ${featured ? 'border-4 border-yellow-400' : isPending ? 'border-2 border-amber-300 opacity-90' : 'border-2 border-gray-200'}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {isPending && (
        <div className="bg-amber-100 text-amber-800 font-bold px-4 py-2 rounded-full mb-3 text-lg flex items-center gap-2 border-2 border-amber-300">
          <span className="text-xl">🕐</span>
          <span>Pending Approval</span>
        </div>
      )}
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
        <div className="w-full max-w-md h-80 bg-linear-to-br from-gray-100 to-gray-200 animate-pulse rounded-xl mb-4 flex items-center justify-center" aria-label="loading image">
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

export default MomentCard;
