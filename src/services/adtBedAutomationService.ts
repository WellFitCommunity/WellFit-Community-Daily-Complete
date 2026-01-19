/**
 * ADT Bed Automation Service
 *
 * Automatically updates bed status based on HL7v2 ADT events.
 * This service bridges the HL7 integration with the bed management system.
 *
 * ADT Event → Bed Status Mapping:
 *   A01 (Admit)           → bed = 'occupied', create assignment
 *   A02 (Transfer)        → old bed = 'dirty', new bed = 'occupied'
 *   A03 (Discharge)       → bed = 'dirty', end assignment
 *   A04 (Register)        → bed = 'reserved' if pre-assigned
 *   A11 (Cancel Admit)    → bed = 'available', delete assignment
 *   A13 (Cancel Discharge)→ bed = 'occupied', reactivate assignment
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';

// ============================================================================
// TYPES
// ============================================================================

/**
 * ADT event types that affect bed status
 */
export type BedRelevantADTEvent = 'A01' | 'A02' | 'A03' | 'A04' | 'A11' | 'A12' | 'A13';

/**
 * Location information from HL7 PV1 segment
 */
export interface ADTLocationInfo {
  room?: string;
  bed?: string;
  unitCode?: string;
  building?: string;
  floor?: string;
}

/**
 * Input for ADT bed update
 */
export interface ADTBedUpdateInput {
  tenantId: string;
  eventType: string;
  patientId?: string;
  location?: ADTLocationInfo;
  previousLocation?: ADTLocationInfo;
  expectedLosDays?: number;
  dischargeDisposition?: string;
  adtMessageId?: string;
  changedBy?: string;
}

/**
 * Result of ADT bed update
 */
export interface ADTBedUpdateResult {
  success: boolean;
  action: string;
  bedId?: string;
  previousBedId?: string;
  assignmentId?: string;
  newStatus?: string;
  message?: string;
  error?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Process an ADT event and update bed status accordingly
 */
export async function processADTBedUpdate(
  input: ADTBedUpdateInput
): Promise<ServiceResult<ADTBedUpdateResult>> {
  const { tenantId, eventType, patientId, location, previousLocation } = input;

  // Validate input
  if (!tenantId) {
    return failure('VALIDATION_ERROR', 'Tenant ID is required');
  }

  if (!eventType) {
    return failure('VALIDATION_ERROR', 'Event type is required');
  }

  // Check if this event type affects beds
  const bedRelevantEvents: BedRelevantADTEvent[] = ['A01', 'A02', 'A03', 'A04', 'A11', 'A12', 'A13'];
  if (!bedRelevantEvents.includes(eventType as BedRelevantADTEvent)) {
    await auditLogger.debug('ADT_BED_UPDATE_SKIPPED', {
      eventType,
      reason: 'Event type does not affect bed status',
    });

    return success({
      success: true,
      action: 'ignored',
      message: `Event type ${eventType} does not affect bed status`,
    });
  }

  try {
    await auditLogger.clinical('ADT_BED_UPDATE_START', true, {
      tenantId,
      eventType,
      patientId,
      room: location?.room,
      bed: location?.bed,
    });

    // Call the database function
    const { data, error } = await supabase.rpc('process_adt_bed_update', {
      p_tenant_id: tenantId,
      p_event_type: eventType,
      p_patient_id: patientId || null,
      p_bed_room: location?.room || null,
      p_bed_position: location?.bed || 'A',
      p_unit_code: location?.unitCode || null,
      p_previous_bed_room: previousLocation?.room || null,
      p_previous_bed_position: previousLocation?.bed || 'A',
      p_expected_los_days: input.expectedLosDays || null,
      p_discharge_disposition: input.dischargeDisposition || null,
      p_adt_message_id: input.adtMessageId || null,
      p_changed_by: input.changedBy || null,
    });

    if (error) {
      await auditLogger.error(
        'ADT_BED_UPDATE_FAILED',
        new Error(error.message),
        { tenantId, eventType, patientId, code: error.code }
      );

      return failure('DATABASE_ERROR', `Failed to process ADT bed update: ${error.message}`, error);
    }

    const result = data as ADTBedUpdateResult;

    if (result.success) {
      await auditLogger.clinical('ADT_BED_UPDATE_SUCCESS', true, {
        tenantId,
        eventType,
        action: result.action,
        bedId: result.bedId,
        newStatus: result.newStatus,
      });
    } else {
      await auditLogger.clinical('ADT_BED_UPDATE_NO_ACTION', false, {
        tenantId,
        eventType,
        error: result.error,
      });
    }

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    await auditLogger.error('ADT_BED_UPDATE_ERROR', error, {
      tenantId,
      eventType,
      patientId,
    });

    return failure('OPERATION_FAILED', `ADT bed update error: ${error.message}`, err);
  }
}

/**
 * Extract location info from HL7 PV1 assigned patient location
 */
export function extractLocationFromPV1(
  assignedLocation: unknown
): ADTLocationInfo | undefined {
  if (!assignedLocation || typeof assignedLocation !== 'object') {
    return undefined;
  }

  const loc = assignedLocation as Record<string, unknown>;

  return {
    room: typeof loc.room === 'string' ? loc.room : undefined,
    bed: typeof loc.bed === 'string' ? loc.bed : undefined,
    unitCode: typeof loc.pointOfCare === 'string' ? loc.pointOfCare : undefined,
    building: typeof loc.building === 'string' ? loc.building : undefined,
    floor: typeof loc.floor === 'string' ? loc.floor : undefined,
  };
}

/**
 * Check if an ADT event type affects bed status
 */
export function isADTEventBedRelevant(eventType: string): boolean {
  const bedRelevantEvents = ['A01', 'A02', 'A03', 'A04', 'A11', 'A12', 'A13'];
  return bedRelevantEvents.includes(eventType);
}

/**
 * Get human-readable description of ADT event bed action
 */
export function getADTBedActionDescription(eventType: string): string {
  const descriptions: Record<string, string> = {
    A01: 'Admit - Bed marked as occupied',
    A02: 'Transfer - Old bed dirty, new bed occupied',
    A03: 'Discharge - Bed marked as dirty (awaiting cleaning)',
    A04: 'Register - Bed reserved for incoming patient',
    A11: 'Cancel Admit - Bed marked as available',
    A12: 'Cancel Transfer - Reverted to previous state',
    A13: 'Cancel Discharge - Bed marked as occupied again',
  };

  return descriptions[eventType] || `Unknown event type: ${eventType}`;
}
