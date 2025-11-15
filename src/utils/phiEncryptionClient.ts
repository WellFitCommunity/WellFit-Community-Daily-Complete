/**
 * PHI Encryption Client
 * HIPAA-compliant client for server-side encryption
 *
 * Replaces client-side encryption with secure Edge Function calls
 * Encryption keys never exposed to browser
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Encrypts PHI data using server-side encryption
 * @param plaintext - Data to encrypt
 * @param patientId - Patient ID for audit logging
 * @returns Encrypted data as base64 string
 */
export async function encryptPHI(
  plaintext: string,
  patientId: string
): Promise<string> {
  try {
    // Get current session for auth
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Authentication required for PHI encryption');
    }

    // Call Edge Function for server-side encryption
    const { data, error } = await supabase.functions.invoke('phi-encrypt', {
      body: {
        data: plaintext,
        patientId: patientId,
        operation: 'encrypt',
      },
    });

    if (error) {
      throw new Error('Failed to encrypt PHI data');
    }

    if (!data.success || !data.result) {
      throw new Error('Encryption operation failed');
    }

    return data.result;
  } catch (error: any) {
    throw new Error(`Failed to encrypt PHI data: ${error.message}`);
  }
}

/**
 * Decrypts PHI data using server-side decryption
 * @param encryptedData - Encrypted data as base64 string
 * @param patientId - Patient ID for audit logging
 * @returns Decrypted plaintext string
 */
export async function decryptPHI(
  encryptedData: string,
  patientId: string
): Promise<string> {
  try {
    // Get current session for auth
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Authentication required for PHI decryption');
    }

    // Call Edge Function for server-side decryption
    const { data, error } = await supabase.functions.invoke('phi-encrypt', {
      body: {
        data: encryptedData,
        patientId: patientId,
        operation: 'decrypt',
      },
    });

    if (error) {
      throw new Error('Failed to decrypt PHI data');
    }

    if (!data.success || !data.result) {
      throw new Error('Decryption operation failed');
    }

    return data.result;
  } catch (error: any) {
    throw new Error(`Failed to decrypt PHI data: ${error.message}`);
  }
}

/**
 * Validates that encryption is working correctly
 * Run this on app startup to verify encryption setup
 */
export async function validateEncryption(): Promise<boolean> {
  try {
    const testData = 'TEST_PHI_DATA_' + Date.now();
    const testPatientId = 'test-patient-id';

    const encrypted = await encryptPHI(testData, testPatientId);
    const decrypted = await decryptPHI(encrypted, testPatientId);

    return decrypted === testData;
  } catch (error) {
    return false;
  }
}
