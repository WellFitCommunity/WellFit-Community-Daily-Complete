# Tenant Identifier System Documentation

**Last Updated**: November 18, 2025
**Version**: 1.0
**Status**: ✅ Active

---

## Overview

The WellFit platform uses a **Tenant Code + PIN** authentication system to support multi-tenant architecture. This allows multiple organizations to securely access their isolated data through unique tenant identifiers.

---

## Authentication Types

### 1. Envision Master Admin (Platform Management)
- **Route**: `/envision` (private, not publicly linked)
- **Input**: Email + PIN only  
- **No Tenant Code Required**
- **Redirects To**: `/super-admin` (Master Admin Panel)
- **Database**: `super_admin_users` table with `tenant_id = NULL`

**Example**:
```
Email: admin@envisionvirtualedge.com
PIN: 1234
→ Access to all tenants, platform controls
```

### 2. Tenant Admin (Organization Admin)
- **Route**: `/admin`
- **Input**: Tenant Code + PIN
- **Format**: `[CODE]-[PIN]` or `[CODE] + [PIN]`
- **Database**: `admin_users` table with specific `tenant_id`

**Example**:
```
Tenant Code: P3
PIN: 5678  
→ Access to Law Enforcement tenant only
```

---

## Current Tenant Codes

| Organization | Code | Status |
|-------------|------|--------|
| Envision VirtualEdge | (None) | Active - Master Admin |
| Law Enforcement | `P3` | Active |
| WellFit Community | `WF` | Pending - After Methodist |

---

## How Login Works

### Tenant Login Flow
```
1. User enters: P3 + 5678
2. System looks up tenant_id for "P3"
3. Validates PIN against hashed value
4. Sets tenant context in session
5. Redirects to tenant admin panel
```

### Envision Login Flow  
```
1. User enters: email + PIN
2. Authenticates via Supabase Auth
3. Verifies in super_admin_users table
4. No tenant context (tenant_id = NULL)
5. Redirects to /super-admin with vault animation
```

---

## Security Features

- ✅ PIN hashing (bcrypt)
- ✅ Rate limiting (5 attempts = 15min lockout)
- ✅ Row Level Security (RLS) for data isolation
- ✅ Audit logging for all auth attempts
- ✅ Session expiry
- ✅ HTTPS only

---

## Key Files

- **EnvisionLoginPage**: `src/pages/EnvisionLoginPage.tsx`
- **AdminLoginPage**: `src/pages/AdminLoginPage.tsx`
- **admin-login function**: `supabase/functions/admin-login/`
- **verify-admin-pin function**: `supabase/functions/verify-admin-pin/`

---

## Database Tables

### `tenants`
```sql
tenant_code TEXT UNIQUE  -- e.g., 'P3', 'WF'
name TEXT                -- e.g., 'Law Enforcement'
```

### `admin_users`  
```sql
tenant_id UUID           -- NULL = Envision Master Admin
pin_hash TEXT            -- Bcrypt hashed PIN
role staff_role          -- 'super_admin' | 'admin' | etc.
```

### `super_admin_users`
```sql
user_id UUID             -- Links to auth.users
permissions JSONB        -- Cross-tenant permissions
```

---

## Troubleshooting

**"Invalid tenant code"**
- Verify code exists in `tenants` table
- Check spelling (case-insensitive but normalized to uppercase)

**"Invalid PIN"**
- Wait 15 minutes if locked out
- Reset via Master Admin Panel

**"Unauthorized: Super admin access required"**
- Only Envision personnel can access `/envision`
- Regular users use `/admin` with tenant code

---

For support: support@envisionvirtualedge.com
