// Bed Optimizer - Data Access Layer
// Database queries for bed board, unit capacity, historical data

import { supabase } from '../../../lib/supabaseClient';
import type { BedBoardEntry, UnitCapacity } from '../../../types/bed';
import type { HistoricalCensusSnapshot, ScheduledArrival, LOSBenchmark } from './types';

/**
 * Get bed board view for tenant
 */
export async function getBedBoard(tenantId: string): Promise<BedBoardEntry[]> {
  const { data } = await supabase.rpc('get_bed_board_view', { p_tenant_id: tenantId });
  return data || [];
}

/**
 * Get unit capacity summary for tenant
 */
export async function getUnitCapacity(tenantId: string): Promise<UnitCapacity[]> {
  const { data } = await supabase.rpc('get_unit_capacity_summary', { p_tenant_id: tenantId });
  return data || [];
}

/**
 * Get historical census data for past N days
 */
export async function getHistoricalCensusData(tenantId: string, days: number): Promise<HistoricalCensusSnapshot[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data } = await supabase
    .from('daily_census_snapshots')
    .select('*')
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
    .select('*')
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
    .select('*')
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
