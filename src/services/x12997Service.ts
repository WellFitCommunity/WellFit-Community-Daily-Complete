/**
 * X12 997 Functional Acknowledgment Service
 *
 * Purpose: Process, store, and retrieve X12 997 acknowledgments
 * Features: Parse, store, query, statistics, claim linking
 * Integration: Clearinghouse MCP, billing workflows
 *
 * @module services/x12997Service
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import {
  x12997Parser,
  Parsed997,
  isRejected,
  getGroupAckDescription,
  AcknowledgmentStatusCode,
  TransactionAckCode,
} from './x12997Parser';

// =============================================================================
// TYPES
// =============================================================================

export interface StoredAcknowledgment {
  id: string;
  tenantId: string;
  interchangeControlNumber: string;
  groupControlNumber: string | null;
  acknowledgmentStatus: AcknowledgmentStatusCode;
  acknowledgmentStatusDescription: string;
  originalTransactionType: string | null;
  originalControlNumber: string | null;
  transactionSetsReceived: number;
  transactionSetsAccepted: number;
  transactionSetsRejected: number;
  receivedAt: string;
  processedAt: string | null;
  clearinghouseProvider: string | null;
}

export interface StoredTransactionSet {
  id: string;
  acknowledgmentId: string;
  transactionSetIdentifier: string;
  transactionSetControlNumber: string;
  acknowledgmentCode: TransactionAckCode;
  acknowledgmentCodeDescription: string;
  syntaxErrorCode1: string | null;
  linkedClaimId: string | null;
}

export interface StoredSegmentError {
  id: string;
  transactionSetId: string;
  segmentIdCode: string;
  segmentPosition: number;
  loopIdentifierCode: string | null;
  segmentSyntaxErrorCode: string | null;
  elementPosition: number | null;
  elementSyntaxErrorCode: string | null;
  copyOfBadDataElement: string | null;
  segmentErrorDescription: string | null;
  elementErrorDescription: string | null;
}

export interface AcknowledgmentSummary {
  id: string;
  interchangeControlNumber: string;
  acknowledgmentStatus: string;
  originalTransactionType: string | null;
  transactionSetsReceived: number;
  transactionSetsAccepted: number;
  transactionSetsRejected: number;
  receivedAt: string;
  totalErrors: number;
}

export interface RejectedTransaction {
  acknowledgmentId: string;
  transactionSetId: string;
  transactionSetIdentifier: string;
  transactionSetControlNumber: string;
  acknowledgmentCode: string;
  errorDescription: string | null;
  remediation: string | null;
  linkedClaimId: string | null;
  receivedAt: string;
}

export interface Acknowledgment997Statistics {
  totalAcknowledgments: number;
  accepted: number;
  acceptedWithErrors: number;
  rejected: number;
  totalTransactionSets: number;
  tsAccepted: number;
  tsRejected: number;
  commonErrors: Array<{
    code: string;
    description: string;
    count: number;
  }>;
}

export interface ProcessResult {
  acknowledgmentId: string;
  status: AcknowledgmentStatusCode;
  statusDescription: string;
  transactionSetsProcessed: number;
  errorsFound: number;
  summary: {
    accepted: number;
    rejected: number;
    acceptedWithErrors: number;
  };
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Process and store a 997 acknowledgment
 */
