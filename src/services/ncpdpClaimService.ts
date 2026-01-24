/**
 * NCPDP Claim Service - Pharmacy Billing Claims Management
 *
 * Purpose: Create, submit, and manage pharmacy claims using NCPDP D.0 standard
 * Features: Claim creation, submission via clearinghouse MCP, response processing, reversals
 * Compliance: NCPDP D.0 standard, HIPAA EDI requirements
 *
 * @module services/ncpdpClaimService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type ClaimStatus = 'pending' | 'submitted' | 'accepted' | 'rejected' | 'paid' | 'reversed' | 'duplicate';
export type TransactionCode = 'B1' | 'B2' | 'B3' | 'E1' | 'P1' | 'P2' | 'P3' | 'P4';
export type DAWCode = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

export interface NCPDPClaim {
  id: string;
  claim_number: string;
  patient_id: string;
  patient_first_name: string;
  patient_last_name: string;
  patient_dob: string;
  prescriber_npi: string;
  prescriber_name: string;
  service_provider_ncpdp: string;
  ndc_code: string;
  drug_name: string;
  quantity_dispensed: number;
  days_supply: number;
  date_of_service: string;
  claim_status: ClaimStatus;
  transaction_code: TransactionCode | null;
  response_status: string | null;
  authorization_number: string | null;
  rejection_codes: string[] | null;
  rejection_messages: string[] | null;
  paid_amount: number | null;
  copay_amount: number | null;
  submitted_at: string | null;
  response_received_at: string | null;
  created_at: string;
}

export interface CreateClaimRequest {
  patientId: string;
  prescriberNPI: string;
  ndcCode: string;
  drugName: string;
  quantity: number;
  daysSupply: number;
  pharmacyNCPDP: string;
  dateOfService?: string;
  fillNumber?: number;
  refillsAuthorized?: number;
  ingredientCost?: number;
  dispensingFee?: number;
  dawCode?: DAWCode;
  priorAuthNumber?: string;
}

export interface ClaimResponse {
  claimId: string;
  claimNumber: string;
  status: ClaimStatus;
  responseStatus?: string;
  authorizationNumber?: string;
  paidAmount?: number;
  copayAmount?: number;
  rejectionCodes?: string[];
  rejectionMessages?: string[];
}

export interface ClaimMetrics {
  period: {
    from: string;
    to: string;
  };
  total_claims: number;
  pending_claims: number;
  submitted_claims: number;
  accepted_claims: number;
  rejected_claims: number;
  reversed_claims: number;
  acceptance_rate: number | null;
  total_billed_cents: number | null;
  total_paid_cents: number | null;
  total_copays_cents: number | null;
  top_rejection_codes: Array<{ code: string; count: number }> | null;
}

export interface PharmacyConnection {
  id: string;
  pharmacy_name: string;
  ncpdp_id: string;
  npi: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  pharmacy_type: string | null;
  is_active: boolean;
}

// =============================================================================
// NCPDP REJECTION CODE DESCRIPTIONS
// =============================================================================

const REJECTION_CODE_DESCRIPTIONS: Record<string, string> = {
  '01': 'M/I BIN Number',
  '02': 'M/I Version Number',
  '03': 'M/I Transaction Code',
  '04': 'M/I Processor Control Number',
  '05': 'M/I Service Provider Number',
  '06': 'M/I Group ID',
  '07': 'M/I Cardholder ID',
  '08': 'M/I Person Code',
  '10': 'M/I Date of Birth',
  '11': 'M/I Patient Gender Code',
  '12': 'M/I Patient First Name',
  '13': 'M/I Patient Last Name',
  '19': 'M/I Days Supply',
  '20': 'M/I Compound Code',
  '21': 'M/I Product/Service ID',
  '22': 'M/I Dispense as Written Code',
  '25': 'M/I Prescriber ID',
  '26': 'M/I Quantity Dispensed',
  '29': 'M/I Date of Service',
  '40': 'NDC Not Covered',
  '41': 'Submit to Primary Payer',
  '65': 'Patient Not Covered',
  '70': 'Product/Service Not Covered',
  '75': 'Prior Authorization Required',
  '76': 'Drug Utilization Review',
  '79': 'Refill Too Soon',
  '80': 'Pharmacy Not Network Pharmacy',
  '88': 'DUR Reject Error',
  '89': 'Quantity Exceeds Maximum',
  '99': 'Host Processing Error',
};

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Create a new pharmacy claim
 */
