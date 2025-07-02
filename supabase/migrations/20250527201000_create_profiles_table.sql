-- Enable the pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          TEXT          UNIQUE       NOT NULL,
  -- password_hash  TEXT                      NOT NULL, -- Removed, Supabase Auth handles passwords
  first_name     TEXT                      NOT NULL,
  last_name      TEXT                      NOT NULL,
  email          TEXT,
  consent        BOOLEAN       NOT NULL     DEFAULT FALSE,
  phone_verified BOOLEAN       NOT NULL     DEFAULT FALSE,
  email_verified BOOLEAN       NOT NULL     DEFAULT FALSE,
  created_at     TIMESTAMPTZ   NOT NULL     DEFAULT NOW()
);
