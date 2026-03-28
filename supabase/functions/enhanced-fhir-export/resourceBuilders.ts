// Resource builders for FHIR export — extracted from index.ts for decomposition
// Each function builds a valid FHIR resource entry with required field validation

interface FhirEntry {
  fullUrl: string;
  resource: Record<string, unknown>;
}

// ============================================================================
// Validation — reject resources missing required FHIR fields
// ============================================================================

function isValidObservation(resource: Record<string, unknown>): boolean {
  return Boolean(
    resource.resourceType === 'Observation' &&
    resource.status &&
    resource.code &&
    resource.subject
  );
}

function isValidDiagnosticReport(resource: Record<string, unknown>): boolean {
  return Boolean(
    resource.resourceType === 'DiagnosticReport' &&
    resource.status &&
    resource.code &&
    resource.subject
  );
}

function isValidRiskAssessment(resource: Record<string, unknown>): boolean {
  return Boolean(
    resource.resourceType === 'RiskAssessment' &&
    resource.status &&
    resource.subject
  );
}

// Validate entry and return null if invalid
function validateEntry(entry: FhirEntry): FhirEntry | null {
  const rt = entry.resource.resourceType;
  if (rt === 'Patient') return entry; // Patient always valid if present
  if (rt === 'Observation' && !isValidObservation(entry.resource)) return null;
  if (rt === 'DiagnosticReport' && !isValidDiagnosticReport(entry.resource)) return null;
  if (rt === 'RiskAssessment' && !isValidRiskAssessment(entry.resource)) return null;
  return entry;
}

// ============================================================================
// Patient Resource
// ============================================================================

interface PatientProfile {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  dob: string | null;
  address: string | null;
}

export function buildPatientResource(patientId: string, profile: PatientProfile): FhirEntry {
  return {
    fullUrl: `Patient/${patientId}`,
    resource: {
      resourceType: 'Patient',
      id: patientId,
      identifier: [{ system: 'http://wellfitcommunity.org/patient-id', value: patientId }],
      name: [{
        use: 'official',
        family: profile.last_name,
        given: profile.first_name ? [profile.first_name] : []
      }],
      telecom: [
        ...(profile.phone ? [{ system: 'phone', value: profile.phone, use: 'mobile' }] : []),
        ...(profile.email ? [{ system: 'email', value: profile.email, use: 'home' }] : [])
      ],
      birthDate: profile.dob,
      address: profile.address ? [{ use: 'home', text: profile.address }] : []
    }
  };
}

// ============================================================================
// Check-in Vital Signs
// ============================================================================

interface CheckIn {
  id: string;
  created_at: string;
  heart_rate: number | null;
  pulse_oximeter: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  mood: string | null;
}

function vitalSignCategory() {
  return [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/observation-category',
      code: 'vital-signs',
      display: 'Vital Signs'
    }]
  }];
}

