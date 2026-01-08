/**
 * React Query hooks for FHIR Services
 *
 * Provides cached, optimized data fetching for FHIR R4 resources.
 * Follows the HIPAA-compliant caching strategy defined in queryClient.ts.
 *
 * NOTE: This file covers FHIR services that use the FHIRApiResponse<T> pattern.
 * Services with inconsistent APIs (AllergyIntolerance, Encounter, etc.) may need
 * custom hooks in component files until services are standardized.
 *
 * @see src/lib/queryClient.ts for cache configuration
 * @see src/services/fhir/ for underlying FHIR service implementations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MedicationRequestService,
  ConditionService,
  ObservationService,
  ProcedureService,
  DiagnosticReportService,
  AllergyIntoleranceService,
  ImmunizationService,
  CarePlanService,
} from '../services/fhir';
import { queryKeys, cacheTime } from '../lib/queryClient';
import type {
  CreateMedicationRequest,
  MedicationRequest,
  CreateCondition,
  Condition,
  CreateObservation,
  CreateProcedure,
  CreateDiagnosticReport,
  FHIRImmunization,
  FHIRCarePlan,
} from '../types/fhir';

// ============================================================================
// MEDICATION REQUEST HOOKS
// ============================================================================

/**
 * Get all medication requests for a patient
 * Cache: 5 minutes (frequent updates)
 */
export function useMedicationRequests(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.medicationRequests(), patientId],
    queryFn: async () => {
      const result = await MedicationRequestService.getByPatient(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.frequent,
    enabled: !!patientId,
  });
}

/**
 * Get active medication requests for a patient
 * Cache: 5 minutes (frequent updates)
 */
export function useActiveMedicationRequests(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.medicationRequests(), 'active', patientId],
    queryFn: async () => {
      const result = await MedicationRequestService.getActive(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.frequent,
    enabled: !!patientId,
  });
}

/**
 * Get medication request history
 * Cache: 10 minutes (stable historical data)
 * @param patientId - Patient ID
 * @param limit - Max number of records to return (default: 50)
 */
export function useMedicationRequestHistory(patientId: string, limit?: number) {
  return useQuery({
    queryKey: [...queryKeys.fhir.medicationRequests(), 'history', patientId, limit],
    queryFn: async () => {
      const result = await MedicationRequestService.getHistory(patientId, limit);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Create a medication request
 * Auto-invalidates medication request queries on success
 */
export function useCreateMedicationRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateMedicationRequest) => {
      const result = await MedicationRequestService.create(request);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate all medication request queries for this patient
      queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.medicationRequests(), variables.patient_id] });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.medicationRequests(), 'active', variables.patient_id] });
    },
  });
}

/**
 * Update a medication request
 * Auto-invalidates related queries on success
 */
export function useUpdateMedicationRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MedicationRequest> }) => {
      const result = await MedicationRequestService.update(id, updates);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      // Invalidate medication request queries for this patient
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.medicationRequests(), data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.medicationRequests(), 'active', data.patient_id] });
      }
    },
  });
}

/**
 * Cancel a medication request
 * Auto-invalidates related queries on success
 */
export function useCancelMedicationRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const result = await MedicationRequestService.cancel(id, reason);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.medicationRequests(), data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.medicationRequests(), 'active', data.patient_id] });
      }
    },
  });
}

// ============================================================================
// CONDITION HOOKS (Diagnoses)
// ============================================================================

/**
 * Get all conditions for a patient
 * Cache: 5 minutes (frequent updates)
 */
export function useConditions(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.conditions(), patientId],
    queryFn: async () => {
      const result = await ConditionService.getByPatient(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.frequent,
    enabled: !!patientId,
  });
}

/**
 * Get active conditions (problem list)
 * Cache: 5 minutes (frequent updates)
 */
export function useActiveConditions(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.conditions(), 'active', patientId],
    queryFn: async () => {
      const result = await ConditionService.getActive(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.frequent,
    enabled: !!patientId,
  });
}

/**
 * Get problem list for a patient
 * Cache: 5 minutes (frequent updates)
 */
export function useProblemList(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.conditions(), 'problems', patientId],
    queryFn: async () => {
      const result = await ConditionService.getProblemList(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.frequent,
    enabled: !!patientId,
  });
}

/**
 * Get chronic conditions for a patient
 * Cache: 10 minutes (stable data)
 */
export function useChronicConditions(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.conditions(), 'chronic', patientId],
    queryFn: async () => {
      const result = await ConditionService.getChronic(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Get conditions by encounter
 * Cache: 10 minutes (stable historical data)
 */
export function useConditionsByEncounter(encounterId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.conditions(), 'encounter', encounterId],
    queryFn: async () => {
      const result = await ConditionService.getByEncounter(encounterId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.stable,
    enabled: !!encounterId,
  });
}

/**
 * Create a condition
 * Auto-invalidates condition queries on success
 */
export function useCreateCondition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (condition: CreateCondition) => {
      const result = await ConditionService.create(condition);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.conditions(), variables.patient_id] });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.conditions(), 'active', variables.patient_id] });
    },
  });
}

