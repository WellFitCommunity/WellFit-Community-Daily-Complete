import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createUserClient } from '../_shared/supabaseClient.ts'
import { corsFromRequest, handleOptions } from "../_shared/cors.ts"
import { createLogger } from '../_shared/auditLogger.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Device info structure for mobile vitals
interface DeviceInfo {
  device_id?: string;
  device_model?: string;
  device_manufacturer?: string;
  os_version?: string;
  app_version?: string;
}

// Vital signs snapshot for emergency incidents
interface VitalSignsSnapshot {
  heart_rate?: number;
  spo2?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  measured_at?: string;
}

// ❌ REMOVED WILDCARD CORS - Using secure cors() function instead
// const corsHeaders = {
//   // CORS handled by shared module,  // SECURITY RISK REMOVED
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
// }

interface LocationData {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  speed?: number
  heading?: number
  recorded_at: string
  battery_level?: number
}

interface VitalData {
  measurement_type: 'heart_rate' | 'spo2' | 'blood_pressure' | 'activity_level'
  value_primary: number
  value_secondary?: number
  unit: string
  measurement_method?: string
  measurement_quality?: string
  confidence_score?: number
  measured_at: string
  device_info?: DeviceInfo
}

interface GeofenceEvent {
  geofence_zone_id: number
  event_type: 'enter' | 'exit' | 'breach' | 'dwell'
  latitude: number
  longitude: number
  distance_from_center?: number
  duration_seconds?: number
  occurred_at: string
}

interface EmergencyIncident {
  incident_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  auto_detected: boolean
  location_latitude?: number
  location_longitude?: number
  vital_signs?: VitalSignsSnapshot
  description?: string
  triggered_at: string
}

interface SyncRequest {
  device_id: string
  locations?: LocationData[]
  vitals?: VitalData[]
  geofence_events?: GeofenceEvent[]
  emergency_incidents?: EmergencyIncident[]
  device_status?: {
    battery_level?: number
    is_charging?: boolean
    network_type?: string
    last_active_at: string
  }
}

