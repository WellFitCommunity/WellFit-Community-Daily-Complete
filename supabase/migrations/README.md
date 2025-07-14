# Supabase Migrations

This directory contains the SQL migration files for the Supabase database.

## Migration Process

Migrations are managed using the Supabase CLI. To apply new migrations, run:

```bash
supabase db push
```

To reset the local database and apply all migrations from scratch, run:

```bash
supabase db reset
```

**IMPORTANT:** `supabase db reset` is a destructive operation and should only be used in local development.

## Core Tables

### `profiles`

The `public.profiles` table is the central table for user data. It is linked to the `auth.users` table via the `id` column, which is a foreign key to `auth.users(id)`.

It is critical that all tables that need to reference a user do so by creating a foreign key to `auth.users(id)`, not `profiles(id)`. This ensures data integrity and consistency with the Supabase authentication system.

### `roles` and `user_roles`

The `public.roles` and `public.user_roles` tables are used to manage user roles and permissions. RLS policies should use the `check_user_has_role` function to check for user roles.

## Data Migration

This set of migrations corrects the schema of the `profiles` table and other related tables. However, it does not handle the migration of existing data in the `profiles` table. If you have existing user data, you will need to manually migrate it to align with the new schema. This typically involves:

1.  Creating a temporary table with the corrected schema.
2.  Copying and transforming data from the old `profiles` table to the new one, ensuring that the `id` column of the new table matches the corresponding `id` in `auth.users`.
3.  Dropping the old `profiles` table and renaming the new one.

This process is highly dependent on the state of your existing data and should be handled with care to avoid data loss.
