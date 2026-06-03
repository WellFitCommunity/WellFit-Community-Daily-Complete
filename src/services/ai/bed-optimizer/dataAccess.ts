// Bed Optimizer - Data Access Layer
// Database queries for bed board, unit capacity, historical data

import { supabase } from '../../../lib/supabaseClient';
import type { BedBoardEntry, UnitCapacity } from '../../../types/bed';
import type { HistoricalCensusSnapshot, ScheduledArrival, LOSBenchmark } from './types';

/**
 * Get bed board view for tenant
 */
export async function getBedBoard(tenantId: string): Promise<BedBoardEntry[]> {
  // Live object is the security_invoker view v_bed_board (the get_bed_board_view
  // RPC was renamed to a view). Tenant scoping is enforced by the view's RLS;
  // the explicit .eq keeps parity with the old p_tenant_id argument.
  const { data } = await supabase
    .from('v_bed_board')
    .select(
      'bed_id, bed_label, room_number, bed_position, bed_type, status, status_changed_at, has_telemetry, has_isolation_capability, has_negative_pressure, unit_id, unit_code, unit_name, unit_type, floor_number, facility_id, facility_name, patient_id, patient_name, patient_mrn, assigned_at, expected_discharge_date, patient_acuity, tenant_id'
    )
    .eq('tenant_id', tenantId);
  return (data ?? []) as unknown as BedBoardEntry[];
}

/**
 * Get unit capacity summary for tenant
 */
export async function getUnitCapacity(tenantId: string): Promise<UnitCapacity[]> {
  // Live object is the security_invoker view v_unit_capacity (the
  // get_unit_capacity_summary RPC was renamed to a view).
  const { data } = await supabase
    .from('v_unit_capacity')
    .select(
      'unit_id, unit_code, unit_name, unit_type, total_beds, target_census, max_census, facility_name, active_beds, occupied, available, pending_clean, out_of_service, occupancy_pct, tenant_id'
    )
    .eq('tenant_id', tenantId);
  return (data ?? []) as unknown as UnitCapacity[];
}

/**
 * Get historical census data for past N days
 */
export async function getHistoricalCensusData(tenantId: string, days: number): Promise<HistoricalCensusSnapshot[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data } = await supabase
    .from('daily_census_snapshots')
    .select('snapshot_date, discharges_count, admissions_count, midnight_census, eod_census')
    .eq('tenant_id', tenantId)
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: false });

  return data || [];
}

/**
 * Get scheduled arrivals for next N days
 */
export async function getScheduledArrivals(tenantId: string, days: number): Promise<ScheduledArrival[]> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const { data } = await supabase
    .from('scheduled_arrivals')
    .select('scheduled_date, status')
    .eq('tenant_id', tenantId)
    .gte('scheduled_date', new Date().toISOString())
    .lte('scheduled_date', endDate.toISOString())
    .eq('status', 'confirmed');

  return data || [];
}

/**
 * Get LOS benchmarks for tenant (or defaults)
 */
export async function getLOSBenchmarks(tenantId: string): Promise<LOSBenchmark[]> {
  const { data } = await supabase
    .from('los_benchmarks')
    .select('tenant_id, is_default, drg_code, expected_los')
    .or(`tenant_id.eq.${tenantId},is_default.eq.true`)
    .limit(100);

  return data || [];
}

/**
 * Get available beds for tenant with unit info
 */
export async function getAvailableBeds(tenantId: string) {
  const { data, error } = await supabase
    .from('beds')
    .select(`
      *,
      hospital_units!inner(unit_name, unit_type, unit_code)
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'available')
    .eq('is_active', true);

  return { data, error };
}
