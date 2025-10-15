# URGENT: Fix 404 Login Error Before Thursday Presentation

## Problem
404 NOT_FOUND error when clicking login button.
Error ID: `cle1::trqcv-1760492980893-7952bd28c446`

## Root Cause
Supabase Auth is trying to verify hCaptcha server-side but the hCaptcha secret is not configured in Supabase project settings.

## IMMEDIATE FIX (5 minutes)

### Step 1: Configure hCaptcha in Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/auth/providers
2. Scroll down to **"CAPTCHA Protection"** section
3. Click "Enable hCaptcha"
4. Enter your hCaptcha Site Key and Secret Key from your hCaptcha account
5. Click **Save**

### Step 2: Verify the Fix

1. Clear your browser cache
2. Try logging in again
3. The 404 error should be gone

## Alternative Quick Fix (if Step 1 doesn't work)

If you can't access Supabase dashboard or need immediate fix, disable hCaptcha verification temporarily:

Edit `/workspaces/WellFit-Community-Daily-Complete/src/pages/LoginPage.tsx`:

Change line 210-216 from:
```typescript
const token = await ensureCaptcha();
if (!token) throw new Error('Captcha required.');

const { error: signInError } = await supabase.auth.signInWithPassword({
  phone: e164,
  password: seniorPassword,
  options: { captchaToken: token },
});
```

To:
```typescript
// Temporarily bypass captcha for demo
const { error: signInError } = await supabase.auth.signInWithPassword({
  phone: e164,
  password: seniorPassword,
});
```

Do the same for Admin login (lines 256-262).

**IMPORTANT:** Re-enable hCaptcha after the presentation for security!

## Testing Before Presentation

1. Test senior login with phone number
2. Test admin login with email
3. Verify both work without 404 errors

## Notes
- The migration with `role` and `role_code` columns was already applied
- The error is NOT from database queries
- The error is from Supabase Auth's hCaptcha verification endpoint returning 404
