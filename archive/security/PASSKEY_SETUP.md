# Passkey/Biometric Authentication System

## Overview

This system enables passwordless biometric login using WebAuthn/Passkeys. Users can authenticate using:

- **Touch ID** (Mac, iPhone, iPad)
- **Face ID** (iPhone, iPad)
- **Windows Hello** (Windows 10/11)
- **Fingerprint sensors** (Android, laptops)
- **USB Security Keys** (YubiKey, etc.)

## Features

✅ **Passwordless Login** - Users can skip entering passwords entirely
✅ **Multi-Device Support** - Register multiple biometric devices
✅ **Secure by Design** - Uses public-key cryptography (FIDO2/WebAuthn)
✅ **Privacy Focused** - Biometric data never leaves the device
✅ **Audit Logging** - All passkey operations are logged for compliance
✅ **Fallback Support** - Traditional password login remains available

## Architecture

### Database Tables

#### `passkey_credentials`
Stores WebAuthn credentials for each user:
- `credential_id` - Unique identifier from authenticator
- `public_key` - Public key for signature verification
- `counter` - Signature counter for replay protection
- `authenticator_type` - Platform (built-in) or cross-platform (USB)
- `device_name` - User-friendly name
- `last_used_at` - Track usage for security monitoring

#### `passkey_challenges`
Temporary storage for challenges (prevents replay attacks):
- `challenge` - Random value sent to client
- `type` - Registration or authentication
- `expires_at` - Auto-expires after 5 minutes
- `used` - Prevents challenge reuse

#### `passkey_audit_log`
Security audit trail for all passkey operations:
- `action` - register, authenticate, delete, failed_auth
- `success` - Whether operation succeeded
- `error_message` - Failure details
- `ip_address` - Client IP (logged by Edge Function)
- `user_agent` - Browser/device info

### Edge Functions

#### `passkey-register-start`
**Purpose:** Initiate passkey registration
**Auth:** Requires valid user session
**Returns:** WebAuthn creation options with challenge

```typescript
POST /functions/v1/passkey-register-start
Headers: Authorization: Bearer <token>
Body: {
  "user_name": "user@example.com",
  "display_name": "John Doe",
  "prefer_platform": true
}
```

#### `passkey-register-finish`
**Purpose:** Complete passkey registration and store credential
**Auth:** Requires valid user session
**Returns:** Saved credential record

```typescript
POST /functions/v1/passkey-register-finish
Headers: Authorization: Bearer <token>
Body: {
  "id": "<credential-id>",
  "rawId": "<base64url-encoded-raw-id>",
  "response": {
    "clientDataJSON": "<base64url>",
    "attestationObject": "<base64url>",
    "transports": ["internal", "usb"]
  },
  "authenticatorAttachment": "platform",
  "device_name": "My iPhone",
  "user_agent": "<browser-user-agent>"
}
```

#### `passkey-auth-start`
**Purpose:** Initiate passkey authentication
**Auth:** Public (no auth required)
**Returns:** WebAuthn request options with challenge

```typescript
POST /functions/v1/passkey-auth-start
Body: {
  "user_id": "<optional-user-id>"
}
```

#### `passkey-auth-finish`
**Purpose:** Complete authentication and create session
**Auth:** Public (verified via signature)
**Returns:** User info and session

```typescript
POST /functions/v1/passkey-auth-finish
Body: {
  "id": "<credential-id>",
  "rawId": "<base64url>",
  "response": {
    "clientDataJSON": "<base64url>",
    "authenticatorData": "<base64url>",
    "signature": "<base64url>",
    "userHandle": "<base64url>"
  }
}
```

### Frontend Components

#### `PasskeySetup.tsx`
Registration and management component for user settings:
- Check browser support
- Register new passkeys
- View registered devices
- Remove passkeys
- User-friendly error messages

#### `passkeyService.ts`
Client-side WebAuthn service with helper functions:
- `isPasskeySupported()` - Check browser compatibility
- `isPlatformAuthenticatorAvailable()` - Check for Touch ID, Face ID, etc.
- `registerPasskey()` - Complete registration flow
- `authenticateWithPasskey()` - Complete authentication flow
- `getUserPasskeys()` - List user's registered devices
- `deletePasskey()` - Remove a device

#### `LoginPage.tsx` Integration
Added biometric login button:
- Only shows if browser supports WebAuthn
- "OR" divider between password and biometric login
- Friendly error messages
- Automatic redirect after successful auth

## User Flow

### Registration Flow

1. User navigates to Settings → Security & Login
2. Clicks "Add Biometric Authentication"
3. Optionally enters device name (e.g., "My iPhone")
4. System calls `passkey-register-start` to get challenge
5. Browser prompts for biometric (Touch ID, Face ID, etc.)
6. User authenticates with biometric
7. System calls `passkey-register-finish` to save credential
8. Success! Device is now registered

### Login Flow

