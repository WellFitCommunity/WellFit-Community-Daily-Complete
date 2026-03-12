/**
 * Community Moments — Utility Functions
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { useState, useEffect } from 'react';
import { isBrowser } from './types';

export function sanitizeTags(input: string): string {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10)
    .join(', ');
}

export function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function useWindowSize() {
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

/**
 * Normalize raw database rows into Moment interface
 */
import type { Moment } from './types';

export function normalizeMomentRows(data: unknown[]): Moment[] {
  return (data as Moment[]).map((r) => ({
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
}