export function buildCheckInObservations(patientId: string, checkIns: CheckIn[]): FhirEntry[] {
  const entries: FhirEntry[] = [];

  for (const ci of checkIns) {
    if (ci.heart_rate) {
      const entry: FhirEntry = {
        fullUrl: `Observation/web-hr-${ci.id}`,
        resource: {
          resourceType: 'Observation', id: `web-hr-${ci.id}`, status: 'final',
          category: vitalSignCategory(),
          code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }] },
          subject: { reference: `Patient/${patientId}` },
          effectiveDateTime: ci.created_at,
          valueQuantity: { value: ci.heart_rate, unit: 'beats/min', system: 'http://unitsofmeasure.org', code: '/min' },
          device: { display: 'WellFit Community Web App - Manual Entry' }
        }
      };
      const valid = validateEntry(entry);
      if (valid) entries.push(valid);
    }

    if (ci.pulse_oximeter) {
      const entry: FhirEntry = {
        fullUrl: `Observation/web-spo2-${ci.id}`,
        resource: {
          resourceType: 'Observation', id: `web-spo2-${ci.id}`, status: 'final',
          category: vitalSignCategory(),
          code: { coding: [{ system: 'http://loinc.org', code: '2708-6', display: 'Oxygen saturation in Arterial blood' }] },
          subject: { reference: `Patient/${patientId}` },
          effectiveDateTime: ci.created_at,
          valueQuantity: { value: ci.pulse_oximeter, unit: '%', system: 'http://unitsofmeasure.org', code: '%' },
          device: { display: 'WellFit Community Web App - Manual Entry' }
        }
      };
      const valid = validateEntry(entry);
      if (valid) entries.push(valid);
    }

    if (ci.bp_systolic && ci.bp_diastolic) {
      const entry: FhirEntry = {
        fullUrl: `Observation/web-bp-${ci.id}`,
        resource: {
          resourceType: 'Observation', id: `web-bp-${ci.id}`, status: 'final',
          category: vitalSignCategory(),
          code: { coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel with all children optional' }] },
          subject: { reference: `Patient/${patientId}` },
          effectiveDateTime: ci.created_at,
          component: [
            {
              code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] },
              valueQuantity: { value: ci.bp_systolic, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
            },
            {
              code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] },
              valueQuantity: { value: ci.bp_diastolic, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
            }
          ],
          device: { display: 'WellFit Community Web App - Manual Entry' }
        }
      };
      const valid = validateEntry(entry);
      if (valid) entries.push(valid);
    }

    if (ci.mood) {
      const entry: FhirEntry = {
        fullUrl: `Observation/web-mood-${ci.id}`,
        resource: {
          resourceType: 'Observation', id: `web-mood-${ci.id}`, status: 'final',
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey', display: 'Survey' }] }],
          code: { coding: [{ system: 'http://wellfitcommunity.org/fhir/codes', code: 'mood-assessment', display: 'Mood Assessment' }] },
          subject: { reference: `Patient/${patientId}` },
          effectiveDateTime: ci.created_at,
          valueString: ci.mood,
          device: { display: 'WellFit Community Web App' }
        }
      };
      const valid = validateEntry(entry);
      if (valid) entries.push(valid);
    }
  }

  return entries;
}

// ============================================================================
// Mobile Vitals
// ============================================================================

interface MobileVital {
  id: string;
  measurement_type: string;
  measured_at: string;
  value_primary: number;
  unit: string;
  measurement_method: string | null;
  confidence_score: number | null;
  measurement_quality: string | null;
}

export function buildMobileVitalObservations(patientId: string, vitals: MobileVital[]): FhirEntry[] {
  const entries: FhirEntry[] = [];

  for (const vital of vitals) {
    const loincCode = vital.measurement_type === 'heart_rate' ? '8867-4' :
                      vital.measurement_type === 'spo2' ? '2708-6' : '33747-0';
    const loincDisplay = vital.measurement_type === 'heart_rate' ? 'Heart rate' :
                         vital.measurement_type === 'spo2' ? 'Oxygen saturation' : 'General observation';

    const entry: FhirEntry = {
      fullUrl: `Observation/mobile-${vital.measurement_type}-${vital.id}`,
      resource: {
        resourceType: 'Observation',
        id: `mobile-${vital.measurement_type}-${vital.id}`,
        status: 'final',
        category: vitalSignCategory(),
        code: { coding: [{ system: 'http://loinc.org', code: loincCode, display: loincDisplay }] },
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: vital.measured_at,
        valueQuantity: { value: vital.value_primary, unit: vital.unit, system: 'http://unitsofmeasure.org' },
        device: { display: `Mobile Companion App - ${vital.measurement_method || 'Camera PPG'}` },
        extension: [
          ...(vital.confidence_score != null ? [{ url: 'http://wellfitcommunity.org/fhir/confidence-score', valueInteger: vital.confidence_score }] : []),
          ...(vital.measurement_quality ? [{ url: 'http://wellfitcommunity.org/fhir/measurement-quality', valueString: vital.measurement_quality }] : [])
        ]
      }
    };
    const valid = validateEntry(entry);
    if (valid) entries.push(valid);
  }

  return entries;
}

// ============================================================================
// Emergency Incidents
// ============================================================================

interface EmergencyIncident {
  id: string;
  triggered_at: string;
  incident_type: string;
  severity: string;
  auto_detected: boolean;
  incident_resolved: boolean;
}

