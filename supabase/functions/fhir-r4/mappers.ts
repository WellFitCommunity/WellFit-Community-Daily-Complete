/**
 * FHIR R4 Server — Resource Mappers
 *
 * Transform database records into FHIR R4 resources conforming
 * to US Core profiles for USCDI compliance.
 */

import type {
  AllergyRecord,
  ConditionRecord,
  MedicationRecord,
  ObservationRecord,
  ImmunizationRecord,
  ProcedureRecord,
  DiagnosticReportRecord,
  CarePlanRecord,
  CareTeamRecord,
  GoalRecord,
  DocumentRecord,
} from './types.ts';

// =============================================================================
// Gender Mapping
// =============================================================================

export function mapGender(gender: string | null): string {
  if (!gender) return "unknown";
  const g = gender.toLowerCase();
  if (g === 'male' || g === 'm') return 'male';
  if (g === 'female' || g === 'f') return 'female';
  if (g === 'other') return 'other';
  return 'unknown';
}

// =============================================================================
// AllergyIntolerance
// =============================================================================

export function mapAllergyToFHIR(allergy: AllergyRecord, patientId: string) {
  return {
    resourceType: "AllergyIntolerance",
    id: allergy.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance"]
    },
    clinicalStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
        code: allergy.clinical_status || "active"
      }]
    },
    verificationStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
        code: allergy.verification_status || "confirmed"
      }]
    },
    type: allergy.allergen_type === 'intolerance' ? 'intolerance' : 'allergy',
    category: [allergy.allergen_type || "medication"],
    criticality: allergy.criticality || "unable-to-assess",
    code: {
      text: allergy.allergen_name
    },
    patient: { reference: `Patient/${patientId}` },
    recordedDate: allergy.created_at,
    reaction: allergy.reaction_description ? [{
      description: allergy.reaction_description,
      severity: allergy.severity || "moderate"
    }] : undefined
  };
}

// =============================================================================
// Condition
// =============================================================================

export function mapConditionToFHIR(condition: ConditionRecord, patientId: string) {
  return {
    resourceType: "Condition",
    id: condition.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition"]
    },
    clinicalStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
        code: condition.clinical_status || "active"
      }]
    },
    verificationStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
        code: condition.verification_status || "confirmed"
      }]
    },
    category: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-category",
        code: "problem-list-item"
      }]
    }],
    code: {
      coding: condition.code ? [{
        system: condition.code_system || "http://hl7.org/fhir/sid/icd-10-cm",
        code: condition.code,
        display: condition.code_display
      }] : undefined,
      text: condition.code_display
    },
    subject: { reference: `Patient/${patientId}` },
    onsetDateTime: condition.onset_datetime,
    recordedDate: condition.recorded_date
  };
}

// =============================================================================
// MedicationRequest
// =============================================================================

export function mapMedicationToFHIR(medication: MedicationRecord, patientId: string) {
  return {
    resourceType: "MedicationRequest",
    id: medication.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest"]
    },
    status: medication.status || "active",
    intent: "order",
    medicationCodeableConcept: {
      text: medication.medication_name
    },
    subject: { reference: `Patient/${patientId}` },
    authoredOn: medication.created_at,
    dosageInstruction: [{
      text: medication.instructions || medication.dosage,
      timing: medication.frequency ? { code: { text: medication.frequency } } : undefined,
      doseAndRate: medication.dosage ? [{
        doseQuantity: { value: 1, unit: medication.dosage }
      }] : undefined
    }]
  };
}

// =============================================================================
// Observation
// =============================================================================

export function mapObservationToFHIR(observation: ObservationRecord, patientId: string) {
  return {
    resourceType: "Observation",
    id: observation.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab"]
    },
    status: observation.status || "final",
    category: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/observation-category",
        code: observation.category || "vital-signs"
      }]
    }],
    code: {
      coding: observation.code ? [{
        system: "http://loinc.org",
        code: observation.code,
        display: observation.code_display
      }] : undefined,
      text: observation.code_display
    },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: observation.effective_datetime,
    valueQuantity: observation.value_quantity ? {
      value: observation.value_quantity,
      unit: observation.value_unit,
      system: "http://unitsofmeasure.org"
    } : undefined,
    valueString: observation.value_string
  };
}

