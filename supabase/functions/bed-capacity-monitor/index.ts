/**
 * Bed Capacity Monitor Edge Function
 *
 * Cron-triggered function that monitors bed capacity across all facilities
 * and creates guardian_alerts when thresholds are breached.
 *
 * Escalation Rules:
 * - 70-80% occupancy: Alert charge nurse
 * - 80-90% occupancy: Alert bed control + discharge coordinator
 * - 90-95% occupancy: Alert hospital administrator
 * - >95% occupancy: Trigger divert protocol notification
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { getEnv } from '../_shared/env.ts';

// Capacity thresholds
const THRESHOLD_WATCH = 70;
const THRESHOLD_WARNING = 80;
const THRESHOLD_CRITICAL = 90;
const THRESHOLD_DIVERT = 95;

// Alert types mapped to guardian_alerts
const ALERT_TYPES = {
  WATCH: 'capacity_watch',
  WARNING: 'capacity_warning',
  CRITICAL: 'capacity_critical',
  DIVERT: 'capacity_divert',
} as const;

interface FacilityCapacity {
  facility_id: string;
  facility_name: string;
  tenant_id: string;
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  occupancy_percent: number;
  divert_status: boolean;
}

interface MonitorResult {
  facilities_checked: number;
  alerts_created: number;
  alerts_resolved: number;
  errors: string[];
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
    const serviceRoleKey = getEnv('SB_SECRET_KEY', 'SB_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const result: MonitorResult = {
      facilities_checked: 0,
      alerts_created: 0,
      alerts_resolved: 0,
      errors: [],
    };

    // Get latest capacity snapshots for all facilities
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('facility_capacity_snapshots')
      .select('facility_id, facility_name, tenant_id, total_beds, occupied_beds, available_beds, occupancy_percent, divert_status')
      .order('facility_id')
      .order('snapshot_at', { ascending: false });

    if (snapshotsError) {
      throw new Error(`Failed to fetch capacity snapshots: ${snapshotsError.message}`);
    }

    // De-duplicate to get latest per facility
    const latestByFacility = new Map<string, FacilityCapacity>();
    for (const row of snapshots || []) {
      if (!latestByFacility.has(row.facility_id)) {
        latestByFacility.set(row.facility_id, row as FacilityCapacity);
      }
    }

    result.facilities_checked = latestByFacility.size;

    // Get existing active alerts to avoid duplicates
    const { data: existingAlerts, error: alertsError } = await supabase
      .from('guardian_alerts')
      .select('id, reference_id, alert_type, status')
      .in('alert_type', Object.values(ALERT_TYPES))
      .eq('status', 'active');

    if (alertsError) {
      result.errors.push(`Failed to fetch existing alerts: ${alertsError.message}`);
    }

    const existingAlertsByFacility = new Map<string, Set<string>>();
    for (const alert of existingAlerts || []) {
      if (alert.reference_id) {
        if (!existingAlertsByFacility.has(alert.reference_id)) {
          existingAlertsByFacility.set(alert.reference_id, new Set());
        }
        existingAlertsByFacility.get(alert.reference_id)?.add(alert.alert_type);
      }
    }

    // Process each facility
    for (const [facilityId, capacity] of latestByFacility) {
      try {
        const alertType = getAlertTypeForOccupancy(capacity.occupancy_percent, capacity.divert_status);
        const existingTypes = existingAlertsByFacility.get(facilityId) || new Set();

        // Create new alert if threshold crossed and no existing alert
        if (alertType && !existingTypes.has(alertType)) {
          const alertData = createAlertData(capacity, alertType);

          const { error: insertError } = await supabase
            .from('guardian_alerts')
            .insert(alertData);

          if (insertError) {
            result.errors.push(`Failed to create alert for ${capacity.facility_name}: ${insertError.message}`);
          } else {
            result.alerts_created++;
          }
        }

        // Resolve alerts if occupancy dropped below threshold
        if (capacity.occupancy_percent < THRESHOLD_WATCH && !capacity.divert_status) {
          // Resolve all capacity alerts for this facility
          for (const existingType of existingTypes) {
            const { error: resolveError } = await supabase
              .from('guardian_alerts')
              .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
                resolution_notes: `Occupancy dropped to ${capacity.occupancy_percent.toFixed(1)}%`,
              })
              .eq('reference_id', facilityId)
              .eq('alert_type', existingType)
              .eq('status', 'active');

            if (resolveError) {
              result.errors.push(`Failed to resolve alert for ${capacity.facility_name}: ${resolveError.message}`);
            } else {
              result.alerts_resolved++;
            }
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        result.errors.push(`Error processing ${capacity.facility_name}: ${errorMessage}`);
      }
    }

    // Log the monitor run
    await supabase.from('audit_logs').insert({
      event_type: 'CAPACITY_MONITOR_RUN',
      event_data: {
        facilities_checked: result.facilities_checked,
        alerts_created: result.alerts_created,
        alerts_resolved: result.alerts_resolved,
        errors_count: result.errors.length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        result,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Get alert type based on occupancy percentage
 */
