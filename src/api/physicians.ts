// src/api/physicians.ts
import { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceResult } from '../services/_base/ServiceResult';
import { success, failure } from '../services/_base/ServiceResult';

export type Physician = {
  id: string;
  first_name: string;
  last_name: string;
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  active: boolean;
};

export async function listPhysiciansByTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ServiceResult<Physician[]>> {
  try {
    const { data, error } = await supabase
      .from('physicians')
      .select('id, first_name, last_name, specialty, phone, email, active, physician_tenants!inner(tenant_id)')
      .eq('physician_tenants.tenant_id', tenantId)
      .eq('active', true);

    if (error) return failure('DATABASE_ERROR', `listPhysiciansByTenant failed: ${error.message}`, error);
    return success((data ?? []) as unknown as Physician[]);
  } catch (err: unknown) {
    return failure('UNKNOWN_ERROR', 'Failed to list physicians', err);
  }
}

export async function upsertPhysicianForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  physician: Omit<Physician, 'id'> & { id?: string }
): Promise<ServiceResult<string>> {
  try {
    const { data: upserted, error: upsertErr } = await supabase
      .from('physicians')
      .upsert(physician, { onConflict: 'id' })
      .select('id')
      .single();

    if (upsertErr) return failure('DATABASE_ERROR', `Upsert physician failed: ${upsertErr.message}`, upsertErr);

    const physicianId = upserted.id as string;

    const { error: linkErr } = await supabase
      .from('physician_tenants')
      .upsert({ physician_id: physicianId, tenant_id: tenantId });

    if (linkErr) return failure('DATABASE_ERROR', `Link physician to tenant failed: ${linkErr.message}`, linkErr);
    return success(physicianId);
  } catch (err: unknown) {
    return failure('UNKNOWN_ERROR', 'Failed to upsert physician', err);
  }
}
