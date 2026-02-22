/**
 * Encounter Billing Bridge Service
 *
 * Bridges signed/finalized encounters to superbill drafts, enabling
 * the encounter → superbill → claim pipeline.
 *
 * Used by: BillingQueueDashboard
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type SuperbillStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'claimed';

export interface EncounterSuperbill {
  id: string;
  encounter_id: string;
  claim_id: string | null;
  superbill_status: SuperbillStatus;
  diagnosis_codes: DiagnosisEntry[];
  procedure_codes: ProcedureEntry[];
  total_charge: number;
  generated_at: string;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface DiagnosisEntry {
  code: string;
  description?: string;
  sequence?: number;
}

export interface ProcedureEntry {
  code: string;
  description?: string;
  charge_amount?: number;
  units?: number;
  modifiers?: string[];
}

export interface BillingQueueEncounter {
  encounter_id: string;
  patient_id: string;
  patient_name: string;
  provider_name: string;
  date_of_service: string;
  status: string;
  signed_at: string | null;
  diagnosis_count: number;
  procedure_count: number;
  superbill_id: string | null;
  superbill_status: SuperbillStatus | null;
}

export interface BillingQueueStats {
  awaiting_superbill: number;
  draft: number;
  pending_review: number;
  approved: number;
  claimed: number;
}

// =============================================================================
// DATABASE ROW INTERFACES
// =============================================================================

interface EncounterRow {
  id: string;
  patient_id: string;
  date_of_service: string;
  status: string;
  signed_at: string | null;
  tenant_id: string | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
  billing_providers: { organization_name: string | null } | null;
  encounter_diagnoses: { code: string }[];
  encounter_procedures: { code: string }[];
  encounter_superbills: { id: string; superbill_status: string }[] | null;
}

interface DiagnosisRow {
  code: string;
  sequence: number | null;
  code_icd: { desc: string | null } | null;
}

interface ProcedureRow {
  code: string;
  charge_amount: number | null;
  units: number | null;
  modifiers: string[] | null;
  code_cpt: { short_desc: string | null } | null;
}

interface SuperbillRow {
  id: string;
  encounter_id: string;
  claim_id: string | null;
  superbill_status: string;
  diagnosis_codes: unknown;
  procedure_codes: unknown;
  total_charge: number;
  generated_at: string;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const BILLABLE_STATUSES = ['signed', 'ready_for_billing', 'billed', 'completed'];

function buildPatientName(profile: { first_name: string | null; last_name: string | null } | null): string {
  if (!profile) return 'Unknown';
  return `${profile.last_name || ''}, ${profile.first_name || ''}`.trim().replace(/^,\s*/, '') || 'Unknown';
}