async function processAcknowledgment(
  x12Content: string,
  tenantId: string,
  clearinghouseProvider?: string,
  originalTransactionType?: string,
  claimIds?: string[]
): Promise<ServiceResult<ProcessResult>> {
  try {
    // Parse the 997 content
    const parseResult = x12997Parser.parse(x12Content);
    if (!parseResult.success || !parseResult.data) {
      return failure('INVALID_INPUT', parseResult.error || 'Failed to parse 997 content');
    }

    const parsed = parseResult.data;

    // Store the acknowledgment
    const { data: ackData, error: ackError } = await supabase.rpc('store_997_acknowledgment', {
      p_tenant_id: tenantId,
      p_interchange_control_number: parsed.isa.interchangeControlNumber,
      p_group_control_number: parsed.gs.groupControlNumber,
      p_acknowledgment_status: parsed.ak9.functionalGroupAcknowledgeCode,
      p_original_transaction_type: originalTransactionType || parsed.ak1.functionalIdCode,
      p_original_control_number: parsed.ak1.groupControlNumber,
      p_transaction_sets_received: parsed.ak9.numberOfReceivedTransactionSets,
      p_transaction_sets_accepted: parsed.ak9.numberOfAcceptedTransactionSets,
      p_transaction_sets_rejected:
        parsed.ak9.numberOfReceivedTransactionSets - parsed.ak9.numberOfAcceptedTransactionSets,
      p_raw_x12_content: x12Content,
      p_clearinghouse_provider: clearinghouseProvider || null,
    });

    if (ackError) {
      return failure('DATABASE_ERROR', 'Failed to store acknowledgment', ackError);
    }

    const acknowledgmentId = ackData as string;
    let totalErrors = 0;
    let accepted = 0;
    let rejected = 0;
    let acceptedWithErrors = 0;

    // Store transaction set acknowledgments
    for (const txSet of parsed.transactionSets) {
      const { data: tsData, error: tsError } = await supabase.rpc('store_997_transaction_set', {
        p_acknowledgment_id: acknowledgmentId,
        p_transaction_set_identifier: txSet.ak2.transactionSetIdCode,
        p_transaction_set_control_number: txSet.ak2.transactionSetControlNumber,
        p_acknowledgment_code: txSet.ak5.transactionSetAcknowledgmentCode,
        p_syntax_error_code_1: txSet.ak5.transactionSetSyntaxErrorCode1 || null,
        p_syntax_error_code_2: txSet.ak5.transactionSetSyntaxErrorCode2 || null,
        p_syntax_error_code_3: txSet.ak5.transactionSetSyntaxErrorCode3 || null,
        p_linked_claim_id: null, // Will be linked separately if claimIds provided
      });

      if (tsError) {
        await auditLogger.warn('997_TRANSACTION_SET_STORE_FAILED', {
          acknowledgmentId,
          error: tsError.message,
        });
        continue;
      }

      const transactionSetId = tsData as string;

      // Count status
      if (txSet.ak5.transactionSetAcknowledgmentCode === 'A') {
        accepted++;
      } else if (txSet.ak5.transactionSetAcknowledgmentCode === 'E') {
        acceptedWithErrors++;
      } else {
        rejected++;
      }

      // Store segment errors
      for (const segError of txSet.segmentErrors) {
        await supabase.rpc('store_997_segment_error', {
          p_transaction_set_id: transactionSetId,
          p_segment_id_code: segError.ak3.segmentIdCode,
          p_segment_position: segError.ak3.segmentPositionInTransactionSet,
          p_loop_identifier_code: segError.ak3.loopIdentifierCode || null,
          p_segment_syntax_error_code: segError.ak3.segmentSyntaxErrorCode || null,
          p_element_position: null,
          p_element_syntax_error_code: null,
          p_copy_of_bad_data_element: null,
        });

        totalErrors++;

        // Store element errors
        for (const elemError of segError.ak4Errors) {
          await supabase.rpc('store_997_segment_error', {
            p_transaction_set_id: transactionSetId,
            p_segment_id_code: segError.ak3.segmentIdCode,
            p_segment_position: segError.ak3.segmentPositionInTransactionSet,
            p_loop_identifier_code: segError.ak3.loopIdentifierCode || null,
            p_segment_syntax_error_code: segError.ak3.segmentSyntaxErrorCode || null,
            p_element_position: elemError.positionInSegment,
            p_element_syntax_error_code: elemError.dataElementSyntaxErrorCode || null,
            p_copy_of_bad_data_element: elemError.copyOfBadDataElement || null,
          });

          totalErrors++;
        }
      }
    }

    // Link to claims if provided
    if (claimIds && claimIds.length > 0) {
      await supabase.rpc('link_997_to_claims', {
        p_acknowledgment_id: acknowledgmentId,
        p_claim_ids: claimIds,
      });
    }

    await auditLogger.info('997_ACKNOWLEDGMENT_PROCESSED', {
      acknowledgmentId,
      tenantId,
      status: parsed.ak9.functionalGroupAcknowledgeCode,
      transactionSets: parsed.transactionSets.length,
      errorsFound: totalErrors,
    });

    return success({
      acknowledgmentId,
      status: parsed.ak9.functionalGroupAcknowledgeCode,
      statusDescription: getGroupAckDescription(parsed.ak9.functionalGroupAcknowledgeCode),
      transactionSetsProcessed: parsed.transactionSets.length,
      errorsFound: totalErrors,
      summary: {
        accepted,
        rejected,
        acceptedWithErrors,
      },
    });
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('997_PROCESSING_FAILED', wrappedError, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to process 997 acknowledgment', wrappedError);
  }
}

/**
 * Get acknowledgment by ID
 */
async function getAcknowledgment(
  acknowledgmentId: string
): Promise<ServiceResult<StoredAcknowledgment>> {
  try {
    const { data, error } = await supabase
      .from('x12_997_acknowledgments')
      .select('*')
      .eq('id', acknowledgmentId)
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get acknowledgment', error);
    }

    if (!data) {
      return failure('NOT_FOUND', 'Acknowledgment not found');
    }

    return success({
      id: data.id,
      tenantId: data.tenant_id,
      interchangeControlNumber: data.interchange_control_number,
      groupControlNumber: data.group_control_number,
      acknowledgmentStatus: data.acknowledgment_status,
      acknowledgmentStatusDescription: data.acknowledgment_status_description,
      originalTransactionType: data.original_transaction_type,
      originalControlNumber: data.original_control_number,
      transactionSetsReceived: data.transaction_sets_received,
      transactionSetsAccepted: data.transaction_sets_accepted,
      transactionSetsRejected: data.transaction_sets_rejected,
      receivedAt: data.received_at,
      processedAt: data.processed_at,
      clearinghouseProvider: data.clearinghouse_provider,
    });
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('997_GET_FAILED', wrappedError, { acknowledgmentId });
    return failure('OPERATION_FAILED', 'Failed to get acknowledgment', wrappedError);
  }
}