function getAlertTypeForOccupancy(occupancyPercent: number, onDivert: boolean): string | null {
  if (onDivert || occupancyPercent >= THRESHOLD_DIVERT) {
    return ALERT_TYPES.DIVERT;
  }
  if (occupancyPercent >= THRESHOLD_CRITICAL) {
    return ALERT_TYPES.CRITICAL;
  }
  if (occupancyPercent >= THRESHOLD_WARNING) {
    return ALERT_TYPES.WARNING;
  }
  if (occupancyPercent >= THRESHOLD_WATCH) {
    return ALERT_TYPES.WATCH;
  }
  return null;
}

/**
 * Create guardian alert data structure
 */
function createAlertData(capacity: FacilityCapacity, alertType: string): Record<string, unknown> {
  const severity = getSeverityForAlertType(alertType);
  const escalationTargets = getEscalationTargets(alertType);

  return {
    tenant_id: capacity.tenant_id,
    alert_type: alertType,
    severity,
    title: getAlertTitle(capacity, alertType),
    message: getAlertMessage(capacity, alertType),
    reference_type: 'facility',
    reference_id: capacity.facility_id,
    status: 'active',
    escalation_level: getEscalationLevel(alertType),
    escalation_targets: escalationTargets,
    triggered_at: new Date().toISOString(),
    metadata: {
      facility_name: capacity.facility_name,
      occupancy_percent: capacity.occupancy_percent,
      total_beds: capacity.total_beds,
      occupied_beds: capacity.occupied_beds,
      available_beds: capacity.available_beds,
      divert_status: capacity.divert_status,
    },
  };
}

function getSeverityForAlertType(alertType: string): string {
  switch (alertType) {
    case ALERT_TYPES.DIVERT:
      return 'critical';
    case ALERT_TYPES.CRITICAL:
      return 'high';
    case ALERT_TYPES.WARNING:
      return 'medium';
    case ALERT_TYPES.WATCH:
      return 'low';
    default:
      return 'info';
  }
}

function getEscalationLevel(alertType: string): number {
  switch (alertType) {
    case ALERT_TYPES.DIVERT:
      return 4;
    case ALERT_TYPES.CRITICAL:
      return 3;
    case ALERT_TYPES.WARNING:
      return 2;
    case ALERT_TYPES.WATCH:
      return 1;
    default:
      return 0;
  }
}

function getEscalationTargets(alertType: string): string[] {
  switch (alertType) {
    case ALERT_TYPES.DIVERT:
      return ['hospital_administrator', 'bed_control', 'discharge_coordinator', 'charge_nurse', 'nursing_supervisor'];
    case ALERT_TYPES.CRITICAL:
      return ['hospital_administrator', 'bed_control', 'discharge_coordinator', 'nursing_supervisor'];
    case ALERT_TYPES.WARNING:
      return ['bed_control', 'discharge_coordinator', 'charge_nurse'];
    case ALERT_TYPES.WATCH:
      return ['charge_nurse'];
    default:
      return [];
  }
}

function getAlertTitle(capacity: FacilityCapacity, alertType: string): string {
  const percent = capacity.occupancy_percent.toFixed(1);
  switch (alertType) {
    case ALERT_TYPES.DIVERT:
      return `DIVERT: ${capacity.facility_name} at ${percent}% capacity`;
    case ALERT_TYPES.CRITICAL:
      return `CRITICAL: ${capacity.facility_name} at ${percent}% capacity`;
    case ALERT_TYPES.WARNING:
      return `WARNING: ${capacity.facility_name} at ${percent}% capacity`;
    case ALERT_TYPES.WATCH:
      return `WATCH: ${capacity.facility_name} at ${percent}% capacity`;
    default:
      return `Capacity Alert: ${capacity.facility_name}`;
  }
}

function getAlertMessage(capacity: FacilityCapacity, alertType: string): string {
  const percent = capacity.occupancy_percent.toFixed(1);
  const available = capacity.available_beds;

  switch (alertType) {
    case ALERT_TYPES.DIVERT:
      return `${capacity.facility_name} is at ${percent}% occupancy with only ${available} beds available. Divert protocol should be activated. Immediate discharge review and transfer options needed.`;
    case ALERT_TYPES.CRITICAL:
      return `${capacity.facility_name} is at ${percent}% occupancy with ${available} beds available. Hospital administrator has been notified. Accelerate discharges and review all pending admissions.`;
    case ALERT_TYPES.WARNING:
      return `${capacity.facility_name} is at ${percent}% occupancy with ${available} beds available. Bed control and discharge coordinator should review discharge planning and incoming transfers.`;
    case ALERT_TYPES.WATCH:
      return `${capacity.facility_name} is at ${percent}% occupancy with ${available} beds available. Charge nurse should monitor bed status and anticipated discharges.`;
    default:
      return `${capacity.facility_name} capacity alert: ${percent}% occupied, ${available} available.`;
  }
}
