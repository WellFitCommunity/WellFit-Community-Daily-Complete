-- migrate:skip
-- SQL to alter the profiles table and add fields
ALTER TABLE profiles
ADD COLUMN city TEXT,
ADD COLUMN state TEXT,
ADD COLUMN zip_code TEXT;
