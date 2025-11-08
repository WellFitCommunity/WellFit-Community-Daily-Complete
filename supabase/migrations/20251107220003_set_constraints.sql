-- Set NOT NULL and add RLS policies
BEGIN;

ALTER TABLE profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE check_ins ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE encounters ALTER COLUMN tenant_id SET NOT NULL;

CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE tenant_id UUID;
BEGIN
  BEGIN tenant_id := current_setting('app.current_tenant_id', TRUE)::UUID;
  EXCEPTION WHEN OTHERS THEN SELECT p.tenant_id INTO tenant_id FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1; END;
  IF tenant_id IS NULL THEN SELECT id INTO tenant_id FROM tenants WHERE subdomain = 'www' LIMIT 1; END IF;
  RETURN tenant_id;
END$$;

DROP POLICY IF EXISTS "profiles select self" ON profiles;
DROP POLICY IF EXISTS "profiles update self" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

CREATE POLICY "profiles_tenant" ON profiles FOR SELECT USING (tenant_id = get_current_tenant_id() AND (auth.uid() = user_id OR is_admin = TRUE));
CREATE POLICY "check_ins_tenant" ON check_ins FOR SELECT USING (tenant_id = get_current_tenant_id() AND user_id = auth.uid());
CREATE POLICY "encounters_tenant" ON encounters FOR SELECT USING (tenant_id = get_current_tenant_id());

COMMIT;