1. User navigates to Login page
2. Sees "Login with Biometrics" button (if supported)
3. Clicks button
4. System calls `passkey-auth-start` to get challenge
5. Browser prompts for biometric
6. User authenticates with biometric
7. System calls `passkey-auth-finish` to verify signature
8. User is logged in automatically

## Security Considerations

### ✅ Implemented

- **Public Key Cryptography** - Private keys never leave device
- **Challenge-Response** - Prevents replay attacks
- **Signature Counter** - Detects cloned authenticators
- **CORS Protection** - Strict origin allowlist
- **Rate Limiting** - Built into Edge Functions
- **Audit Logging** - All operations tracked
- **RLS Policies** - Row-level security on all tables
- **Challenge Expiry** - Challenges expire after 5 minutes
- **One-Time Use** - Challenges can only be used once

### ⚠️ Production Recommendations

1. **Full Signature Verification**
   - Current implementation skips full cryptographic verification
   - Use a WebAuthn library like `@simplewebauthn/server` for production
   - Verify attestation objects properly
   - Implement full signature validation

2. **Session Management**
   - Current implementation returns user info without creating a proper session
   - Implement custom JWT generation or use Supabase magic links
   - Set proper session expiry and refresh tokens

3. **Device Management**
   - Add ability to rename devices
   - Show last used location/IP
   - Send notifications when new devices are added
   - Add device limits per user

4. **Attestation Verification**
   - Verify authenticator attestation certificates
   - Check against known compromised authenticators
   - Store AAGUID for authenticator identification

5. **Database Migration**
   - The migration creates the tables but may conflict with existing tables
   - Run manually in production using Supabase dashboard
   - Or use: `supabase db push` (review changes first)

## Browser Compatibility

| Browser | Platform | Support |
|---------|----------|---------|
| Safari  | macOS    | ✅ Touch ID |
| Safari  | iOS      | ✅ Touch ID / Face ID |
| Chrome  | Windows  | ✅ Windows Hello |
| Chrome  | macOS    | ✅ Touch ID |
| Chrome  | Android  | ✅ Fingerprint |
| Edge    | Windows  | ✅ Windows Hello |
| Firefox | All      | ✅ (56+) |

## Testing

### Local Development

1. **HTTPS Required** (except localhost)
   - WebAuthn requires HTTPS in production
   - Works on `localhost` without HTTPS
   - Use ngrok or similar for mobile testing

2. **Test Registration**
   ```bash
   # Start dev server
   npm run dev

   # Login as a user
   # Navigate to Settings → Security & Login
   # Click "Add Biometric Authentication"
   # Test with your device's biometric sensor
   ```

3. **Test Authentication**
   ```bash
   # Logout
   # Go to Login page
   # Click "Login with Biometrics"
   # Authenticate with biometric
   ```

### Edge Function Testing

```bash
# Deploy functions
supabase functions deploy passkey-register-start
supabase functions deploy passkey-register-finish
supabase functions deploy passkey-auth-start
supabase functions deploy passkey-auth-finish

# Test with curl
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/passkey-register-start \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_name":"test","display_name":"Test User","prefer_platform":true}'
```

## Troubleshooting

### "Passkeys not supported" message

**Cause:** Browser doesn't support WebAuthn
**Solution:** Use Chrome 67+, Safari 13+, Firefox 60+, or Edge 18+

### "Authentication was cancelled or timed out"

**Cause:** User cancelled biometric prompt or it timed out
**Solution:** Try again, ensure biometric sensor is working

### "No passkey found for this account"

**Cause:** User hasn't registered a passkey yet
**Solution:** Go to Settings → Security & Login and add a passkey

### "Invalid or expired challenge"

**Cause:** Challenge expired (5 min limit) or was already used
**Solution:** Retry registration/login to get a new challenge

### Edge Function CORS errors

**Cause:** Request from unauthorized origin
**Solution:** Add origin to `ALLOWED_ORIGINS` in Edge Functions

## Future Enhancements

- [ ] Conditional UI (only show if user has registered passkeys)
- [ ] Passkey-only accounts (no password required)
- [ ] Cross-device authentication (QR code flow)
- [ ] Backup codes for account recovery
- [ ] Admin panel for passkey management
- [ ] Passkey usage analytics/metrics
- [ ] Support for passkey-autofill (username-less login)
- [ ] Integration with password managers (1Password, Bitwarden)

## Resources

- [WebAuthn Guide](https://webauthn.guide/)
- [FIDO Alliance](https://fidoalliance.org/)
- [W3C WebAuthn Spec](https://www.w3.org/TR/webauthn-2/)
- [Can I Use WebAuthn](https://caniuse.com/webauthn)
- [SimpleWebAuthn Library](https://simplewebauthn.dev/)

## Support

For issues or questions:
1. Check browser console for errors
2. Review `passkey_audit_log` table for failed operations
3. Check Edge Function logs in Supabase dashboard
4. Review this documentation

---

**Note:** This implementation provides a solid foundation but requires additional cryptographic verification for production use. Consider using established libraries like `@simplewebauthn/server` for production deployments.
