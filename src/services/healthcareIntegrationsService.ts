/**
 * Healthcare Integrations Service
 *
 * Unified service for external healthcare system integrations:
 * - Lab Systems (LabCorp, Quest Diagnostics)
 * - Pharmacy (Surescripts, PillPack)
 * - Imaging/PACS (DICOM)
 * - Insurance Verification (X12 270/271)
 *
 * Uses ServiceResult<T> pattern for consistent error handling.
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';
import type {
  // Lab types
  LabProviderConnection,
  LabOrder,
  LabOrderTest,
  LabResult,
  CreateLabOrderRequest,
  // Pharmacy types
  PharmacyConnection,
  EPrescription,
  MedicationHistory,
  RefillRequest,
  CreatePrescriptionRequest,
  // Imaging types
  PACSConnection,
  ImagingOrder,
  ImagingStudy,
  ImagingReport,
  CreateImagingOrderRequest,
  // Insurance types
  InsurancePayerConnection,
  EligibilityRequest,
  // EligibilityResponse - type available for insurance responses
  PatientInsurance,
  CheckEligibilityRequest,
  // Stats
  HealthcareIntegrationStats,
} from '../types/healthcareIntegrations';

// ============================================================================
// LAB SYSTEMS SERVICE
// ============================================================================

export class LabIntegrationService {
  /**
   * Get all lab provider connections for tenant
   */
  static async getConnections(): Promise<ServiceResult<LabProviderConnection[]>> {
    try {
      const { data, error } = await supabase
        .from('lab_provider_connections')
        .select('*')
        .order('provider_name');

      if (error) {
        await auditLogger.error('LAB_GET_CONNECTIONS_FAILED', error.message);
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapLabConnectionFromDB));
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
        .select('*')
        .eq('patient_id', patientId)
        .order('reported_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapLabResultFromDB));
    } catch (err) {
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
        .select('*')
        .eq('has_critical_values', true)
        .eq('critical_values_acknowledged', false)
        .order('reported_at', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapLabResultFromDB));
    } catch (err) {
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
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to acknowledge critical values', err);
    }
  }
}

// ============================================================================
// PHARMACY SERVICE
// ============================================================================

