/**
 * WebAuthn/Passkey Biometric Authentication Service
 * Supports: Touch ID, Face ID, Windows Hello, Fingerprint, USB Security Keys
 *
 * IMPORTANT: This uses the WebAuthn API which requires HTTPS in production
 * Works on localhost without HTTPS for testing
 */

import { supabase } from '../lib/supabaseClient';

// ─── Types ─────────────────────────────────────────────────────────

export interface PasskeyCredential {
  id: string;
  user_id: string;
  credential_id: string;
  device_name: string | null;
  authenticator_type: 'platform' | 'cross-platform' | null;
  transports: string[] | null;
  last_used_at: string | null;
  created_at: string;
}

export interface RegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number;
  }>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    requireResidentKey?: boolean;
    residentKey?: 'required' | 'preferred' | 'discouraged';
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  timeout?: number;
  attestation?: 'none' | 'indirect' | 'direct' | 'enterprise';
}

export interface AuthenticationOptions {
  challenge: string;
  rpId?: string;
  allowCredentials?: Array<{
    type: 'public-key';
    id: BufferSource;
    transports?: string[];
  }>;
  timeout?: number;
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

// ─── Helper Functions ─────────────────────────────────────────────────

/**
 * Check if WebAuthn is supported in this browser
 */
export function isPasskeySupported(): boolean {
  return !!(
    window?.PublicKeyCredential &&
    typeof navigator?.credentials?.create === 'function' &&
    typeof navigator?.credentials?.get === 'function'
  );
}

/**
 * Check if platform authenticator (Touch ID, Face ID, Windows Hello) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;

  try {
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Convert base64url string to Uint8Array (as ArrayBuffer)
 */
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64url string
 */
function uint8ArrayToBase64url(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Get relying party ID (domain name)
 */
function getRelyingPartyId(): string {
  // In production, use actual domain
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'localhost';
  }
  return window.location.hostname;
}

/**
 * Get user-friendly authenticator name
 */
function getAuthenticatorName(authenticatorType: string | undefined): string {
  if (authenticatorType === 'platform') {
    const ua = navigator.userAgent;
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'Face ID / Touch ID';
    if (ua.includes('Mac')) return 'Touch ID';
    if (ua.includes('Windows')) return 'Windows Hello';
    if (ua.includes('Android')) return 'Fingerprint';
    return 'Built-in Biometric';
  }
  return 'Security Key';
}

// ─── Registration Functions ─────────────────────────────────────────────

/**
 * Start passkey registration process
 * Step 1: Get registration options from server
 */
export async function startPasskeyRegistration(
  userId: string,
  userName: string,
  displayName: string,
  preferPlatform = true
): Promise<RegistrationOptions> {
  const { data, error } = await supabase.functions.invoke('passkey-register-start', {
    body: {
      user_id: userId,
      user_name: userName,
      display_name: displayName,
      prefer_platform: preferPlatform
    }
  });

  if (error) throw new Error(error.message || 'Failed to start registration');
  return data;
}

/**
 * Complete passkey registration
 * Step 2: Create credential with WebAuthn API and save to database
 */
export async function completePasskeyRegistration(
  options: RegistrationOptions,
  deviceName?: string
): Promise<PasskeyCredential> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported in this browser');
  }

  try {
    // Convert options to WebAuthn format
    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge: base64urlToUint8Array(options.challenge) as BufferSource,
      rp: options.rp,
      user: {
        ...options.user,
        id: base64urlToUint8Array(options.user.id) as BufferSource
      },
      pubKeyCredParams: options.pubKeyCredParams,
      authenticatorSelection: options.authenticatorSelection,
      timeout: options.timeout || 60000,
      attestation: options.attestation || 'none'
    };

    // Create credential via WebAuthn
    const credential = await navigator.credentials.create({
      publicKey: publicKeyOptions
    }) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Failed to create credential');
    }

    const response = credential.response as AuthenticatorAttestationResponse;

    // Prepare credential data for server
    const credentialData = {
      id: credential.id,
      rawId: uint8ArrayToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: uint8ArrayToBase64url(response.clientDataJSON),
        attestationObject: uint8ArrayToBase64url(response.attestationObject),
        transports: (response as any).getTransports?.() || []
      },
      authenticatorAttachment: (credential as any).authenticatorAttachment,
      device_name: deviceName || getAuthenticatorName((credential as any).authenticatorAttachment),
      user_agent: navigator.userAgent
    };

    // Send to server for verification and storage
    const { data, error } = await supabase.functions.invoke('passkey-register-finish', {
      body: credentialData
    });

    if (error) throw new Error(error.message || 'Failed to save credential');
    return data;

  } catch (error: unknown) {


    if (error.name === 'NotAllowedError') {
      throw new Error('Registration was cancelled or timed out');
    } else if (error.name === 'InvalidStateError') {
      throw new Error('This device is already registered');
    } else if (error.name === 'NotSupportedError') {
      throw new Error('Passkeys are not supported on this device');
    }

    throw error;
  }
}

