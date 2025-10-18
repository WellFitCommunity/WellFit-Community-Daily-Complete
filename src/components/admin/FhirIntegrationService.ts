// FHIR Integration Layer for WellFit - Complete Implementation
// Maps your existing Supabase schema to FHIR R4 resources

import { supabase } from '../../lib/supabaseClient';
import { SupabaseClient } from '@supabase/supabase-js';

// FHIR R4 Resource Types
interface FHIRPatient {
  resourceType: 'Patient';
  id: string;
  identifier: Array<{
    use: string;
    type: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    system: string;
    value: string;
  }>;
  active: boolean;
  name: Array<{
    use: string;
    family: string;
    given: string[];
  }>;
  telecom: Array<{
    system: 'phone' | 'email';
    value: string;
    use: string;
  }>;
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string;
  address: Array<{
    use: string;
    type: string;
    line: string[];
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;
  contact?: Array<{
    relationship: Array<{
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    }>;
    name: {
      family: string;
      given: string[];
    };
    telecom: Array<{
      system: string;
      value: string;
    }>;
  }>;
}

interface FHIRObservation {
  resourceType: 'Observation';
  id: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended';
  category: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
    display: string;
  };
  effectiveDateTime: string;
  issued: string;
  performer?: Array<{
    reference: string;
    display: string;
  }>;
  valueQuantity?: {
    value: number;
    unit: string;
    system: string;
    code: string;
  };
  valueString?: string;
  component?: Array<{
    code: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    valueQuantity: {
      value: number;
      unit: string;
      system: string;
      code: string;
    };
  }>;
}

interface FHIRMedicationStatement {
  resourceType: 'MedicationStatement';
  id: string;
  status: 'active' | 'completed' | 'entered-in-error' | 'intended' | 'stopped' | 'on-hold' | 'unknown' | 'not-taken';
  medicationCodeableConcept: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  subject: {
    reference: string;
    display: string;
  };
  effectiveDateTime: string;
  dateAsserted: string;
  informationSource: {
    reference: string;
    display: string;
  };
  dosage?: Array<{
    text: string;
    timing?: {
      repeat: {
        frequency: number;
        period: number;
        periodUnit: string;
      };
    };
    route?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    doseAndRate?: Array<{
      doseQuantity: {
        value?: number;
        unit: string;
        system: string;
      };
    }>;
  }>;
  note?: Array<{
    text: string;
  }>;
}

interface FHIRBundle {
  resourceType: 'Bundle';
  id: string;
  meta: {
    versionId: string;
    lastUpdated: string;
    profile: string[];
  };
  identifier: {
    system: string;
    value: string;
  };
  type: 'collection' | 'searchset' | 'history';
  timestamp: string;
  entry: Array<{
    fullUrl: string;
    resource: FHIRPatient | FHIRObservation | FHIRMedicationStatement;
  }>;
}

// Your existing database types (from schema)
interface Profile {
  id: string;
  user_id: string;
  phone: string;
  first_name: string;
  last_name: string;
  email?: string;
  dob?: string;
  address?: string;
  caregiver_email?: string;
  emergency_contact_name?: string;
  created_at: string;
}

interface CheckIn {
  id: string;
  user_id: string;
  is_emergency: boolean;
  label?: string;
  notes?: string;
  mood?: string;
  activity_level?: string;
  heart_rate?: number;
  pulse_oximeter?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  glucose_mg_dl?: number;
  created_at: string;
}

interface HealthEntry {
  id: string;
  user_id: string;
  entry_type: string;
  data: {
    mood?: string;
    symptoms?: string;
    activity_description?: string;
  };
  created_at: string;
}

interface Medication {
  id: string;
  user_id: string;
  medication_name: string;
  generic_name?: string;
  brand_name?: string;
  dosage?: string;
  dosage_form?: string;
  strength?: string;
  instructions?: string;
  frequency?: string;
  route?: string;
  prescribed_by?: string;
  prescribed_date?: string;
  prescription_number?: string;
  pharmacy_name?: string;
  pharmacy_phone?: string;
  quantity?: number;
  refills_remaining?: number;
  last_refill_date?: string;
  next_refill_date?: string;
  ndc_code?: string;
  purpose?: string;
  side_effects?: string[];
  warnings?: string[];
  interactions?: string[];
  status: string;
  discontinued_date?: string;
  discontinued_reason?: string;
  ai_confidence?: number;
  extraction_notes?: string;
  needs_review?: boolean;
  created_at: string;
  updated_at: string;
}

