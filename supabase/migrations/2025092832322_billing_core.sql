-- ========= Helpers (idempotent) =========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Expect a roles table: roles(user_id uuid, role text)
-- Fallback-safe admin checker (skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
    CREATE FUNCTION public.is_admin(p_uid uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    AS $func$
      SELECT EXISTS (
        SELECT 1 FROM public.roles r
        WHERE r.user_id = p_uid AND r.role IN ('admin','super_admin')
      );
    $func$;
  END IF;
END $$;

-- Optional: sequences + RPC used by Edge Function control numbers
CREATE SEQUENCE IF NOT EXISTS public.x12_isa_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.x12_gs_seq  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.x12_st_seq  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.next_seq(seq text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE v bigint;
BEGIN
  EXECUTE format('SELECT nextval(''%I'')', seq) INTO v;
  RETURN v;
END $$;

-- ========= 1) billing_providers =========
CREATE TABLE IF NOT EXISTS public.billing_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  npi varchar(10) UNIQUE NOT NULL,
  taxonomy_code varchar(10),
  organization_name text,
  ein varchar(10),
  submitter_id text,
  contact_phone text,
  address_line1 text,
  city text,
  state text,
  zip text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_providers_user ON public.billing_providers(user_id);
CREATE TRIGGER trg_billing_providers_uat BEFORE UPDATE ON public.billing_providers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.billing_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bp_admin_rw_owner_r" ON public.billing_providers;
CREATE POLICY "bp_admin_rw_owner_r" ON public.billing_providers
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- ========= 2) billing_payers =========
CREATE TABLE IF NOT EXISTS public.billing_payers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  payer_id text,               -- payer-assigned ID if applicable
  receiver_id text,            -- X12 receiver id
  clearinghouse_id text,       -- clearinghouse ISA receiver
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_payers_name ON public.billing_payers(name);
CREATE TRIGGER trg_billing_payers_uat BEFORE UPDATE ON public.billing_payers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.billing_payers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pay_admin_rw_owner_r" ON public.billing_payers;
CREATE POLICY "pay_admin_rw_owner_r" ON public.billing_payers
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- ========= 3) code_cpt =========
CREATE TABLE IF NOT EXISTS public.code_cpt (
  code text PRIMARY KEY,
  short_desc text,
  long_desc text,
  status text DEFAULT 'active',
  effective_from date,
  effective_to date
);
CREATE INDEX IF NOT EXISTS idx_code_cpt_status ON public.code_cpt(status);

ALTER TABLE public.code_cpt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cpt_admin_r_all_r" ON public.code_cpt;
CREATE POLICY "cpt_admin_r_all_r" ON public.code_cpt FOR SELECT USING (true);
DROP POLICY IF EXISTS "cpt_admin_w" ON public.code_cpt;
CREATE POLICY "cpt_admin_w" ON public.code_cpt FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ========= 4) code_hcpcs =========
CREATE TABLE IF NOT EXISTS public.code_hcpcs (
  code text PRIMARY KEY,
  "desc" text,
  status text DEFAULT 'active',
  effective_from date,
  effective_to date
);
ALTER TABLE public.code_hcpcs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hcpcs_admin_r_all_r" ON public.code_hcpcs;
CREATE POLICY "hcpcs_admin_r_all_r" ON public.code_hcpcs FOR SELECT USING (true);
DROP POLICY IF EXISTS "hcpcs_admin_w" ON public.code_hcpcs;
CREATE POLICY "hcpcs_admin_w" ON public.code_hcpcs FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ========= 5) code_icd10 =========
CREATE TABLE IF NOT EXISTS public.code_icd10 (
  code text PRIMARY KEY,       -- store without dot for X12 ease
  "desc" text,
  chapter text,
  billable boolean DEFAULT true,
  status text DEFAULT 'active',
  effective_from date,
  effective_to date
);
CREATE INDEX IF NOT EXISTS idx_icd10_status ON public.code_icd10(status);