/**
 * Get recent acknowledgments for a tenant
 */
async function getRecentAcknowledgments(
  tenantId: string,
  limit: number = 50
): Promise<ServiceResult<AcknowledgmentSummary[]>> {
  try {
    const { data, error } = await supabase
      .from('v_997_acknowledgment_summary')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get acknowledgments', error);
    }

    const summaries: AcknowledgmentSummary[] = (data || []).map((row) => ({
      id: row.id,
      interchangeControlNumber: row.interchange_control_number,
      acknowledgmentStatus: row.acknowledgment_status,
      originalTransactionType: row.original_transaction_type,
      transactionSetsReceived: row.transaction_sets_received,
      transactionSetsAccepted: row.transaction_sets_accepted,
      transactionSetsRejected: row.rejected_count || 0,
      receivedAt: row.received_at,
      totalErrors: row.total_errors || 0,
    }));

    return success(summaries);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('997_LIST_FAILED', wrappedError, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to get acknowledgments', wrappedError);
  }
}

/**
 * Get rejected transactions requiring attention
 */
async function getRejectedTransactions(
  tenantId: string,
  limit: number = 50
): Promise<ServiceResult<RejectedTransaction[]>> {
  try {
    const { data, error } = await supabase
      .from('v_997_rejected_transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get rejected transactions', error);
    }

    const rejections: RejectedTransaction[] = (data || []).map((row) => ({
      acknowledgmentId: row.acknowledgment_id,
      transactionSetId: row.transaction_set_id,
      transactionSetIdentifier: row.transaction_set_identifier,
      transactionSetControlNumber: row.transaction_set_control_number,
      acknowledgmentCode: row.acknowledgment_code,
      errorDescription: row.error_description,
      remediation: row.remediation,
      linkedClaimId: row.linked_claim_id,
      receivedAt: row.received_at,
    }));

    return success(rejections);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('997_REJECTIONS_FAILED', wrappedError, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to get rejected transactions', wrappedError);
  }
}

/**
 * Get transaction sets for an acknowledgment
 */