export function buildEmergencyReports(patientId: string, incidents: EmergencyIncident[]): FhirEntry[] {
  const entries: FhirEntry[] = [];

  for (const incident of incidents) {
    const entry: FhirEntry = {
      fullUrl: `DiagnosticReport/emergency-${incident.id}`,
      resource: {
        resourceType: 'DiagnosticReport',
        id: `emergency-${incident.id}`,
        status: incident.incident_resolved ? 'final' : 'preliminary',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'OTH', display: 'Other' }] }],
        code: { coding: [{ system: 'http://wellfitcommunity.org/fhir/codes', code: 'emergency-incident', display: 'Emergency Incident' }] },
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: incident.triggered_at,
        conclusion: `${incident.incident_type} - Severity: ${incident.severity}${incident.auto_detected ? ' (Auto-detected)' : ' (Manual trigger)'}`,
        conclusionCode: [{ coding: [{ system: 'http://wellfitcommunity.org/fhir/incident-types', code: incident.incident_type, display: incident.incident_type.replace(/_/g, ' ') }] }]
      }
    };
    const valid = validateEntry(entry);
    if (valid) entries.push(valid);
  }

  return entries;
}

// ============================================================================
// Movement Patterns
// ============================================================================

interface MovementPattern {
  id: string;
  date_tracked: string;
  total_distance_meters: number;
  active_time_minutes: number;
}

export function buildMovementObservations(patientId: string, patterns: MovementPattern[]): FhirEntry[] {
  const entries: FhirEntry[] = [];

  for (const pattern of patterns) {
    const entry: FhirEntry = {
      fullUrl: `Observation/movement-${pattern.id}`,
      resource: {
        resourceType: 'Observation',
        id: `movement-${pattern.id}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'activity', display: 'Activity' }] }],
        code: { coding: [{ system: 'http://wellfitcommunity.org/fhir/codes', code: 'daily-activity-summary', display: 'Daily Activity Summary' }] },
        subject: { reference: `Patient/${patientId}` },
        effectiveDate: pattern.date_tracked,
        component: [
          {
            code: { coding: [{ system: 'http://wellfitcommunity.org/fhir/codes', code: 'total-distance', display: 'Total Distance Traveled' }] },
            valueQuantity: { value: pattern.total_distance_meters, unit: 'meters', system: 'http://unitsofmeasure.org', code: 'm' }
          },
          {
            code: { coding: [{ system: 'http://wellfitcommunity.org/fhir/codes', code: 'active-time', display: 'Active Time' }] },
            valueQuantity: { value: pattern.active_time_minutes, unit: 'minutes', system: 'http://unitsofmeasure.org', code: 'min' }
          }
        ]
      }
    };
    const valid = validateEntry(entry);
    if (valid) entries.push(valid);
  }

  return entries;
}

// ============================================================================
// AI Risk Assessments
// ============================================================================

interface RiskAssessment {
  id: string;
  assessed_at: string;
  risk_level: string;
  risk_score: number;
  risk_factors: string[] | null;
  recommendations: string[] | null;
}

export function buildRiskAssessments(patientId: string, assessments: RiskAssessment[]): FhirEntry[] {
  const entries: FhirEntry[] = [];

  for (const assessment of assessments) {
    const entry: FhirEntry = {
      fullUrl: `RiskAssessment/ai-${assessment.id}`,
      resource: {
        resourceType: 'RiskAssessment',
        id: `ai-${assessment.id}`,
        status: 'final',
        subject: { reference: `Patient/${patientId}` },
        occurrenceDateTime: assessment.assessed_at,
        prediction: [{
          outcome: { coding: [{ system: 'http://wellfitcommunity.org/fhir/risk-levels', code: assessment.risk_level, display: assessment.risk_level }] },
          probabilityDecimal: assessment.risk_score / 100,
          rationale: assessment.risk_factors?.join(', ')
        }],
        note: assessment.recommendations?.map((rec: string) => ({ text: rec }))
      }
    };
    const valid = validateEntry(entry);
    if (valid) entries.push(valid);
  }

  return entries;
}