ALTER TABLE public.code_icd10 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "icd_admin_r_all_r" ON public.code_icd10;
CREATE POLICY "icd_admin_r_all_r" ON public.code_icd10 FOR SELECT USING (true);
DROP POLICY IF EXISTS "icd_admin_w" ON public.code_icd10;
CREATE POLICY "icd_admin_w" ON public.code_icd10 FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ========= 6) code_modifiers (CPT/HCPCS modifiers) =========
CREATE TABLE IF NOT EXISTS public.code_modifiers (
  code text PRIMARY KEY,
  "desc" text,
  status text DEFAULT 'active',
  effective_from date,
  effective_to date
);
ALTER TABLE public.code_modifiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mod_admin_r_all_r" ON public.code_modifiers;
CREATE POLICY "mod_admin_r_all_r" ON public.code_modifiers FOR SELECT USING (true);
DROP POLICY IF EXISTS "mod_admin_w" ON public.code_modifiers;
CREATE POLICY "mod_admin_w" ON public.code_modifiers FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ========= 7) fee_schedules (header) =========
CREATE TABLE IF NOT EXISTS public.fee_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  payer_id uuid REFERENCES public.billing_payers(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.billing_providers(id) ON DELETE SET NULL,
  effective_from date NOT NULL DEFAULT now()::date,
  effective_to date,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_fee_schedules_uat BEFORE UPDATE ON public.fee_schedules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.fee_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fs_admin_rw_owner_r" ON public.fee_schedules;
CREATE POLICY "fs_admin_rw_owner_r" ON public.fee_schedules
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- ========= 8) fee_schedule_items =========
CREATE TABLE IF NOT EXISTS public.fee_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_schedule_id uuid NOT NULL REFERENCES public.fee_schedules(id) ON DELETE CASCADE,
  code_system text NOT NULL CHECK (code_system IN ('CPT','HCPCS')),
  code text NOT NULL,
  modifier1 text,
  modifier2 text,
  modifier3 text,
  modifier4 text,
  price numeric(12,2) NOT NULL,
  unit text DEFAULT 'UN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_fee_schedule_item UNIQUE (fee_schedule_id, code_system, code, modifier1, modifier2, modifier3, modifier4)
);
CREATE INDEX IF NOT EXISTS idx_fsi_fee_schedule ON public.fee_schedule_items(fee_schedule_id);
CREATE INDEX IF NOT EXISTS idx_fsi_code ON public.fee_schedule_items(code);

CREATE TRIGGER trg_fsi_uat BEFORE UPDATE ON public.fee_schedule_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.fee_schedule_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fsi_admin_rw" ON public.fee_schedule_items;
CREATE POLICY "fsi_admin_rw" ON public.fee_schedule_items
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ========= 9) claims =========
CREATE TABLE IF NOT EXISTS public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL,                     -- reference your existing encounters table if present
  payer_id uuid REFERENCES public.billing_payers(id) ON DELETE SET NULL,
  billing_provider_id uuid REFERENCES public.billing_providers(id) ON DELETE SET NULL,
  claim_type text NOT NULL DEFAULT '837P',
  status text NOT NULL DEFAULT 'generated',       -- generated | submitted | accepted | rejected | paid | void
  control_number text,                            -- ST02
  segment_count integer,
  total_charge numeric(12,2),
  x12_content text,                               -- raw outbound claim (for audit)
  response_payload text,                          -- clearinghouse/payer response
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_claims_encounter ON public.claims(encounter_id);
CREATE INDEX IF NOT EXISTS idx_claims_payer ON public.claims(payer_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);

CREATE TRIGGER trg_claims_uat BEFORE UPDATE ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "claims_admin_rw_owner_r" ON public.claims;
CREATE POLICY "claims_admin_rw_owner_r" ON public.claims
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- ========= 10) claim_lines =========
CREATE TABLE IF NOT EXISTS public.claim_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  code_system text NOT NULL CHECK (code_system IN ('CPT','HCPCS')),
  procedure_code text NOT NULL,
  modifiers text[] DEFAULT '{}',
  units numeric(12,2) DEFAULT 1,
  charge_amount numeric(12,2) NOT NULL,
  diagnosis_pointers integer[] DEFAULT '{1}',
  service_date date,
  position integer,                        -- LX number
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cl_claim ON public.claim_lines(claim_id);

CREATE TRIGGER trg_claim_lines_uat BEFORE UPDATE ON public.claim_lines
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.claim_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cl_admin_rw_owner_r" ON public.claim_lines;
CREATE POLICY "cl_admin_rw_owner_r" ON public.claim_lines
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_lines.claim_id AND c.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_lines.claim_id AND c.created_by = auth.uid())
  );

-- ========= 11) claim_status_history =========
CREATE TABLE IF NOT EXISTS public.claim_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text,
  payload jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csh_claim ON public.claim_status_history(claim_id);