/**
 * Update a condition
 * Auto-invalidates related queries on success
 */
export function useUpdateCondition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Condition> }) => {
      const result = await ConditionService.update(id, updates);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.conditions(), data.patient_id] });
      }
    },
  });
}

/**
 * Resolve a condition (mark as resolved/inactive)
 * Auto-invalidates related queries on success
 */
export function useResolveCondition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await ConditionService.resolve(id);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.conditions(), data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.conditions(), 'active', data.patient_id] });
      }
    },
  });
}

// ============================================================================
// OBSERVATION HOOKS (Vitals, Labs, Clinical Measurements)
// ============================================================================

/**
 * Get all observations for a patient
 * Cache: 5 minutes (frequent updates)
 */
export function useObservations(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.observations(), patientId],
    queryFn: async () => {
      const result = await ObservationService.getByPatient(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.frequent,
    enabled: !!patientId,
  });
}

/**
 * Get vital signs for a patient
 * Cache: 5 minutes (frequent updates)
 * @param patientId - Patient ID
 * @param days - Number of days to look back (default: 30)
 */
export function useVitalSigns(patientId: string, days: number = 30) {
  return useQuery({
    queryKey: [...queryKeys.fhir.observations(), 'vitals', patientId, days],
    queryFn: async () => {
      const result = await ObservationService.getVitalSigns(patientId, days);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.frequent,
    enabled: !!patientId,
  });
}

/**
 * Get lab results for a patient
 * Cache: 10 minutes (stable historical data)
 * @param patientId - Patient ID
 * @param days - Number of days to look back (default: 90)
 */
export function useLabResults(patientId: string, days: number = 90) {
  return useQuery({
    queryKey: [...queryKeys.fhir.observations(), 'labs', patientId, days],
    queryFn: async () => {
      const result = await ObservationService.getLabResults(patientId, days);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Get social history observations
 * Cache: 10 minutes (stable data)
 */
export function useSocialHistory(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.observations(), 'social', patientId],
    queryFn: async () => {
      const result = await ObservationService.getSocialHistory(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Get observations by LOINC/SNOMED code
 * Cache: 5 minutes
 */
export function useObservationsByCode(patientId: string, code: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.observations(), 'code', patientId, code],
    queryFn: async () => {
      const result = await ObservationService.getByCode(patientId, code);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.frequent,
    enabled: !!patientId && !!code,
  });
}

/**
 * Get observations by category (vital-signs, laboratory, social-history, etc.)
 * Cache: 5 minutes
 */
export function useObservationsByCategory(patientId: string, category: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.observations(), 'category', patientId, category],
    queryFn: async () => {
      const result = await ObservationService.getByCategory(patientId, category);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.frequent,
    enabled: !!patientId && !!category,
  });
}

/**
 * Create an observation
 * Auto-invalidates observation queries on success
 */
export function useCreateObservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (observation: CreateObservation) => {
      const result = await ObservationService.create(observation);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.observations(), variables.patient_id] });
    },
  });
}

// ============================================================================
// PROCEDURE HOOKS
// ============================================================================

/**
 * Get all procedures for a patient
 * Cache: 10 minutes (historical data)
 */
export function useProcedures(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.procedures(), patientId],
    queryFn: async () => {
      const result = await ProcedureService.getByPatient(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Get procedures by encounter
 * Cache: 10 minutes (historical data)
 */
export function useProceduresByEncounter(encounterId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.procedures(), 'encounter', encounterId],
    queryFn: async () => {
      const result = await ProcedureService.getByEncounter(encounterId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.stable,
    enabled: !!encounterId,
  });
}

/**
 * Create a procedure
 * Auto-invalidates procedure queries on success
 */
export function useCreateProcedure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (procedure: CreateProcedure) => {
      const result = await ProcedureService.create(procedure);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.procedures(), variables.patient_id] });
    },
  });
}

// ============================================================================
// DIAGNOSTIC REPORT HOOKS
// ============================================================================

/**
 * Get all diagnostic reports for a patient
 * Cache: 10 minutes (historical data)
 */
export function useDiagnosticReports(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.diagnosticReports(), patientId],
    queryFn: async () => {
      const result = await DiagnosticReportService.getByPatient(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Create a diagnostic report
 * Auto-invalidates report queries on success
 */
export function useCreateDiagnosticReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: CreateDiagnosticReport) => {
      const result = await DiagnosticReportService.create(report);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.diagnosticReports(), variables.patient_id] });
    },
  });
}

// ============================================================================
// ALLERGY INTOLERANCE HOOKS
// ============================================================================

/**
 * Get all allergies for a patient
 * Cache: 10 minutes (stable data, critical for medication safety)
 */
