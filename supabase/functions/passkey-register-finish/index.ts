// supabase/functions/passkey-register-finish/index.ts
import { SUPABASE_URL as IMPORTED_SUPABASE_URL, SB_SECRET_KEY as IMPORTED_SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.28.0";
import { verifyRegistrationResponse } from "https://deno.land/x/simplewebauthn@v10.0.1/deno/server.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = IMPORTED_SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? IMPORTED_SB_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Missing SUPABASE_URL or SB_SECRET_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

/** Convert Uint8Array to base64url string for storage */
function uint8ArrayToBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

serve(async (req: Request) => {
  const logger = createLogger('passkey-register-finish', req);
  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method === "OPTIONS") return handleOptions(req);
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  // Extract client IP for audit logging
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                   req.headers.get('cf-connecting-ip') ||
                   req.headers.get('x-real-ip') || null;

  try {
    // Get user from auth header
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const {
      id,
      rawId,
      response,
      authenticatorAttachment,
      device_name,
      user_agent
    } = body;

    // Parse client data to extract challenge for DB lookup
    const clientDataJSON = JSON.parse(
      atob(response.clientDataJSON.replace(/-/g, '+').replace(/_/g, '/'))
    );

    // Verify challenge exists and is valid
    const { data: challenges, error: challengeError } = await supabase
      .from('passkey_challenges')
      .select('id, challenge, user_id, type, used, expires_at')
      .eq('challenge', clientDataJSON.challenge)
      .eq('user_id', user.id)
      .eq('type', 'registration')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    if (challengeError || !challenges || challenges.length === 0) {
      // HIPAA AUDIT LOGGING: Log invalid/expired challenge
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'PASSKEY_REGISTER_FAILED',
          event_category: 'AUTHENTICATION',
          actor_user_id: user.id,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'PASSKEY_REGISTER',
          resource_type: 'auth_event',
          success: false,
          error_code: 'INVALID_CHALLENGE',
          error_message: 'Invalid or expired registration challenge',
          metadata: { credential_id: rawId }
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('Audit log insertion failed', { error: errorMessage });
      }

      return new Response(
        JSON.stringify({ error: 'Invalid or expired challenge' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Mark challenge as used
    await supabase
      .from('passkey_challenges')
      .update({ used: true })
      .eq('challenge', clientDataJSON.challenge);

    // Get relying party ID and origin from request
    const origin = req.headers.get("Origin") || "";
    const expectedOrigin = origin || Deno.env.get("EXPECTED_ORIGIN") || "https://thewellfitcommunity.org";
    const expectedRPID = Deno.env.get("EXPECTED_RP_ID") || new URL(expectedOrigin).hostname;

    // Verify the registration response using SimpleWebAuthn
    // This cryptographically verifies the attestation and extracts the COSE public key
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: {
          id,
          rawId,
          response: {
            clientDataJSON: response.clientDataJSON,
            attestationObject: response.attestationObject,
            transports: response.transports,
          },
          type: 'public-key',
          clientExtensionResults: {},
          authenticatorAttachment: authenticatorAttachment || undefined,
        },
        expectedChallenge: clientDataJSON.challenge,
        expectedOrigin: expectedOrigin,
        expectedRPID: expectedRPID,
        requireUserVerification: false, // Registration may not require UV on all devices
      });
    } catch (verifyErr: unknown) {
      const verifyErrorMessage = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
      logger.error('Attestation verification failed', { error: verifyErrorMessage });

      // HIPAA AUDIT LOGGING: Log attestation verification failure
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'PASSKEY_REGISTER_ATTESTATION_FAILED',
          event_category: 'AUTHENTICATION',
          actor_user_id: user.id,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'PASSKEY_REGISTER',
          resource_type: 'auth_event',
          success: false,
          error_code: 'ATTESTATION_VERIFICATION_FAILED',
          error_message: verifyErrorMessage,
          metadata: { credential_id: rawId }
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('Audit log insertion failed', { error: errorMessage });
      }

      return new Response(
        JSON.stringify({ error: 'Attestation verification failed' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      // HIPAA AUDIT LOGGING: Log unverified attestation
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'PASSKEY_REGISTER_NOT_VERIFIED',
          event_category: 'AUTHENTICATION',
          actor_user_id: user.id,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'PASSKEY_REGISTER',
          resource_type: 'auth_event',
          success: false,
          error_code: 'ATTESTATION_NOT_VERIFIED',
          error_message: 'Attestation verification returned false',
          metadata: { credential_id: rawId }
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('Audit log insertion failed', { error: errorMessage });
      }

      return new Response(
        JSON.stringify({ error: 'Registration verification failed' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Extract verified credential data from SimpleWebAuthn
    const { registrationInfo } = verification;
    const verifiedCredentialId = uint8ArrayToBase64url(registrationInfo.credentialID);
    const verifiedPublicKey = uint8ArrayToBase64url(registrationInfo.credentialPublicKey);
    const verifiedCounter = registrationInfo.counter;

    // Resolve user's tenant_id for multi-tenant isolation
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!userProfile?.tenant_id) {
      logger.error('User has no tenant_id', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'User tenant not found' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Store verified credential in database
    const { data: credential, error: credError } = await supabase
      .from('passkey_credentials')
      .insert({
        user_id: user.id,
        tenant_id: userProfile.tenant_id,
        credential_id: verifiedCredentialId,
        public_key: verifiedPublicKey, // COSE public key, NOT raw attestation blob
        counter: verifiedCounter,
        authenticator_type: authenticatorAttachment || null,
        transports: response.transports || null,
        device_name: device_name || 'Unknown Device',
        user_agent: user_agent || null,
        attestation_format: registrationInfo.fmt || 'none',
        aaguid: registrationInfo.aaguid || null,
        backup_eligible: registrationInfo.credentialBackedUp ?? false,
        backup_state: registrationInfo.credentialBackedUp ?? false,
      })
      .select('id, credential_id, device_name, authenticator_type, created_at')
      .single();

    if (credError) {
      logger.error('Failed to store credential', { error: credError.message, code: credError.code });

      // HIPAA AUDIT LOGGING: Log credential storage failure
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'PASSKEY_REGISTER_STORAGE_FAILED',
          event_category: 'AUTHENTICATION',
          actor_user_id: user.id,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'PASSKEY_REGISTER',
          resource_type: 'auth_event',
          success: false,
          error_code: credError.code || 'STORAGE_ERROR',
          error_message: credError.message,
          metadata: { credential_id: verifiedCredentialId }
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('Audit log insertion failed', { error: errorMessage });
      }

      return new Response(
        JSON.stringify({ error: 'Failed to store credential' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Log successful registration (passkey-specific table)
    await supabase.from('passkey_audit_log').insert({
      user_id: user.id,
      credential_id: verifiedCredentialId,
      action: 'register',
      success: true,
      user_agent: user_agent
    });

    // HIPAA AUDIT LOGGING: Log successful registration
    try {
      await supabase.from('audit_logs').insert({
        event_type: 'PASSKEY_REGISTER_SUCCESS',
        event_category: 'AUTHENTICATION',
        actor_user_id: user.id,
        actor_ip_address: clientIp,
        actor_user_agent: req.headers.get('user-agent'),
        operation: 'PASSKEY_REGISTER',
        resource_type: 'auth_event',
        success: true,
        metadata: {
          credential_id: verifiedCredentialId,
          device_name: device_name || 'Unknown Device',
          attestation_format: registrationInfo.fmt || 'none',
          counter: verifiedCounter
        }
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Audit log insertion failed', { error: errorMessage });
    }

    return new Response(JSON.stringify(credential), { status: 201, headers: corsHeaders });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Unhandled error in passkey-register-finish', { error: errorMessage });

    // Log failed registration (passkey-specific table)
    await supabase.from('passkey_audit_log').insert({
      action: 'failed_register',
      success: false,
      error_message: errorMessage || 'Unknown error'
    }).catch(() => {});

    return new Response(
      JSON.stringify({ error: errorMessage || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
