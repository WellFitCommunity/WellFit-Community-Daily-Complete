// src/utils/getSignedUrl.ts
import { supabase } from '../lib/supabaseClient';

interface CachedSignedUrl {
  url: string;
  expiresAt: number;
}

// In-memory cache for signed URLs
const urlCache = new Map<string, CachedSignedUrl>();

// Cache duration buffer (renew 5 minutes before actual expiry)
const CACHE_BUFFER_SECONDS = 300;

/**
 * Generates a signed URL for a specific file in Supabase Storage with caching
 * @param path - Path to the file inside the bucket
 * @param expiresIn - Time in seconds the link will remain valid (default: 3600 = 1h)
 * @param bucket - Storage bucket name (default: 'consent-signatures')
 * @returns A signed URL string, or null if an error occurred
 */
export async function getSignedUrl(
  path: string,
  expiresIn = 3600,
  bucket = 'consent-signatures'
): Promise<string | null> {
  const cacheKey = `${bucket}:${path}`;
  const now = Date.now();

  // Check cache first
  const cached = urlCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  // Generate new signed URL
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error('Signed URL generation failed:', error.message);
    return null;
  }

  if (!data || !data.signedUrl) {
    console.error('No signed URL returned for path:', path);
    return null;
  }

  // Cache the URL (subtract buffer to ensure fresh URLs)
  const expiresAt = now + (expiresIn - CACHE_BUFFER_SECONDS) * 1000;
  urlCache.set(cacheKey, {
    url: data.signedUrl,
    expiresAt
  });

  return data.signedUrl;
}

/**
 * Clears the signed URL cache for a specific path or all paths
 * @param path - Optional specific path to clear from cache
 * @param bucket - Optional bucket name
 */
export function clearSignedUrlCache(path?: string, bucket?: string): void {
  if (path && bucket) {
    urlCache.delete(`${bucket}:${path}`);
  } else if (path) {
    // Clear all entries for this path across all buckets
    for (const key of urlCache.keys()) {
      if (key.endsWith(`:${path}`)) {
        urlCache.delete(key);
      }
    }
  } else {
    // Clear entire cache
    urlCache.clear();
  }
}