async function getTransactionSets(
  acknowledgmentId: string
): Promise<ServiceResult<StoredTransactionSet[]>> {
  try {
    const { data, error } = await supabase
      .from('x12_997_transaction_sets')
      .select('*')
      .eq('acknowledgment_id', acknowledgmentId)
      .order('created_at');

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get transaction sets', error);
    }

    const transactionSets: StoredTransactionSet[] = (data || []).map((row) => ({
      id: row.id,
      acknowledgmentId: row.acknowledgment_id,
      transactionSetIdentifier: row.transaction_set_identifier,
      transactionSetControlNumber: row.transaction_set_control_number,
      acknowledgmentCode: row.acknowledgment_code,
      acknowledgmentCodeDescription: row.acknowledgment_code_description,
      syntaxErrorCode1: row.syntax_error_code_1,
      linkedClaimId: row.linked_claim_id,
    }));

    return success(transactionSets);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('997_TS_GET_FAILED', wrappedError, { acknowledgmentId });
    return failure('OPERATION_FAILED', 'Failed to get transaction sets', wrappedError);
  }
}

/**
 * Get segment errors for a transaction set
 */
async function getSegmentErrors(
  transactionSetId: string
): Promise<ServiceResult<StoredSegmentError[]>> {
  try {
    const { data, error } = await supabase
      .from('x12_997_segment_errors')
      .select('*')
      .eq('transaction_set_id', transactionSetId)
      .order('segment_position');

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get segment errors', error);
    }

    const errors: StoredSegmentError[] = (data || []).map((row) => ({
      id: row.id,
      transactionSetId: row.transaction_set_id,
      segmentIdCode: row.segment_id_code,
      segmentPosition: row.segment_position,
      loopIdentifierCode: row.loop_identifier_code,
      segmentSyntaxErrorCode: row.segment_syntax_error_code,
      elementPosition: row.element_position,
      elementSyntaxErrorCode: row.element_syntax_error_code,
      copyOfBadDataElement: row.copy_of_bad_data_element,
      segmentErrorDescription: row.segment_error_description,
      elementErrorDescription: row.element_error_description,
    }));

    return success(errors);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('997_ERRORS_GET_FAILED', wrappedError, { transactionSetId });
    return failure('OPERATION_FAILED', 'Failed to get segment errors', wrappedError);
  }
}

/**
 * Get 997 statistics for a tenant
 */
