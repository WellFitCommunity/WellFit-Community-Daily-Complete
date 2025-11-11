# Database Migrations Guide

## Quick Start

### Create a New Migration

```bash
npm run db:new-migration "add_user_preferences"
```

This creates a timestamped migration file in `supabase/migrations/` with a template.

### Apply Migrations

**Local development:**
```bash
npm run db:migrate
```

**Staging:**
```bash
npm run db:migrate:staging
```

**Production:**
```bash
npm run db:migrate:production
```

## How It Works

1. **Supabase CLI handles ordering** - Migrations are applied in timestamp order automatically
2. **No hardcoded paths** - Scripts work with all migrations in the migrations folder
3. **Safe by default** - Production requires confirmation

## Migration Workflow

### 1. Create Migration

```bash
npm run db:new-migration "descriptive_name"
```

Creates: `supabase/migrations/20251111235900_descriptive_name.sql`

### 2. Write SQL

Edit the generated file and add your SQL:

```sql
-- Migration: add_user_preferences
-- Created: 2025-11-11 23:59:00 UTC
-- Description: Adds user preferences table for storing app settings

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light',
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON user_preferences
  FOR ALL
  USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Add comments
COMMENT ON TABLE user_preferences IS 'Stores user-specific application preferences';
```

### 3. Test Locally

```bash
npm run db:migrate
```

Applies all pending migrations to your local Supabase instance.

### 4. Commit to Git

```bash
git add supabase/migrations/20251111235900_add_user_preferences.sql
git commit -m "feat: add user preferences table"
git push
```

### 5. Deploy to Staging/Production

```bash
# Staging
npm run db:migrate:staging

# Production (requires confirmation)
npm run db:migrate:production
```

## Best Practices

### ✅ Do

- **One migration per feature** - Keep migrations focused
- **Use descriptive names** - `add_user_preferences` not `update_db`
- **Add comments** - Document tables, columns, and complex logic
- **Test locally first** - Always test before deploying
- **Use `IF NOT EXISTS`** - Makes migrations idempotent
- **Include rollback notes** - Comment how to undo if needed

### ❌ Don't

- **Don't modify existing migrations** - Create a new one instead
- **Don't hardcode file paths** - Use the provided scripts
- **Don't skip local testing** - Catch issues early
- **Don't commit migrations without testing** - Broken migrations break deployments

## Environment Variables

Migrations use these environment variables:

- **Local**: Uses default `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **Staging/Production**: Uses `DATABASE_URL` from environment

Set `DATABASE_URL` in your environment:

```bash
export DATABASE_URL="postgresql://user:pass@host:port/database"
```

## Troubleshooting

### Migration failed locally

1. Check Supabase is running: `npx supabase status`
2. Check your SQL syntax
3. Reset local DB if needed: `npx supabase db reset`

### Migration failed in staging/production

1. Check error message
2. Verify migration file is committed
3. Check DATABASE_URL is correct
4. Review SQL for production-specific issues (permissions, etc.)

### Need to rollback a migration

Supabase doesn't have automatic rollbacks. To rollback:

1. Create a new migration that undoes the changes
2. Name it clearly: `rollback_user_preferences.sql`
3. Apply it like any other migration

## Old Scripts (Deprecated)

These scripts still exist but shouldn't be used:

- ❌ `scripts/apply-migration-directly.sh` - Hardcoded paths
- ❌ `scripts/verify-migrations.sh` - Manual verification
- ❌ Custom deployment scripts - Use unified workflow

**Use the new workflow instead:**
- ✅ `npm run db:new-migration`
- ✅ `npm run db:migrate`

## Architecture

```
supabase/
  migrations/
    20251111000000_initial_setup.sql      ← Applied first
    20251111120000_add_profiles.sql       ← Applied second
    20251111235900_add_preferences.sql    ← Applied third

scripts/
  migrate.sh         ← Unified migration runner
  create-migration.sh ← Migration generator
```

Supabase CLI reads `supabase/migrations/` in timestamp order and tracks which migrations have been applied using the `supabase_migrations` table in your database.

## Summary

**Creating migrations:**
```bash
npm run db:new-migration "description"
```

**Running migrations:**
```bash
npm run db:migrate              # Local
npm run db:migrate:staging      # Staging
npm run db:migrate:production   # Production
```

That's it! No more fighting with file paths. 🎉
