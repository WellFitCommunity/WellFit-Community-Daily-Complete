// src/utils/getSignedUrl.ts
import { supabase } from '../lib/supabaseClient';

/**
 * Generates a signed URL for a specific file in Supabase Storage
 * @param path - Path to the file inside the bucket
 * @param expiresIn - Time in seconds the link will remain valid (default: 3600 = 1h)
 * @returns A signed URL string, or null if an error occurred
 */
export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('consent-signatures')
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error('Signed URL generation failed:', error.message);
    return null;
  }

  if (!data || !data.signedUrl) {
    console.error('No signed URL returned for path:', path);
    return null;
  }

  return data.signedUrl;
}