async function getStatistics(
  tenantId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<ServiceResult<Acknowledgment997Statistics>> {
  try {
    const { data, error } = await supabase.rpc('get_997_statistics', {
      p_tenant_id: tenantId,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get statistics', error);
    }

    const row = data?.[0] || data;

    return success({
      totalAcknowledgments: row?.total_acknowledgments || 0,
      accepted: row?.accepted || 0,
      acceptedWithErrors: row?.accepted_with_errors || 0,
      rejected: row?.rejected || 0,
      totalTransactionSets: row?.total_transaction_sets || 0,
      tsAccepted: row?.ts_accepted || 0,
      tsRejected: row?.ts_rejected || 0,
      commonErrors: (row?.common_errors || []) as Array<{
        code: string;
        description: string;
        count: number;
      }>,
    });
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('997_STATS_FAILED', wrappedError, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to get statistics', wrappedError);
  }
}

/**
 * Link acknowledgment to claim IDs
 */
async function linkToClaims(
  acknowledgmentId: string,
  claimIds: string[]
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase.rpc('link_997_to_claims', {
      p_acknowledgment_id: acknowledgmentId,
      p_claim_ids: claimIds,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to link claims', error);
    }

    await auditLogger.info('997_CLAIMS_LINKED', {
      acknowledgmentId,
      claimCount: claimIds.length,
    });

    return success(undefined);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('997_LINK_FAILED', wrappedError, { acknowledgmentId });
    return failure('OPERATION_FAILED', 'Failed to link claims', wrappedError);
  }
}

/**
 * Get acknowledgments for a specific claim
 */
async function getAcknowledgmentsForClaim(
  claimId: string
): Promise<ServiceResult<AcknowledgmentSummary[]>> {
  try {
    // Search for acknowledgments that have this claim ID in their array
    const { data, error } = await supabase
      .from('x12_997_acknowledgments')
      .select('*')
      .contains('original_claim_ids', [claimId])
      .order('received_at', { ascending: false });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get acknowledgments for claim', error);
    }

    const summaries: AcknowledgmentSummary[] = (data || []).map((row) => ({
      id: row.id,
      interchangeControlNumber: row.interchange_control_number,
      acknowledgmentStatus: row.acknowledgment_status,
      originalTransactionType: row.original_transaction_type,
      transactionSetsReceived: row.transaction_sets_received,
      transactionSetsAccepted: row.transaction_sets_accepted,
      transactionSetsRejected: row.transaction_sets_rejected,
      receivedAt: row.received_at,
      totalErrors: 0, // Would need join to count
    }));

    return success(summaries);
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('997_CLAIM_LOOKUP_FAILED', wrappedError, { claimId });
    return failure('OPERATION_FAILED', 'Failed to get acknowledgments for claim', wrappedError);
  }
}

/**
 * Get error code reference information
 */
async function getErrorCodeInfo(
  code: string,
  errorType?: string
): Promise<ServiceResult<{ code: string; errorType: string; description: string; remediation: string | null }>> {
  try {
    let query = supabase
      .from('x12_997_error_codes')
      .select('*')
      .eq('code', code);

    if (errorType) {
      query = query.eq('error_type', errorType);
    }

    const { data, error } = await query.single();

    if (error) {
      return failure('NOT_FOUND', 'Error code not found');
    }

    return success({
      code: data.code,
      errorType: data.error_type,
      description: data.description,
      remediation: data.remediation,
    });
  } catch (err: unknown) {
    const wrappedError = err instanceof Error ? err : new Error(String(err));
    return failure('OPERATION_FAILED', 'Failed to get error code info', wrappedError);
  }
}

/**
 * Parse 997 content without storing (for preview)
 */
function parseOnly(x12Content: string): ServiceResult<Parsed997> {
  const result = x12997Parser.parse(x12Content);
  if (!result.success || !result.data) {
    return failure('INVALID_INPUT', result.error || 'Failed to parse 997 content');
  }
  return success(result.data);
}

/**
 * Validate 997 content
 */
function validate(x12Content: string): ServiceResult<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Parse first
  const parseResult = x12997Parser.parse(x12Content);
  if (!parseResult.success) {
    return success({
      valid: false,
      errors: [parseResult.error || 'Parse failed'],
      warnings: [],
    });
  }

  // parseResult.success is true at this point, so data exists
  const parsed = parseResult.data as NonNullable<typeof parseResult.data>;

  // Validate ISA
  if (!parsed.isa.interchangeControlNumber) {
    errors.push('Missing interchange control number');
  }

  // Validate GS
  if (!parsed.gs.groupControlNumber) {
    errors.push('Missing group control number');
  }

  // Validate AK1
  if (!parsed.ak1.functionalIdCode) {
    errors.push('Missing functional ID code in AK1');
  }

  // Validate AK9
  if (parsed.ak9.numberOfReceivedTransactionSets !==
      parsed.ak9.numberOfAcceptedTransactionSets +
        (parsed.transactionSets.filter(ts =>
          isRejected(ts.ak5.transactionSetAcknowledgmentCode)
        ).length)) {
    warnings.push('Transaction set counts may not match AK9 totals');
  }

  // Check for parse warnings
  if (parseResult.parseErrors && parseResult.parseErrors.length > 0) {
    warnings.push(...parseResult.parseErrors);
  }

  return success({
    valid: errors.length === 0,
    errors,
    warnings,
  });
}

// =============================================================================
// EXPORT
// =============================================================================

export const x12997Service = {
  // Core processing
  processAcknowledgment,
  parseOnly,
  validate,

  // Retrieval
  getAcknowledgment,
  getRecentAcknowledgments,
  getRejectedTransactions,
  getTransactionSets,
  getSegmentErrors,
  getStatistics,

  // Linking
  linkToClaims,
  getAcknowledgmentsForClaim,

  // Reference
  getErrorCodeInfo,
};

export default x12997Service;
