# Supabase Environment Setup for CORS

## Required Environment Variables

To enable secure CORS in your Supabase Edge Functions, you need to set the following environment variable in your Supabase project:

### Using Supabase CLI:

```bash
# Set allowed origins for production
npx supabase secrets set ALLOWED_ORIGINS="https://thewellfitcommunity.org,https://www.thewellfitcommunity.org,https://wellfitcommunity.live,https://www.wellfitcommunity.live"

# Enable local development origins (optional, for development only)
npx supabase secrets set DEV_ALLOW_LOCAL="true"
```

### Using Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add the following secrets:
   - **ALLOWED_ORIGINS**: `https://thewellfitcommunity.org,https://www.thewellfitcommunity.org,https://wellfitcommunity.live,https://www.wellfitcommunity.live`
   - **DEV_ALLOW_LOCAL** (optional): `true` (for development only)

## Verification

After setting the environment variables, your Edge Functions will:
- ✅ Only accept requests from allowed origins
- ✅ Reject requests from unauthorized domains
- ✅ Include comprehensive security headers
- ✅ Pass HIPAA/HITECH compliance requirements

## Note

The CORS configuration is centralized in `/supabase/functions/_shared/cors.ts` and used by all Edge Functions.
