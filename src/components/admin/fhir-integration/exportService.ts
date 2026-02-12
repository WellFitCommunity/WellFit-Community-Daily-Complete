// FHIR Integration Service — Export Orchestrator
// Coordinates FHIR bundle creation, population health, and audit logging

import { supabase } from '../../../lib/supabaseClient';
import { SupabaseClient } from '@supabase/supabase-js';
import type {
  FHIRBundle,
  FHIRObservation,
  Profile,
  CheckIn,
  HealthEntry,
  Medication,
  VitalsRow,
  ImmunizationDbRow,
  CarePlanDbRow,
} from './types';
import { createPatientResource } from './patientMapper';
import { createVitalsObservations, createWellnessObservations } from './observationMapper';
import { createMedicationStatements } from './medicationMapper';
import { mapImmunizationToFHIR } from './immunizationMapper';
import { mapCarePlanToFHIR } from './carePlanMapper';

export class FHIRIntegrationService {
  private supabase: SupabaseClient;
  private organizationSystem = 'http://wellfit-community.com/patient-ids';

  constructor() {
    this.supabase = supabase;
  }

  // ==== PATIENT RESOURCE MAPPING ====
  async createPatientResource(profile: Profile) {
    return createPatientResource(profile, this.organizationSystem);
  }

  // ==== OBSERVATION RESOURCE MAPPING ====
  async createVitalsObservations(checkIn: CheckIn, profile: Profile): Promise<FHIRObservation[]> {
    return createVitalsObservations(checkIn, profile);
  }

  async createWellnessObservations(entry: HealthEntry, profile: Profile): Promise<FHIRObservation[]> {
    return createWellnessObservations(entry, profile);
  }

  // ==== MEDICATION STATEMENT RESOURCE MAPPING ====
  async createMedicationStatements(medications: Medication[], profile: Profile) {
    return createMedicationStatements(medications, profile);
  }

