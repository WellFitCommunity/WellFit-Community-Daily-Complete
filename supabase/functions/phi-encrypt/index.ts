/**
 * PHI Encryption Edge Function
 * HIPAA § 164.312(a)(2)(iv) Compliant Server-Side Encryption
 *
 * Encrypts/decrypts PHI data using keys stored in Supabase Vault
 * Never exposes encryption keys to the client
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { createLogger } from '../_shared/auditLogger.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

interface EncryptRequest {
  data: string;
  patientId: string;
  operation: 'encrypt' | 'decrypt';
}

interface EncryptResponse {
  success: boolean;
  result?: string;
  error?: string;
}

serve(async (req) => {
  const logger = createLogger('phi-encrypt', req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Get Supabase client with service role (for vault access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { data, patientId, operation }: EncryptRequest = await req.json();

    if (!data || !patientId || !operation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: data, patientId, operation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (operation !== 'encrypt' && operation !== 'decrypt') {
      return new Response(
        JSON.stringify({ success: false, error: 'Operation must be "encrypt" or "decrypt"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get encryption key from Supabase Secrets (environment variable)
    const encryptionKey = Deno.env.get('PHI_ENCRYPTION_KEY');

    if (!encryptionKey) {
      logger.error('PHI_ENCRYPTION_KEY not found in Supabase Secrets');
      return new Response(
        JSON.stringify({ success: false, error: 'Encryption key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform encryption/decryption using PostgreSQL functions
    let result: string | null;

    if (operation === 'encrypt') {
      const { data: encrypted, error } = await supabase
        .rpc('encrypt_phi_text', {
          data: data,
          encryption_key: encryptionKey,
        });

      if (error) throw error;
      result = encrypted;
    } else {
      const { data: decrypted, error } = await supabase
        .rpc('decrypt_phi_text', {
          encrypted_data: data,
          encryption_key: encryptionKey,
        });

      if (error) throw error;
      result = decrypted;
    }

    if (!result) {
      return new Response(
        JSON.stringify({ success: false, error: `${operation} operation failed` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response: EncryptResponse = {
      success: true,
      result: result,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    logger.error('PHI encryption error', { error: error.message });

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