export class FHIRIntegrationService {
  private supabase: SupabaseClient;
  private organizationSystem = 'http://wellfit-community.com/patient-ids';

  constructor() {
    this.supabase = supabase;
  }

  // ==== PATIENT RESOURCE MAPPING ====
  async createPatientResource(profile: Profile): Promise<FHIRPatient> {
    const patient: FHIRPatient = {
      resourceType: 'Patient',
      id: profile.user_id,
      identifier: [
        {
          use: 'usual',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'MR',
                display: 'Medical Record Number'
              }
            ]
          },
          system: this.organizationSystem,
          value: `WF-${profile.user_id.slice(0, 8)}`
        }
      ],
      active: true,
      name: [
        {
          use: 'official',
          family: profile.last_name,
          given: [profile.first_name]
        }
      ],
      telecom: [
        {
          system: 'phone',
          value: profile.phone,
          use: 'home'
        }
      ],
      gender: 'unknown', // You might want to add gender to profiles table
      birthDate: profile.dob || '',
      address: profile.address ? this.parseAddress(profile.address) : []
    };

    // Add email if present
    if (profile.email) {
      patient.telecom.push({
        system: 'email',
        value: profile.email,
        use: 'home'
      });
    }

    // Add emergency contact if present
    if (profile.emergency_contact_name && profile.caregiver_email) {
      patient.contact = [
        {
          relationship: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                  code: 'C',
                  display: 'Emergency Contact'
                }
              ]
            }
          ],
          name: {
            family: profile.emergency_contact_name.split(' ').pop() || '',
            given: profile.emergency_contact_name.split(' ').slice(0, -1)
          },
          telecom: [
            {
              system: 'email',
              value: profile.caregiver_email
            }
          ]
        }
      ];
    }

    return patient;
  }

  // ==== OBSERVATION RESOURCE MAPPING ====
  async createVitalsObservations(checkIn: CheckIn, profile: Profile): Promise<FHIRObservation[]> {
  const observations: FHIRObservation[] = [];
  const patientReference = `Patient/${profile.user_id}`;
  const patientDisplay = `${profile.first_name} ${profile.last_name}`;

  // Blood Pressure (both values must be present)
  if (checkIn.bp_systolic != null && checkIn.bp_diastolic != null) {
    observations.push({
      resourceType: 'Observation',
      id: `bp-${checkIn.id}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel with all children optional',
          },
        ],
      },
      subject: { reference: patientReference, display: patientDisplay },
      effectiveDateTime: checkIn.created_at,
      issued: checkIn.created_at,
      component: [
        {
          code: {
            coding: [
              { system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' },
            ],
          },
          valueQuantity: {
            value: checkIn.bp_systolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
        },
        {
          code: {
            coding: [
              { system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' },
            ],
          },
          valueQuantity: {
            value: checkIn.bp_diastolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
        },
      ],
    });
  }

  // Heart Rate
  if (checkIn.heart_rate != null) {
    observations.push({
      resourceType: 'Observation',
      id: `hr-${checkIn.id}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }],
      },
      subject: { reference: patientReference, display: patientDisplay },
      effectiveDateTime: checkIn.created_at,
      issued: checkIn.created_at,
      valueQuantity: {
        value: checkIn.heart_rate,
        unit: 'beats/min',
        system: 'http://unitsofmeasure.org',
        code: '/min',
      },
    });
  }

  // Glucose
  if (checkIn.glucose_mg_dl != null) {
    observations.push({
      resourceType: 'Observation',
      id: `glucose-${checkIn.id}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [{ system: 'http://loinc.org', code: '33747-0', display: 'Glucose measurement' }],
      },
      subject: { reference: patientReference, display: patientDisplay },
      effectiveDateTime: checkIn.created_at,
      issued: checkIn.created_at,
      valueQuantity: {
        value: checkIn.glucose_mg_dl,
        unit: 'mg/dL',
        system: 'http://unitsofmeasure.org',
        code: 'mg/dL',
      },
    });
  }

  // Pulse Oximetry (SpO2)
  if (checkIn.pulse_oximeter != null) {
    observations.push({
      resourceType: 'Observation',
      id: `spo2-${checkIn.id}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [
          { system: 'http://loinc.org', code: '2708-6', display: 'Oxygen saturation in Arterial blood' },
        ],
      },
      subject: { reference: patientReference, display: patientDisplay },
      effectiveDateTime: checkIn.created_at,
      issued: checkIn.created_at,
      valueQuantity: {
        value: checkIn.pulse_oximeter,
        unit: '%',
        system: 'http://unitsofmeasure.org',
        code: '%',
      },
    });
  }

  return observations;
}

  async createWellnessObservations(entry: HealthEntry, profile: Profile): Promise<FHIRObservation[]> {
    const observations: FHIRObservation[] = [];
    const patientReference = `Patient/${profile.user_id}`;
    const patientDisplay = `${profile.first_name} ${profile.last_name}`;

    // Mood Observation
    if (entry.data && entry.data.mood) {
      observations.push({
        resourceType: 'Observation',
        id: `mood-${entry.id}`,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'survey',
                display: 'Survey'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '72133-2',
              display: 'Mood assessment'
            }
          ]
        },
        subject: {
          reference: patientReference,
          display: patientDisplay
        },
        effectiveDateTime: entry.created_at,
        issued: entry.created_at,
        valueString: entry.data.mood
      });
    }

    // Activity Level Observation
    if (entry.data && entry.data.activity_description) {
      observations.push({
        resourceType: 'Observation',
        id: `activity-${entry.id}`,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'activity',
                display: 'Activity'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '89574-8',
              display: 'Physical activity assessment'
            }
          ]
        },
        subject: {
          reference: patientReference,
          display: patientDisplay
        },
        effectiveDateTime: entry.created_at,
        issued: entry.created_at,
        valueString: entry.data.activity_description
      });
    }

    return observations;
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
      console.error('FHIR export error:', error);
      throw error;
    }
  }

  // ==== POPULATION HEALTH ANALYTICS ====
  async getPopulationHealthMetrics(days = 30): Promise<any> {
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

  // Strongly type vitals rows
  type VitalsRow = {
    bp_systolic: number | null;
    bp_diastolic: number | null;
    heart_rate: number | null;
    glucose_mg_dl: number | null;
  };

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
  private parseAddress(address: string): any[] {
    // Simple address parsing - you might want to enhance this
    const parts = address.split(',').map(p => p.trim());
    return [
      {
        use: 'home',
        type: 'both',
        line: parts.slice(0, -3),
        city: parts[parts.length - 3] || '',
        state: parts[parts.length - 2] || '',
        postalCode: parts[parts.length - 1] || '',
        country: 'US'
      }
    ];
  }

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

  // ==== MEDICATION STATEMENT RESOURCE MAPPING ====
  async createMedicationStatements(medications: Medication[], profile: Profile): Promise<FHIRMedicationStatement[]> {
    const statements: FHIRMedicationStatement[] = [];
    const patientReference = `Patient/${profile.user_id}`;
    const patientDisplay = `${profile.first_name} ${profile.last_name}`;

    for (const medication of medications) {
      if (medication.status !== 'active') continue; // Only sync active medications

      const statement: FHIRMedicationStatement = {
        resourceType: 'MedicationStatement',
        id: `medication-${medication.id}`,
        status: this.mapMedicationStatus(medication.status),
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: medication.ndc_code || 'unknown',
              display: medication.medication_name
            }
          ],
          text: medication.medication_name
        },
        subject: {
          reference: patientReference,
          display: patientDisplay
        },
        effectiveDateTime: medication.prescribed_date || medication.created_at,
        dateAsserted: medication.created_at,
        informationSource: {
          reference: patientReference,
          display: 'Patient reported'
        },
        dosage: [
          {
            text: medication.instructions || `${medication.dosage} ${medication.frequency || ''}`.trim(),
            timing: medication.frequency ? {
              repeat: {
                frequency: this.parseFrequency(medication.frequency),
                period: 1,
                periodUnit: 'd' // day
              }
            } : undefined,
            route: medication.route ? {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: this.mapRouteToSNOMED(medication.route),
                  display: medication.route
                }
              ]
            } : undefined,
            doseAndRate: medication.dosage ? [
              {
                doseQuantity: {
                  value: parseFloat(medication.dosage.replace(/[^\d.]/g, '')) || undefined,
                  unit: medication.dosage.replace(/[\d.]/g, '').trim() || 'unit',
                  system: 'http://unitsofmeasure.org'
                }
              }
            ] : undefined
          }
        ],
        note: []
      };

      // Add purpose as note
      if (medication.purpose) {
        statement.note!.push({
          text: `Purpose: ${medication.purpose}`
        });
      }

      // Add side effects as note
      if (medication.side_effects && medication.side_effects.length > 0) {
        statement.note!.push({
          text: `Side effects: ${medication.side_effects.join(', ')}`
        });
      }

      // Add warnings as note
      if (medication.warnings && medication.warnings.length > 0) {
        statement.note!.push({
          text: `Warnings: ${medication.warnings.join(', ')}`
        });
      }

      statements.push(statement);
    }

    return statements;
  }

  // Helper functions for medication mapping
  private mapMedicationStatus(status: string): 'active' | 'completed' | 'entered-in-error' | 'intended' | 'stopped' | 'on-hold' | 'unknown' | 'not-taken' {
    switch (status) {
      case 'active': return 'active';
      case 'completed': return 'completed';
      case 'discontinued': return 'stopped';
      default: return 'unknown';
    }
  }

  private parseFrequency(frequency: string): number {
    const lowerFreq = frequency.toLowerCase();
    if (lowerFreq.includes('once')) return 1;
    if (lowerFreq.includes('twice') || lowerFreq.includes('two')) return 2;
    if (lowerFreq.includes('three') || lowerFreq.includes('thrice')) return 3;
    if (lowerFreq.includes('four')) return 4;
    // Extract number from string like "every 8 hours" = 3 times per day
    const match = lowerFreq.match(/every\s+(\d+)\s+hour/);
    if (match) {
      const hours = parseInt(match[1]);
      return Math.round(24 / hours);
    }
    return 1; // Default to once daily
  }

  private mapRouteToSNOMED(route: string): string {
    const routeMap: Record<string, string> = {
      'oral': '26643006',
      'topical': '6064005',
      'injection': '129326001',
      'intravenous': '47625008',
      'sublingual': '37839007',
      'rectal': '37161004',
      'inhalation': '447694001'
    };
    return routeMap[route.toLowerCase()] || '26643006'; // Default to oral
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
        console.error('Failed to fetch medications:', medError);
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
      console.error('FHIR export with medications error:', error);
      throw error;
    }
  }

  // ==== IMMUNIZATION RESOURCE MAPPING ====
  private mapSiteCode(site: string): string {
    const siteMap: Record<string, string> = {
      'left arm': 'LA',
      'right arm': 'RA',
      'left deltoid': 'LD',
      'right deltoid': 'RD',
      'left thigh': 'LT',
      'right thigh': 'RT'
    };
    return siteMap[site?.toLowerCase()] || 'LA';
  }

  private mapRouteCodeImmunization(route: string): string {
    const routeMap: Record<string, string> = {
      'intramuscular': 'IM',
      'subcutaneous': 'SC',
      'oral': 'PO',
      'intranasal': 'NASINHL'
    };
    return routeMap[route?.toLowerCase()] || 'IM';
  }

  private mapImmunizationToFHIR(imm: any): any {
    return {
      resourceType: 'Immunization',
      id: imm.id,
      status: imm.status,
      vaccineCode: {
        coding: [{
          system: 'http://hl7.org/fhir/sid/cvx',
          code: imm.vaccine_code,
          display: imm.vaccine_display || imm.vaccine_name
        }]
      },
      patient: {
        reference: `Patient/${imm.patient_id}`
      },
      occurrenceDateTime: imm.occurrence_datetime,
      recorded: imm.created_at,
      primarySource: imm.primary_source !== false,
      lotNumber: imm.lot_number,
      expirationDate: imm.expiration_date,
      site: imm.site_display ? {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActSite',
          code: this.mapSiteCode(imm.site_display),
          display: imm.site_display
        }]
      } : undefined,
      route: imm.route_display ? {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-RouteOfAdministration',
          code: this.mapRouteCodeImmunization(imm.route_display),
          display: imm.route_display
        }]
      } : undefined,
      doseQuantity: imm.dose_quantity_value ? {
        value: imm.dose_quantity_value,
        unit: imm.dose_quantity_unit || 'mL',
        system: 'http://unitsofmeasure.org',
        code: imm.dose_quantity_unit || 'mL'
      } : undefined,
      performer: imm.performer_actor_display ? [{
        actor: {
          display: imm.performer_actor_display
        }
      }] : undefined,
      note: imm.note ? [{
        text: imm.note
      }] : undefined,
      protocolApplied: imm.protocol_dose_number_positive_int ? [{
        doseNumberPositiveInt: imm.protocol_dose_number_positive_int,
        seriesDosesPositiveInt: imm.protocol_series_doses_positive_int
      }] : undefined,
      reaction: imm.reaction_date ? [{
        date: imm.reaction_date,
        reported: imm.reaction_reported
      }] : undefined
    };
  }

  // ==== CAREPLAN RESOURCE MAPPING ====
  private mapCarePlanToFHIR(plan: any): any {
    return {
      resourceType: 'CarePlan',
      id: plan.id,
      status: plan.status,
      intent: plan.intent,
      category: plan.category ? plan.category.map((cat: string) => ({
        coding: [{
          system: 'http://hl7.org/fhir/us/core/CodeSystem/careplan-category',
          code: cat,
          display: cat
        }]
      })) : undefined,
      title: plan.title,
      description: plan.description,
      subject: {
        reference: `Patient/${plan.patient_id}`
      },
      period: {
        start: plan.period_start,
        end: plan.period_end
      },
      created: plan.created || plan.created_at,
      author: plan.author_display ? {
        display: plan.author_display
      } : undefined,
      careTeam: plan.care_team_reference ? [{
        reference: plan.care_team_reference,
        display: plan.care_team_display
      }] : undefined,
      addresses: plan.addresses_condition_references ? plan.addresses_condition_references.map((ref: string, idx: number) => ({
        reference: ref,
        display: plan.addresses_condition_displays?.[idx]
      })) : undefined,
      goal: plan.goal_displays ? plan.goal_displays.map((g: string) => ({
        display: g
      })) : undefined,
      activity: plan.activities ? (Array.isArray(plan.activities) ? plan.activities : []).map((a: any) => ({
        detail: {
          kind: a.kind || 'Task',
          status: a.status,
          description: a.detail || a.description,
          scheduledTiming: a.scheduled_start ? {
            repeat: {
              boundsPeriod: {
                start: a.scheduled_start,
                end: a.scheduled_end
              }
            }
          } : undefined
        }
      })) : undefined,
      note: plan.note ? [{
        text: plan.note
      }] : undefined
    };
  }

  // ==== COMPLETE EXPORT (ALL RESOURCES) ====
  async exportPatientDataComplete(userId: string): Promise<FHIRBundle> {
    try {
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
        console.error('Failed to fetch immunizations:', immError);
      } else if (immunizations && immunizations.length > 0) {
        immunizations.forEach(imm => {
          const fhirImmunization = this.mapImmunizationToFHIR(imm);
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
        console.error('Failed to fetch care plans:', cpError);
      } else if (carePlans && carePlans.length > 0) {
        carePlans.forEach(plan => {
          const fhirCarePlan = this.mapCarePlanToFHIR(plan);
          bundle.entry.push({
            fullUrl: `urn:uuid:careplan-${plan.id}`,
            resource: fhirCarePlan
          });
        });
      }

      return bundle;
    } catch (error) {
      console.error('FHIR complete export error:', error);
      throw error;
    }
  }
}

// Usage Example:
/*
const fhirService = new FHIRIntegrationService();

// Export patient data as FHIR Bundle
const patientBundle = await fhirService.exportPatientData('user-uuid');

// Get population health metrics
const populationMetrics = await fhirService.getPopulationHealthMetrics(30);

// Validate bundle before sending to EHR
const isValid = fhirService.validateBundle(patientBundle);
*/

export default FHIRIntegrationService;