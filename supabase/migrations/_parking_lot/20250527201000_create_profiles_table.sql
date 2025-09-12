-- Enable the pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- This table stores user profile information.
-- It is critical that the `id` column is a foreign key to `auth.users(id)`.
-- This ensures that every profile is linked to a valid user in the Supabase auth system.
-- All other tables that reference a user should do so by referencing `auth.users(id)`.
CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone          TEXT          UNIQUE       NOT NULL,
  first_name     TEXT                      NOT NULL,
  last_name      TEXT                      NOT NULL,
  email          TEXT,
  consent        BOOLEAN       NOT NULL     DEFAULT FALSE,
  phone_verified BOOLEAN       NOT NULL     DEFAULT FALSE,
  email_verified BOOLEAN       NOT NULL     DEFAULT FALSE,
  created_at     TIMESTAMPTZ   NOT NULL     DEFAULT NOW()
);