// =============================================================================
// Immunization
// =============================================================================

export function mapImmunizationToFHIR(immunization: ImmunizationRecord, patientId: string) {
  return {
    resourceType: "Immunization",
    id: immunization.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization"]
    },
    status: immunization.status || "completed",
    vaccineCode: {
      coding: immunization.vaccine_code ? [{
        system: "http://hl7.org/fhir/sid/cvx",
        code: immunization.vaccine_code,
        display: immunization.vaccine_display
      }] : undefined,
      text: immunization.vaccine_display
    },
    patient: { reference: `Patient/${patientId}` },
    occurrenceDateTime: immunization.occurrence_datetime,
    lotNumber: immunization.lot_number,
    primarySource: true
  };
}

// =============================================================================
// Procedure
// =============================================================================

export function mapProcedureToFHIR(procedure: ProcedureRecord, patientId: string) {
  return {
    resourceType: "Procedure",
    id: procedure.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure"]
    },
    status: procedure.status || "completed",
    code: {
      coding: procedure.code ? [{
        system: procedure.code_system || "http://www.ama-assn.org/go/cpt",
        code: procedure.code,
        display: procedure.code_display
      }] : undefined,
      text: procedure.code_display
    },
    subject: { reference: `Patient/${patientId}` },
    performedDateTime: procedure.performed_datetime
  };
}

// =============================================================================
// DiagnosticReport
// =============================================================================

export function mapDiagnosticReportToFHIR(report: DiagnosticReportRecord, patientId: string) {
  return {
    resourceType: "DiagnosticReport",
    id: report.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab"]
    },
    status: report.status || "final",
    category: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/v2-0074",
        code: report.category || "LAB"
      }]
    }],
    code: {
      coding: report.code ? [{
        system: "http://loinc.org",
        code: report.code,
        display: report.code_display
      }] : undefined,
      text: report.code_display
    },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: report.effective_datetime,
    issued: report.issued,
    conclusion: report.conclusion
  };
}

// =============================================================================
// CarePlan
// =============================================================================

export function mapCarePlanToFHIR(carePlan: CarePlanRecord, patientId: string) {
  return {
    resourceType: "CarePlan",
    id: carePlan.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan"]
    },
    status: carePlan.status || "active",
    intent: "plan",
    title: carePlan.title,
    description: carePlan.description,
    subject: { reference: `Patient/${patientId}` },
    period: {
      start: carePlan.period_start,
      end: carePlan.period_end
    },
    category: [{
      coding: [{
        system: "http://hl7.org/fhir/us/core/CodeSystem/careplan-category",
        code: "assess-plan"
      }]
    }]
  };
}

// =============================================================================
// CareTeam
// =============================================================================

export function mapCareTeamToFHIR(careTeam: CareTeamRecord, patientId: string) {
  return {
    resourceType: "CareTeam",
    id: careTeam.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-careteam"]
    },
    status: careTeam.status || "active",
    name: careTeam.name,
    subject: { reference: `Patient/${patientId}` },
    participant: careTeam.participants || []
  };
}

// =============================================================================
// Goal
// =============================================================================

export function mapGoalToFHIR(goal: GoalRecord, patientId: string) {
  return {
    resourceType: "Goal",
    id: goal.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal"]
    },
    lifecycleStatus: goal.lifecycle_status || "active",
    description: {
      text: goal.description
    },
    subject: { reference: `Patient/${patientId}` },
    startDate: goal.start_date,
    target: goal.target_date ? [{
      dueDate: goal.target_date
    }] : undefined
  };
}

// =============================================================================
// DocumentReference
// =============================================================================

export function mapDocumentToFHIR(document: DocumentRecord, patientId: string) {
  return {
    resourceType: "DocumentReference",
    id: document.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference"]
    },
    status: "current",
    type: {
      coding: [{
        system: "http://loinc.org",
        code: "34108-1",
        display: "Outpatient Note"
      }]
    },
    subject: { reference: `Patient/${patientId}` },
    date: document.created_at,
    content: [{
      attachment: {
        contentType: "text/plain",
        data: btoa(document.content || "")
      }
    }]
  };
}
