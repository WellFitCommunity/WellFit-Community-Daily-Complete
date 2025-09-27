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
    resource: FHIRPatient | FHIRObservation;
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
               entry.resource.resourceType === 'Observation'
             );
    } catch {
      return false;
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