#!/bin/bash
# Apply the community_moments migration directly using Supabase CLI

echo "🚀 Applying community_moments migration..."
echo ""

# Use Supabase CLI to execute the migration SQL directly
npx supabase db execute \
  --file supabase/migrations/20250923150000_add_missing_community_features.sql \
  --db-url "$DATABASE_URL"

echo ""
echo "✅ Migration applied!"
echo ""
echo "🔄 Now reloading PostgREST schema cache..."
node scripts/reload-schema-cache.js