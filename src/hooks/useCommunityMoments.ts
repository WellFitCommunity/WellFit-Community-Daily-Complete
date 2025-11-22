/**
 * React Query hooks for Community Moments
 *
 * Provides cached image URL fetching for community moments to prevent
 * redundant Supabase Storage API calls.
 *
 * Performance Impact:
 * - Signed URLs are valid for 1 hour (3600 seconds)
 * - Cache for 50 minutes to stay within TTL
 * - Eliminates repeated API calls for the same image
 *
 * @see src/lib/queryClient.ts for cache configuration
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys, queryClient } from '../lib/queryClient';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'community-moments';
const SIGNED_URL_TTL_SEC = 3600; // 1 hour
const CACHE_TIME_MS = 50 * 60 * 1000; // 50 minutes (stays within 1 hour TTL)

/**
 * Fetch a signed URL for a Supabase Storage file
 * @param client Supabase client
 * @param path File path in storage bucket
 * @returns Signed URL or null if error
 */
async function fetchSignedUrl(
  client: SupabaseClient,
  path: string
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);

  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  return null;
}

/**
 * Hook to get a cached signed URL for a community moment image
 *
 * Usage:
 * ```tsx
 * const { data: imageUrl } = useSignedImageUrl(supabase, moment.file_path);
 * <img src={imageUrl || moment.file_url || fallbackUrl} />
 * ```
 *
 * @param client Supabase client
 * @param filePath Path to the file in storage
 * @returns Query result with signed URL
 */
export function useSignedImageUrl(client: SupabaseClient, filePath?: string | null) {
  return useQuery<string | null>({
    queryKey: [...queryKeys.community.imageUrl(filePath || ''), filePath],
    queryFn: async () => {
      if (!filePath) return null;
      return fetchSignedUrl(client, filePath);
    },
    staleTime: CACHE_TIME_MS,
    gcTime: CACHE_TIME_MS * 2, // Keep in cache for 100 minutes
    enabled: !!filePath, // Only fetch if we have a file path
    retry: 1, // Retry once on failure
  });
}

/**
 * Prefetch signed URLs for multiple images
 * Useful for prefetching images that will be displayed soon
 *
 * @param client Supabase client
 * @param filePaths Array of file paths to prefetch
 */
export function prefetchSignedUrls(
  client: SupabaseClient,
  filePaths: string[]
): Promise<void[]> {
  return Promise.all(
    filePaths.map((path) =>
      queryClient.prefetchQuery({
        queryKey: [...queryKeys.community.imageUrl(path), path],
        queryFn: () => fetchSignedUrl(client, path),
        staleTime: CACHE_TIME_MS,
      })
    )
  );
}