serve(async (req: Request) => {
  const logger = createLogger('mobile-sync', req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client with connection pooling
    const supabaseClient = createUserClient(authHeader)

    // Get user from auth
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { method } = req

    // Resolve tenant once — every mobile_* table is tenant-RLS'd
    // (tenant_id = get_current_tenant_id()); a NULL tenant_id insert is rejected.
    const { data: profileRow } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single()
    const tenantId: string | null = profileRow?.tenant_id ?? null

    if (method === 'POST') {
      const syncData: SyncRequest = await req.json()
      const results = {
        locations_synced: 0,
        vitals_synced: 0,
        geofence_events_synced: 0,
        emergency_incidents_synced: 0,
        device_updated: false,
        errors: [] as string[]
      }

      // Update device status first — mobile_devices keys on user_id (not patient_id)
      // and has no unique constraint on device_id, so upsert would 42P10:
      // check-then-write on (user_id, device_id).
      if (syncData.device_id) {
        const deviceRow = {
          user_id: user.id,
          device_id: syncData.device_id,
          is_active: true,
          last_seen_at: syncData.device_status?.last_active_at ?? new Date().toISOString(),
          tenant_id: tenantId
        }

        const { data: existingDevice } = await supabaseClient
          .from('mobile_devices')
          .select('id')
          .eq('user_id', user.id)
          .eq('device_id', syncData.device_id)
          .maybeSingle()

        const { error: deviceError } = existingDevice
          ? await supabaseClient.from('mobile_devices')
              .update({ is_active: true, last_seen_at: deviceRow.last_seen_at })
              .eq('id', existingDevice.id)
          : await supabaseClient.from('mobile_devices').insert(deviceRow)

        if (deviceError) {
          results.errors.push(`Device update failed: ${deviceError.message}`)
        } else {
          results.device_updated = true
        }
      }

      // Location sync: NOT PROVISIONED. There is no GPS location table live —
      // `patient_locations` is a hospital bed-placement table (department/room/bed),
      // a name-collision trap, NOT a GPS store. Creating a continuous-location
      // table is a product + privacy decision (documented in the intake/labs
      // tracker follow-ups); until then this reports honestly instead of
      // writing GPS points into the bed-board.
      if (syncData.locations && syncData.locations.length > 0) {
        results.errors.push('Location sync not provisioned: no GPS location table exists')
      }

      // Sync vital signs — mobile_vitals live shape:
      // user_id, device_id, vital_type, vital_value, vital_unit, measured_at, source.
      // blood_pressure carries two values → two rows (systolic/diastolic).
      if (syncData.vitals && syncData.vitals.length > 0) {
        const vitalsInserts = syncData.vitals.flatMap(vital => {
          const base = {
            user_id: user.id,
            device_id: syncData.device_id ?? null,
            vital_unit: vital.unit,
            measured_at: vital.measured_at,
            source: 'mobile_app',
            tenant_id: tenantId
          }
          if (vital.measurement_type === 'blood_pressure' && vital.value_secondary != null) {
            return [
              { ...base, vital_type: 'blood_pressure_systolic', vital_value: vital.value_primary },
              { ...base, vital_type: 'blood_pressure_diastolic', vital_value: vital.value_secondary }
            ]
          }
          return [{ ...base, vital_type: vital.measurement_type, vital_value: vital.value_primary }]
        })

        const { error: vitalsError } = await supabaseClient
          .from('mobile_vitals')
          .insert(vitalsInserts)

        if (vitalsError) {
          results.errors.push(`Vitals sync failed: ${vitalsError.message}`)
        } else {
          results.vitals_synced = syncData.vitals.length

          // Trigger AI analysis for new vitals
          await triggerVitalsAnalysis(supabaseClient, user.id, syncData.vitals)
        }
      }

      // Geofence events: storage NOT PROVISIONED (geofence_events table never
      // created — baselined drift). Safety-first: still evaluate the submitted
      // events for breach alerts even though the raw events can't be persisted.
      if (syncData.geofence_events && syncData.geofence_events.length > 0) {
        results.errors.push('Geofence event storage not provisioned: geofence_events table does not exist')
        await checkGeofenceAlerts(supabaseClient, user.id, syncData.geofence_events)
      }

      // Sync emergency incidents — mobile_emergency_incidents live shape:
      // user_id, incident_type, location_lat/lng, status, notes.
      if (syncData.emergency_incidents && syncData.emergency_incidents.length > 0) {
        const incidentInserts = syncData.emergency_incidents.map(incident => ({
          user_id: user.id,
          incident_type: incident.incident_type,
          location_lat: incident.location_latitude ?? null,
          location_lng: incident.location_longitude ?? null,
          status: 'reported',
          notes: incident.description ?? null,
          tenant_id: tenantId
        }))

        const { error: incidentError } = await supabaseClient
          .from('mobile_emergency_incidents')
          .insert(incidentInserts)

        if (incidentError) {
          results.errors.push(`Emergency incidents sync failed: ${incidentError.message}`)
        } else {
          results.emergency_incidents_synced = syncData.emergency_incidents.length

          // Trigger emergency response
          await triggerEmergencyResponse(supabaseClient, user.id, syncData.emergency_incidents)
        }
      }

      // Update sync status — mobile_sync_status live shape is one row per
      // (user_id, device_id) with last_sync_at/sync_status/pending_uploads
      // (no per-data_type rows, no unique constraint → check-then-write).
      if (syncData.device_id) {
        const anySynced =
          results.vitals_synced + results.emergency_incidents_synced > 0 || results.device_updated

        if (anySynced) {
          const statusRow = {
            user_id: user.id,
            device_id: syncData.device_id,
            last_sync_at: new Date().toISOString(),
            sync_status: results.errors.length > 0 ? 'completed_with_errors' : 'completed',
            pending_uploads: 0,
            tenant_id: tenantId
          }

          const { data: existingStatus } = await supabaseClient
            .from('mobile_sync_status')
            .select('id')
            .eq('user_id', user.id)
            .eq('device_id', syncData.device_id)
            .maybeSingle()

          if (existingStatus) {
            await supabaseClient
              .from('mobile_sync_status')
              .update({
                last_sync_at: statusRow.last_sync_at,
                sync_status: statusRow.sync_status,
                pending_uploads: 0
              })
              .eq('id', existingStatus.id)
          } else {
            await supabaseClient.from('mobile_sync_status').insert(statusRow)
          }
        }
      }

      return new Response(
        JSON.stringify(results),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // GET: Retrieve data for mobile app
    if (method === 'GET') {
      const url = new URL(req.url)
      const dataType = url.searchParams.get('type')
      const since = url.searchParams.get('since')

      let data = {}

      // Batch all data fetching operations in parallel for better performance
      const queries = [];

      // Geofence zones: NOT PROVISIONED (geofence_zones table never created).
      // Return an empty list so the app degrades gracefully instead of erroring.
      if (!dataType || dataType === 'geofence_zones') {
        queries.push(Promise.resolve({ data: [] as unknown[] }));
      } else {
        queries.push(Promise.resolve({ data: null }));
      }

      // mobile_emergency_contacts keys on user_id; live columns have is_primary
      // (no is_active / priority_order).
      if (!dataType || dataType === 'emergency_contacts') {
        queries.push(
          supabaseClient
            .from('mobile_emergency_contacts')
            .select('id, contact_name, contact_phone, contact_relationship, is_primary')
            .eq('user_id', user.id)
            .order('is_primary', { ascending: false })
        );
      } else {
        queries.push(Promise.resolve({ data: null }));
      }

      // mobile_vitals keys on user_id
      if (!dataType || dataType === 'recent_vitals') {
        let query = supabaseClient
          .from('mobile_vitals')
          .select('id, device_id, vital_type, vital_value, vital_unit, measured_at, source')
          .eq('user_id', user.id)
          .order('measured_at', { ascending: false })
          .limit(50);

        if (since) {
          query = query.gte('measured_at', since);
        }

        queries.push(query);
      } else {
        queries.push(Promise.resolve({ data: null }));
      }

      // Execute all queries in parallel
      const [zonesResult, contactsResult, vitalsResult] = await Promise.all(queries);

      if (zonesResult.data) data = { ...data, geofence_zones: zonesResult.data };
      if (contactsResult.data) data = { ...data, emergency_contacts: contactsResult.data };
      if (vitalsResult.data) data = { ...data, recent_vitals: vitalsResult.data };

      return new Response(
        JSON.stringify(data),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Mobile sync error', { error: errorMessage })
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Helper function to trigger AI vitals analysis
async function triggerVitalsAnalysis(supabaseClient: SupabaseClient, patientId: string, vitals: VitalData[]) {
  const logger = createLogger('mobile-sync');
  try {
    // Check for abnormal vitals and batch create alerts
    const alerts = [];

    for (const vital of vitals) {
      let isAbnormal = false
      let alertMessage = ''

      if (vital.measurement_type === 'heart_rate') {
        if (vital.value_primary < 50 || vital.value_primary > 120) {
          isAbnormal = true
          alertMessage = `Abnormal heart rate detected: ${vital.value_primary} bpm`
        }
      } else if (vital.measurement_type === 'spo2') {
        if (vital.value_primary < 92) {
          isAbnormal = true
          alertMessage = `Low oxygen saturation detected: ${vital.value_primary}%`
        }
      }

      if (isAbnormal) {
        const critical = vital.value_primary < 50 || vital.value_primary > 150;
        alerts.push({
          patient_id: patientId,
          alert_type: 'vitals_declining',
          severity: critical ? 'critical' : 'medium',
          priority: critical ? 'emergency' : 'urgent',
          title: `Mobile vitals anomaly: ${vital.measurement_type}`,
          description: alertMessage,
          alert_data: {
            source: 'mobile-sync',
            measurement_type: vital.measurement_type,
            value: vital.value_primary,
            probability_score: vital.confidence_score || 85
          }
        });
      }
    }

    // Batch insert all alerts (care_team_alerts — emergency_alerts never existed live)
    if (alerts.length > 0) {
      const { error } = await supabaseClient.from('care_team_alerts').insert(alerts);
      if (error) {
        logger.error('Vitals alert insert failed', { error: error.message, patientId });
      } else {
        logger.phi('Vitals anomaly detected', { patientId, alertCount: alerts.length });
      }
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Vitals analysis error', { error: errorMessage, patientId })
  }
}

// Helper function to check geofence alerts
async function checkGeofenceAlerts(supabaseClient: SupabaseClient, patientId: string, events: GeofenceEvent[]) {
  const logger = createLogger('mobile-sync');
  try {
    const breachEvents = events.filter(e => e.event_type === 'breach' || e.event_type === 'exit')

    if (breachEvents.length > 0) {
      const { error } = await supabaseClient
        .from('care_team_alerts')
        .insert({
          patient_id: patientId,
          alert_type: 'geofence_breach',
          severity: 'high',
          priority: 'urgent',
          title: 'Geofence breach',
          description: 'Patient has left designated safe zone',
          alert_data: { source: 'mobile-sync', breach_count: breachEvents.length }
        })
      if (error) {
        logger.error('Geofence alert insert failed', { error: error.message, patientId });
      } else {
        logger.security('Geofence breach detected', { patientId, breachCount: breachEvents.length });
      }
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Geofence alert error', { error: errorMessage, patientId })
  }
}

// Helper function to trigger emergency response
async function triggerEmergencyResponse(supabaseClient: SupabaseClient, patientId: string, incidents: EmergencyIncident[]) {
  const logger = createLogger('mobile-sync');
  try {
    const criticalIncidents = incidents.filter(i => i.severity === 'critical' || i.severity === 'high')

    if (criticalIncidents.length > 0) {
      const { error } = await supabaseClient
        .from('care_team_alerts')
        .insert({
          patient_id: patientId,
          alert_type: 'emergency_incident',
          severity: 'critical',
          priority: 'emergency',
          title: 'Emergency incident (mobile app)',
          description: 'Emergency incident detected via mobile app',
          alert_data: { source: 'mobile-sync', incident_count: criticalIncidents.length }
        })
      if (error) {
        logger.error('Emergency alert insert failed', { error: error.message, patientId });
      } else {
        logger.security('Critical emergency incident detected', { patientId, incidentCount: criticalIncidents.length });
      }
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Emergency response error', { error: errorMessage, patientId })
  }
}