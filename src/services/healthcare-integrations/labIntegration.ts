/**
 * Lab Systems Integration (LabCorp, Quest Diagnostics)
 *
 * Extracted from healthcareIntegrationsService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — service methods + DB mappers moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import type {
  LabProviderConnection,
  LabOrder,
  LabOrderTest,
  LabResult,
  CreateLabOrderRequest,
} from '../../types/healthcareIntegrations';

export class LabIntegrationService {
  /**
   * Get all lab provider connections for tenant
   */
  static async getConnections(): Promise<ServiceResult<LabProviderConnection[]>> {
    try {
      const { data, error } = await supabase
        .from('lab_provider_connections')
        .select('id, tenant_id, provider_code, provider_name, description, fhir_base_url, fhir_version, auth_type, client_id, smart_authorize_url, smart_token_url, smart_scopes, facility_id, account_number, enabled, auto_fetch_results, fetch_interval_minutes, result_notification_enabled, last_connected_at, last_error, connection_status, orders_sent, results_received, errors_count, created_at, updated_at, created_by')
        .order('provider_name');

      if (error) {
        await auditLogger.error('LAB_GET_CONNECTIONS_FAILED', error.message);
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapLabConnectionFromDB));
    } catch (err: unknown) {
      await auditLogger.error('LAB_GET_CONNECTIONS_ERROR', err instanceof Error ? err.message : 'Unknown error');
      return failure('UNKNOWN_ERROR', 'Failed to get lab connections', err);
    }
  }

  /**
   * Create a new lab order
   */
  static async createOrder(request: CreateLabOrderRequest): Promise<ServiceResult<LabOrder>> {
    try {
      const internalOrderId = `LAB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { data: order, error: orderError } = await supabase
        .from('lab_orders')
        .insert({
          patient_id: request.patientId,
          connection_id: request.connectionId,
          internal_order_id: internalOrderId,
          ordering_provider_id: request.orderingProviderId,
          ordering_provider_npi: request.orderingProviderNpi,
          priority: request.priority || 'routine',
          diagnosis_codes: request.diagnosisCodes,
          clinical_notes: request.clinicalNotes,
          fasting_required: request.fastingRequired || false,
          fasting_hours: request.fastingHours,
          order_status: 'pending',
        })
        .select()
        .single();

      if (orderError) {
        await auditLogger.error('LAB_CREATE_ORDER_FAILED', orderError.message);
        return failure('DATABASE_ERROR', orderError.message, orderError);
      }

      // Create individual tests
      if (request.tests && request.tests.length > 0) {
        const testsToInsert = request.tests.map(test => ({
          order_id: order.id,
          test_code: test.testCode,
          test_name: test.testName,
          loinc_code: test.loincCode,
          test_status: 'ordered',
        }));

        const { error: testsError } = await supabase
          .from('lab_order_tests')
          .insert(testsToInsert);

        if (testsError) {
          await auditLogger.warn('LAB_CREATE_ORDER_TESTS_FAILED', { orderId: order.id, error: testsError.message });
        }
      }

      await auditLogger.info('LAB_ORDER_CREATED', { orderId: order.id, patientId: request.patientId });
      return success(mapLabOrderFromDB(order));
    } catch (err: unknown) {
      await auditLogger.error('LAB_CREATE_ORDER_ERROR', err instanceof Error ? err.message : 'Unknown error');
      return failure('UNKNOWN_ERROR', 'Failed to create lab order', err);
    }
  }

  /**
   * Get lab orders for a patient
   */
  static async getPatientOrders(patientId: string, limit = 50): Promise<ServiceResult<LabOrder[]>> {
    try {
      const { data, error } = await supabase
        .from('lab_orders')
        .select(`
          *,
          lab_order_tests (*)
        `)
        .eq('patient_id', patientId)
        .order('ordered_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapLabOrderFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient lab orders', err);
    }
  }

  /**
   * Get lab results for a patient
   */
  static async getPatientResults(patientId: string, limit = 50): Promise<ServiceResult<LabResult[]>> {
    try {
      const { data, error } = await supabase
        .from('lab_results')
        .select('id, tenant_id, order_id, patient_id, connection_id, accession_number, report_id, report_status, report_type, specimen_collected_at, specimen_received_at, reported_at, ordering_provider_name, performing_lab_name, pathologist_name, results_summary, pdf_report_url, fhir_diagnostic_report_id, fhir_bundle_id, patient_notified, patient_notified_at, provider_notified, provider_notified_at, reviewed_by, reviewed_at, review_notes, has_critical_values, critical_values_acknowledged, critical_values_acknowledged_at, critical_values_acknowledged_by, created_at, updated_at')
        .eq('patient_id', patientId)
        .order('reported_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapLabResultFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient lab results', err);
    }
  }

  /**
   * Get critical lab results that need acknowledgment
   */
  static async getCriticalResults(): Promise<ServiceResult<LabResult[]>> {
    try {
      const { data, error } = await supabase
        .from('lab_results')
        .select('id, tenant_id, order_id, patient_id, connection_id, accession_number, report_id, report_status, report_type, specimen_collected_at, specimen_received_at, reported_at, ordering_provider_name, performing_lab_name, pathologist_name, results_summary, pdf_report_url, fhir_diagnostic_report_id, fhir_bundle_id, patient_notified, patient_notified_at, provider_notified, provider_notified_at, reviewed_by, reviewed_at, review_notes, has_critical_values, critical_values_acknowledged, critical_values_acknowledged_at, critical_values_acknowledged_by, created_at, updated_at')
        .eq('has_critical_values', true)
        .eq('critical_values_acknowledged', false)
        .order('reported_at', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapLabResultFromDB));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to get critical results', err);
    }
  }

  /**
   * Acknowledge critical lab values
   */
  static async acknowledgeCriticalValues(resultId: string, userId: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('lab_results')
        .update({
          critical_values_acknowledged: true,
          critical_values_acknowledged_at: new Date().toISOString(),
          critical_values_acknowledged_by: userId,
        })
        .eq('id', resultId);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('LAB_CRITICAL_VALUES_ACKNOWLEDGED', { resultId, userId });
      return success(undefined);
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to acknowledge critical values', err);
    }
  }
}

// ============================================================================
// DATABASE MAPPERS
// ============================================================================

export function mapLabConnectionFromDB(row: Record<string, unknown>): LabProviderConnection {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    providerCode: row.provider_code as LabProviderConnection['providerCode'],
    providerName: row.provider_name as string,
    description: row.description as string | undefined,
    fhirBaseUrl: row.fhir_base_url as string,
    fhirVersion: row.fhir_version as string,
    authType: row.auth_type as LabProviderConnection['authType'],
    clientId: row.client_id as string | undefined,
    smartAuthorizeUrl: row.smart_authorize_url as string | undefined,
    smartTokenUrl: row.smart_token_url as string | undefined,
    smartScopes: row.smart_scopes as string[] | undefined,
    facilityId: row.facility_id as string | undefined,
    accountNumber: row.account_number as string | undefined,
    enabled: row.enabled as boolean,
    autoFetchResults: row.auto_fetch_results as boolean,
    fetchIntervalMinutes: row.fetch_interval_minutes as number,
    resultNotificationEnabled: row.result_notification_enabled as boolean,
    lastConnectedAt: row.last_connected_at as string | undefined,
    lastError: row.last_error as string | undefined,
    connectionStatus: row.connection_status as LabProviderConnection['connectionStatus'],
    ordersSent: row.orders_sent as number,
    resultsReceived: row.results_received as number,
    errorsCount: row.errors_count as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: row.created_by as string | undefined,
  };
}

export function mapLabOrderFromDB(row: Record<string, unknown>): LabOrder {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    connectionId: row.connection_id as string | undefined,
    patientId: row.patient_id as string,
    internalOrderId: row.internal_order_id as string,
    externalOrderId: row.external_order_id as string | undefined,
    accessionNumber: row.accession_number as string | undefined,
    orderingProviderId: row.ordering_provider_id as string | undefined,
    orderingProviderNpi: row.ordering_provider_npi as string | undefined,
    orderStatus: row.order_status as LabOrder['orderStatus'],
    priority: row.priority as LabOrder['priority'],
    diagnosisCodes: row.diagnosis_codes as string[] | undefined,
    clinicalNotes: row.clinical_notes as string | undefined,
    fastingRequired: row.fasting_required as boolean,
    fastingHours: row.fasting_hours as number | undefined,
    specimenCollectedAt: row.specimen_collected_at as string | undefined,
    specimenType: row.specimen_type as string | undefined,
    specimenSource: row.specimen_source as string | undefined,
    orderedAt: row.ordered_at as string,
    submittedAt: row.submitted_at as string | undefined,
    receivedByLabAt: row.received_by_lab_at as string | undefined,
    expectedResultsAt: row.expected_results_at as string | undefined,
    resultedAt: row.resulted_at as string | undefined,
    fhirServiceRequestId: row.fhir_service_request_id as string | undefined,
    fhirDiagnosticReportId: row.fhir_diagnostic_report_id as string | undefined,
    tests: (row.lab_order_tests as Record<string, unknown>[] | undefined)?.map(mapLabOrderTestFromDB),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapLabOrderTestFromDB(row: Record<string, unknown>): LabOrderTest {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    testCode: row.test_code as string,
    testName: row.test_name as string,
    loincCode: row.loinc_code as string | undefined,
    testStatus: row.test_status as LabOrderTest['testStatus'],
    resultValue: row.result_value as string | undefined,
    resultUnit: row.result_unit as string | undefined,
    referenceRange: row.reference_range as string | undefined,
    abnormalFlag: row.abnormal_flag as string | undefined,
    interpretation: row.interpretation as string | undefined,
    resultedAt: row.resulted_at as string | undefined,
    performingLab: row.performing_lab as string | undefined,
    pathologistNotes: row.pathologist_notes as string | undefined,
    fhirObservationId: row.fhir_observation_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapLabResultFromDB(row: Record<string, unknown>): LabResult {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    orderId: row.order_id as string | undefined,
    patientId: row.patient_id as string,
    connectionId: row.connection_id as string | undefined,
    accessionNumber: row.accession_number as string,
    reportId: row.report_id as string | undefined,
    reportStatus: row.report_status as LabResult['reportStatus'],
    reportType: row.report_type as string | undefined,
    specimenCollectedAt: row.specimen_collected_at as string | undefined,
    specimenReceivedAt: row.specimen_received_at as string | undefined,
    reportedAt: row.reported_at as string,
    orderingProviderName: row.ordering_provider_name as string | undefined,
    performingLabName: row.performing_lab_name as string | undefined,
    pathologistName: row.pathologist_name as string | undefined,
    resultsSummary: row.results_summary as Record<string, unknown> | undefined,
    pdfReportUrl: row.pdf_report_url as string | undefined,
    fhirDiagnosticReportId: row.fhir_diagnostic_report_id as string | undefined,
    fhirBundleId: row.fhir_bundle_id as string | undefined,
    patientNotified: row.patient_notified as boolean,
    patientNotifiedAt: row.patient_notified_at as string | undefined,
    providerNotified: row.provider_notified as boolean,
    providerNotifiedAt: row.provider_notified_at as string | undefined,
    reviewedBy: row.reviewed_by as string | undefined,
    reviewedAt: row.reviewed_at as string | undefined,
    reviewNotes: row.review_notes as string | undefined,
    hasCriticalValues: row.has_critical_values as boolean,
    criticalValuesAcknowledged: row.critical_values_acknowledged as boolean,
    criticalValuesAcknowledgedAt: row.critical_values_acknowledged_at as string | undefined,
    criticalValuesAcknowledgedBy: row.critical_values_acknowledged_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
