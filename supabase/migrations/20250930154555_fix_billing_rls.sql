-- Fix billing RLS policies to allow admins full read access
-- This fixes the "permission denied" error when viewing billing data

-- Drop existing policies
DROP POLICY IF EXISTS "pay_admin_rw_owner_r" ON public.billing_payers;
DROP POLICY IF EXISTS "bp_admin_rw_owner_r" ON public.billing_providers;

-- Billing Payers: Admins can do anything, others can only see their own
CREATE POLICY "billing_payers_admin_all" ON public.billing_payers
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "billing_payers_user_read_own" ON public.billing_payers
  FOR SELECT
  USING (created_by = auth.uid());

-- Billing Providers: Admins can do anything, others can only see their own
CREATE POLICY "billing_providers_admin_all" ON public.billing_providers
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "billing_providers_user_read_own" ON public.billing_providers
  FOR SELECT
  USING (created_by = auth.uid());

-- Claims: Admins can see all, users see their own
DROP POLICY IF EXISTS "claims_access" ON public.claims;
CREATE POLICY "claims_admin_all" ON public.claims
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "claims_user_read_own" ON public.claims
  FOR SELECT
  USING (created_by = auth.uid());

-- Fee schedules: Admins manage, everyone can read
DROP POLICY IF EXISTS "fee_schedules_access" ON public.fee_schedules;
CREATE POLICY "fee_schedules_admin_write" ON public.fee_schedules
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "fee_schedules_read_all" ON public.fee_schedules
  FOR SELECT
  USING (true);

-- Fee schedule items: Admins manage, everyone can read
DROP POLICY IF EXISTS "fee_schedule_items_access" ON public.fee_schedule_items;
CREATE POLICY "fee_schedule_items_admin_write" ON public.fee_schedule_items
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "fee_schedule_items_read_all" ON public.fee_schedule_items
  FOR SELECT
  USING (true);
