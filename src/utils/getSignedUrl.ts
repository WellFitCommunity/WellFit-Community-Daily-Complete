// src/utils/getSignedUrl.ts
import { supabase } from '../lib/supabaseClient';

/**
 * Generates a signed URL for a specific file in Supabase Storage
 * @param {string} path - Path to the file inside the bucket
 * @param {number} expiresIn - Time in seconds the link will remain valid
 * @returns {Promise<string | null>} - Signed URL or null if error
 */
export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('consent-signatures')
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error('Signed URL generation failed:', error.message);
    return null;
  }

  return data.signedUrl;
}