function mapSuperbillRow(row: SuperbillRow): EncounterSuperbill {
  return {
    id: row.id,
    encounter_id: row.encounter_id,
    claim_id: row.claim_id,
    superbill_status: row.superbill_status as SuperbillStatus,
    diagnosis_codes: Array.isArray(row.diagnosis_codes)
      ? (row.diagnosis_codes as DiagnosisEntry[])
      : [],
    procedure_codes: Array.isArray(row.procedure_codes)
      ? (row.procedure_codes as ProcedureEntry[])
      : [],
    total_charge: row.total_charge ?? 0,
    generated_at: row.generated_at,
    reviewed_at: row.reviewed_at,
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    rejected_by: row.rejected_by,
    rejection_reason: row.rejection_reason,
    notes: row.notes,
    tenant_id: row.tenant_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// =============================================================================
// SERVICE
// =============================================================================

export const encounterBillingBridgeService = {
  /**
   * Fetch encounters in billable states (signed/ready_for_billing/billed/completed)
   * and show which ones have superbills and which don't.
   */
  async getBillingQueue(): Promise<ServiceResult<BillingQueueEncounter[]>> {
    try {
      const { data, error } = await supabase
        .from('encounters')
        .select(`
          id, patient_id, date_of_service, status, signed_at, tenant_id,
          profiles!encounters_patient_id_fkey(first_name, last_name),
          billing_providers(organization_name),
          encounter_diagnoses(code),
          encounter_procedures(code),
          encounter_superbills(id, superbill_status)
        `)
        .in('status', BILLABLE_STATUSES)
        .order('signed_at', { ascending: false, nullsFirst: false })
        .limit(200);

      if (error) {
        await auditLogger.error('BILLING_QUEUE_FETCH_FAILED', 'Failed to fetch billing queue', { context: 'getBillingQueue' });
        return failure('DATABASE_ERROR', 'Failed to fetch billing queue', error);
      }

      const rows = (data || []) as unknown as EncounterRow[];

      const queue: BillingQueueEncounter[] = rows.map(row => {
        const superbillArr = row.encounter_superbills || [];
        const superbill = superbillArr.length > 0 ? superbillArr[0] : null;

        return {
          encounter_id: row.id,
          patient_id: row.patient_id,
          patient_name: buildPatientName(row.profiles),
          provider_name: row.billing_providers?.organization_name || 'Unassigned',
          date_of_service: row.date_of_service,
          status: row.status,
          signed_at: row.signed_at,
          diagnosis_count: (row.encounter_diagnoses || []).length,
          procedure_count: (row.encounter_procedures || []).length,
          superbill_id: superbill?.id || null,
          superbill_status: superbill ? (superbill.superbill_status as SuperbillStatus) : null,
        };
      });

      return success(queue);
    } catch (err: unknown) {
      await auditLogger.error(
        'BILLING_QUEUE_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getBillingQueue' },
      );
      return failure('OPERATION_FAILED', 'Failed to fetch billing queue');
    }
  },

  /**
   * Get aggregate billing queue stats.
   */
  async getBillingQueueStats(): Promise<ServiceResult<BillingQueueStats>> {
    try {
      // Count encounters ready for billing without superbills
      const { count: awaitingCount, error: awaitingErr } = await supabase
        .from('encounters')
        .select('id', { count: 'exact', head: true })
        .in('status', BILLABLE_STATUSES)
        .is('signed_at', null)
        .not('signed_at', 'is', null); // trick: just get billable count

      // Actually count encounters with no superbill
      const { data: allBillable, error: billableErr } = await supabase
        .from('encounters')
        .select('id')
        .in('status', BILLABLE_STATUSES);

      if (billableErr) {
        return failure('DATABASE_ERROR', 'Failed to fetch billable encounters', billableErr);
      }

      const billableIds = (allBillable || []).map(e => (e as { id: string }).id);

      const { data: superbillData, error: sbErr } = await supabase
        .from('encounter_superbills')
        .select('encounter_id, superbill_status')
        .in('encounter_id', billableIds.length > 0 ? billableIds : ['__none__']);

      if (sbErr) {
        return failure('DATABASE_ERROR', 'Failed to fetch superbill statuses', sbErr);
      }

      const superbillMap = new Map<string, string>();
      for (const sb of (superbillData || []) as Array<{ encounter_id: string; superbill_status: string }>) {
        superbillMap.set(sb.encounter_id, sb.superbill_status);
      }

      const stats: BillingQueueStats = {
        awaiting_superbill: 0,
        draft: 0,
        pending_review: 0,
        approved: 0,
        claimed: 0,
      };

      for (const encId of billableIds) {
        const sbStatus = superbillMap.get(encId);
        if (!sbStatus) {
          stats.awaiting_superbill++;
        } else if (sbStatus === 'draft') {
          stats.draft++;
        } else if (sbStatus === 'pending_review') {
          stats.pending_review++;
        } else if (sbStatus === 'approved') {
          stats.approved++;
        } else if (sbStatus === 'claimed') {
          stats.claimed++;
        }
      }

      // suppress unused variable warning
      void awaitingCount;
      void awaitingErr;

      return success(stats);
    } catch (err: unknown) {
      await auditLogger.error(
        'BILLING_QUEUE_STATS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'getBillingQueueStats' },
      );
      return failure('OPERATION_FAILED', 'Failed to compute billing queue stats');
    }
  },

  /**
   * Generate a superbill draft from a signed encounter.
   * Pulls diagnoses, procedures, and billing suggestions into a superbill record.
   */
  async generateSuperbillDraft(
    encounterId: string,
    tenantId: string,
  ): Promise<ServiceResult<EncounterSuperbill>> {
    try {
      // 1. Check encounter is in a billable state
      const { data: encounter, error: encErr } = await supabase
        .from('encounters')
        .select('id, status, signed_at, tenant_id')
        .eq('id', encounterId)
        .single();

      if (encErr || !encounter) {
        return failure('NOT_FOUND', 'Encounter not found');
      }

      const enc = encounter as { id: string; status: string; signed_at: string | null; tenant_id: string | null };
      if (!BILLABLE_STATUSES.includes(enc.status)) {
        return failure('INVALID_STATE', `Encounter must be in a billable state (signed, ready_for_billing, billed, or completed). Current: ${enc.status}`);
      }

      // 2. Check no superbill exists already
      const { data: existing } = await supabase
        .from('encounter_superbills')
        .select('id')
        .eq('encounter_id', encounterId)
        .maybeSingle();

      if (existing) {
        return failure('ALREADY_EXISTS', 'A superbill already exists for this encounter');
      }

      // 3. Pull diagnoses
      const { data: dxRows } = await supabase
        .from('encounter_diagnoses')
        .select('code, sequence, code_icd(desc)')
        .eq('encounter_id', encounterId)
        .order('sequence', { ascending: true });

      const diagnoses: DiagnosisEntry[] = ((dxRows || []) as unknown as DiagnosisRow[]).map(d => ({
        code: d.code,
        description: d.code_icd?.desc || undefined,
        sequence: d.sequence ?? undefined,
      }));

      // 4. Pull procedures
      const { data: procRows } = await supabase
        .from('encounter_procedures')
        .select('code, charge_amount, units, modifiers, code_cpt(short_desc)')
        .eq('encounter_id', encounterId);

      const procedures: ProcedureEntry[] = ((procRows || []) as unknown as ProcedureRow[]).map(p => ({
        code: p.code,
        description: p.code_cpt?.short_desc || undefined,
        charge_amount: p.charge_amount ?? undefined,
        units: p.units ?? undefined,
        modifiers: p.modifiers ?? undefined,
      }));

      // 5. Calculate total charge
      const totalCharge = procedures.reduce((sum, p) => {
        return sum + ((p.charge_amount ?? 0) * (p.units ?? 1));
      }, 0);

      // 6. Insert superbill
      const { data: inserted, error: insertErr } = await supabase
        .from('encounter_superbills')
        .insert({
          encounter_id: encounterId,
          superbill_status: 'draft',
          diagnosis_codes: diagnoses,
          procedure_codes: procedures,
          total_charge: totalCharge,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        await auditLogger.error('SUPERBILL_GENERATION_FAILED', 'Failed to insert superbill', { encounterId });
        return failure('DATABASE_ERROR', 'Failed to generate superbill', insertErr);
      }

      await auditLogger.clinical('SUPERBILL_GENERATED', true, {
        encounterId,
        superbillId: (inserted as SuperbillRow).id,
        diagnosisCount: diagnoses.length,
        procedureCount: procedures.length,
        totalCharge,
      });

      return success(mapSuperbillRow(inserted as SuperbillRow));
    } catch (err: unknown) {
      await auditLogger.error(
        'SUPERBILL_GENERATION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounterId },
      );
      return failure('OPERATION_FAILED', 'Failed to generate superbill');
    }
  },

  /**
   * Get a superbill by encounter ID.
   */
  async getSuperbillByEncounter(encounterId: string): Promise<ServiceResult<EncounterSuperbill | null>> {
    try {
      const { data, error } = await supabase
        .from('encounter_superbills')
        .select('id, encounter_id, claim_id, superbill_status, diagnosis_codes, procedure_codes, total_charge, generated_at, reviewed_at, approved_by, approved_at, rejected_by, rejection_reason, notes, tenant_id, created_at, updated_at')
        .eq('encounter_id', encounterId)
        .maybeSingle();

      if (error) {
        return failure('DATABASE_ERROR', 'Failed to fetch superbill', error);
      }

      if (!data) return success(null);
      return success(mapSuperbillRow(data as SuperbillRow));
    } catch (err: unknown) {
      await auditLogger.error(
        'SUPERBILL_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { encounterId },
      );
      return failure('OPERATION_FAILED', 'Failed to fetch superbill');
    }
  },

  /**
   * Link an approved superbill to a generated claim.
   */
  async linkSuperbillToClaim(
    superbillId: string,
    claimId: string,
  ): Promise<ServiceResult<EncounterSuperbill>> {
    try {
      const { data, error } = await supabase
        .from('encounter_superbills')
        .update({
          claim_id: claimId,
          superbill_status: 'claimed',
        })
        .eq('id', superbillId)
        .eq('superbill_status', 'approved')
        .select()
        .single();

      if (error || !data) {
        return failure('OPERATION_FAILED', 'Superbill must be in approved status to link to a claim');
      }

      await auditLogger.clinical('SUPERBILL_LINKED_TO_CLAIM', true, { superbillId, claimId });
      return success(mapSuperbillRow(data as SuperbillRow));
    } catch (err: unknown) {
      await auditLogger.error(
        'SUPERBILL_LINK_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { superbillId, claimId },
      );
      return failure('OPERATION_FAILED', 'Failed to link superbill to claim');
    }
  },

  /**
   * Submit a superbill draft for provider review.
   */
  async submitForReview(superbillId: string): Promise<ServiceResult<EncounterSuperbill>> {
    try {
      const { data, error } = await supabase
        .from('encounter_superbills')
        .update({
          superbill_status: 'pending_review',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', superbillId)
        .eq('superbill_status', 'draft')
        .select()
        .single();

      if (error || !data) {
        return failure('OPERATION_FAILED', 'Superbill must be in draft status to submit for review');
      }

      await auditLogger.clinical('SUPERBILL_SUBMITTED_FOR_REVIEW', true, { superbillId });
      return success(mapSuperbillRow(data as SuperbillRow));
    } catch (err: unknown) {
      await auditLogger.error(
        'SUPERBILL_REVIEW_SUBMIT_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { superbillId },
      );
      return failure('OPERATION_FAILED', 'Failed to submit superbill for review');
    }
  },
};