export class PharmacyIntegrationService {
  /**
   * Get all pharmacy connections for tenant
   */
  static async getConnections(): Promise<ServiceResult<PharmacyConnection[]>> {
    try {
      const { data, error } = await supabase
        .from('pharmacy_connections')
        .select('*')
        .order('pharmacy_name');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapPharmacyConnectionFromDB));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get pharmacy connections', err);
    }
  }

  /**
   * Create a new e-prescription
   */
  static async createPrescription(request: CreatePrescriptionRequest): Promise<ServiceResult<EPrescription>> {
    try {
      const internalRxId = `RX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { data, error } = await supabase
        .from('e_prescriptions')
        .insert({
          patient_id: request.patientId,
          pharmacy_connection_id: request.pharmacyConnectionId,
          internal_rx_id: internalRxId,
          prescriber_npi: request.prescriberNpi,
          prescriber_dea: request.prescriberDea,
          medication_name: request.medicationName,
          medication_ndc: request.medicationNdc,
          rxnorm_code: request.rxnormCode,
          strength: request.strength,
          dosage_form: request.dosageForm,
          quantity: request.quantity,
          quantity_unit: request.quantityUnit || 'EA',
          days_supply: request.daysSupply,
          refills_authorized: request.refillsAuthorized || 0,
          sig: request.sig,
          dispense_as_written: request.dispenseAsWritten || false,
          diagnosis_codes: request.diagnosisCodes,
          is_controlled_substance: request.isControlledSubstance || false,
          schedule: request.schedule,
          rx_status: 'draft',
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('PHARMACY_CREATE_RX_FAILED', error.message);
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('PRESCRIPTION_CREATED', { rxId: data.id, patientId: request.patientId });
      return success(mapPrescriptionFromDB(data));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to create prescription', err);
    }
  }

  /**
   * Get prescriptions for a patient
   */
  static async getPatientPrescriptions(patientId: string, limit = 50): Promise<ServiceResult<EPrescription[]>> {
    try {
      const { data, error } = await supabase
        .from('e_prescriptions')
        .select('*')
        .eq('patient_id', patientId)
        .order('written_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapPrescriptionFromDB));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient prescriptions', err);
    }
  }

  /**
   * Get medication history for a patient
   */
  static async getMedicationHistory(patientId: string): Promise<ServiceResult<MedicationHistory[]>> {
    try {
      const { data, error } = await supabase
        .from('medication_history')
        .select('*')
        .eq('patient_id', patientId)
        .order('fill_date', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapMedicationHistoryFromDB));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get medication history', err);
    }
  }

  /**
   * Get pending refill requests
   */
  static async getPendingRefillRequests(): Promise<ServiceResult<RefillRequest[]>> {
    try {
      const { data, error } = await supabase
        .from('refill_requests')
        .select('*')
        .eq('request_status', 'pending')
        .order('requested_at', { ascending: true });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapRefillRequestFromDB));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get refill requests', err);
    }
  }

  /**
   * Respond to a refill request
   */
  static async respondToRefillRequest(
    requestId: string,
    status: 'approved' | 'denied' | 'new_rx_needed',
    responseNotes?: string,
    responsePrescriptionId?: string
  ): Promise<ServiceResult<void>> {
    try {
      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('refill_requests')
        .update({
          request_status: status,
          response_notes: responseNotes,
          response_prescription_id: responsePrescriptionId,
          responded_by: user.user?.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('REFILL_REQUEST_RESPONDED', { requestId, status });
      return success(undefined);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to respond to refill request', err);
    }
  }
}

// ============================================================================
// IMAGING/PACS SERVICE
// ============================================================================

export class ImagingIntegrationService {
  /**
   * Get all PACS connections for tenant
   */
  static async getConnections(): Promise<ServiceResult<PACSConnection[]>> {
    try {
      const { data, error } = await supabase
        .from('pacs_connections')
        .select('*')
        .order('pacs_name');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapPACSConnectionFromDB));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get PACS connections', err);
    }
  }

  /**
   * Create an imaging order
   */
  static async createOrder(request: CreateImagingOrderRequest): Promise<ServiceResult<ImagingOrder>> {
    try {
      const internalOrderId = `IMG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { data, error } = await supabase
        .from('imaging_orders')
        .insert({
          patient_id: request.patientId,
          pacs_connection_id: request.pacsConnectionId,
          internal_order_id: internalOrderId,
          ordering_provider_id: request.orderingProviderId,
          ordering_provider_npi: request.orderingProviderNpi,
          modality: request.modality,
          procedure_code: request.procedureCode,
          procedure_name: request.procedureName,
          body_part: request.bodyPart,
          laterality: request.laterality,
          reason_for_exam: request.reasonForExam,
          diagnosis_codes: request.diagnosisCodes,
          clinical_history: request.clinicalHistory,
          priority: request.priority || 'routine',
          scheduled_at: request.scheduledAt,
          order_status: 'pending',
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('IMAGING_CREATE_ORDER_FAILED', error.message);
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('IMAGING_ORDER_CREATED', { orderId: data.id, patientId: request.patientId });
      return success(mapImagingOrderFromDB(data));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to create imaging order', err);
    }
  }

  /**
   * Get imaging orders for a patient
   */
  static async getPatientOrders(patientId: string, limit = 50): Promise<ServiceResult<ImagingOrder[]>> {
    try {
      const { data, error } = await supabase
        .from('imaging_orders')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapImagingOrderFromDB));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient imaging orders', err);
    }
  }

  /**
   * Get imaging studies for a patient
   */
  static async getPatientStudies(patientId: string, limit = 50): Promise<ServiceResult<ImagingStudy[]>> {
    try {
      const { data, error } = await supabase
        .from('imaging_studies')
        .select('*')
        .eq('patient_id', patientId)
        .order('study_date', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapImagingStudyFromDB));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient imaging studies', err);
    }
  }

  /**
   * Get imaging reports for a patient
   */
  static async getPatientReports(patientId: string, limit = 50): Promise<ServiceResult<ImagingReport[]>> {
    try {
      const { data, error } = await supabase
        .from('imaging_reports')
        .select('*')
        .eq('patient_id', patientId)
        .order('signed_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapImagingReportFromDB));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient imaging reports', err);
    }
  }

  /**
   * Get critical imaging findings that need acknowledgment
   */
  static async getCriticalFindings(): Promise<ServiceResult<ImagingReport[]>> {
    try {
      const { data, error } = await supabase
        .from('imaging_reports')
        .select('*')
        .eq('has_critical_finding', true)
        .eq('critical_finding_communicated', false)
        .order('signed_at', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapImagingReportFromDB));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get critical findings', err);
    }
  }
}

