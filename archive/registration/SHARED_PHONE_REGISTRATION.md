# Shared Phone Registration System

## Problem

In low-income communities, it's common for family members (spouses, parents/children) to share a single phone. Traditional phone-based authentication assumes one phone = one user, which doesn't work for these communities.

## Solution

WellFit supports **multiple users registering with the same phone number** by using a hybrid email/phone authentication approach.

---

## How It Works

### Scenario 1: User Provides Email (Standard Registration)
```
User: John Smith
Phone: +15551234567
Email: john@example.com
```

**Registration:**
- Auth identifier: `john@example.com`
- Auth phone: `+15551234567`
- Login method: Email + password OR Phone + password

**Result:** Traditional Supabase Auth user

---

### Scenario 2: First User Without Email (Phone-Only)
```
User: Maria Garcia
Phone: +15551234567
Email: (none provided)
```

**Registration:**
- Auth identifier: `15551234567_a1b2c3d4@wellfit.internal` (auto-generated)
- Auth phone: `+15551234567`
- Actual phone stored in: `user_metadata.actual_phone` and `profiles.phone`
- Login method: Phone + password (app looks up generated email internally)

**Result:** Phone-only user with generated internal email

---

### Scenario 3: Second User on Same Phone (Shared Phone)
```
User: Carlos Garcia (Maria's husband)
Phone: +15551234567 (same as Maria's)
Email: (none provided)
```

**Registration:**
- Auth identifier: `15551234567_x9y8z7w6@wellfit.internal` (different ID)
- Auth phone: `undefined` (NOT SET - Maria already uses this phone in auth)
- Actual phone stored in: `user_metadata.actual_phone` and `profiles.phone`
- Flags: `user_metadata.is_shared_phone = true`
- Login method: Generated email + password (app must handle lookup)

**Result:** Shared phone user - can't login with phone number alone

---

## Database Structure

### auth.users table
```
| id   | email                              | phone         | user_metadata                    |
|------|------------------------------------|---------------|----------------------------------|
| uuid1| john@example.com                   | +15551234567  | {...}                           |
| uuid2| 15551234567_a1b2@wellfit.internal | +15551234567  | {actual_phone: +15551234567}    |
| uuid3| 15551234567_x9y8@wellfit.internal | null          | {actual_phone: +15551234567, is_shared_phone: true} |
```

### profiles table
```
| user_id | phone         | email            | first_name | last_name |
|---------|---------------|------------------|------------|-----------|
| uuid1   | +15551234567  | john@example.com | John       | Smith     |
| uuid2   | +15551234567  | null             | Maria      | Garcia    |
| uuid3   | +15551234567  | null             | Carlos     | Garcia    |
```

**Note:** All users have the same phone in profiles - this is their actual contact number.

---

## Login Flow

### For Standard Users (Has Email or First Phone-Only User)
```typescript
// User enters: phone + password
// Backend can use: phone-based login

const { data, error } = await supabase.auth.signInWithPassword({
  phone: '+15551234567',
  password: 'user_password'
});
```

**Works:** Supabase Auth finds the user by phone

---

### For Shared Phone Users (Second+ User on Same Phone)
```typescript
// PROBLEM: Can't login with phone (not in auth.users.phone)
// SOLUTION: App must look up the generated email first

// Step 1: Get all users with this phone from profiles
const { data: users } = await supabase
  .from('profiles')
  .select('user_id, first_name, last_name, email')
  .eq('phone', '+15551234567');

// Step 2: Show user list to select which account
// User selects: "Carlos Garcia"

// Step 3: Get auth email from user_metadata
const { data: { user } } = await supabase.auth.admin.getUserById(selectedUserId);
const authEmail = user.email; // "15551234567_x9y8@wellfit.internal"

// Step 4: Login with generated email
const { data, error } = await supabase.auth.signInWithPassword({
  email: authEmail,
  password: 'user_password'
});
```

---

## Frontend Implementation

### Registration Response
```json
{
  "ok": true,
  "message": "Registration completed successfully!",
  "user": {
    "user_id": "uuid-here",
    "phone": "+15551234567",
    "email": null,
    "first_name": "Carlos",
    "last_name": "Garcia",
    "is_shared_phone": true,
    "login_identifier": "15551234567_x9y8@wellfit.internal"
  },
  "session": { ... }
}
```