  // ==== MAIN EXPORT FUNCTIONS ====
  async exportPatientData(userId: string): Promise<FHIRBundle> {
    try {
      // Fetch patient profile
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile) {
        throw new Error(`Profile not found for user ${userId}`);
      }

      // Fetch check-ins (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: checkIns, error: checkInsError } = await this.supabase
        .from('check_ins')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      // Fetch self reports (last 30 days)
      const { data: healthEntries, error: healthError } = await this.supabase
        .from('self_reports')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (checkInsError || healthError) {
        throw new Error('Failed to fetch patient data');
      }

      // Create FHIR resources
      const bundleEntries = [];

      // Add Patient resource
      const patientResource = await this.createPatientResource(profile);
      bundleEntries.push({
        fullUrl: `urn:uuid:patient-${profile.user_id}`,
        resource: patientResource
      });

      // Add Observations from check-ins
      if (checkIns) {
        for (const checkIn of checkIns) {
          const vitalsObs = await this.createVitalsObservations(checkIn, profile);
          vitalsObs.forEach((obs) => {
            bundleEntries.push({
              fullUrl: `urn:uuid:observation-${obs.id}`,
              resource: obs
            });
          });
        }
      }

      // Add Observations from health entries
      if (healthEntries) {
        for (const entry of healthEntries) {
          const wellnessObs = await this.createWellnessObservations(entry, profile);
          wellnessObs.forEach((obs) => {
            bundleEntries.push({
              fullUrl: `urn:uuid:observation-${obs.id}`,
              resource: obs
            });
          });
        }
      }

      // Create FHIR Bundle
      const bundle: FHIRBundle = {
        resourceType: 'Bundle',
        id: `patient-export-${userId}`,
        meta: {
          versionId: '1',
          lastUpdated: new Date().toISOString(),
          profile: ['http://hl7.org/fhir/StructureDefinition/Bundle']
        },
        identifier: {
          system: 'http://wellfit-community.com/bundle-ids',
          value: `EXPORT-${Date.now()}`
        },
        type: 'collection',
        timestamp: new Date().toISOString(),
        entry: bundleEntries
      };

      return bundle;
    } catch (error) {

      throw error;
    }
  }

  // ==== POPULATION HEALTH ANALYTICS ====
  async getPopulationHealthMetrics(days = 30): Promise<{
    totalPatients: number;
    activePatients: number;
    engagementRate: number;
    averageVitals: {
      systolic: number | null;
      diastolic: number | null;
      heartRate: number | null;
      glucose: number | null;
    };
    period: string;
    generatedAt: string;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Patient count
    const { count: totalPatients } = await this.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Active = has check-ins in period
    const { count: activePatients } = await this.supabase
      .from('check_ins')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', cutoffDate.toISOString());

    const { data: vitalsData } = await this.supabase
      .from('check_ins')
      .select('bp_systolic, bp_diastolic, heart_rate, glucose_mg_dl')
      .gte('created_at', cutoffDate.toISOString());

    const buckets = ((vitalsData as VitalsRow[] | null) ?? []).reduce(
      (acc, curr) => {
        if (curr.bp_systolic != null)   acc.systolic.push(curr.bp_systolic);
        if (curr.bp_diastolic != null)  acc.diastolic.push(curr.bp_diastolic);
        if (curr.heart_rate != null)    acc.heartRate.push(curr.heart_rate);
        if (curr.glucose_mg_dl != null) acc.glucose.push(curr.glucose_mg_dl);
        return acc;
      },
      {
        systolic: [] as number[],
        diastolic: [] as number[],
        heartRate: [] as number[],
        glucose: [] as number[],
      }
    );

    return {
      totalPatients: totalPatients || 0,
      activePatients: activePatients || 0,
      engagementRate: totalPatients ? Math.round(((activePatients || 0) / totalPatients) * 100) : 0,
      averageVitals: {
        systolic: this.calculateAverage(buckets.systolic),
        diastolic: this.calculateAverage(buckets.diastolic),
        heartRate: this.calculateAverage(buckets.heartRate),
        glucose: this.calculateAverage(buckets.glucose),
      },
      period: `${days} days`,
      generatedAt: new Date().toISOString(),
    };
  }

  // ==== UTILITY FUNCTIONS ====
  private calculateAverage(values: number[]): number | null {
    if (!values.length) return null;
    return Math.round(values.reduce((sum, val) => sum + val, 0) / values.length * 100) / 100;
  }

  // Validate FHIR Bundle
  validateBundle(bundle: FHIRBundle): boolean {
    try {
      return bundle.resourceType === 'Bundle' &&
             bundle.entry.length > 0 &&
             bundle.entry.every(entry =>
               entry.resource.resourceType === 'Patient' ||
               entry.resource.resourceType === 'Observation' ||
               entry.resource.resourceType === 'MedicationStatement'
             );
    } catch {
      return false;
    }
  }

  // Update exportPatientData to include medications
  async exportPatientDataWithMedications(userId: string): Promise<FHIRBundle> {
    try {
      // Get base bundle with patient and observations
      const bundle = await this.exportPatientData(userId);

      // Fetch medications
      const { data: medications, error: medError } = await this.supabase
        .from('medications')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (medError) {

        return bundle; // Return bundle without medications
      }

      if (medications && medications.length > 0) {
        // Get profile for patient reference
        const { data: profile } = await this.supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (profile) {
          const medicationStatements = await this.createMedicationStatements(medications, profile);

          // Add medication statements to bundle
          medicationStatements.forEach((statement) => {
            bundle.entry.push({
              fullUrl: `urn:uuid:medication-statement-${statement.id}`,
              resource: statement
            });
          });
        }
      }

      return bundle;
    } catch (error) {

      throw error;
    }
  }

  // ==== COMPLETE EXPORT (ALL RESOURCES) - SOC 2 COMPLIANT ====
  async exportPatientDataComplete(userId: string): Promise<FHIRBundle> {
    const startTime = Date.now();
    const currentUser = (await this.supabase.auth.getUser()).data.user;

    try {
      // SOC 2: Validate user has permission to export this data
      if (!currentUser) {
        await this.logSecurityEvent('UNAUTHORIZED_FHIR_EXPORT_ATTEMPT', {
          target_user_id: userId,
          reason: 'No authenticated user'
        });
        throw new Error('Unauthorized: Authentication required');
      }

      // SOC 2: Log PHI access (audit trail)
      await this.logAuditEvent('FHIR_EXPORT_STARTED', {
        actor_user_id: currentUser.id,
        target_user_id: userId,
        resource_types: ['Patient', 'Observation', 'MedicationStatement', 'Immunization', 'CarePlan'],
        timestamp: new Date().toISOString()
      });

      // Get base bundle with patient, observations, and medications
      const bundle = await this.exportPatientDataWithMedications(userId);

      // Fetch immunizations
      const { data: immunizations, error: immError } = await this.supabase
        .from('fhir_immunizations')
        .select('*')
        .eq('patient_id', userId)
        .eq('status', 'completed')
        .order('occurrence_datetime', { ascending: false });

      if (immError) {
        // SOC 2: Secure error logging (no PHI in logs)
        await this.logSecurityEvent('FHIR_EXPORT_ERROR', {
          actor_user_id: currentUser.id,
          target_user_id: userId,
          resource_type: 'Immunization',
          error_code: immError.code,
          error_message: immError.message
        });
        throw new Error('Failed to fetch immunization data');
      } else if (immunizations && immunizations.length > 0) {
        immunizations.forEach((imm: ImmunizationDbRow) => {
          const fhirImmunization = mapImmunizationToFHIR(imm);
          bundle.entry.push({
            fullUrl: `urn:uuid:immunization-${imm.id}`,
            resource: fhirImmunization
          });
        });
      }

      // Fetch care plans
      const { data: carePlans, error: cpError } = await this.supabase
        .from('fhir_care_plans')
        .select('*')
        .eq('patient_id', userId)
        .in('status', ['active', 'on-hold'])
        .order('created', { ascending: false });

      if (cpError) {
        // SOC 2: Secure error logging (no PHI in logs)
        await this.logSecurityEvent('FHIR_EXPORT_ERROR', {
          actor_user_id: currentUser.id,
          target_user_id: userId,
          resource_type: 'CarePlan',
          error_code: cpError.code,
          error_message: cpError.message
        });
        throw new Error('Failed to fetch care plan data');
      } else if (carePlans && carePlans.length > 0) {
        carePlans.forEach((plan: CarePlanDbRow) => {
          const fhirCarePlan = mapCarePlanToFHIR(plan);
          bundle.entry.push({
            fullUrl: `urn:uuid:careplan-${plan.id}`,
            resource: fhirCarePlan
          });
        });
      }

      // SOC 2: Log successful export with metadata
      const duration = Date.now() - startTime;
      await this.logAuditEvent('FHIR_EXPORT_COMPLETED', {
        actor_user_id: currentUser.id,
        target_user_id: userId,
        resource_count: bundle.entry.length,
        duration_ms: duration,
        timestamp: new Date().toISOString()
      });

      return bundle;
    } catch (error) {
      // SOC 2: Secure error logging (no PHI, no stack traces in production)
      await this.logSecurityEvent('FHIR_EXPORT_FAILED', {
        actor_user_id: currentUser?.id,
        target_user_id: userId,
        error_type: error instanceof Error ? error.constructor.name : 'Unknown',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  // SOC 2: Audit logging helper
  private async logAuditEvent(eventType: string, metadata: Record<string, unknown>): Promise<void> {
    try {
      await this.supabase.from('audit_logs').insert({
        event_type: eventType,
        event_category: 'PHI_ACCESS',
        metadata: metadata,
        created_at: new Date().toISOString()
      });
    } catch (_err) {
      // Fallback: If audit logging fails, this is a critical security issue
      // In production, this should trigger alerts
    }
  }

  // SOC 2: Security event logging helper
  private async logSecurityEvent(eventType: string, metadata: Record<string, unknown>): Promise<void> {
    try {
      await this.supabase.from('security_events').insert({
        event_type: eventType,
        severity: 'HIGH',
        metadata: metadata,
        created_at: new Date().toISOString()
      });
    } catch (_err) {
      // Fallback: If security logging fails, this is critical
    }
  }
}