// ============================================================================
// INSURANCE VERIFICATION SERVICE
// ============================================================================

export class InsuranceVerificationService {
  /**
   * Get all insurance payer connections
   */
  static async getPayerConnections(): Promise<ServiceResult<InsurancePayerConnection[]>> {
    try {
      const { data, error } = await supabase
        .from('insurance_payer_connections')
        .select('*')
        .order('payer_name');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapInsurancePayerFromDB));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get payer connections', err);
    }
  }

  /**
   * Check eligibility for a patient
   */
  static async checkEligibility(request: CheckEligibilityRequest): Promise<ServiceResult<EligibilityRequest>> {
    try {
      const { data: user } = await supabase.auth.getUser();
      const traceNumber = `TRN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { data, error } = await supabase
        .from('eligibility_requests')
        .insert({
          patient_id: request.patientId,
          payer_connection_id: request.payerConnectionId,
          subscriber_id: request.subscriberId,
          subscriber_name: request.subscriberName,
          subscriber_dob: request.subscriberDob,
          is_dependent: request.isDependent || false,
          dependent_name: request.dependentName,
          dependent_dob: request.dependentDob,
          relationship_code: request.relationshipCode,
          service_type_codes: request.serviceTypeCodes,
          date_of_service: request.dateOfService,
          provider_npi: request.providerNpi,
          trace_number: traceNumber,
          request_status: 'pending',
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('ELIGIBILITY_CHECK_FAILED', error.message);
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('ELIGIBILITY_CHECK_INITIATED', { requestId: data.id, patientId: request.patientId });
      return success(mapEligibilityRequestFromDB(data));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to check eligibility', err);
    }
  }

  /**
   * Get eligibility requests for a patient
   */
  static async getPatientEligibilityHistory(patientId: string, limit = 20): Promise<ServiceResult<EligibilityRequest[]>> {
    try {
      const { data, error } = await supabase
        .from('eligibility_requests')
        .select('*')
        .eq('patient_id', patientId)
        .order('requested_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data.map(mapEligibilityRequestFromDB));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get eligibility history', err);
    }
  }

  /**
   * Get patient's active insurance
   */
  static async getPatientInsurance(patientId: string): Promise<ServiceResult<PatientInsurance[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_patient_active_insurance', { p_patient_id: patientId });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      // Map from RPC function result
      return success(data.map((row: Record<string, unknown>) => ({
        id: row.insurance_id as string,
        tenantId: '',
        patientId,
        payerConnectionId: undefined,
        payerId: '',
        payerName: row.payer_name as string,
        subscriberId: row.subscriber_id as string,
        groupNumber: row.group_number as string | undefined,
        groupName: undefined,
        subscriberRelationship: 'SELF' as const,
        planName: row.plan_name as string | undefined,
        planType: undefined,
        effectiveDate: '',
        coveragePriority: row.coverage_priority as number,
        lastVerifiedAt: row.last_verified_at as string | undefined,
        verificationStatus: row.verification_status as 'unverified' | 'verified' | 'needs_review' | 'inactive',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      })));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get patient insurance', err);
    }
  }

  /**
   * Add or update patient insurance
   */
  static async savePatientInsurance(insurance: Partial<PatientInsurance>): Promise<ServiceResult<PatientInsurance>> {
    try {
      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('patient_insurance')
        .upsert({
          id: insurance.id,
          patient_id: insurance.patientId,
          payer_connection_id: insurance.payerConnectionId,
          payer_id: insurance.payerId,
          payer_name: insurance.payerName,
          subscriber_id: insurance.subscriberId,
          group_number: insurance.groupNumber,
          group_name: insurance.groupName,
          subscriber_relationship: insurance.subscriberRelationship,
          subscriber_name: insurance.subscriberName,
          subscriber_dob: insurance.subscriberDob,
          plan_name: insurance.planName,
          plan_type: insurance.planType,
          effective_date: insurance.effectiveDate,
          termination_date: insurance.terminationDate,
          coverage_priority: insurance.coveragePriority,
          is_active: insurance.isActive ?? true,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('PATIENT_INSURANCE_SAVED', { insuranceId: data.id, patientId: insurance.patientId });
      return success(mapPatientInsuranceFromDB(data));
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to save patient insurance', err);
    }
  }
}

// ============================================================================
// UNIFIED HEALTHCARE INTEGRATIONS SERVICE
// ============================================================================

export class HealthcareIntegrationsService {
  static Lab = LabIntegrationService;
  static Pharmacy = PharmacyIntegrationService;
  static Imaging = ImagingIntegrationService;
  static Insurance = InsuranceVerificationService;

  /**
   * Get overall healthcare integration statistics
   */
  static async getStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<ServiceResult<HealthcareIntegrationStats>> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .single();

      if (!profile?.tenant_id) {
        return failure('NOT_FOUND', 'Tenant not found');
      }

      const { data, error } = await supabase.rpc('get_healthcare_integration_stats', {
        p_tenant_id: profile.tenant_id,
        p_start_date: startDate?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_end_date: endDate?.toISOString() || new Date().toISOString(),
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      const stats = data?.[0] || {};
      return success({
        labOrdersTotal: Number(stats.lab_orders_total) || 0,
        labResultsReceived: Number(stats.lab_results_received) || 0,
        labCriticalValues: Number(stats.lab_critical_values) || 0,
        prescriptionsSent: Number(stats.prescriptions_sent) || 0,
        refillRequestsPending: Number(stats.refill_requests_pending) || 0,
        imagingStudiesTotal: Number(stats.imaging_studies_total) || 0,
        imagingReportsFinal: Number(stats.imaging_reports_final) || 0,
        eligibilityChecks: Number(stats.eligibility_checks) || 0,
        eligibilityVerified: Number(stats.eligibility_verified) || 0,
      });
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get integration stats', err);
    }
  }
}

// ============================================================================
// DATABASE MAPPERS
// ============================================================================

function mapLabConnectionFromDB(row: Record<string, unknown>): LabProviderConnection {
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

function mapLabOrderFromDB(row: Record<string, unknown>): LabOrder {
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

function mapLabOrderTestFromDB(row: Record<string, unknown>): LabOrderTest {
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

function mapLabResultFromDB(row: Record<string, unknown>): LabResult {
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

function mapPharmacyConnectionFromDB(row: Record<string, unknown>): PharmacyConnection {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    pharmacyType: row.pharmacy_type as PharmacyConnection['pharmacyType'],
    pharmacyName: row.pharmacy_name as string,
    ncpdpId: row.ncpdp_id as string | undefined,
    npi: row.npi as string | undefined,
    deaNumber: row.dea_number as string | undefined,
    addressLine1: row.address_line1 as string | undefined,
    addressLine2: row.address_line2 as string | undefined,
    city: row.city as string | undefined,
    state: row.state as string | undefined,
    zipCode: row.zip_code as string | undefined,
    phone: row.phone as string | undefined,
    fax: row.fax as string | undefined,
    protocol: row.protocol as PharmacyConnection['protocol'],
    apiEndpoint: row.api_endpoint as string | undefined,
    supportsErx: row.supports_erx as boolean,
    supportsRefillRequests: row.supports_refill_requests as boolean,
    supportsMedicationHistory: row.supports_medication_history as boolean,
    supportsEligibility: row.supports_eligibility as boolean,
    supportsControlledSubstances: row.supports_controlled_substances as boolean,
    enabled: row.enabled as boolean,
    isPreferred: row.is_preferred as boolean,
    lastConnectedAt: row.last_connected_at as string | undefined,
    lastError: row.last_error as string | undefined,
    connectionStatus: row.connection_status as PharmacyConnection['connectionStatus'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: row.created_by as string | undefined,
  };
}

function mapPrescriptionFromDB(row: Record<string, unknown>): EPrescription {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    pharmacyConnectionId: row.pharmacy_connection_id as string | undefined,
    patientId: row.patient_id as string,
    prescriberId: row.prescriber_id as string | undefined,
    prescriberNpi: row.prescriber_npi as string,
    prescriberDea: row.prescriber_dea as string | undefined,
    internalRxId: row.internal_rx_id as string,
    externalRxId: row.external_rx_id as string | undefined,
    surescriptsMessageId: row.surescripts_message_id as string | undefined,
    medicationName: row.medication_name as string,
    medicationNdc: row.medication_ndc as string | undefined,
    rxnormCode: row.rxnorm_code as string | undefined,
    strength: row.strength as string | undefined,
    dosageForm: row.dosage_form as string | undefined,
    quantity: row.quantity as number,
    quantityUnit: row.quantity_unit as string,
    daysSupply: row.days_supply as number | undefined,
    refillsAuthorized: row.refills_authorized as number,
    refillsRemaining: row.refills_remaining as number | undefined,
    sig: row.sig as string,
    sigCode: row.sig_code as string | undefined,
    dispenseAsWritten: row.dispense_as_written as boolean,
    substitutionAllowed: row.substitution_allowed as boolean,
    diagnosisCodes: row.diagnosis_codes as string[] | undefined,
    indication: row.indication as string | undefined,
    priorAuthNumber: row.prior_auth_number as string | undefined,
    isControlledSubstance: row.is_controlled_substance as boolean,
    schedule: row.schedule as EPrescription['schedule'],
    rxStatus: row.rx_status as EPrescription['rxStatus'],
    writtenAt: row.written_at as string,
    signedAt: row.signed_at as string | undefined,
    transmittedAt: row.transmitted_at as string | undefined,
    dispensedAt: row.dispensed_at as string | undefined,
    expiresAt: row.expires_at as string | undefined,
    transmissionError: row.transmission_error as string | undefined,
    pharmacyResponse: row.pharmacy_response as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapMedicationHistoryFromDB(row: Record<string, unknown>): MedicationHistory {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    patientId: row.patient_id as string,
    source: row.source as MedicationHistory['source'],
    sourcePharmacyName: row.source_pharmacy_name as string | undefined,
    sourcePharmacyNcpdp: row.source_pharmacy_ncpdp as string | undefined,
    medicationName: row.medication_name as string,
    ndc: row.ndc as string | undefined,
    rxnormCode: row.rxnorm_code as string | undefined,
    strength: row.strength as string | undefined,
    dosageForm: row.dosage_form as string | undefined,
    fillDate: row.fill_date as string | undefined,
    quantityDispensed: row.quantity_dispensed as number | undefined,
    daysSupply: row.days_supply as number | undefined,
    refillsRemaining: row.refills_remaining as number | undefined,
    prescriberName: row.prescriber_name as string | undefined,
    prescriberNpi: row.prescriber_npi as string | undefined,
    isActive: row.is_active as boolean,
    discontinuedDate: row.discontinued_date as string | undefined,
    discontinuedReason: row.discontinued_reason as string | undefined,
    fetchedAt: row.fetched_at as string,
    createdAt: row.created_at as string,
  };
}

function mapRefillRequestFromDB(row: Record<string, unknown>): RefillRequest {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    patientId: row.patient_id as string,
    originalPrescriptionId: row.original_prescription_id as string | undefined,
    pharmacyConnectionId: row.pharmacy_connection_id as string | undefined,
    medicationName: row.medication_name as string,
    requestSource: row.request_source as RefillRequest['requestSource'],
    requestStatus: row.request_status as RefillRequest['requestStatus'],
    responsePrescriptionId: row.response_prescription_id as string | undefined,
    responseNotes: row.response_notes as string | undefined,
    respondedBy: row.responded_by as string | undefined,
    respondedAt: row.responded_at as string | undefined,
    requestedAt: row.requested_at as string,
    dueBy: row.due_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapPACSConnectionFromDB(row: Record<string, unknown>): PACSConnection {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    pacsVendor: row.pacs_vendor as string,
    pacsName: row.pacs_name as string,
    description: row.description as string | undefined,
    aeTitle: row.ae_title as string,
    hostname: row.hostname as string,
    port: row.port as number,
    queryAeTitle: row.query_ae_title as string | undefined,
    queryPort: row.query_port as number | undefined,
    wadoUrl: row.wado_url as string | undefined,
    wadoAuthType: row.wado_auth_type as PACSConnection['wadoAuthType'],
    dicomwebUrl: row.dicomweb_url as string | undefined,
    dicomwebQidoPath: row.dicomweb_qido_path as string | undefined,
    dicomwebWadoPath: row.dicomweb_wado_path as string | undefined,
    dicomwebStowPath: row.dicomweb_stow_path as string | undefined,
    enabled: row.enabled as boolean,
    autoFetchStudies: row.auto_fetch_studies as boolean,
    storeImagesLocally: row.store_images_locally as boolean,
    lastConnectedAt: row.last_connected_at as string | undefined,
    lastError: row.last_error as string | undefined,
    connectionStatus: row.connection_status as PACSConnection['connectionStatus'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: row.created_by as string | undefined,
  };
}

function mapImagingOrderFromDB(row: Record<string, unknown>): ImagingOrder {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    pacsConnectionId: row.pacs_connection_id as string | undefined,
    patientId: row.patient_id as string,
    internalOrderId: row.internal_order_id as string,
    accessionNumber: row.accession_number as string | undefined,
    orderingProviderId: row.ordering_provider_id as string | undefined,
    orderingProviderNpi: row.ordering_provider_npi as string | undefined,
    modality: row.modality as string,
    procedureCode: row.procedure_code as string,
    procedureName: row.procedure_name as string,
    bodyPart: row.body_part as string | undefined,
    laterality: row.laterality as ImagingOrder['laterality'],
    reasonForExam: row.reason_for_exam as string | undefined,
    diagnosisCodes: row.diagnosis_codes as string[] | undefined,
    clinicalHistory: row.clinical_history as string | undefined,
    priority: row.priority as ImagingOrder['priority'],
    orderStatus: row.order_status as ImagingOrder['orderStatus'],
    scheduledAt: row.scheduled_at as string | undefined,
    performedAt: row.performed_at as string | undefined,
    performingFacility: row.performing_facility as string | undefined,
    performingLocation: row.performing_location as string | undefined,
    interpretingRadiologist: row.interpreting_radiologist as string | undefined,
    dictatedAt: row.dictated_at as string | undefined,
    finalizedAt: row.finalized_at as string | undefined,
    studyInstanceUid: row.study_instance_uid as string | undefined,
    fhirImagingStudyId: row.fhir_imaging_study_id as string | undefined,
    fhirDiagnosticReportId: row.fhir_diagnostic_report_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapImagingStudyFromDB(row: Record<string, unknown>): ImagingStudy {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    orderId: row.order_id as string | undefined,
    patientId: row.patient_id as string,
    pacsConnectionId: row.pacs_connection_id as string | undefined,
    studyInstanceUid: row.study_instance_uid as string,
    seriesCount: row.series_count as number,
    instanceCount: row.instance_count as number,
    studyDate: row.study_date as string,
    studyTime: row.study_time as string | undefined,
    accessionNumber: row.accession_number as string | undefined,
    modalities: row.modalities as string[],
    studyDescription: row.study_description as string | undefined,
    bodyPartExamined: row.body_part_examined as string | undefined,
    dicomPatientName: row.dicom_patient_name as string | undefined,
    dicomPatientId: row.dicom_patient_id as string | undefined,
    institutionName: row.institution_name as string | undefined,
    referringPhysician: row.referring_physician as string | undefined,
    performingPhysician: row.performing_physician as string | undefined,
    storageLocation: row.storage_location as string | undefined,
    totalSizeBytes: row.total_size_bytes as number | undefined,
    availability: row.availability as ImagingStudy['availability'],
    hasReport: row.has_report as boolean,
    reportId: row.report_id as string | undefined,
    receivedAt: row.received_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapImagingReportFromDB(row: Record<string, unknown>): ImagingReport {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    studyId: row.study_id as string | undefined,
    orderId: row.order_id as string | undefined,
    patientId: row.patient_id as string,
    reportId: row.report_id as string,
    accessionNumber: row.accession_number as string | undefined,
    reportStatus: row.report_status as ImagingReport['reportStatus'],
    clinicalInfo: row.clinical_info as string | undefined,
    comparison: row.comparison as string | undefined,
    technique: row.technique as string | undefined,
    findings: row.findings as string,
    impression: row.impression as string,
    codedFindings: row.coded_findings as Record<string, unknown> | undefined,
    hasCriticalFinding: row.has_critical_finding as boolean,
    criticalFindingDescription: row.critical_finding_description as string | undefined,
    criticalFindingCommunicated: row.critical_finding_communicated as boolean,
    criticalFindingCommunicatedTo: row.critical_finding_communicated_to as string | undefined,
    criticalFindingCommunicatedAt: row.critical_finding_communicated_at as string | undefined,
    dictatingRadiologist: row.dictating_radiologist as string | undefined,
    dictatingRadiologistNpi: row.dictating_radiologist_npi as string | undefined,
    signingRadiologist: row.signing_radiologist as string | undefined,
    signingRadiologistNpi: row.signing_radiologist_npi as string | undefined,
    dictatedAt: row.dictated_at as string | undefined,
    transcribedAt: row.transcribed_at as string | undefined,
    signedAt: row.signed_at as string | undefined,
    amendedAt: row.amended_at as string | undefined,
    isAmended: row.is_amended as boolean,
    amendmentReason: row.amendment_reason as string | undefined,
    originalReportId: row.original_report_id as string | undefined,
    fhirDiagnosticReportId: row.fhir_diagnostic_report_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapInsurancePayerFromDB(row: Record<string, unknown>): InsurancePayerConnection {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    payerId: row.payer_id as string,
    payerName: row.payer_name as string,
    payerType: row.payer_type as InsurancePayerConnection['payerType'],
    ediReceiverId: row.edi_receiver_id as string | undefined,
    ediInterchangeQualifier: row.edi_interchange_qualifier as string | undefined,
    connectionType: row.connection_type as InsurancePayerConnection['connectionType'],
    clearinghouseName: row.clearinghouse_name as string | undefined,
    clearinghouseId: row.clearinghouse_id as string | undefined,
    apiEndpoint: row.api_endpoint as string | undefined,
    portalUrl: row.portal_url as string | undefined,
    supports270_271: row.supports_270_271 as boolean,
    supports276_277: row.supports_276_277 as boolean,
    supports278: row.supports_278 as boolean,
    supports835: row.supports_835 as boolean,
    supports837: row.supports_837 as boolean,
    supportsRealTime: row.supports_real_time as boolean,
    batchSchedule: row.batch_schedule as string | undefined,
    enabled: row.enabled as boolean,
    lastConnectedAt: row.last_connected_at as string | undefined,
    lastError: row.last_error as string | undefined,
    connectionStatus: row.connection_status as InsurancePayerConnection['connectionStatus'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: row.created_by as string | undefined,
  };
}

function mapEligibilityRequestFromDB(row: Record<string, unknown>): EligibilityRequest {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    payerConnectionId: row.payer_connection_id as string | undefined,
    patientId: row.patient_id as string,
    subscriberId: row.subscriber_id as string,
    subscriberName: row.subscriber_name as string | undefined,
    subscriberDob: row.subscriber_dob as string | undefined,
    isDependent: row.is_dependent as boolean,
    dependentName: row.dependent_name as string | undefined,
    dependentDob: row.dependent_dob as string | undefined,
    relationshipCode: row.relationship_code as string | undefined,
    serviceTypeCodes: row.service_type_codes as string[] | undefined,
    dateOfService: row.date_of_service as string,
    providerNpi: row.provider_npi as string | undefined,
    providerTaxonomy: row.provider_taxonomy as string | undefined,
    requestStatus: row.request_status as EligibilityRequest['requestStatus'],
    traceNumber: row.trace_number as string | undefined,
    submitterTrace: row.submitter_trace as string | undefined,
    requestedAt: row.requested_at as string,
    submittedAt: row.submitted_at as string | undefined,
    responseReceivedAt: row.response_received_at as string | undefined,
    responseId: row.response_id as string | undefined,
    errorCode: row.error_code as string | undefined,
    errorMessage: row.error_message as string | undefined,
    createdAt: row.created_at as string,
    createdBy: row.created_by as string | undefined,
  };
}

function mapPatientInsuranceFromDB(row: Record<string, unknown>): PatientInsurance {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    patientId: row.patient_id as string,
    payerConnectionId: row.payer_connection_id as string | undefined,
    payerId: row.payer_id as string,
    payerName: row.payer_name as string,
    subscriberId: row.subscriber_id as string,
    groupNumber: row.group_number as string | undefined,
    groupName: row.group_name as string | undefined,
    subscriberRelationship: row.subscriber_relationship as PatientInsurance['subscriberRelationship'],
    subscriberName: row.subscriber_name as string | undefined,
    subscriberDob: row.subscriber_dob as string | undefined,
    planName: row.plan_name as string | undefined,
    planType: row.plan_type as string | undefined,
    effectiveDate: row.effective_date as string,
    terminationDate: row.termination_date as string | undefined,
    coveragePriority: row.coverage_priority as number,
    lastVerifiedAt: row.last_verified_at as string | undefined,
    lastVerificationRequestId: row.last_verification_request_id as string | undefined,
    verificationStatus: row.verification_status as PatientInsurance['verificationStatus'],
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: row.created_by as string | undefined,
  };
}

// Export singleton
export default HealthcareIntegrationsService;
