# How to Build a WebAuthn/Passkey Biometric Login System

> **Author:** Maria (Envision Virtual Edge Group LLC)
> **Created:** 2026-03-24
> **Purpose:** Step-by-step blueprint for building passkey/biometric authentication from scratch. Written from lessons learned building WellFit Community's passkey system — including every mistake an AI coding assistant made so you don't repeat them.
> **Use this for:** Any new app that needs fingerprint, Face ID, Windows Hello, or security key login.

---

## Table of Contents

1. [What You're Building](#1-what-youre-building)
2. [Prerequisites](#2-prerequisites)
3. [Step 1: Database Schema](#step-1-database-schema)
4. [Step 2: Server — Registration Start](#step-2-server--registration-start)
5. [Step 3: Server — Registration Finish](#step-3-server--registration-finish)
6. [Step 4: Server — Authentication Start](#step-4-server--authentication-start)
7. [Step 5: Server — Authentication Finish](#step-5-server--authentication-finish)
8. [Step 6: Client Service](#step-6-client-service)
9. [Step 7: UI Components](#step-7-ui-components)
10. [Step 8: Testing](#step-8-testing)
11. [Step 9: Deployment Checklist](#step-9-deployment-checklist)
12. [Common AI Mistakes (And How to Prevent Them)](#common-ai-mistakes)
13. [Glossary](#glossary)

---

## 1. What You're Building

WebAuthn (Web Authentication) is the W3C standard that lets users log in with biometrics instead of passwords. The browser talks to a hardware authenticator (fingerprint reader, Face ID camera, USB security key) to prove who they are using **public key cryptography** — no passwords transmitted, no passwords stored.

### The 4-Step Flow

**Registration (one-time setup):**
```
Browser ──1──> Server: "I want to register a passkey"
Server  ──2──> Browser: "Here's a challenge + options"
Browser ──3──> Authenticator: "Create a key pair, sign this challenge"
Browser ──4──> Server: "Here's the signed attestation"
Server  ──5──> Database: Verify attestation, extract public key, store it
```

**Authentication (every login):**
```
Browser ──1──> Server: "I want to log in with my passkey"
Server  ──2──> Browser: "Here's a challenge"
Browser ──3──> Authenticator: "Sign this challenge with your private key"
Browser ──4──> Server: "Here's the signed assertion"
Server  ──5──> Database: Find stored public key, verify signature, create session
```

### Key Concepts

| Term | What It Is | Where It Lives |
|------|-----------|----------------|
| **Relying Party (RP)** | Your app (identified by domain) | Server config |
| **Challenge** | Random bytes the server generates to prevent replay attacks | Database (temporary, expires in 5 min) |
| **Credential ID** | Unique identifier for the passkey | Database + authenticator |
| **Public Key** | COSE-format key used to verify signatures | Database (you store this) |
| **Private Key** | Secret key that signs challenges | Authenticator hardware (never leaves the device) |
| **Counter** | Increments each time the passkey is used — detects cloned authenticators | Database (updated each login) |
| **Attestation** | Proof from the authenticator about the credential it created | Verified during registration |
| **Assertion** | Proof from the authenticator that it holds the private key | Verified during authentication |

---

## 2. Prerequisites

### Required Library: SimpleWebAuthn

This is the library that handles the hard cryptography. Do NOT try to implement WebAuthn verification yourself.

**Server (Node.js):**
```bash
npm install @simplewebauthn/server
```

**Server (Deno / Supabase Edge Functions):**
```typescript
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "https://deno.land/x/simplewebauthn@v10.0.1/deno/server.ts";
```

**Client (browser):**
```bash
npm install @simplewebauthn/browser
```
Or use the raw WebAuthn API (no client library needed — the browser has it built in).

### Required Infrastructure

| Component | Purpose | Examples |
|-----------|---------|---------|
| HTTPS | WebAuthn requires secure context | Any production domain, localhost works for dev |
| Database | Store credentials, challenges, audit logs | PostgreSQL, Supabase, any SQL database |
| Server/API | Handle registration + authentication endpoints | Express, Deno, Edge Functions, any backend |
| Auth system | Issue session tokens after passkey verification | Supabase Auth, NextAuth, custom JWT |

---

## Step 1: Database Schema

You need 3 tables. Create them in this order.

### Table 1: `passkey_credentials` — Stores registered passkeys

```sql
CREATE TABLE IF NOT EXISTS passkey_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- WHO owns this credential
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),  -- multi-tenant apps ONLY

    -- THE CREDENTIAL (from WebAuthn verification — NOT raw client data)
    credential_id TEXT NOT NULL UNIQUE,     -- Base64URL encoded, from verification
    public_key BYTEA NOT NULL,             -- COSE public key bytes, from verification
    counter BIGINT NOT NULL DEFAULT 0,      -- Signature counter, from verification
    -- NOTE: public_key is BYTEA (binary), NOT TEXT. SimpleWebAuthn returns
    -- Uint8Array from verifyRegistrationResponse. Store it as binary.

    -- AUTHENTICATOR INFO
    authenticator_type TEXT CHECK (authenticator_type IN ('platform', 'cross-platform')),
    transports TEXT[],            -- ['internal', 'usb', 'nfc', 'ble', 'hybrid']
    backup_eligible BOOLEAN DEFAULT false,
    backup_state BOOLEAN DEFAULT false,
    aaguid TEXT,                  -- Authenticator model identifier

    -- DEVICE INFO (for user-facing management UI)
    device_name TEXT,             -- "Maria's iPhone", "Office Laptop"
    user_agent TEXT,              -- Browser/OS string

    -- TIMESTAMPS
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_passkey_cred_user ON passkey_credentials(user_id);
CREATE INDEX idx_passkey_cred_tenant ON passkey_credentials(tenant_id);
CREATE INDEX idx_passkey_cred_credential_id ON passkey_credentials(credential_id);

-- Row Level Security (REQUIRED for multi-tenant)
ALTER TABLE passkey_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own credentials" ON passkey_credentials
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own credentials" ON passkey_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own credentials" ON passkey_credentials
    FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users update own credentials" ON passkey_credentials
    FOR UPDATE USING (auth.uid() = user_id);
-- Add tenant isolation if multi-tenant:
-- USING (auth.uid() = user_id AND tenant_id = get_current_tenant_id())

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_passkey_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER passkey_updated_at
    BEFORE UPDATE ON passkey_credentials
    FOR EACH ROW EXECUTE FUNCTION update_passkey_updated_at();

COMMENT ON TABLE passkey_credentials IS 'WebAuthn passkey credentials for biometric login';
COMMENT ON COLUMN passkey_credentials.public_key IS 'COSE public key from verifyRegistrationResponse — NOT the raw attestation object';
COMMENT ON COLUMN passkey_credentials.counter IS 'Signature counter — must increase on each auth to detect cloned authenticators';
```

### Table 2: `passkey_challenges` — Temporary challenge storage

```sql
CREATE TABLE IF NOT EXISTS passkey_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_passkey_challenges_expires
    ON passkey_challenges(expires_at) WHERE NOT used;

ALTER TABLE passkey_challenges ENABLE ROW LEVEL SECURITY;

-- Service role inserts challenges (from your API endpoints)
CREATE POLICY "Service inserts challenges" ON passkey_challenges
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users see own challenges" ON passkey_challenges
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Cleanup function (run on a schedule)
CREATE OR REPLACE FUNCTION cleanup_expired_passkey_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- REQUIRED for SECURITY DEFINER functions
AS $$
BEGIN
    DELETE FROM passkey_challenges
    WHERE expires_at < now() - INTERVAL '1 hour';
END;
$$;

COMMENT ON TABLE passkey_challenges IS 'Temporary WebAuthn challenges — auto-expire after 5 minutes';
```

### Table 3: `passkey_audit_log` — Security audit trail

```sql
CREATE TABLE IF NOT EXISTS passkey_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    credential_id TEXT,
    action TEXT NOT NULL,  -- 'register', 'authenticate', 'delete', 'failed_auth'
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_passkey_audit_user ON passkey_audit_log(user_id, created_at DESC);
CREATE INDEX idx_passkey_audit_action ON passkey_audit_log(action, created_at DESC);

ALTER TABLE passkey_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own audit" ON passkey_audit_log
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service inserts audit" ON passkey_audit_log
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins see all audit" ON passkey_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
        )
    );

COMMENT ON TABLE passkey_audit_log IS 'Audit trail for all passkey operations — register, auth, delete, failures';
```

### Critical Schema Rules

| Rule | Why |
|------|-----|
| `public_key` is **BYTEA** (binary), not TEXT | SimpleWebAuthn returns `Uint8Array`. Storing as text requires base64 encoding/decoding at every auth — error-prone |
| Every table has **RLS enabled** | Without RLS, any authenticated user can see all credentials |
| Challenges **expire in 5 minutes** | Prevents replay attacks |
| Counter is **BIGINT**, not INTEGER | Authenticators can have high counters |
| `credential_id` is **UNIQUE** | One credential per authenticator per relying party |
| Cleanup function has **`SET search_path = public`** | Required for SECURITY DEFINER to prevent injection |

---

## Step 2: Server — Registration Start

**Endpoint:** `POST /passkey/register/start`
**Auth required:** Yes (user must be logged in to register a passkey)
**Returns:** Registration options for the browser

```typescript
// === SERVER: Registration Start ===

import {
  generateRegistrationOptions
} from "@simplewebauthn/server";  // or Deno import

async function handleRegistrationStart(req: Request) {
  // 1. VERIFY THE USER IS AUTHENTICATED
  const user = await getUserFromAuthHeader(req);
  if (!user) return errorResponse(401, "Unauthorized");

  // 2. GET USER'S EXISTING CREDENTIALS (to exclude them)
  const existingCredentials = await db.query(
    `SELECT credential_id, transports FROM passkey_credentials WHERE user_id = $1`,
    [user.id]
  );

  // 3. GENERATE REGISTRATION OPTIONS (SimpleWebAuthn does the hard work)
  const options = await generateRegistrationOptions({
    rpName: "Your App Name",                    // Display name
    rpID: getRelyingPartyId(req),               // Domain: "yourapp.com" or "localhost"
    userID: user.id,                            // Unique user identifier
    userName: user.email || user.phone,          // Display in authenticator prompt
    userDisplayName: user.display_name || user.email,

    // Don't let user re-register an existing authenticator
    excludeCredentials: existingCredentials.map(cred => ({
      id: base64urlToUint8Array(cred.credential_id),
      transports: cred.transports || [],
    })),

    // Prefer built-in biometrics (Face ID, Touch ID, Windows Hello)
    authenticatorSelection: {
      authenticatorAttachment: "platform",      // "platform" = built-in, "cross-platform" = USB key
      residentKey: "preferred",                 // Allow discoverable credentials
      userVerification: "required",             // MUST verify user (biometric/PIN)
    },

    // Algorithm preference: ES256 first (fast, small), RS256 as fallback
    supportedAlgorithmIDs: [-7, -257],

    timeout: 60000,         // 60 seconds for user to complete
    attestationType: "none" // Don't need attestation certificate for most apps
  });

  // 4. STORE THE CHALLENGE IN DATABASE (expires in 5 minutes)
  await db.query(
    `INSERT INTO passkey_challenges (challenge, user_id, type, expires_at)
     VALUES ($1, $2, 'registration', $3)`,
    [options.challenge, user.id, new Date(Date.now() + 5 * 60 * 1000)]
  );

  // 5. RETURN OPTIONS TO BROWSER
  return jsonResponse(200, options);
}

// Helper: Get relying party ID from request
function getRelyingPartyId(req: Request): string {
  const origin = req.headers.get("Origin");
  if (!origin) return "localhost";
  const hostname = new URL(origin).hostname;
  return hostname;
}
```

---

## Step 3: Server — Registration Finish

**Endpoint:** `POST /passkey/register/finish`
**Auth required:** Yes
**Receives:** Attestation response from browser
**THIS IS WHERE AI MESSES UP THE MOST. Read carefully.**

```typescript
// === SERVER: Registration Finish ===
// *** THIS IS THE CRITICAL STEP. DO NOT SKIP VERIFICATION. ***

import {
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse
} from "@simplewebauthn/server";

async function handleRegistrationFinish(req: Request) {
  // 1. VERIFY THE USER IS AUTHENTICATED
  const user = await getUserFromAuthHeader(req);
  if (!user) return errorResponse(401, "Unauthorized");

  // 2. GET THE ATTESTATION RESPONSE FROM THE BROWSER
  const body = await req.json();
  // body contains: { id, rawId, response: { clientDataJSON, attestationObject, transports }, type }

  // 3. FIND THE CHALLENGE WE STORED IN STEP 2
  const challenge = await db.queryOne(
    `SELECT challenge FROM passkey_challenges
     WHERE user_id = $1 AND type = 'registration' AND used = false
     AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [user.id]
  );

  if (!challenge) return errorResponse(400, "Challenge expired or not found");

  // 4. *** VERIFY THE ATTESTATION WITH SimpleWebAuthn ***
  //    This is the step AI skips. DO NOT SKIP THIS.
  //    This cryptographically verifies the authenticator's response.
  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response: body,                                    // The raw attestation from browser
      expectedChallenge: challenge.challenge,             // Must match what we generated
      expectedOrigin: getExpectedOrigin(req),             // "https://yourapp.com"
      expectedRPID: getRelyingPartyId(req),              // "yourapp.com"
      requireUserVerification: true,                      // Biometric/PIN was used
    });
  } catch (error) {
    await auditLog(user.id, body.id, 'failed_auth', false, error.message);
    return errorResponse(400, "Attestation verification failed");
  }

  if (!verification.verified || !verification.registrationInfo) {
    return errorResponse(400, "Registration verification failed");
  }

  // 5. *** EXTRACT THE VERIFIED DATA ***
  //    These values come from SimpleWebAuthn's verification — NOT from the raw request.
  //    This is the second place AI messes up: using raw client data instead of verified data.
  const { registrationInfo } = verification;
  const {
    credentialID,           // Uint8Array — the verified credential ID
    credentialPublicKey,    // Uint8Array — the COSE public key (THIS IS WHAT YOU STORE)
    counter,                // number — initial signature counter
    credentialBackedUp,     // boolean — is credential synced to cloud
    credentialDeviceType,   // "singleDevice" | "multiDevice"
  } = registrationInfo;

  // 6. STORE THE VERIFIED CREDENTIAL IN DATABASE
  //    Store the COSE public key as binary (BYTEA), NOT as text.
  //    Store the credential ID as base64url text.
  const credentialIdBase64url = uint8ArrayToBase64url(credentialID);

  await db.query(
    `INSERT INTO passkey_credentials
     (user_id, tenant_id, credential_id, public_key, counter,
      authenticator_type, transports, backup_eligible, backup_state,
      device_name, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      user.id,
      user.tenant_id,                                    // Get from user profile
      credentialIdBase64url,                              // Verified credential ID
      Buffer.from(credentialPublicKey),                   // COSE public key as BYTEA
      counter,                                           // Verified initial counter
      body.authenticatorAttachment || null,               // 'platform' or 'cross-platform'
      body.response?.transports || null,                  // Transport hints
      credentialBackedUp,                                // Backup status
      credentialDeviceType === "multiDevice",             // Multi-device = backup eligible
      body.device_name || getDefaultDeviceName(req),     // User-friendly name
      req.headers.get("user-agent"),                     // Browser info
    ]
  );

  // 7. MARK CHALLENGE AS USED (prevents replay)
  await db.query(
    `UPDATE passkey_challenges SET used = true WHERE challenge = $1`,
    [challenge.challenge]
  );

  // 8. AUDIT LOG
  await auditLog(user.id, credentialIdBase64url, 'register', true);

  // 9. RETURN SUCCESS
  return jsonResponse(201, {
    credential_id: credentialIdBase64url,
    device_name: body.device_name || getDefaultDeviceName(req),
    created_at: new Date().toISOString()
  });
}
```

### What AI Gets Wrong Here (And What You Must Verify)

| AI Mistake | What Actually Happens | The Fix |
|------------|----------------------|---------|
| Skips `verifyRegistrationResponse` entirely | No cryptographic verification — anyone can register a fake credential | ALWAYS call `verifyRegistrationResponse`. Period. |
| Stores `response.attestationObject` as the public key | The attestation object is a CBOR-encoded blob containing metadata + the key. It is NOT the key itself. | Store `verification.registrationInfo.credentialPublicKey` — this is the extracted COSE key |
| Stores raw `body.rawId` as credential ID | Client data can be tampered with | Store `verification.registrationInfo.credentialID` — this is verified |
| Stores public key as TEXT/base64 | Encoding/decoding errors on every auth attempt | Store as BYTEA (binary). SimpleWebAuthn returns Uint8Array. |
| Uses `body.response.clientDataJSON` to extract challenge | Can be spoofed | Use the challenge from your database, pass it to `verifyRegistrationResponse` which checks it |

---

## Step 4: Server — Authentication Start

**Endpoint:** `POST /passkey/auth/start`
**Auth required:** No (user is trying to log in)
**Returns:** Authentication options for the browser

```typescript
// === SERVER: Authentication Start ===

import {
  generateAuthenticationOptions
} from "@simplewebauthn/server";

async function handleAuthenticationStart(req: Request) {
  const body = await req.json();
  const { user_id } = body;  // Optional — for non-discoverable credentials

  // 1. GET USER'S REGISTERED CREDENTIALS (if user_id provided)
  let allowCredentials = undefined;
  if (user_id) {
    const credentials = await db.query(
      `SELECT credential_id, transports FROM passkey_credentials WHERE user_id = $1`,
      [user_id]
    );

    if (credentials.length > 0) {
      allowCredentials = credentials.map(cred => ({
        id: base64urlToUint8Array(cred.credential_id),
        transports: cred.transports || [],
      }));
    }
  }
  // If no user_id provided, allowCredentials stays undefined
  // → browser shows ALL available passkeys (discoverable credential flow)

  // 2. GENERATE AUTHENTICATION OPTIONS
  const options = await generateAuthenticationOptions({
    rpID: getRelyingPartyId(req),
    allowCredentials,
    userVerification: "required",   // MUST verify biometric/PIN
    timeout: 60000,
  });

  // 3. STORE CHALLENGE
  await db.query(
    `INSERT INTO passkey_challenges (challenge, user_id, type, expires_at)
     VALUES ($1, $2, 'authentication', $3)`,
    [options.challenge, user_id || null, new Date(Date.now() + 5 * 60 * 1000)]
  );

  // 4. AUDIT LOG
  await auditLog(user_id, null, 'auth_start', true, null, {
    has_credentials: !!allowCredentials,
    credential_count: allowCredentials?.length || 0
  });

  // 5. RETURN OPTIONS
  return jsonResponse(200, options);
}
```

---

## Step 5: Server — Authentication Finish

**Endpoint:** `POST /passkey/auth/finish`
**Auth required:** No (this IS the login)
**Receives:** Assertion response from browser
**Returns:** Session token (user is now logged in)

```typescript
// === SERVER: Authentication Finish ===

import {
  verifyAuthenticationResponse,
  type VerifiedAuthenticationResponse
} from "@simplewebauthn/server";

async function handleAuthenticationFinish(req: Request) {
  const body = await req.json();
  // body contains: { id, rawId, response: { clientDataJSON, authenticatorData, signature, userHandle }, type }

  // 1. FIND THE CREDENTIAL IN DATABASE
  //    Use the credential ID from the assertion to look up the stored public key.
  const credential = await db.queryOne(
    `SELECT id, user_id, credential_id, public_key, counter, transports
     FROM passkey_credentials
     WHERE credential_id = $1`,
    [body.rawId]  // or body.id — both are the credential ID
  );

  if (!credential) {
    await auditLog(null, body.rawId, 'failed_auth', false, 'Credential not found');
    return errorResponse(404, "Credential not found");
  }

  // 2. FIND THE CHALLENGE
  const challenge = await db.queryOne(
    `SELECT challenge FROM passkey_challenges
     WHERE type = 'authentication' AND used = false
     AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`
  );

  if (!challenge) {
    await auditLog(credential.user_id, body.rawId, 'failed_auth', false, 'Challenge expired');
    return errorResponse(400, "Challenge expired or not found");
  }

  // 3. *** VERIFY THE ASSERTION WITH SimpleWebAuthn ***
  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getExpectedOrigin(req),
      expectedRPID: getRelyingPartyId(req),
      authenticator: {
        credentialID: base64urlToUint8Array(credential.credential_id),
        credentialPublicKey: new Uint8Array(credential.public_key),  // BYTEA → Uint8Array
        counter: credential.counter,
        transports: credential.transports || [],
      },
      requireUserVerification: true,
    });
  } catch (error) {
    await auditLog(credential.user_id, body.rawId, 'failed_auth', false, error.message);
    return errorResponse(401, "Signature verification failed");
  }

  if (!verification.verified) {
    await auditLog(credential.user_id, body.rawId, 'failed_auth', false, 'Signature not verified');
    return errorResponse(401, "Authentication failed");
  }

  // 4. UPDATE COUNTER (prevents authenticator cloning attacks)
  const newCounter = verification.authenticationInfo.newCounter;
  await db.query(
    `UPDATE passkey_credentials
     SET counter = $1, last_used_at = now()
     WHERE id = $2`,
    [newCounter, credential.id]
  );

  // 5. MARK CHALLENGE AS USED
  await db.query(
    `UPDATE passkey_challenges SET used = true WHERE challenge = $1`,
    [challenge.challenge]
  );

  // 6. CREATE A SESSION FOR THE USER
  //    This depends on your auth system. Examples:
  //
  //    Supabase:
  //    const session = await supabase.auth.admin.generateLink({
  //      type: 'magiclink', email: user.email
  //    });
  //
  //    Custom JWT:
  //    const token = jwt.sign({ sub: credential.user_id, role: 'authenticated' }, secret);
  //
  //    NextAuth:
  //    Create a session token and set it as a cookie.

  const session = await createSessionForUser(credential.user_id);

  // 7. AUDIT LOG
  await auditLog(credential.user_id, body.rawId, 'authenticate', true, null, {
    counter: newCounter,
    userVerified: verification.authenticationInfo.userVerified,
  });

  // 8. RETURN SESSION
  return jsonResponse(200, {
    session,
    user: await getUserProfile(credential.user_id)
  });
}
```

---

## Step 6: Client Service

The browser-side code that talks to your server and invokes the WebAuthn API.

```typescript
// === CLIENT: passkeyService.ts ===

// Option A: Use @simplewebauthn/browser (recommended — handles encoding)
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

// Option B: Use raw WebAuthn API (more control, more code)
// See below for raw API approach.

// ─── Check Support ───

export function isPasskeySupported(): boolean {
  return !!(
    window?.PublicKeyCredential &&
    typeof navigator?.credentials?.create === "function" &&
    typeof navigator?.credentials?.get === "function"
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ─── Registration ───

export async function registerPasskey(
  userId: string,
  userName: string,
  displayName: string,
  deviceName?: string
): Promise<{ credential_id: string; device_name: string }> {

  // Step 1: Get options from YOUR server
  const optionsRes = await fetch("/api/passkey/register/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({ user_id: userId, user_name: userName, display_name: displayName }),
  });

  if (!optionsRes.ok) throw new Error("Failed to start registration");
  const options = await optionsRes.json();

  // Step 2: Create credential with WebAuthn API
  //    @simplewebauthn/browser handles all the base64url encoding
  let attestation;
  try {
    attestation = await startRegistration(options);
  } catch (error) {
    if (error.name === "NotAllowedError") throw new Error("Registration cancelled or timed out");
    if (error.name === "InvalidStateError") throw new Error("This device is already registered");
    throw error;
  }

  // Step 3: Send attestation to YOUR server for verification
  const verifyRes = await fetch("/api/passkey/register/finish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      ...attestation,
      device_name: deviceName || getDefaultDeviceName(),
    }),
  });

  if (!verifyRes.ok) throw new Error("Failed to complete registration");
  return await verifyRes.json();
}

// ─── Authentication ───

export async function authenticateWithPasskey(
  userId?: string
): Promise<{ session: Session; user: User }> {

  // Step 1: Get challenge from YOUR server
  const optionsRes = await fetch("/api/passkey/auth/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!optionsRes.ok) throw new Error("Failed to start authentication");
  const options = await optionsRes.json();

  // Step 2: Sign challenge with WebAuthn API
  let assertion;
  try {
    assertion = await startAuthentication(options);
  } catch (error) {
    if (error.name === "NotAllowedError") throw new Error("Authentication cancelled or timed out");
    throw error;
  }

  // Step 3: Verify assertion on YOUR server
  const verifyRes = await fetch("/api/passkey/auth/finish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assertion),
  });

  if (!verifyRes.ok) throw new Error("Authentication failed");
  const result = await verifyRes.json();

  // Step 4: Set the session in your auth client
  if (result.session) {
    await setSession(result.session);  // e.g., supabase.auth.setSession()
  }

  return result;
}

// ─── Management ───

export async function getUserPasskeys(): Promise<PasskeyCredential[]> {
  const res = await fetch("/api/passkey/list", {
    headers: { "Authorization": `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) return [];
  return await res.json();
}

export async function deletePasskey(credentialId: string): Promise<void> {
  const res = await fetch(`/api/passkey/${credentialId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error("Failed to delete passkey");
}

// ─── Helpers ───

function getDefaultDeviceName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("iPhone") || ua.includes("iPad")) return "Face ID / Touch ID";
  if (ua.includes("Mac")) return "Touch ID";
  if (ua.includes("Windows")) return "Windows Hello";
  if (ua.includes("Android")) return "Fingerprint";
  return "Biometric Login";
}
```

---

## Step 7: UI Components

### 7a. Login Button

Add a biometric login button to your login page:

```tsx
function LoginPage() {
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
  }, []);

  const handleBiometricLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await authenticateWithPasskey();
      navigate("/dashboard");  // Success — user is logged in
    } catch (err) {
      setError(err.message || "Biometric login failed. Try your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handlePasswordLogin}>
      {/* ... your normal email/password fields ... */}

      {passkeySupported && (
        <>
          <div className="divider">or</div>
          <button
            type="button"
            onClick={handleBiometricLogin}
            disabled={loading}
            className="biometric-login-btn"
          >
            {loading ? "Authenticating..." : "Log in with Biometrics"}
          </button>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </form>
  );
}
```

### 7b. Settings / Registration Component

Let users manage their passkeys in account settings:

```tsx
function PasskeySettings({ userId, userName, displayName }) {
  const [supported, setSupported] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported(isPasskeySupported());
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    const creds = await getUserPasskeys();
    setCredentials(creds);
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      await registerPasskey(userId, userName, displayName);
      await loadCredentials();  // Refresh list
    } catch (err) {
      alert(err.message);  // Replace with proper error UI
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (credentialId) => {
    if (!confirm("Remove this biometric login?")) return;
    await deletePasskey(credentialId);
    await loadCredentials();
  };

  if (!supported) return <p>Your browser does not support biometric login.</p>;

  return (
    <div>
      <h3>Biometric Authentication</h3>

      {/* List existing credentials */}
      {credentials.map(cred => (
        <div key={cred.id}>
          <span>{cred.device_name || "Unknown Device"}</span>
          <span>Last used: {cred.last_used_at || "Never"}</span>
          <button onClick={() => handleDelete(cred.credential_id)}>Remove</button>
        </div>
      ))}

      {/* Register new */}
      <button onClick={handleRegister} disabled={loading}>
        {loading ? "Setting up..." : "Add Biometric Login"}
      </button>
    </div>
  );
}
```

---

## Step 8: Testing

### What to Test (and What NOT to Mock)

| Test | Mock This | Don't Mock This |
|------|-----------|-----------------|
| Registration start | Database queries, auth header | Challenge generation logic |
| Registration finish | Database queries, auth header | `verifyRegistrationResponse` behavior |
| Auth start | Database queries | Challenge generation |
| Auth finish | Database queries | `verifyAuthenticationResponse` behavior |
| Client service | `fetch()` calls, `navigator.credentials` | Base64 encoding/decoding |
| UI component | Service functions | User interactions |

### Server Test Example

```typescript
describe("POST /passkey/register/finish", () => {
  it("should verify attestation and store COSE public key", async () => {
    // Setup: mock DB to return a valid challenge
    mockDb.queryOne.mockResolvedValue({ challenge: "test-challenge" });

    // Setup: mock verifyRegistrationResponse to return success
    mockVerify.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credentialID: new Uint8Array([1, 2, 3]),
        credentialPublicKey: new Uint8Array([4, 5, 6, 7, 8]),
        counter: 0,
        credentialBackedUp: false,
        credentialDeviceType: "singleDevice",
      }
    });

    const response = await handler(mockRequest);

    // Verify: stored the COSE public key (not attestation object)
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO passkey_credentials"),
      expect.arrayContaining([
        Buffer.from(new Uint8Array([4, 5, 6, 7, 8])),  // COSE public key
      ])
    );
  });

  it("should reject unverified attestation", async () => {
    mockDb.queryOne.mockResolvedValue({ challenge: "test-challenge" });
    mockVerify.mockResolvedValue({ verified: false });

    const response = await handler(mockRequest);

    expect(response.status).toBe(400);
  });

  it("should reject when challenge is expired", async () => {
    mockDb.queryOne.mockResolvedValue(null);  // No valid challenge

    const response = await handler(mockRequest);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Challenge expired or not found" });
  });

  it("should log failed registration to audit log", async () => {
    mockDb.queryOne.mockResolvedValue({ challenge: "test-challenge" });
    mockVerify.mockRejectedValue(new Error("Invalid attestation"));

    await handler(mockRequest);

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.any(String),  // user_id
      expect.any(String),  // credential_id
      "failed_auth",
      false,
      "Invalid attestation"
    );
  });
});
```

---

## Step 9: Deployment Checklist

Before going live, verify every item:

### Infrastructure
- [ ] App is served over **HTTPS** (WebAuthn requires secure context)
- [ ] Relying party ID matches your production domain exactly
- [ ] `EXPECTED_ORIGIN` env var set to your production URL (e.g., `https://yourapp.com`)
- [ ] `EXPECTED_RP_ID` env var set to your domain (e.g., `yourapp.com`)

### Database
- [ ] All 3 tables created with correct column types (`public_key` is BYTEA)
- [ ] RLS enabled on all 3 tables
- [ ] RLS policies verified (test as non-admin user)
- [ ] `tenant_id` column present if multi-tenant
- [ ] Indexes on `user_id`, `credential_id`, `tenant_id`
- [ ] Challenge cleanup function has `SET search_path = public`
- [ ] Challenge cleanup scheduled (cron job, every hour)

### Server
- [ ] `verifyRegistrationResponse` is called in register-finish (NOT skipped)
- [ ] COSE public key stored from `registrationInfo.credentialPublicKey` (NOT attestation object)
- [ ] `verifyAuthenticationResponse` is called in auth-finish
- [ ] Counter updated after each successful authentication
- [ ] Challenges marked as used after verification
- [ ] All audit log inserts use correct column names (test by checking DB after each operation)
- [ ] No `SELECT *` — explicit column lists only
- [ ] Error responses don't leak internal details

### Client
- [ ] `isPasskeySupported()` check before showing biometric UI
- [ ] Graceful fallback when biometrics not available
- [ ] Clear error messages for: cancelled, timed out, already registered, not supported
- [ ] Session properly set after successful authentication

### Testing
- [ ] Registration flow: start → browser prompt → finish → credential in DB
- [ ] Authentication flow: start → browser prompt → finish → session returned
- [ ] Replay attack: reuse a challenge → should fail
- [ ] Expired challenge: wait 5+ minutes → should fail
- [ ] Wrong credential: use credential from different user → should fail
- [ ] Counter rollback: send lower counter → should fail (cloned authenticator detection)

---

## Common AI Mistakes

These are the exact mistakes made building WellFit's passkey system. Copy this table into your CLAUDE.md or AI governance doc for the new project.

| # | Mistake | What AI Did | What It Should Have Done | How to Catch It |
|---|---------|-------------|--------------------------|-----------------|
| 1 | **Skipped attestation verification** | Wrote `// simplified - in production use full verification` and stored raw data | Call `verifyRegistrationResponse` — it's one function call | Search for "simplified", "for now", "in production" comments |
| 2 | **Stored attestation object as public key** | `public_key: response.attestationObject` | `public_key: verification.registrationInfo.credentialPublicKey` | Check what's being stored — is it from `verification.registrationInfo` or from `body/response`? |
| 3 | **Wrong column names in audit inserts** | Used `operation` when table has `action` | Read the actual migration CREATE TABLE before writing INSERT | `grep` the migration for column names before coding |
| 4 | **Added columns that don't exist** | Inserted `resource_type` into a table without that column | Only insert columns that exist in the CREATE TABLE | Cross-reference every INSERT against the schema |
| 5 | **Used `SELECT *`** | `supabase.from('table').select('*')` | `supabase.from('table').select('id, user_id, credential_id, ...')` | `grep` for `select('*')` or `SELECT *` |
| 6 | **Forgot `SET search_path` on SECURITY DEFINER** | `SECURITY DEFINER` without `SET search_path = public` | Always pair them | Search for `SECURITY DEFINER` without `SET search_path` |
| 7 | **Wrote fake tests** | Tests that create local data structures and assert on them — never call the actual function | Tests that mock the database/auth but call the real handler | Ask: "Does this test fail if I delete the function's logic?" |
| 8 | **Declared it done without end-to-end verification** | Said "passkey login is complete" when register stores wrong data → auth always fails | Test the actual flow: register → log out → log in with biometric | Try it yourself in the browser |
| 9 | **Stored public key as TEXT instead of BYTEA** | `public_key TEXT` in migration | `public_key BYTEA` — binary data stored as binary | Check column type in migration |
| 10 | **No multi-tenant isolation** | Forgot `tenant_id` on credentials table | Every table in a multi-tenant app gets `tenant_id` | Compare new table against existing tables' column patterns |

### The #1 Rule for AI Building Passkey Auth

**Do NOT let AI skip `verifyRegistrationResponse` or `verifyAuthenticationResponse`.** These are the entire point of WebAuthn security. Without them, you have a login system that trusts whatever the browser sends — which means anyone with Postman can register fake credentials and log in as any user.

If you see comments like "simplified for now", "in production use full verification", or "we'll add this later" — **stop the AI immediately.** That is the verification. There is no "simplified" version.

---

## Glossary

| Term | Definition |
|------|-----------|
| **WebAuthn** | W3C standard for passwordless authentication using public key cryptography |
| **Passkey** | User-friendly name for a WebAuthn credential (Apple/Google marketing term) |
| **FIDO2** | The broader protocol that includes WebAuthn (browser API) + CTAP2 (authenticator protocol) |
| **Relying Party (RP)** | Your application — identified by domain name |
| **COSE Key** | CBOR Object Signing and Encryption — the format WebAuthn uses for public keys |
| **CBOR** | Concise Binary Object Representation — binary encoding format (like JSON but binary) |
| **Attestation** | Proof from the authenticator during registration (contains the public key) |
| **Assertion** | Proof from the authenticator during login (contains a signature) |
| **Platform Authenticator** | Built into the device: Touch ID, Face ID, Windows Hello, Android fingerprint |
| **Cross-Platform Authenticator** | External device: YubiKey, USB security key, NFC key |
| **Discoverable Credential** | Passkey stored on the authenticator that can be found without a credential ID (enables "usernameless" login) |
| **Counter** | Number that increments each time a passkey is used — if it goes backward, the authenticator was cloned |
| **SimpleWebAuthn** | The open-source library that handles all the cryptographic verification — use it, don't roll your own |
| **Challenge** | Random bytes generated by the server to prevent replay attacks — expires in 5 minutes |
| **User Verification** | Confirming the person is who they say they are (biometric scan, device PIN) — not just possession of the key |

---

*Built with lessons from WellFit Community's passkey implementation. Every mistake in this guide was made by an AI assistant and caught during audit. The guide exists so you don't pay for the same mistakes twice.*
