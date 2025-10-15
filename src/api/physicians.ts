// src/api/physicians.ts
import { SupabaseClient } from '@supabase/supabase-js';

export type Physician = {
  id: string;
  first_name: string;
  last_name: string;
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  active: boolean;
  // joined through physician_tenants, but you can fetch with a second query if needed
};

export async function listPhysiciansByTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Physician[]> {
  // You can either:
  // A) create a view to expose physician + tenant rows; or
  // B) rely on RLS to filter via a join query.
  // This is a simple RLS-filtered approach using the join table.
  const { data, error } = await supabase
    .from('physicians')
    .select('id, first_name, last_name, specialty, phone, email, active, physician_tenants!inner(tenant_id)')
    .eq('physician_tenants.tenant_id', tenantId)
    .eq('active', true);

  if (error) throw new Error(`listPhysiciansByTenant failed: ${error.message}`);
  return (data ?? []) as unknown as Physician[];
}

export async function upsertPhysicianForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  physician: Omit<Physician, 'id'> & { id?: string }
): Promise<string> {
  // Upsert the physician
  const { data: upserted, error: upsertErr } = await supabase
    .from('physicians')
    .upsert(physician, { onConflict: 'id' })
    .select('id')
    .single();

  if (upsertErr) throw new Error(`upsert physician failed: ${upsertErr.message}`);

  const physicianId = upserted.id as string;

  // Ensure tenant linkage exists
  const { error: linkErr } = await supabase
    .from('physician_tenants')
    .upsert({ physician_id: physicianId, tenant_id: tenantId });

  if (linkErr) throw new Error(`link physician to tenant failed: ${linkErr.message}`);
  return physicianId;
}
