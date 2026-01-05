// supabase/functions/passkey-auth-finish/index.ts
import { SUPABASE_URL as IMPORTED_SUPABASE_URL, SB_SECRET_KEY as IMPORTED_SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.28.0";
import { verifyAuthenticationResponse } from "https://deno.land/x/simplewebauthn@v10.0.1/deno/server.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = IMPORTED_SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? IMPORTED_SB_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Missing SUPABASE_URL or SB_SECRET_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

serve(async (req: Request) => {
  const logger = createLogger('passkey-auth-finish', req);
  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method === "OPTIONS") return handleOptions(req);
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  try {
    const body = await req.json();
    const { id, rawId, response } = body;

    // Extract client IP for audit logging
    // NOTE: actor_ip_address column is inet type - use null instead of 'unknown' if no IP available
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     req.headers.get('x-real-ip') || null;

    // Parse client data to verify challenge
    const clientDataJSON = JSON.parse(
      atob(response.clientDataJSON.replace(/-/g, '+').replace(/_/g, '/'))
    );

    // Verify challenge exists and is valid
    const { data: challenges, error: challengeError } = await supabase
      .from('passkey_challenges')
      .select('*')
      .eq('challenge', clientDataJSON.challenge)
      .eq('type', 'authentication')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    if (challengeError || !challenges || challenges.length === 0) {
      // HIPAA AUDIT LOGGING: Log invalid/expired challenge
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'PASSKEY_AUTH_FAILED',
          event_category: 'AUTHENTICATION',
          actor_user_id: null,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'PASSKEY_AUTH',
resource_type: 'auth_event',
          success: false,
          error_code: 'INVALID_CHALLENGE',
          error_message: 'Invalid or expired challenge',
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

    // Find credential in database
    const { data: credential, error: credError } = await supabase
      .from('passkey_credentials')
      .select('*')
      .eq('credential_id', rawId)
      .single();

    if (credError || !credential) {
      // Log failed authentication (passkey-specific table)
      await supabase.from('passkey_audit_log').insert({
        credential_id: rawId,
        operation: 'failed_auth',
resource_type: 'auth_event',
        success: false,
        error_message: 'Credential not found'
      });

      // HIPAA AUDIT LOGGING: Log credential not found
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'PASSKEY_AUTH_FAILED',
          event_category: 'AUTHENTICATION',
          actor_user_id: null,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'PASSKEY_AUTH',
resource_type: 'auth_event',
          success: false,
          error_code: 'CREDENTIAL_NOT_FOUND',
          error_message: 'Credential not found',
          metadata: { credential_id: rawId }
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('Audit log insertion failed', { error: errorMessage });
      }

      return new Response(
        JSON.stringify({ error: 'Credential not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify the signature using WebAuthn cryptographic verification
    const expectedOrigin = Deno.env.get("EXPECTED_ORIGIN") || "https://thewellfitcommunity.org";
    const expectedRPID = Deno.env.get("EXPECTED_RP_ID") || "thewellfitcommunity.org";

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: {
          id,
          rawId,
          response: {
            authenticatorData: response.authenticatorData,
            clientDataJSON: response.clientDataJSON,
            signature: response.signature,
            userHandle: response.userHandle,
          },
          type: 'public-key',
          clientExtensionResults: {},
        },
        expectedChallenge: clientDataJSON.challenge,
        expectedOrigin: expectedOrigin,
        expectedRPID: expectedRPID,
        authenticator: {
          credentialID: new Uint8Array(
            atob(credential.credential_id.replace(/-/g, '+').replace(/_/g, '/'))
              .split('')
              .map((c) => c.charCodeAt(0))
          ),
          credentialPublicKey: new Uint8Array(
            atob(credential.public_key.replace(/-/g, '+').replace(/_/g, '/'))
              .split('')
              .map((c) => c.charCodeAt(0))
          ),
          counter: credential.counter,
        },
        requireUserVerification: true,  // Enforce biometric/PIN
      });
    } catch (verifyErr: unknown) {
      const verifyErrorMessage = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
      const verifyErrorName = verifyErr instanceof Error ? verifyErr.name : 'UnknownError';
      // HIPAA AUDIT LOGGING: Log signature verification failure
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'PASSKEY_SIGNATURE_VERIFICATION_FAILED',
          event_category: 'AUTHENTICATION',
          actor_user_id: credential.user_id,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'PASSKEY_AUTH',
          resource_type: 'auth_event',
          success: false,
          error_code: 'SIGNATURE_VERIFICATION_FAILED',
          error_message: verifyErrorMessage || 'Cryptographic signature verification failed',
          metadata: {
            credential_id: rawId,
            error_type: verifyErrorName,
          }
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('Audit log insertion failed', { error: errorMessage });
      }

      return new Response(
        JSON.stringify({ error: 'Signature verification failed' }),
        { status: 401, headers: corsHeaders }
      );
    }

    if (!verification.verified) {
      // HIPAA AUDIT LOGGING: Log unverified signature
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'PASSKEY_SIGNATURE_NOT_VERIFIED',
          event_category: 'AUTHENTICATION',
          actor_user_id: credential.user_id,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'PASSKEY_AUTH',
          resource_type: 'auth_event',
          success: false,
          error_code: 'SIGNATURE_NOT_VERIFIED',
          error_message: 'Cryptographic signature verification failed',
          metadata: { credential_id: rawId }
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('Audit log insertion failed', { error: errorMessage });
      }

      return new Response(
        JSON.stringify({ error: 'Authentication failed - invalid signature' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Update credential's last_used_at and counter with verified counter from WebAuthn
    const newCounter = verification.authenticationInfo.newCounter;
    await supabase
      .from('passkey_credentials')
      .update({
        last_used_at: new Date().toISOString(),
        counter: newCounter  // Use verified counter from WebAuthn
      })
      .eq('id', credential.id);

    // Get user from auth
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(credential.user_id);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', credential.user_id)
      .single();

    // Create a session token for the user using Supabase Admin API
    // This generates a valid access token and refresh token
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email || user.phone || `${user.id}@passkey.local`
    });

    if (sessionError || !sessionData) {
      logger.error('Session generation failed', { error: sessionError?.message, code: sessionError?.code });
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Extract the session properties from the magic link response
    // The properties object contains access_token and refresh_token
    const session = {
      access_token: sessionData.properties?.access_token || null,
      refresh_token: sessionData.properties?.refresh_token || null,
      expires_in: sessionData.properties?.expires_in || 3600,
      expires_at: sessionData.properties?.expires_at || null,
      token_type: 'bearer',
      user: user
    };

    // Log successful authentication (passkey-specific table)
    await supabase.from('passkey_audit_log').insert({
      user_id: credential.user_id,
      credential_id: rawId,
      operation: 'authenticate',
resource_type: 'auth_event',
      success: true
    });

    // HIPAA AUDIT LOGGING: Log successful passkey authentication with verification details
    try {
      await supabase.from('audit_logs').insert({
        event_type: 'PASSKEY_AUTH_SUCCESS',
        event_category: 'AUTHENTICATION',
        actor_user_id: credential.user_id,
        actor_ip_address: clientIp,
        actor_user_agent: req.headers.get('user-agent'),
        operation: 'PASSKEY_AUTH',
        resource_type: 'auth_event',
        success: true,
        metadata: {
          credential_id: rawId,
          user_id: credential.user_id,
          counter: newCounter,
          userVerified: verification.authenticationInfo.userVerified,
          signature_verified: true
        }
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Audit log insertion failed', { error: errorMessage });
    }

    return new Response(
      JSON.stringify({
        session: session,
        user: user,
        profile: profile
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Unhandled error in passkey-auth-finish', { error: errorMessage });

    // Log failed authentication
    await supabase.from('passkey_audit_log').insert({
      operation: 'failed_auth',
      resource_type: 'auth_event',
      success: false,
      error_message: errorMessage || 'Unknown error'
    }).catch(() => {});

    return new Response(
      JSON.stringify({ error: errorMessage || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
