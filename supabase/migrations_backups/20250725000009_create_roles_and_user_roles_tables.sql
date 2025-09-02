-- Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.roles IS 'Defines user roles within the application (e.g., admin, senior).';
COMMENT ON COLUMN public.roles.name IS 'Unique name of the role (e.g., ''admin'', ''super_admin'', ''senior'').';

-- Create user_roles join table
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (user_id, role_id)
);

COMMENT ON TABLE public.user_roles IS 'Assigns roles to users. A user can have multiple roles.';
COMMENT ON COLUMN public.user_roles.user_id IS 'Foreign key to the user in the auth.users table.';
COMMENT ON COLUMN public.user_roles.role_id IS 'Foreign key to the role in the roles table.';

-- Seed initial roles (optional, but often useful)
INSERT INTO public.roles (name, description) VALUES
    ('senior', 'Regular senior user of the application.'),
    ('admin', 'Administrator with elevated privileges.'),
    ('super_admin', 'Super administrator with full system privileges.')
ON CONFLICT (name) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
