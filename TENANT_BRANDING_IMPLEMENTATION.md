# Tenant Branding Configuration System

## Overview

This implementation replaces hardcoded branding in `branding.config.ts` with a **database-driven, multi-tenant branding system**. Each tenant (WellFit Houston, Miami, Phoenix) can now have custom:

- 🎨 Brand colors (primary, secondary, accent)
- 🖼️ Logo upload
- 📝 Custom app name
- 🌈 Gradient headers
- 📄 Custom footer text
- ⚙️ Advanced theme settings

## Architecture

### Database Layer
- **Table:** `tenants` (extended with branding columns)
- **Functions:** `get_tenant_branding_by_subdomain()`, `get_all_active_tenants()`
- **Audit:** `tenant_branding_audit` table tracks all branding changes
- **Storage:** Supabase Storage bucket `tenant-logos` for logo uploads

### Service Layer
- **File:** `src/services/tenantBrandingService.ts`
- **Functions:**
  - `fetchTenantBrandingBySubdomain(subdomain)` - Load branding by subdomain
  - `fetchTenantBrandingById(tenantId)` - Load branding by tenant ID
  - `fetchAllActiveTenants()` - List all tenants (for admin dropdown)
  - `updateTenantBranding(tenantId, updates)` - Update branding (admin only)
  - `uploadTenantLogo(tenantId, file)` - Upload logo to Supabase Storage

### React Layer
- **Context:** `src/BrandingContext.tsx` (updated to load from database)
- **Hook:** `src/hooks/useTenantBranding.ts`
- **Component:** `src/components/admin/TenantBrandingManager.tsx` (admin UI)

## Database Schema

### Tenants Table Columns (Added)

```sql
-- Branding Configuration
app_name TEXT DEFAULT 'WellFit Community'
logo_url TEXT
primary_color TEXT DEFAULT '#003865'
secondary_color TEXT DEFAULT '#8cc63f'
accent_color TEXT
text_color TEXT DEFAULT '#ffffff'
gradient TEXT DEFAULT 'linear-gradient(to bottom right, #003865, #8cc63f)'
contact_info TEXT
custom_footer TEXT
favicon_url TEXT
subdomain TEXT UNIQUE
custom_css JSONB DEFAULT '{}'
theme_settings JSONB DEFAULT '{}'
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### Current Tenants (Migrated)

| Tenant Name | Subdomain | Primary Color | Secondary Color |
|-------------|-----------|---------------|-----------------|
| WellFit | www | #003865 (Blue) | #8cc63f (Green) |
| WellFit Houston | houston | #C8102E (Red) | #FFDC00 (Gold) |
| WellFit Miami | miami | #00B4A6 (Teal) | #FF6B35 (Coral) |
| WellFit Phoenix | phoenix | #D2691E (Orange) | #8B4513 (Brown) |

## Implementation Steps

### 1. Run Database Migration

```bash
# Apply the migration
PGPASSWORD="MyDaddyLovesMeToo1" psql -h aws-0-us-west-1.pooler.supabase.com -p 6543 \
  -U postgres.xkybsjnvuohpqpbkikyn -d postgres \
  -f supabase/migrations/20251028000000_tenant_branding_configuration.sql
```

**What it does:**
- Adds branding columns to `tenants` table
- Migrates existing hardcoded branding from `branding.config.ts` to database
- Creates database functions for branding retrieval
- Sets up audit table for tracking changes
- Applies RLS policies

### 2. Create Supabase Storage Bucket

**Manual Step (Supabase Dashboard):**

1. Go to **Storage** > **Create Bucket**
2. Bucket name: `tenant-logos`
3. Settings:
   - **Public:** Yes (logos need to be publicly accessible)
   - **File size limit:** 5MB
   - **Allowed MIME types:** `image/png`, `image/jpeg`, `image/svg+xml`

4. **Storage Policies** (create these in the Dashboard):
   - **Upload:** Only authenticated admins can upload
   - **Read:** Public (anyone can view logos)

```sql
-- Upload policy (create in Supabase Dashboard > Storage > Policies)
CREATE POLICY "tenant_logo_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND (is_admin() OR auth.uid()::text = (storage.foldername(name))[1])
);

-- Public read policy
CREATE POLICY "tenant_logo_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tenant-logos');
```

### 3. Access Admin UI

Navigate to:
```
/admin/branding
```

Or add a link in your admin navigation:
```tsx
<button onClick={() => navigate('/admin/branding')}>
  🎨 Tenant Branding
</button>
```

## Usage Examples

### For Developers

#### Load Current Tenant Branding
```tsx
import { useBranding } from '../BrandingContext';

function MyComponent() {
  const { branding, loading } = useBranding();

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ color: branding.primaryColor }}>
      <h1>{branding.appName}</h1>
      <img src={branding.logoUrl} alt="Logo" />
    </div>
  );
}
```

#### Load Specific Tenant Branding (Admin Panel)
```tsx
import { useTenantBrandingBySubdomain } from '../hooks/useTenantBranding';

function TenantPreview() {
  const { branding, loading } = useTenantBrandingBySubdomain('houston');

  return (
    <div style={{ background: branding?.gradient }}>
      {branding?.appName}
    </div>
  );
}
```

#### Update Branding Programmatically
```tsx
import { updateTenantBranding } from '../services/tenantBrandingService';

