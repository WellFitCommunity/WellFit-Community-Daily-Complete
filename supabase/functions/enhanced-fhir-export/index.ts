import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createUserClient, batchQueries } from '../_shared/supabaseClient.ts'
import { cors } from "../_shared/cors.ts"

// Strict CORS policy matching other functions
const ALLOWED_ORIGINS = [
  "https://thewellfitcommunity.org",
  "https://wellfitcommunity.live",
  "http://localhost:3100",
  "https://localhost:3100"
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
  return {
    "Access-Control-Allow-Origin": allowedOrigin || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

interface FHIRExportRequest {
  patient_id?: string
  start_date?: string
  end_date?: string
  include_mobile_data?: boolean
  include_ai_assessments?: boolean
  format?: 'bundle' | 'individual'
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createUserClient(authHeader)

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      console.log('Unauthorized FHIR export attempt', { error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'POST') {
      const exportRequest: FHIRExportRequest = await req.json()

      // Check if user has permission to export data
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role_code')
        .eq('user_id', user.id)
        .single()

      const isAdmin = profile?.role_code && [1, 2, 3, 12].includes(profile.role_code)
      const patientId = exportRequest.patient_id || user.id

      // Users can only export their own data unless they're admin
      if (!isAdmin && patientId !== user.id) {
        console.log('Unauthorized FHIR export attempt', {
          userId: user.id,
          requestedPatientId: patientId,
          isAdmin
        });
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const startDate = exportRequest.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const endDate = exportRequest.end_date || new Date().toISOString()

      console.log('FHIR export initiated', {
        userId: user.id,
        patientId,
        isAdmin,
        startDate,
        endDate,
        includeMobileData: exportRequest.include_mobile_data !== false,
        includeAIAssessments: exportRequest.include_ai_assessments !== false
      });

      // Generate comprehensive FHIR bundle
      const fhirBundle = await generateEnhancedFHIRBundle(
        supabaseClient,
        patientId,
        startDate,
        endDate,
        exportRequest.include_mobile_data !== false,
        exportRequest.include_ai_assessments !== false,
        logger
      )

      // Cache the bundle
      const { error: cacheError } = await supabaseClient
        .from('fhir_bundles')
        .insert({
          patient_id: patientId,
          bundle_type: 'enhanced_patient_export',
          bundle_data: fhirBundle,
          validation_status: 'VALID',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })

      if (cacheError) {
        console.warn('Failed to cache FHIR bundle', { error: cacheError.message });
      }

      const processingTime = Date.now() - startTime;
      console.log('FHIR export completed successfully', {
        userId: user.id,
        patientId,
        resourceCount: fhirBundle.total,
        processingTimeMs: processingTime
      });

      return new Response(
        JSON.stringify(fhirBundle),
        { headers: { ...corsHeaders, 'Content-Type': 'application/fhir+json' } }
      )
    }

    console.warn('Method not allowed', { method: req.method });
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('FHIR export error', {
      error: error.message,
      processingTimeMs: processingTime
    });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function generateEnhancedFHIRBundle(
  supabaseClient: any,
  patientId: string,
  startDate: string,
  endDate: string,
  includeMobileData: boolean,
  includeAIAssessments: boolean,
  logger: any
) {
  const bundleId = `bundle-${patientId}-${Date.now()}`
  const entries = []

  // Batch all initial data fetching in parallel
  const baseQueries = [
    () => supabaseClient.from('profiles').select('*').eq('user_id', patientId).single(),
    () => supabaseClient.from('check_ins').select('*').eq('user_id', patientId).gte('created_at', startDate).lte('created_at', endDate)
  ];

  // Add mobile data queries if requested
  if (includeMobileData) {
    baseQueries.push(
      () => supabaseClient.from('mobile_vitals').select('*').eq('patient_id', patientId).gte('measured_at', startDate).lte('measured_at', endDate),
      () => supabaseClient.from('mobile_emergency_incidents').select('*').eq('patient_id', patientId).gte('triggered_at', startDate).lte('triggered_at', endDate),
      () => supabaseClient.from('movement_patterns').select('*').eq('patient_id', patientId).gte('date_tracked', startDate.split('T')[0]).lte('date_tracked', endDate.split('T')[0])
    );
  } else {
    baseQueries.push(
      () => Promise.resolve({ data: null }),
      () => Promise.resolve({ data: null }),
      () => Promise.resolve({ data: null })
    );
  }

  // Add AI assessments query if requested
  if (includeAIAssessments) {
    baseQueries.push(
      () => supabaseClient.from('ai_risk_assessments').select('*').eq('patient_id', patientId).gte('assessed_at', startDate).lte('assessed_at', endDate)
    );
  } else {
    baseQueries.push(() => Promise.resolve({ data: null }));
  }

  const [
    { data: patientProfile },
    { data: checkIns },
    { data: mobileVitals },
    { data: emergencyIncidents },
    { data: movementPatterns },
    { data: riskAssessments }
  ] = await batchQueries(baseQueries);

  console.log('FHIR data fetched', {
    patientId,
    checkInsCount: checkIns?.length || 0,
    mobileVitalsCount: mobileVitals?.length || 0,
    emergencyIncidentsCount: emergencyIncidents?.length || 0,
    movementPatternsCount: movementPatterns?.length || 0,
    riskAssessmentsCount: riskAssessments?.length || 0
  });

  // 1. Patient Resource
  if (patientProfile) {
    entries.push({
      fullUrl: `Patient/${patientId}`,
      resource: {
        resourceType: 'Patient',
        id: patientId,
        identifier: [
          {
            system: 'http://wellfitcommunity.org/patient-id',
            value: patientId
          }
        ],
        name: [
          {
            use: 'official',
            family: patientProfile.last_name,
            given: [patientProfile.first_name]
          }
        ],
        telecom: [
          {
            system: 'phone',
            value: patientProfile.phone,
            use: 'mobile'
          },
          {
            system: 'email',
            value: patientProfile.email,
            use: 'home'
          }
        ],
        birthDate: patientProfile.dob,
        address: [
          {
            use: 'home',
            text: patientProfile.address
          }
        ]
      }
    })
  }

  // 2. Web App Check-ins as Observations
  for (const checkIn of checkIns || []) {
    // Heart Rate Observation
    if (checkIn.heart_rate) {
      entries.push({
        fullUrl: `Observation/web-hr-${checkIn.id}`,
        resource: {
          resourceType: 'Observation',
          id: `web-hr-${checkIn.id}`,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8867-4',
                display: 'Heart rate'
              }
            ]
          },
          subject: {
            reference: `Patient/${patientId}`
          },
          effectiveDateTime: checkIn.created_at,
          valueQuantity: {
            value: checkIn.heart_rate,
            unit: 'beats/min',
            system: 'http://unitsofmeasure.org',
            code: '/min'
          },
          device: {
            display: 'WellFit Community Web App - Manual Entry'
          }
        }
      })
    }

    // Pulse Oximetry Observation
    if (checkIn.pulse_oximeter) {
      entries.push({
        fullUrl: `Observation/web-spo2-${checkIn.id}`,
        resource: {
          resourceType: 'Observation',
          id: `web-spo2-${checkIn.id}`,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '2708-6',
                display: 'Oxygen saturation in Arterial blood'
              }
            ]
          },
          subject: {
            reference: `Patient/${patientId}`
          },
          effectiveDateTime: checkIn.created_at,
          valueQuantity: {
            value: checkIn.pulse_oximeter,
            unit: '%',
            system: 'http://unitsofmeasure.org',
            code: '%'
          },
          device: {
            display: 'WellFit Community Web App - Manual Entry'
          }
        }
      })
    }

    // Blood Pressure Observation
    if (checkIn.bp_systolic && checkIn.bp_diastolic) {
      entries.push({
        fullUrl: `Observation/web-bp-${checkIn.id}`,
        resource: {
          resourceType: 'Observation',
          id: `web-bp-${checkIn.id}`,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '85354-9',
                display: 'Blood pressure panel with all children optional'
              }
            ]
          },
          subject: {
            reference: `Patient/${patientId}`
          },
          effectiveDateTime: checkIn.created_at,
          component: [
            {
              code: {
                coding: [
                  {
                    system: 'http://loinc.org',
                    code: '8480-6',
                    display: 'Systolic blood pressure'
                  }
                ]
              },
              valueQuantity: {
                value: checkIn.bp_systolic,
                unit: 'mmHg',
                system: 'http://unitsofmeasure.org',
                code: 'mm[Hg]'
              }
            },
            {
              code: {
                coding: [
                  {
                    system: 'http://loinc.org',
                    code: '8462-4',
                    display: 'Diastolic blood pressure'
                  }
                ]
              },
              valueQuantity: {
                value: checkIn.bp_diastolic,
                unit: 'mmHg',
                system: 'http://unitsofmeasure.org',
                code: 'mm[Hg]'
              }
            }
          ],
          device: {
            display: 'WellFit Community Web App - Manual Entry'
          }
        }
      })
    }

    // Mood and Activity Level as Observations
    if (checkIn.mood) {
      entries.push({
        fullUrl: `Observation/web-mood-${checkIn.id}`,
        resource: {
          resourceType: 'Observation',
          id: `web-mood-${checkIn.id}`,
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
                system: 'http://wellfitcommunity.org/fhir/codes',
                code: 'mood-assessment',
                display: 'Mood Assessment'
              }
            ]
          },
          subject: {
            reference: `Patient/${patientId}`
          },
          effectiveDateTime: checkIn.created_at,
          valueString: checkIn.mood,
          device: {
            display: 'WellFit Community Web App'
          }
        }
      })
    }
  }

  // 3. Mobile App Data (already fetched in batch)
  if (includeMobileData && mobileVitals) {
    for (const vital of mobileVitals) {
      entries.push({
        fullUrl: `Observation/mobile-${vital.measurement_type}-${vital.id}`,
        resource: {
          resourceType: 'Observation',
          id: `mobile-${vital.measurement_type}-${vital.id}`,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: vital.measurement_type === 'heart_rate' ? '8867-4' :
                      vital.measurement_type === 'spo2' ? '2708-6' : '33747-0',
                display: vital.measurement_type === 'heart_rate' ? 'Heart rate' :
                        vital.measurement_type === 'spo2' ? 'Oxygen saturation' : 'General observation'
              }
            ]
          },
          subject: {
            reference: `Patient/${patientId}`
          },
          effectiveDateTime: vital.measured_at,
          valueQuantity: {
            value: vital.value_primary,
            unit: vital.unit,
            system: 'http://unitsofmeasure.org'
          },
          device: {
            display: `Mobile Companion App - ${vital.measurement_method || 'Camera PPG'}`
          },
          extension: [
            {
              url: 'http://wellfitcommunity.org/fhir/confidence-score',
              valueInteger: vital.confidence_score
            },
            {
              url: 'http://wellfitcommunity.org/fhir/measurement-quality',
              valueString: vital.measurement_quality
            }
          ]
        }
      })
    }

    // Emergency Incidents as DiagnosticReports (already fetched)
    for (const incident of emergencyIncidents || []) {
      entries.push({
        fullUrl: `DiagnosticReport/emergency-${incident.id}`,
        resource: {
          resourceType: 'DiagnosticReport',
          id: `emergency-${incident.id}`,
          status: incident.incident_resolved ? 'final' : 'preliminary',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
                  code: 'OTH',
                  display: 'Other'
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: 'http://wellfitcommunity.org/fhir/codes',
                code: 'emergency-incident',
                display: 'Emergency Incident'
              }
            ]
          },
          subject: {
            reference: `Patient/${patientId}`
          },
          effectiveDateTime: incident.triggered_at,
          conclusion: `${incident.incident_type} - Severity: ${incident.severity}${incident.auto_detected ? ' (Auto-detected)' : ' (Manual trigger)'}`,
          conclusionCode: [
            {
              coding: [
                {
                  system: 'http://wellfitcommunity.org/fhir/incident-types',
                  code: incident.incident_type,
                  display: incident.incident_type.replace(/_/g, ' ')
                }
              ]
            }
          ]
        }
      })
    }

    // Location Data as Observations (daily summaries, already fetched)
    for (const pattern of movementPatterns || []) {
      entries.push({
        fullUrl: `Observation/movement-${pattern.id}`,
        resource: {
          resourceType: 'Observation',
          id: `movement-${pattern.id}`,
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
                system: 'http://wellfitcommunity.org/fhir/codes',
                code: 'daily-activity-summary',
                display: 'Daily Activity Summary'
              }
            ]
          },
          subject: {
            reference: `Patient/${patientId}`
          },
          effectiveDate: pattern.date_tracked,
          component: [
            {
              code: {
                coding: [
                  {
                    system: 'http://wellfitcommunity.org/fhir/codes',
                    code: 'total-distance',
                    display: 'Total Distance Traveled'
                  }
                ]
              },
              valueQuantity: {
                value: pattern.total_distance_meters,
                unit: 'meters',
                system: 'http://unitsofmeasure.org',
                code: 'm'
              }
            },
            {
              code: {
                coding: [
                  {
                    system: 'http://wellfitcommunity.org/fhir/codes',
                    code: 'active-time',
                    display: 'Active Time'
                  }
                ]
              },
              valueQuantity: {
                value: pattern.active_time_minutes,
                unit: 'minutes',
                system: 'http://unitsofmeasure.org',
                code: 'min'
              }
            }
          ]
        }
      })
    }
  }

  // 4. AI Risk Assessments (already fetched in batch)
  if (includeAIAssessments && riskAssessments) {
    for (const assessment of riskAssessments) {
      entries.push({
        fullUrl: `RiskAssessment/ai-${assessment.id}`,
        resource: {
          resourceType: 'RiskAssessment',
          id: `ai-${assessment.id}`,
          status: 'final',
          subject: {
            reference: `Patient/${patientId}`
          },
          occurrenceDateTime: assessment.assessed_at,
          prediction: [
            {
              outcome: {
                coding: [
                  {
                    system: 'http://wellfitcommunity.org/fhir/risk-levels',
                    code: assessment.risk_level,
                    display: assessment.risk_level
                  }
                ]
              },
              probabilityDecimal: assessment.risk_score / 100,
              rationale: assessment.risk_factors?.join(', ')
            }
          ],
          note: assessment.recommendations?.map(rec => ({
            text: rec
          }))
        }
      })
    }
  }

  // Build final bundle
  return {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'collection',
    timestamp: new Date().toISOString(),
    total: entries.length,
    entry: entries
  }
}