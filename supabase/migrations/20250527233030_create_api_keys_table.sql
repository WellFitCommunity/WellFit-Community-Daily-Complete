-- migrate: skip
-- Create the api_keys table
CREATE TABLE api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    usage_count INTEGER DEFAULT 0 NOT NULL,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add comments to the table and columns
COMMENT ON TABLE api_keys IS 'Stores API keys for third-party integrations.';
COMMENT ON COLUMN api_keys.id IS 'Unique identifier for the API key (UUID).';
COMMENT ON COLUMN api_keys.org_name IS 'Name of the organization or service using the API key.';
COMMENT ON COLUMN api_keys.api_key IS 'The actual API key string (should be stored securely).';
COMMENT ON COLUMN api_keys.active IS 'Whether the API key is currently active (TRUE) or disabled (FALSE).';
COMMENT ON COLUMN api_keys.usage_count IS 'How many times the API key has been used.';
COMMENT ON COLUMN api_keys.last_used IS 'Timestamp of the last time the API key was used.';
COMMENT ON COLUMN api_keys.created_at IS 'Timestamp of when the API key was created.';

-- Enable Row Level Security (RLS)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Policy: Allow full access to 'service_role'
-- This role is typically used by Supabase Edge Functions or other backend services.
CREATE POLICY "Allow full access to service_role"
ON api_keys
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policy: Deny all access by default for other roles
-- This is a restrictive policy. You will need to add more specific policies
-- for other roles (e.g., an 'admin' role) if they need to interact with this table.
CREATE POLICY "Deny all access by default"
ON api_keys
FOR ALL
USING (false)
WITH CHECK (false);

-- Optional: If you have a specific admin role (e.g., 'authenticated' users who are admins)
-- you might add a policy like this. Replace 'your_admin_role_identifier_column' and 'admin_user_id'
-- with actual ways you identify admins.
-- CREATE POLICY "Allow admin users to manage API keys"
-- ON api_keys
-- FOR ALL
-- USING (
--   auth.role() = 'authenticated' AND
--   EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.user_id = auth.uid() AND user_profiles.role = 'admin') -- Example condition
-- )
-- WITH CHECK (
--   auth.role() = 'authenticated' AND
--   EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.user_id = auth.uid() AND user_profiles.role = 'admin') -- Example condition
-- );

-- Grant usage on schema for the extension (if not already granted)
-- GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role; -- Might be needed if uuid_generate_v4 is in extensions

-- Ensure the uuid-ossp extension is available (usually enabled by default on Supabase)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions; -- This line might be needed if not already present in your Supabase setup.
-- Typically, Supabase handles extension creation. If `uuid_generate_v4()` fails, this might be the reason.
-- For this exercise, assuming `uuid_generate_v4()` is available as it's common in Supabase.

-- Grant permissions for the table to relevant roles.
-- service_role usually has super privileges, but being explicit can be good.
GRANT ALL ON TABLE api_keys TO service_role;
GRANT SELECT ON TABLE api_keys TO authenticated; -- Example: if authenticated users need to read some keys (highly depends on app logic)
-- DENY all on public, anon unless specifically needed.

-- Note: The RLS policies above are quite restrictive.
-- The "Deny all access by default" will block any user/role not explicitly
-- granted access by another policy.
-- The "Allow full access to service_role" is crucial for backend operations.
-- If you have application administrators who need to manage these keys via an interface,
-- you'll need to define a policy for their role (e.g., an 'admin' role).
-- For example, if you have an 'admins' table or a 'role' column in your 'users' or 'profiles' table:
--
-- CREATE POLICY "Admins can manage API keys"
-- ON api_keys
-- FOR ALL
-- USING (
--   auth.role() = 'authenticated' AND
--   (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin' -- Adjust to your user profile table and role column
-- )
-- WITH CHECK (
--   auth.role() = 'authenticated' AND
--   (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin' -- Adjust as above
-- );
--
-- Remember to adjust 'public.user_profiles' and 'role' to match your actual database schema.
-- Also, ensure that the role used in `auth.role() = '...'` matches the roles in your Supabase project.
-- Common roles are 'anon', 'authenticated', 'service_role'.
-- The `postgres` role bypasses RLS by default.
--
-- For this subtask, the provided policies (service_role full access, deny all else) are a safe default start.
-- Further policies would depend on application-specific admin roles and access patterns.

SELECT 'Migration create_api_keys_table.sql completed.';
