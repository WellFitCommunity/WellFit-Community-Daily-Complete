-- 20250902030000_add_contractor_roles.sql
-- Add contractor roles safely (no description column required)

INSERT INTO public.roles (name)
VALUES 
  ('contractor'),
  ('contractor_nurse')
ON CONFLICT (name) DO NOTHING;

-- Optional: verify after running
-- SELECT * FROM public.roles WHERE name IN ('contractor', 'contractor_nurse');

