/**
 * FHIR Integrator — import a fetched FHIR patient bundle into the community DB
 * (demographics → profiles, observations → check_ins, immunizations, care plans)
 *
 * Extracted from fhirInteroperabilityIntegrator.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — moved verbatim from the private importFHIRData method;
 * `this.logAuditEvent`/`this.logSecurityEvent` rewired to the audit free functions.
 */

import { supabase } from '../../lib/supabaseClient';
import type { UnknownRecord, FHIRPatientData } from './types';
import { logAuditEvent, logSecurityEvent } from './audit';

export async function importFHIRData(communityUserId: string, fhirData: FHIRPatientData): Promise<void> {
  const currentUser = (await supabase.auth.getUser()).data.user;
  const startTime = Date.now();

  // SOC 2: Log PHI import attempt
  await logAuditEvent('FHIR_IMPORT_STARTED', {
    actor_user_id: currentUser?.id,
    target_user_id: communityUserId,
    timestamp: new Date().toISOString()
  });

  try {
    // Import patient demographics
    if (fhirData.patient) {
      const patient = fhirData.patient;
      const name = patient.name?.[0];
      const telecom = patient.telecom || [];
      const email = telecom.find((t) => t.system === 'email')?.value;
      const phone = telecom.find((t) => t.system === 'phone')?.value;

      await supabase
        .from('profiles')
        .update({
          first_name: name?.given?.[0] || '',
          last_name: name?.family || '',
          email: email || '',
          phone: phone || '',
          dob: patient.birthDate || '',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', communityUserId);
    }

    // Import observations as check-ins
    if (fhirData.observations && Array.isArray(fhirData.observations)) {
      // Get tenant_id for check_ins (required NOT NULL field)
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', communityUserId)
        .maybeSingle();

      const tenantId = (userProfile as UnknownRecord | null | undefined)?.tenant_id as string | undefined;

      for (const entry of fhirData.observations) {
        const obs = entry.resource;
        if (!obs) continue;

        const checkInData: Record<string, unknown> = {
          user_id: communityUserId,
          tenant_id: tenantId,
          label: 'FHIR Import',
          source: 'fhir_import',
          created_at: obs.effectiveDateTime || obs.issued || new Date().toISOString(),
          is_emergency: false
        };

        // Skip if no tenant_id (would fail insert anyway)
        if (!tenantId) continue;

        // Map based on LOINC code
        const loincCode = obs.code?.coding?.find((c) => c.system === 'http://loinc.org')?.code;

        switch (loincCode) {
          case '8867-4': // Heart rate
            checkInData.heart_rate = obs.valueQuantity?.value;
            break;
          case '2708-6': // Oxygen saturation
            checkInData.pulse_oximeter = obs.valueQuantity?.value;
            break;
          case '85354-9': // Blood pressure panel
            if (obs.component) {
              const systolic = obs.component.find((c) =>
                c.code?.coding?.find((cc) => cc.code === '8480-6'));
              const diastolic = obs.component.find((c) =>
                c.code?.coding?.find((cc) => cc.code === '8462-4'));
              checkInData.bp_systolic = systolic?.valueQuantity?.value;
              checkInData.bp_diastolic = diastolic?.valueQuantity?.value;
            }
            break;
          case '33747-0': // Glucose
            checkInData.glucose_mg_dl = obs.valueQuantity?.value;
            break;
        }

        // Only insert if we have at least one vitals value
        if (checkInData.heart_rate || checkInData.pulse_oximeter ||
            checkInData.bp_systolic || checkInData.glucose_mg_dl) {
          await supabase.from('check_ins').insert(checkInData);
        }
      }
    }

    // Import Immunizations
    if (fhirData.immunizations && Array.isArray(fhirData.immunizations)) {
      for (const entry of fhirData.immunizations) {
        const imm = entry.resource;
        if (!imm || imm.resourceType !== 'Immunization') continue;

        const vaccineCode = imm.vaccineCode?.coding?.find((c) =>
          c.system === 'http://hl7.org/fhir/sid/cvx'
        );

        if (!vaccineCode) continue;

        // Check if immunization already exists from this external system
        const { data: existing } = await supabase
          .from('fhir_immunizations')
          .select('id')
          .eq('external_id', imm.id)
          .eq('external_system', 'FHIR')
          .maybeSingle();

        const immunizationData = {
          patient_id: communityUserId,
          external_id: imm.id,
          external_system: 'FHIR',
          status: imm.status || 'completed',
          vaccine_code: vaccineCode.code,
          vaccine_display: vaccineCode.display || 'Unknown Vaccine',
          occurrence_datetime: imm.occurrenceDateTime,
          primary_source: imm.primarySource !== false,
          lot_number: imm.lotNumber,
          expiration_date: imm.expirationDate,
          manufacturer: imm.manufacturer?.display,
          site_code: imm.site?.coding?.[0]?.code,
          site_display: imm.site?.coding?.[0]?.display,
          route_code: imm.route?.coding?.[0]?.code,
          route_display: imm.route?.coding?.[0]?.display,
          dose_quantity_value: imm.doseQuantity?.value,
          dose_quantity_unit: imm.doseQuantity?.unit,
          performer_actor_display: imm.performer?.[0]?.actor?.display,
          location_display: imm.location?.display,
          note: imm.note?.[0]?.text,
          protocol_dose_number_positive_int: imm.protocolApplied?.[0]?.doseNumberPositiveInt,
          protocol_series_doses_positive_int: imm.protocolApplied?.[0]?.seriesDosesPositiveInt,
          reaction_date: imm.reaction?.[0]?.date,
          reaction_reported: imm.reaction?.[0]?.reported,
          updated_at: new Date().toISOString()
        };

        if (existing) {
          await supabase
            .from('fhir_immunizations')
            .update(immunizationData)
            .eq('id', (existing as UnknownRecord).id as string);
        } else {
          await supabase
            .from('fhir_immunizations')
            .insert({ ...immunizationData, created_at: new Date().toISOString() });
        }
      }
    }

    // Import CarePlans
    if (fhirData.carePlans && Array.isArray(fhirData.carePlans)) {
      for (const entry of fhirData.carePlans) {
        const plan = entry.resource;
        if (!plan || plan.resourceType !== 'CarePlan') continue;

        // Extract categories
        const categories = plan.category?.map((cat) => cat.coding?.[0]?.code).filter(Boolean) || [];
        const categoryDisplays = plan.category?.map((cat) => cat.coding?.[0]?.display).filter(Boolean) || [];

        // Extract activities from FHIR format
        const activities = plan.activity?.map((a) => ({
          kind: a.detail?.kind,
          status: a.detail?.status,
          detail: a.detail?.description,
          scheduled_start: a.detail?.scheduledTiming?.repeat?.boundsPeriod?.start,
          scheduled_end: a.detail?.scheduledTiming?.repeat?.boundsPeriod?.end
        })) || [];

        // Check if care plan already exists from this external system
        const { data: existingPlan } = await supabase
          .from('fhir_care_plans')
          .select('id')
          .eq('external_id', plan.id)
          .eq('external_system', 'FHIR')
          .maybeSingle();

        const carePlanData = {
          patient_id: communityUserId,
          external_id: plan.id,
          external_system: 'FHIR',
          status: plan.status,
          intent: plan.intent,
          category: categories,
          category_display: categoryDisplays,
          title: plan.title,
          description: plan.description,
          subject_reference: plan.subject?.reference,
          subject_display: plan.subject?.display,
          period_start: plan.period?.start,
          period_end: plan.period?.end,
          created: plan.created,
          author_reference: plan.author?.reference,
          author_display: plan.author?.display,
          care_team_reference: plan.careTeam?.[0]?.reference,
          care_team_display: plan.careTeam?.[0]?.display,
          addresses_condition_references: plan.addresses?.map((a) => a.reference),
          addresses_condition_displays: plan.addresses?.map((a) => a.display),
          goal_references: plan.goal?.map((g) => g.reference),
          goal_displays: plan.goal?.map((g) => g.display),
          activities: activities,
          note: plan.note?.[0]?.text,
          updated_at: new Date().toISOString()
        };

        if (existingPlan) {
          await supabase
            .from('fhir_care_plans')
            .update(carePlanData)
            .eq('id', (existingPlan as UnknownRecord).id as string);
        } else {
          await supabase
            .from('fhir_care_plans')
            .insert({ ...carePlanData, created_at: new Date().toISOString() });
        }
      }
    }

    // SOC 2: Log successful import completion
    const duration = Date.now() - startTime;
    await logAuditEvent('FHIR_IMPORT_COMPLETED', {
      actor_user_id: currentUser?.id,
      target_user_id: communityUserId,
      duration_ms: duration,
      resources_imported: {
        immunizations: fhirData.immunizations?.length || 0,
        carePlans: fhirData.carePlans?.length || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    // SOC 2: Log import failure (no PHI in logs)
    await logSecurityEvent('FHIR_IMPORT_FAILED', {
      actor_user_id: currentUser?.id,
      target_user_id: communityUserId,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}