// ─── Authentication Functions ─────────────────────────────────────────

/**
 * Start passkey authentication
 * Step 1: Get authentication challenge from server
 */
export async function startPasskeyAuthentication(
  userId?: string
): Promise<AuthenticationOptions> {
  const { data, error } = await supabase.functions.invoke('passkey-auth-start', {
    body: { user_id: userId }
  });

  if (error) throw new Error(error.message || 'Failed to start authentication');
  return data;
}

/**
 * Complete passkey authentication
 * Step 2: Sign challenge with WebAuthn and verify on server
 */
export async function completePasskeyAuthentication(
  options: AuthenticationOptions
): Promise<{ session: any; user: any }> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported in this browser');
  }

  try {
    // Convert options to WebAuthn format
    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64urlToUint8Array(options.challenge) as BufferSource,
      rpId: options.rpId || getRelyingPartyId(),
      allowCredentials: options.allowCredentials?.map(cred => ({
        type: 'public-key' as const,
        id: (typeof cred.id === 'string' ? base64urlToUint8Array(cred.id) : cred.id) as BufferSource,
        transports: (cred.transports || []) as AuthenticatorTransport[]
      })),
      timeout: options.timeout || 60000,
      userVerification: options.userVerification || 'preferred'
    };

    // Get credential via WebAuthn
    const credential = await navigator.credentials.get({
      publicKey: publicKeyOptions
    }) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Failed to authenticate');
    }

    const response = credential.response as AuthenticatorAssertionResponse;

    // Prepare authentication data for server
    const authData = {
      id: credential.id,
      rawId: uint8ArrayToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: uint8ArrayToBase64url(response.clientDataJSON),
        authenticatorData: uint8ArrayToBase64url(response.authenticatorData),
        signature: uint8ArrayToBase64url(response.signature),
        userHandle: response.userHandle ? uint8ArrayToBase64url(response.userHandle) : null
      }
    };

    // Verify on server and get session
    const { data, error } = await supabase.functions.invoke('passkey-auth-finish', {
      body: authData
    });

    if (error) throw new Error(error.message || 'Authentication failed');

    // Set the session in Supabase client
    if (data.session) {
      await supabase.auth.setSession(data.session);
    }

    return data;

  } catch (error: unknown) {


    if (error.name === 'NotAllowedError') {
      throw new Error('Authentication was cancelled or timed out');
    } else if (error.name === 'InvalidStateError') {
      throw new Error('No passkey found for this account');
    }

    throw error;
  }
}

// ─── Management Functions ─────────────────────────────────────────────

/**
 * Get all passkeys for current user
 */
export async function getUserPasskeys(): Promise<PasskeyCredential[]> {
  const { data, error } = await supabase
    .from('passkey_credentials')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Delete a passkey
 */
export async function deletePasskey(credentialId: string): Promise<void> {
  const { error } = await supabase
    .from('passkey_credentials')
    .delete()
    .eq('credential_id', credentialId);

  if (error) throw error;

  // Log deletion
  await supabase.from('passkey_audit_log').insert({
    credential_id: credentialId,
    action: 'delete',
    success: true,
    ip_address: null, // Client doesn't know IP
    user_agent: navigator.userAgent
  });
}

/**
 * Check if user has any passkeys registered
 */
export async function hasPasskeys(userId?: string): Promise<boolean> {
  const query = supabase
    .from('passkey_credentials')
    .select('id', { count: 'exact', head: true });

  if (userId) {
    query.eq('user_id', userId);
  }

  const { count, error } = await query;
  if (error) return false;
  return (count || 0) > 0;
}

/**
 * Register a passkey (convenience wrapper for both steps)
 */
export async function registerPasskey(
  userId: string,
  userName: string,
  displayName: string,
  deviceName?: string,
  preferPlatform = true
): Promise<PasskeyCredential> {
  const options = await startPasskeyRegistration(userId, userName, displayName, preferPlatform);
  return await completePasskeyRegistration(options, deviceName);
}

/**
 * Authenticate with passkey (convenience wrapper for both steps)
 */
export async function authenticateWithPasskey(userId?: string): Promise<{ session: any; user: any }> {
  const options = await startPasskeyAuthentication(userId);
  return await completePasskeyAuthentication(options);
}
