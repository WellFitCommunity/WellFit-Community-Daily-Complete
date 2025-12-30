// ==============================================================================
// Supabase Edge Function: hash-pin
// Purpose: Securely hash patient PINs using Web Crypto API (PBKDF2)
// Date: 2025-10-03
//
// SECURITY DESIGN:
// - Uses Web Crypto API's PBKDF2 with SHA-256
// - Generates cryptographically random 16-byte salt per PIN
// - 100,000 iterations (OWASP recommended minimum for PBKDF2)
// - Returns: base64(salt) + ":" + base64(hash)
// - HIPAA compliant: No plaintext PINs stored in database
//
// API CONTRACT:
// Request:  POST /hash-pin
//           Body: { pin: "1234" }
//
// Response: { hashed: "R3p8...==:j9kL...==" }
//           Format: base64(salt):base64(hash)
//
// USAGE:
// Called from:
// - DemographicsPage.tsx when patient sets PIN
// - Any caregiver authentication flow
//
// VERIFICATION:
// To verify a PIN later, split the hashed value on ":", extract salt,
// re-hash the input PIN with same salt, and compare hashes.
// ==============================================================================

import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("hash-pin");

// CORS Configuration - Explicit allowlist for security
const ALLOWED_ORIGINS = [
  "https://thewellfitcommunity.org",
  "https://wellfitcommunity.live",
  "http://localhost:3100",
  "https://localhost:3100",
  // Add tenant subdomains
  "https://houston.thewellfitcommunity.org",
  "https://miami.thewellfitcommunity.org",
  "https://phoenix.thewellfitcommunity.org",
  "https://seattle.thewellfitcommunity.org",
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
  return new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  });
}

/**
 * Hash a PIN using PBKDF2 with cryptographically random salt
 * @param pin - 4-digit PIN string
 * @returns Promise<string> - Format: base64(salt):base64(hash)
 */
async function hashPinWithPBKDF2(pin: string): Promise<string> {
  // Validate PIN format (4 digits)
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("PIN must be exactly 4 digits");
  }

  // Generate cryptographically random 16-byte salt
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  // Convert PIN string to bytes
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);

  // Import PIN as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    pinBytes,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  // Derive key using PBKDF2
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000, // OWASP recommended minimum
      hash: "SHA-256",
    },
    keyMaterial,
    256 // 32 bytes = 256 bits
  );

  // Convert to base64 for storage
  const hashArray = new Uint8Array(hashBuffer);
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));

  // Return format: salt:hash (both base64 encoded)
  return `${saltBase64}:${hashBase64}`;
}

/**
 * Verify a PIN against a stored hash
 * @param pin - User-provided PIN
 * @param storedHash - Previously hashed PIN in format salt:hash
 * @returns Promise<boolean> - True if PIN matches
 */
async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  try {
    // Split stored hash into salt and hash
    const [saltBase64, expectedHashBase64] = storedHash.split(":");
    if (!saltBase64 || !expectedHashBase64) {
      throw new Error("Invalid hash format");
    }

    // Decode salt from base64
    const saltBytes = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));

    // Convert PIN to bytes
    const encoder = new TextEncoder();
    const pinBytes = encoder.encode(pin);

    // Import PIN as key material
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      pinBytes,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    // Derive hash with same salt
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );

    // Compare hashes
    const hashArray = new Uint8Array(hashBuffer);
    const computedHashBase64 = btoa(String.fromCharCode(...hashArray));

    return computedHashBase64 === expectedHashBase64;
  } catch (err: unknown) {
    logger.error("PIN verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// Main handler
serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    // Parse request body
    const body = await req.json();
    const { pin, action, storedHash } = body;

    // Validate PIN exists
    if (!pin || typeof pin !== "string") {
      return new Response(
        JSON.stringify({ error: "PIN is required and must be a string" }),
        { status: 400, headers }
      );
    }

    // Handle different actions
    if (action === "verify") {
      // Verify PIN against stored hash
      if (!storedHash) {
        return new Response(
          JSON.stringify({ error: "storedHash is required for verification" }),
          { status: 400, headers }
        );
      }

      const isValid = await verifyPin(pin, storedHash);
      return new Response(
        JSON.stringify({ valid: isValid }),
        { status: 200, headers }
      );
    } else {
      // Default action: hash PIN
      const hashed = await hashPinWithPBKDF2(pin);
      return new Response(
        JSON.stringify({ hashed }),
        { status: 200, headers }
      );
    }
  } catch (err: unknown) {
    logger.error("Hash PIN request failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers }
    );
  }
});