ALTER TABLE public.claim_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "csh_admin_rw_owner_r" ON public.claim_status_history;
CREATE POLICY "csh_admin_rw_owner_r" ON public.claim_status_history
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_status_history.claim_id AND c.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_status_history.claim_id AND c.created_by = auth.uid())
  );

-- ========= 12) claim_attachments =========
CREATE TABLE IF NOT EXISTS public.claim_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  doc_type text,                 -- e.g., 'PWK', 'medical_record', etc.
  storage_path text,             -- point to Supabase Storage or external URL
  note text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ca_claim ON public.claim_attachments(claim_id);

ALTER TABLE public.claim_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ca_admin_rw_owner_r" ON public.claim_attachments;
CREATE POLICY "ca_admin_rw_owner_r" ON public.claim_attachments
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_attachments.claim_id AND c.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_attachments.claim_id AND c.created_by = auth.uid())
  );

-- ========= 13) clearinghouse_batches =========
CREATE TABLE IF NOT EXISTS public.clearinghouse_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_ref text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'created',   -- created | submitted | acknowledged | rejected | completed
  file_content text,                        -- X12 837 file content (if batching)
  response_payload text,
  submitted_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chb_status ON public.clearinghouse_batches(status);
CREATE TRIGGER trg_chb_uat BEFORE UPDATE ON public.clearinghouse_batches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clearinghouse_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chb_admin_rw_owner_r" ON public.clearinghouse_batches;
CREATE POLICY "chb_admin_rw_owner_r" ON public.clearinghouse_batches
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- ========= 14) clearinghouse_batch_items =========
CREATE TABLE IF NOT EXISTS public.clearinghouse_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.clearinghouse_batches(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  st_control_number text,                   -- ST02 in outbound claim
  status text DEFAULT 'queued',             -- queued | sent | ack | err
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, claim_id)
);
CREATE INDEX IF NOT EXISTS idx_chbi_batch ON public.clearinghouse_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_chbi_claim ON public.clearinghouse_batch_items(claim_id);

CREATE TRIGGER trg_chbi_uat BEFORE UPDATE ON public.clearinghouse_batch_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clearinghouse_batch_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chbi_admin_rw_owner_r" ON public.clearinghouse_batch_items;
CREATE POLICY "chbi_admin_rw_owner_r" ON public.clearinghouse_batch_items
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.clearinghouse_batches b WHERE b.id = clearinghouse_batch_items.batch_id AND b.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.clearinghouse_batches b WHERE b.id = clearinghouse_batch_items.batch_id AND b.created_by = auth.uid())
  );

-- ========= 15) remittances (835) minimal =========
CREATE TABLE IF NOT EXISTS public.remittances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id uuid REFERENCES public.billing_payers(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  file_content text,                 -- raw 835 text
  summary jsonb,                     -- optional parsed header/total summary
  details jsonb,                     -- optional parsed lines (keep single table to stay within 15)
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_remit_payer ON public.remittances(payer_id);
CREATE TRIGGER trg_remit_uat BEFORE UPDATE ON public.remittances
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.remittances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "remit_admin_rw_owner_r" ON public.remittances;
CREATE POLICY "remit_admin_rw_owner_r" ON public.remittances
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- ========= 16) coding_recommendations (clean slate) =========
DROP TABLE IF EXISTS public.coding_recommendations CASCADE;
CREATE TABLE public.coding_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL,
  patient_id uuid,
  payload jsonb NOT NULL,
  confidence int,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
CREATE INDEX idx_coding_rec_encounter ON public.coding_recommendations(encounter_id);
CREATE INDEX idx_coding_rec_patient ON public.coding_recommendations(patient_id);
CREATE INDEX idx_coding_rec_created ON public.coding_recommendations(created_at);

ALTER TABLE public.coding_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coding_rec_admin_rw_owner_r" ON public.coding_recommendations
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- ========= 17) coding_audits (clean slate) =========
DROP TABLE IF EXISTS public.coding_audits CASCADE;
CREATE TABLE public.coding_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid,
  model text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  confidence int,
  error_message text,
  processing_time_ms int,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
CREATE INDEX idx_coding_audits_encounter ON public.coding_audits(encounter_id);
CREATE INDEX idx_coding_audits_model ON public.coding_audits(model);
CREATE INDEX idx_coding_audits_success ON public.coding_audits(success);
CREATE INDEX idx_coding_audits_created ON public.coding_audits(created_at);

ALTER TABLE public.coding_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coding_audits_admin_rw_owner_r" ON public.coding_audits
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());