### Login Page Logic
```typescript
async function handleLogin(phone: string, password: string) {
  // Step 1: Check if multiple users share this phone
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, email')
    .eq('phone', phone);

  if (!profiles || profiles.length === 0) {
    return { error: "No account found with this phone number" };
  }

  if (profiles.length === 1) {
    // Single user - standard phone login
    return await supabase.auth.signInWithPassword({
      phone: phone,
      password: password
    });
  }

  // Multiple users share this phone
  // Show account selector
  const selectedProfile = await showAccountSelector(profiles);

  // Get user's auth email (might be generated internal email)
  const { data: { user } } = await supabase.auth.admin.getUserById(selectedProfile.user_id);

  // Login with email (works for both real and generated emails)
  return await supabase.auth.signInWithPassword({
    email: user.email,
    password: password
  });
}
```

### Account Selector UI
```tsx
function AccountSelector({ accounts, onSelect }) {
  return (
    <div>
      <h2>Multiple accounts use this phone number</h2>
      <p>Select your account:</p>
      {accounts.map(account => (
        <button key={account.user_id} onClick={() => onSelect(account)}>
          {account.first_name} {account.last_name}
          {account.email && ` (${account.email})`}
        </button>
      ))}
    </div>
  );
}
```

---

## User Experience

### First Time Registration (No Email)
1. User enters phone number → SMS code sent
2. User verifies code
3. ✅ Registration complete
4. ✅ Auto-logged in
5. **Suggested:** App shows message: "Save your password! You'll need it to login later."

### Second Person on Same Phone
1. User enters phone number → SMS code sent (same phone)
2. User verifies code
3. ✅ Registration complete
4. ✅ Auto-logged in
5. **Important:** App shows: "This phone is shared with another account. When logging in, you'll select your name from a list."

### Login with Shared Phone
1. User enters phone + password
2. App detects multiple accounts
3. **Shows:** "Maria Garcia" and "Carlos Garcia" buttons
4. User clicks their name
5. ✅ Logged in as selected user

---

## Security Considerations

### ✅ Secure
- Each user has unique password (even if sharing phone)
- SMS verification still required (proves physical access to phone)
- Separate user sessions and data
- Generated emails are unpredictable (crypto.randomUUID())

### ⚠️ Considerations
- Physical access to phone = potential access to all accounts
  - **Mitigation:** Users should use PIN/biometric on phone
  - **Mitigation:** App can require additional verification for sensitive actions
- User must remember which account is theirs
  - **Mitigation:** Show first name during login
  - **Mitigation:** Profile pictures help

---

## Database Queries for Debugging

### Find all users sharing a phone
```sql
SELECT
  p.user_id,
  p.first_name,
  p.last_name,
  p.phone,
  u.email,
  u.phone as auth_phone,
  (u.raw_user_meta_data->>'is_shared_phone')::boolean as is_shared_phone
FROM profiles p
JOIN auth.users u ON p.user_id = u.id
WHERE p.phone = '+15551234567'
ORDER BY u.created_at;
```

### Check for internal emails
```sql
SELECT
  id,
  email,
  phone,
  created_at,
  raw_user_meta_data->>'is_shared_phone' as is_shared_phone,
  raw_user_meta_data->>'actual_phone' as actual_phone
FROM auth.users
WHERE email LIKE '%@wellfit.internal'
ORDER BY created_at DESC;
```

---

## Migration Path

### Existing Users
No changes needed - existing users continue working as before.

### New Feature Rollout
1. ✅ Deploy updated `sms-verify-code` function
2. ✅ Update login page to check for multiple profiles
3. ✅ Add account selector UI component
4. ✅ Test with dev accounts
5. ✅ Monitor logs for `is_shared_phone` flag

---

## Testing Checklist

- [ ] Register first user without email
- [ ] Register second user with same phone (no email)
- [ ] Verify both users in profiles table
- [ ] Check auth.users - second user should have null phone
- [ ] Login with first user - should work with phone + password
- [ ] Login with second user - should show account selector
- [ ] Verify sessions are separate
- [ ] Test password reset for shared phone users

---

## Future Enhancements

1. **Profile Pictures:** Help users identify their account visually
2. **Last Login Time:** Show "Last used 2 hours ago" to help identify account
3. **Biometric Auth:** Fingerprint/face ID for faster shared phone login
4. **Family Accounts:** Explicit family linking with shared access to some data

---

**Last Updated:** 2025-11-24
**Status:** Implemented and deployed
**Feature:** Shared Phone Registration for Low-Income Communities