export function useAllergies(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.allergies(), patientId],
    queryFn: async () => {
      const data = await AllergyIntoleranceService.getAll(patientId);
      return data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Get active allergies only
 * Cache: 10 minutes (critical for medication checks)
 */
export function useActiveAllergies(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.allergies(), 'active', patientId],
    queryFn: async () => {
      const data = await AllergyIntoleranceService.getActive(patientId);
      return data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Get high-risk allergies (criticality = 'high')
 * Cache: 10 minutes (critical safety data)
 */
export function useHighRiskAllergies(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.allergies(), 'high-risk', patientId],
    queryFn: async () => {
      const data = await AllergyIntoleranceService.getHighRisk(patientId);
      return data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Create an allergy record
 * Auto-invalidates allergy queries on success
 */
export function useCreateAllergy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (allergy: Record<string, unknown>) => {
      const data = await AllergyIntoleranceService.create(allergy);
      return data;
    },
    onSuccess: (data) => {
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.allergies(), data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.allergies(), 'active', data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.allergies(), 'high-risk', data.patient_id] });
      }
    },
  });
}

/**
 * Update an allergy record
 * Auto-invalidates related queries on success
 */
export function useUpdateAllergy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const data = await AllergyIntoleranceService.update(id, updates);
      return data;
    },
    onSuccess: (data) => {
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.allergies(), data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.allergies(), 'active', data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.allergies(), 'high-risk', data.patient_id] });
      }
    },
  });
}

/**
 * Delete an allergy record (soft delete)
 * Auto-invalidates related queries on success
 */
export function useDeleteAllergy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const data = await AllergyIntoleranceService.delete(id);
      return data;
    },
    onSuccess: (data) => {
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.allergies(), data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.allergies(), 'active', data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.allergies(), 'high-risk', data.patient_id] });
      }
    },
  });
}

// ============================================================================
// IMMUNIZATION HOOKS
// ============================================================================

/**
 * Get all immunizations for a patient
 * Cache: 10 minutes (stable historical data)
 */
export function useImmunizations(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.immunizations(), patientId],
    queryFn: async () => {
      const result = await ImmunizationService.getByPatient(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Get completed immunizations only
 * Cache: 10 minutes (stable data)
 */
export function useCompletedImmunizations(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.immunizations(), 'completed', patientId],
    queryFn: async () => {
      const result = await ImmunizationService.getCompleted(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Get vaccine gaps (care opportunities)
 * Cache: 10 minutes (preventive care data)
 */
export function useVaccineGaps(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.immunizations(), 'gaps', patientId],
    queryFn: async () => {
      const result = await ImmunizationService.getVaccineGaps(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Create an immunization record
 * Auto-invalidates immunization queries on success
 */
export function useCreateImmunization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (immunization: Partial<FHIRImmunization>) => {
      const result = await ImmunizationService.create(immunization);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.immunizations(), data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.immunizations(), 'completed', data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.immunizations(), 'gaps', data.patient_id] });
      }
    },
  });
}

/**
 * Update an immunization record
 * Auto-invalidates related queries on success
 */
export function useUpdateImmunization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FHIRImmunization> }) => {
      const result = await ImmunizationService.update(id, updates);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.immunizations(), data.patient_id] });
      }
    },
  });
}

/**
 * Delete an immunization record
 * Auto-invalidates related queries on success
 */
export function useDeleteImmunization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await ImmunizationService.delete(id);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      // Invalidate all immunization queries (we don't have patient_id from delete)
      queryClient.invalidateQueries({ queryKey: queryKeys.fhir.immunizations() });
    },
  });
}

// ============================================================================
// CARE PLAN HOOKS
// ============================================================================

/**
 * Get all care plans for a patient
 * Cache: 10 minutes (stable planning data)
 */
export function useCarePlans(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.carePlans(), patientId],
    queryFn: async () => {
      const result = await CarePlanService.getByPatient(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.stable,
    enabled: !!patientId,
  });
}

/**
 * Get active care plans only
 * Cache: 5 minutes (more frequently updated)
 */
export function useActiveCarePlans(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.carePlans(), 'active', patientId],
    queryFn: async () => {
      const result = await CarePlanService.getActive(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.frequent,
    enabled: !!patientId,
  });
}

/**
 * Get current care plan (most recent active)
 * Cache: 5 minutes (frequently accessed)
 */
export function useCurrentCarePlan(patientId: string) {
  return useQuery({
    queryKey: [...queryKeys.fhir.carePlans(), 'current', patientId],
    queryFn: async () => {
      const result = await CarePlanService.getCurrent(patientId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    ...cacheTime.frequent,
    enabled: !!patientId,
  });
}

/**
 * Create a care plan
 * Auto-invalidates care plan queries on success
 */
export function useCreateCarePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (carePlan: Partial<FHIRCarePlan>) => {
      const result = await CarePlanService.create(carePlan);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.carePlans(), data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.carePlans(), 'active', data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.carePlans(), 'current', data.patient_id] });
      }
    },
  });
}

/**
 * Update a care plan
 * Auto-invalidates related queries on success
 */
export function useUpdateCarePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FHIRCarePlan> }) => {
      const result = await CarePlanService.update(id, updates);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.carePlans(), data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.carePlans(), 'active', data.patient_id] });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.fhir.carePlans(), 'current', data.patient_id] });
      }
    },
  });
}