async function createClaim(
  request: CreateClaimRequest,
  createdBy: string
): Promise<ServiceResult<ClaimResponse>> {
  try {
    const { data, error } = await supabase.rpc('create_ncpdp_claim', {
      p_patient_id: request.patientId,
      p_prescriber_npi: request.prescriberNPI,
      p_ndc_code: request.ndcCode,
      p_quantity: request.quantity,
      p_days_supply: request.daysSupply,
      p_pharmacy_ncpdp: request.pharmacyNCPDP,
      p_date_of_service: request.dateOfService || new Date().toISOString().split('T')[0],
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to create claim', error);
    }

    const result = data as { success: boolean; claim_id: string; claim_number: string; error?: string };

    if (!result.success) {
      return failure('OPERATION_FAILED', result.error || 'Claim creation failed');
    }

    // Update additional fields if provided
    if (request.ingredientCost || request.dispensingFee || request.dawCode || request.priorAuthNumber) {
      await supabase
        .from('ncpdp_claims')
        .update({
          drug_name: request.drugName,
          ingredient_cost_submitted: request.ingredientCost,
          dispensing_fee_submitted: request.dispensingFee,
          daw_code: request.dawCode || '0',
          prior_auth_number: request.priorAuthNumber,
          fill_number: request.fillNumber || 0,
          refills_authorized: request.refillsAuthorized,
          created_by: createdBy,
        })
        .eq('id', result.claim_id);
    }

    await auditLogger.info('NCPDP_CLAIM_CREATED', {
      claimId: result.claim_id,
      claimNumber: result.claim_number,
      patientId: request.patientId,
      ndcCode: request.ndcCode,
      createdBy,
    });

    return success({
      claimId: result.claim_id,
      claimNumber: result.claim_number,
      status: 'pending',
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NCPDP_CLAIM_CREATE_FAILED', error, { ...request });
    return failure('OPERATION_FAILED', 'Failed to create pharmacy claim', err);
  }
}

/**
 * Submit claim to clearinghouse
 */
async function submitClaim(
  claimId: string
): Promise<ServiceResult<ClaimResponse>> {
  try {
    const { data, error } = await supabase.rpc('submit_ncpdp_claim', {
      p_claim_id: claimId,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to submit claim', error);
    }

    const result = data as { success: boolean; claim_id: string; claim_number: string; status: string; error?: string };

    if (!result.success) {
      return failure('OPERATION_FAILED', result.error || 'Claim submission failed');
    }

    await auditLogger.info('NCPDP_CLAIM_SUBMITTED', {
      claimId,
      claimNumber: result.claim_number,
    });

    // Note: In a real implementation, this would call the MCP clearinghouse tool
    // await mcp_clearinghouse.submit_pharmacy_claim(...)

    return success({
      claimId: result.claim_id,
      claimNumber: result.claim_number,
      status: 'submitted',
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NCPDP_CLAIM_SUBMIT_FAILED', error, { claimId });
    return failure('OPERATION_FAILED', 'Failed to submit claim', err);
  }
}

/**
 * Process claim response from clearinghouse
 */
async function processClaimResponse(
  claimId: string,
  responseStatus: 'A' | 'P' | 'R',
  authorizationNumber?: string,
  paidAmount?: number,
  copayAmount?: number,
  rejectionCodes?: string[],
  rejectionMessages?: string[]
): Promise<ServiceResult<ClaimResponse>> {
  try {
    const { data, error } = await supabase.rpc('process_ncpdp_claim_response', {
      p_claim_id: claimId,
      p_response_status: responseStatus,
      p_authorization_number: authorizationNumber || null,
      p_paid_amount: paidAmount || null,
      p_copay_amount: copayAmount || null,
      p_rejection_codes: rejectionCodes || null,
      p_rejection_messages: rejectionMessages || null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to process claim response', error);
    }

    const _result = data as { success: boolean; claim_id: string; status: string };

    const newStatus: ClaimStatus = responseStatus === 'A' ? 'accepted' : responseStatus === 'P' ? 'paid' : 'rejected';

    await auditLogger.info('NCPDP_CLAIM_RESPONSE_PROCESSED', {
      claimId,
      responseStatus,
      newStatus,
      paidAmount,
      rejectionCodes,
    });

    return success({
      claimId,
      claimNumber: '',
      status: newStatus,
      responseStatus,
      authorizationNumber,
      paidAmount,
      copayAmount,
      rejectionCodes,
      rejectionMessages,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NCPDP_RESPONSE_PROCESS_FAILED', error, { claimId, responseStatus });
    return failure('OPERATION_FAILED', 'Failed to process claim response', err);
  }
}

/**
 * Reverse a paid claim
 */
async function reverseClaim(
  claimId: string,
  reason?: string
): Promise<ServiceResult<boolean>> {
  try {
    const { data, error } = await supabase.rpc('reverse_ncpdp_claim', {
      p_claim_id: claimId,
      p_reason: reason || null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to reverse claim', error);
    }

    const result = data as { success: boolean; error?: string };

    if (!result.success) {
      return failure('OPERATION_FAILED', result.error || 'Claim reversal failed');
    }

    await auditLogger.info('NCPDP_CLAIM_REVERSED', {
      claimId,
      reason,
    });

    return success(true);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NCPDP_CLAIM_REVERSE_FAILED', error, { claimId });
    return failure('OPERATION_FAILED', 'Failed to reverse claim', err);
  }
}

/**
 * Get claim by ID
 */
async function getClaim(
  claimId: string
): Promise<ServiceResult<NCPDPClaim | null>> {
  try {
    const { data, error } = await supabase
      .from('ncpdp_claims')
      .select('*')
      .eq('id', claimId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', 'Failed to get claim', error);
    }

    return success(data as NCPDPClaim | null);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NCPDP_GET_CLAIM_FAILED', error, { claimId });
    return failure('OPERATION_FAILED', 'Failed to get claim', err);
  }
}

/**
 * Get claims for a patient
 */
async function getPatientClaims(
  patientId: string,
  options: { status?: ClaimStatus; limit?: number; offset?: number } = {}
): Promise<ServiceResult<NCPDPClaim[]>> {
  try {
    let query = supabase
      .from('ncpdp_claims')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('claim_status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get patient claims', error);
    }

    return success((data || []) as NCPDPClaim[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NCPDP_GET_PATIENT_CLAIMS_FAILED', error, { patientId });
    return failure('OPERATION_FAILED', 'Failed to get patient claims', err);
  }
}

/**
 * Get pending claims needing attention
 */
async function getPendingClaims(
  limit: number = 50
): Promise<ServiceResult<NCPDPClaim[]>> {
  try {
    const { data, error } = await supabase
      .from('ncpdp_claims')
      .select('*')
      .in('claim_status', ['pending', 'rejected'])
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get pending claims', error);
    }

    return success((data || []) as NCPDPClaim[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NCPDP_GET_PENDING_CLAIMS_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to get pending claims', err);
  }
}

/**
 * Get claim metrics
 */
async function getClaimMetrics(
  tenantId?: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<ServiceResult<ClaimMetrics>> {
  try {
    const { data, error } = await supabase.rpc('get_ncpdp_claim_metrics', {
      p_tenant_id: tenantId || null,
      p_date_from: dateFrom?.toISOString().split('T')[0] || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      p_date_to: dateTo?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get claim metrics', error);
    }

    return success(data as ClaimMetrics);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NCPDP_GET_METRICS_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to get claim metrics', err);
  }
}

/**
 * Get pharmacy connections
 */
async function getPharmacyConnections(
  activeOnly: boolean = true
): Promise<ServiceResult<PharmacyConnection[]>> {
  try {
    let query = supabase
      .from('pharmacy_provider_connections')
      .select('id, pharmacy_name, ncpdp_id, npi, address_line1, city, state, zip_code, phone, pharmacy_type, is_active')
      .order('pharmacy_name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get pharmacy connections', error);
    }

    return success((data || []) as PharmacyConnection[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NCPDP_GET_PHARMACIES_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to get pharmacy connections', err);
  }
}

/**
 * Get rejection code description
 */
function getRejectionCodeDescription(code: string): string {
  return REJECTION_CODE_DESCRIPTIONS[code] || `Unknown rejection code: ${code}`;
}

/**
 * Format amount from cents to dollars
 */
function formatCentsAsDollars(cents: number | null): string {
  if (cents === null) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

// =============================================================================
// EXPORT
// =============================================================================

export const ncpdpClaimService = {
  // Claim lifecycle
  createClaim,
  submitClaim,
  processClaimResponse,
  reverseClaim,

  // Queries
  getClaim,
  getPatientClaims,
  getPendingClaims,
  getClaimMetrics,

  // Pharmacy
  getPharmacyConnections,

  // Utilities
  getRejectionCodeDescription,
  formatCentsAsDollars,
};

export default ncpdpClaimService;
