import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { cors } from "../_shared/cors.ts"

// ❌ REMOVED WILDCARD CORS - Using secure cors() function instead
// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',  // SECURITY RISK REMOVED
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
  device_info?: any
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
  vital_signs?: any
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
  // Handle CORS with secure origin validation
  const origin = req.headers.get('origin');
  const { headers: corsHeaders, allowed } = cors(origin, {
    methods: ['POST', 'OPTIONS']
  });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

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

    // Initialize Supabase client
    const supabaseUrl = (globalThis as any).Deno?.env?.get('SUPABASE_URL') ?? '';
    const supabaseKey = (globalThis as any).Deno?.env?.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      { global: { headers: { Authorization: authHeader } } }
    )

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

      // Update device status first
      if (syncData.device_id) {
        const deviceUpdate = {
          patient_id: user.id,
          device_id: syncData.device_id,
          ...(syncData.device_status || {}),
          updated_at: new Date().toISOString()
        }

        const { error: deviceError } = await supabaseClient
          .from('mobile_devices')
          .upsert(deviceUpdate, { onConflict: 'device_id' })

        if (deviceError) {
          results.errors.push(`Device update failed: ${deviceError.message}`)
        } else {
          results.device_updated = true
        }
      }

      // Sync location data
      if (syncData.locations && syncData.locations.length > 0) {
        const locationInserts = syncData.locations.map(loc => ({
          patient_id: user.id,
          ...loc
        }))

        const { data: locationData, error: locationError } = await supabaseClient
          .from('patient_locations')
          .insert(locationInserts)

        if (locationError) {
          results.errors.push(`Location sync failed: ${locationError.message}`)
        } else {
          results.locations_synced = syncData.locations.length
        }
      }

      // Sync vital signs
      if (syncData.vitals && syncData.vitals.length > 0) {
        const vitalsInserts = syncData.vitals.map(vital => ({
          patient_id: user.id,
          ...vital
        }))

        const { data: vitalsData, error: vitalsError } = await supabaseClient
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

      // Sync geofence events
      if (syncData.geofence_events && syncData.geofence_events.length > 0) {
        const geofenceInserts = syncData.geofence_events.map(event => ({
          patient_id: user.id,
          ...event
        }))

        const { data: geofenceData, error: geofenceError } = await supabaseClient
          .from('geofence_events')
          .insert(geofenceInserts)

        if (geofenceError) {
          results.errors.push(`Geofence events sync failed: ${geofenceError.message}`)
        } else {
          results.geofence_events_synced = syncData.geofence_events.length

          // Check for emergency geofence breaches
          await checkGeofenceAlerts(supabaseClient, user.id, syncData.geofence_events)
        }
      }

      // Sync emergency incidents
      if (syncData.emergency_incidents && syncData.emergency_incidents.length > 0) {
        const incidentInserts = syncData.emergency_incidents.map(incident => ({
          patient_id: user.id,
          ...incident
        }))

        const { data: incidentData, error: incidentError } = await supabaseClient
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

      // Update sync status
      if (syncData.device_id) {
        const syncUpdates = [
          { data_type: 'locations', count: results.locations_synced },
          { data_type: 'vitals', count: results.vitals_synced },
          { data_type: 'geofence_events', count: results.geofence_events_synced },
          { data_type: 'incidents', count: results.emergency_incidents_synced }
        ]

        for (const update of syncUpdates) {
          if (update.count > 0) {
            await supabaseClient
              .from('mobile_sync_status')
              .upsert({
                patient_id: user.id,
                device_id: syncData.device_id,
                data_type: update.data_type,
                last_sync_at: new Date().toISOString(),
                last_successful_upload: new Date().toISOString(),
                pending_upload_count: 0
              }, { onConflict: 'patient_id,device_id,data_type' })
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

      if (!dataType || dataType === 'geofence_zones') {
        // Get active geofence zones
        const { data: zones } = await supabaseClient
          .from('geofence_zones')
          .select('*')
          .eq('patient_id', user.id)
          .eq('is_active', true)

        data = { ...data, geofence_zones: zones || [] }
      }

      if (!dataType || dataType === 'emergency_contacts') {
        // Get emergency contacts
        const { data: contacts } = await supabaseClient
          .from('mobile_emergency_contacts')
          .select('*')
          .eq('patient_id', user.id)
          .eq('is_active', true)
          .order('priority_order')

        data = { ...data, emergency_contacts: contacts || [] }
      }

      if (!dataType || dataType === 'recent_vitals') {
        // Get recent vitals for comparison
        let query = supabaseClient
          .from('mobile_vitals')
          .select('*')
          .eq('patient_id', user.id)
          .order('measured_at', { ascending: false })
          .limit(50)

        if (since) {
          query = query.gte('measured_at', since)
        }

        const { data: vitals } = await query
        data = { ...data, recent_vitals: vitals || [] }
      }

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

  } catch (error) {
    console.error('Mobile sync error:', error)
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
async function triggerVitalsAnalysis(supabaseClient: any, patientId: string, vitals: VitalData[]) {
  try {
    // Check for abnormal vitals and create alerts
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
        await supabaseClient
          .from('emergency_alerts')
          .insert({
            patient_id: patientId,
            alert_type: 'VITAL_ANOMALY',
            severity: vital.value_primary < 50 || vital.value_primary > 150 ? 'CRITICAL' : 'WARNING',
            message: alertMessage,
            probability_score: vital.confidence_score || 85,
            action_required: true
          })
      }
    }
  } catch (error) {
    console.error('Vitals analysis error:', error)
  }
}

// Helper function to check geofence alerts
async function checkGeofenceAlerts(supabaseClient: any, patientId: string, events: GeofenceEvent[]) {
  try {
    const breachEvents = events.filter(e => e.event_type === 'breach' || e.event_type === 'exit')

    if (breachEvents.length > 0) {
      await supabaseClient
        .from('emergency_alerts')
        .insert({
          patient_id: patientId,
          alert_type: 'GEOFENCE_BREACH',
          severity: 'URGENT',
          message: `Patient has left designated safe zone`,
          action_required: true
        })
    }
  } catch (error) {
    console.error('Geofence alert error:', error)
  }
}

// Helper function to trigger emergency response
async function triggerEmergencyResponse(supabaseClient: any, patientId: string, incidents: EmergencyIncident[]) {
  try {
    const criticalIncidents = incidents.filter(i => i.severity === 'critical' || i.severity === 'high')

    if (criticalIncidents.length > 0) {
      await supabaseClient
        .from('emergency_alerts')
        .insert({
          patient_id: patientId,
          alert_type: 'EMERGENCY_CONTACT',
          severity: 'CRITICAL',
          message: `Emergency incident detected via mobile app`,
          action_required: true
        })
    }
  } catch (error) {
    console.error('Emergency response error:', error)
  }
}