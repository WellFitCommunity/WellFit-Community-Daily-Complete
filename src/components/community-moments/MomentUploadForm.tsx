/**
 * Community Moments — Upload Form
 *
 * Handles photo selection, emoji picking, title/description/tags input,
 * and submission to Supabase storage + community_moments table.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useRef, lazy, Suspense } from 'react';
import { useBranding } from '../../BrandingContext';
import { createPortal } from 'react-dom';
import { BUCKET, MAX_FILE_MB, QUICK_EMOJIS, PAGE_SIZE, isBrowser } from './types';
import { sanitizeTags, safeFilename, normalizeMomentRows } from './utils';
import type { Moment } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

// @ts-ignore
import { motion } from 'framer-motion';

// @ts-ignore
const EmojiPicker = lazy(() => import('emoji-picker-react'));

interface MomentUploadFormProps {
  supabase: SupabaseClient;
  onUploadComplete: (moments: Moment[]) => void;
  onConfetti: () => void;
  onError: (msg: string) => void;
}

const MomentUploadForm: React.FC<MomentUploadFormProps> = ({
  supabase,
  onUploadComplete,
  onConfetti,
  onError,
}) => {
  const { branding } = useBranding();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('😊');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const selectQuickEmoji = (e: string) => {
    setEmoji(e);
    onConfetti();
  };

  const handleEmojiClick = (emojiObj: { emoji?: string }) => {
    setEmoji(emojiObj?.emoji ?? '');
    setShowEmojiPicker(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUploading(true);

    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      const sessionUserId = freshSession?.user?.id;
      if (!sessionUserId) throw new Error('User not authenticated.');
      if (!selectedFile) throw new Error('Please select a photo to upload.');

      const t = title.trim();
      const d = description.trim();
      if (!t || !d) throw new Error('Title and description are required.');

      const cleanTags = sanitizeTags(tags);
      const now = Date.now();
      const safeName = safeFilename(selectedFile.name);
      const filePath = `${sessionUserId}/${now}_${safeName}`;

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

      const insertBody = {
        user_id: sessionUserId,
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

      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setTitle('');
      setDescription('');
      setEmoji('😊');
      setTags('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      onConfetti();

      if (isBrowser) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      alert('🎉 Your photo has been uploaded! It will appear in the gallery while our team reviews it. Thank you for sharing!');

      // Refresh — include user's own pending photos
      const { data } = await supabase
        .from('community_moments')
        .select(
          'id, user_id, file_url, file_path, title, description, emoji, tags, is_gallery_high, approval_status, created_at, profile:profiles(first_name, last_name)'
        )
        .or(`approval_status.eq.approved,and(approval_status.eq.pending,user_id.eq.${sessionUserId})`)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      onUploadComplete(normalizeMomentRows(data ?? []));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error.';
      setError(msg);
      onError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
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
            className="w-full text-xl p-4 bg-white rounded-xl border-4 border-gray-300 focus:outline-hidden cursor-pointer file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-xl file:font-bold file:text-white file:cursor-pointer"
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
            className="w-full border-4 border-gray-300 rounded-xl p-4 text-2xl focus:outline-hidden"
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
            className="w-full border-4 border-gray-300 rounded-xl p-4 text-2xl focus:outline-hidden"
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
            className="w-full border-4 border-gray-300 rounded-xl p-4 text-2xl focus:outline-hidden"
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
  );
};

export default MomentUploadForm;