async function changePrimaryColor(tenantId: string, color: string) {
  const result = await updateTenantBranding(tenantId, {
    primaryColor: color,
  });

  if (result.success) {
    console.log('Branding updated!');
  }
}
```

### For Admins

#### Change Tenant Colors

1. Go to **Admin Panel** > **Tenant Branding**
2. Select tenant from dropdown (Houston, Miami, Phoenix)
3. Use color pickers or enter hex codes
4. See **live preview** at top of page
5. Click **Save Branding**

#### Upload Logo

1. Select tenant
2. Click **Choose File** under "Logo Upload"
3. Select PNG/JPG/SVG (max 5MB)
4. Preview appears immediately
5. Click **Save Branding** to apply

#### Customize per Tenant

**Example: Houston wants red theme**
- Primary Color: `#C8102E` (Houston Red)
- Secondary Color: `#FFDC00` (Houston Gold)
- App Name: "WellFit Houston"
- Contact Info: "Houston Senior Services"
- Custom Footer: "© 2025 WellFit Houston. Powered by Houston Senior Services."

## File Structure

```
src/
├── services/
│   └── tenantBrandingService.ts       # Database operations
├── hooks/
│   └── useTenantBranding.ts           # React hooks
├── components/
│   └── admin/
│       ├── TenantBrandingManager.tsx  # Admin UI
│       └── AdminHeader.tsx            # Updated with dynamic branding
├── BrandingContext.tsx                # Updated to load from DB
└── branding.config.ts                 # Legacy (now fallback only)

supabase/
└── migrations/
    └── 20251028000000_tenant_branding_configuration.sql
```

## Migration from Hardcoded to Database

### Before (Hardcoded)
```tsx
// branding.config.ts
export const tenantBrandings: TenantBranding[] = [
  {
    subdomain: 'houston',
    appName: 'WellFit Houston',
    primaryColor: '#C8102E',
    // ... hardcoded values
  }
];
```

### After (Database-Driven)
```tsx
// Loaded from database automatically
const { branding } = useBranding();
// branding.primaryColor comes from tenants table
```

**Benefits:**
- ✅ No code deployment needed to change branding
- ✅ Admins can change colors via UI
- ✅ Audit trail of all changes
- ✅ Logo uploads without developer involvement

## Testing

### Test Local Subdomain Simulation
```tsx
import { simulateTenant } from './utils/tenantUtils';

// In development console
simulateTenant('houston'); // Simulates houston.localhost
```

### Test Database Functions
```sql
-- Test subdomain lookup
SELECT * FROM get_tenant_branding_by_subdomain('houston');

-- Test all tenants
SELECT * FROM get_all_active_tenants();

-- Check audit log
SELECT * FROM tenant_branding_audit ORDER BY created_at DESC LIMIT 10;
```

### Test Admin UI
1. Navigate to `/admin/branding`
2. Select "WellFit Houston"
3. Change primary color to `#FF0000` (red)
4. Click Save
5. Verify AdminHeader background changes to red gradient
6. Check `tenant_branding_audit` table for change record

## Security

### RLS Policies
- **Read:** All authenticated users can read tenant branding (needed for UI)
- **Write:** Only admins can update branding (`is_admin()` check)
- **Audit:** All changes logged with user ID and timestamp

### Logo Upload Security
- **File types:** Only PNG, JPG, SVG allowed
- **File size:** Max 5MB enforced
- **Upload policy:** Only admins can upload
- **Naming:** Files stored as `{tenantId}/logo-{timestamp}.{ext}`

## Performance

### Caching Strategy
- **BrandingContext:** Loads once on app mount
- **RefreshBranding:** Call `refreshBranding()` to reload
- **Supabase RPC:** Fast (< 50ms typical)

### Optimization Tips
```tsx
// Cache branding in localStorage for offline support
useEffect(() => {
  if (branding) {
    localStorage.setItem('cached_branding', JSON.stringify(branding));
  }
}, [branding]);
```

## Troubleshooting

### Branding not updating after save
```tsx
// Manually refresh branding
const { refreshBranding } = useBranding();
await refreshBranding();
```

### Logo not displaying
1. Check Supabase Storage bucket exists: `tenant-logos`
2. Verify bucket is public
3. Check browser console for CORS errors
4. Verify file uploaded successfully:
   ```sql
   SELECT * FROM storage.objects WHERE bucket_id = 'tenant-logos';
   ```

### Hardcoded colors still showing
- Clear browser cache
- Check component is using `useBranding()` hook
- Verify `BrandingProvider` wraps your app in `index.tsx`

### Database function not found
```bash
# Re-run migration
psql -f supabase/migrations/20251028000000_tenant_branding_configuration.sql
```

## Rollback Plan

If you need to revert to hardcoded branding:

1. **Update BrandingContext.tsx:**
```tsx
// Replace
const dbBranding = await getCurrentTenantBranding();

// With
const dbBranding = getCurrentBranding(); // Uses hardcoded config
```

2. **Hide admin UI:**
```tsx
// Remove route or hide button
// <Route path="/admin/branding" element={<TenantBrandingManager />} />
```

3. **Database stays intact** (no data loss)

## Future Enhancements

- [ ] Font family configuration per tenant
- [ ] Advanced CSS overrides (spacing, border radius)
- [ ] Favicon upload per tenant
- [ ] Dark mode toggle per tenant
- [ ] Branding versioning (rollback to previous)
- [ ] A/B testing different branding
- [ ] Bulk import branding from JSON
- [ ] Tenant branding preview before save

## Support

**Questions?**
- Check audit logs: `SELECT * FROM tenant_branding_audit`
- Review console errors: `[TenantBranding]` prefix
- Verify RLS policies: `\dp tenants` in psql

**Need help?**
- Documentation: `/TENANT_BRANDING_IMPLEMENTATION.md`
- Database schema: `supabase/migrations/20251028000000_tenant_branding_configuration.sql`
- Service code: `src/services/tenantBrandingService.ts`
