// Supabase Edge Function: create-telehealth-room
// Creates HIPAA-compliant Daily.co video rooms for telehealth and links them to
// the scheduled appointment so the WellFit patient and the Envision clinician land
// in the SAME room.
//
// Two invocation modes:
//   1. Scheduled (preferred, "Model B"): { appointment_id }
//      - Called at scheduling time (pre-create) AND when the provider starts the visit.
//      - Idempotent: re-invoking returns the existing room, never a duplicate.
//      - Back-links telehealth_appointments.session_id / daily_room_url / daily_room_name
//        so the patient page can hand the session to PatientWaitingRoom.
//   2. Ad-hoc provider visit (no prior appointment): { patient_id, encounter_type }
//      - Provider-initiated visit with no scheduled appointment row.
//
// Room creation is a PRIVILEGED action: only the appointment's provider or a
// tenant/super admin may create a room. Patients never create rooms — they join
// via create-patient-telehealth-token against the session created here.

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("create-telehealth-room");

const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
const DAILY_API_URL = "https://api.daily.co/v1";

if (!DAILY_API_KEY) {
  throw new Error("DAILY_API_KEY not configured. Please add to Supabase secrets.");
}

const sb: SupabaseClient = createClient(SUPABASE_URL, SB_SECRET_KEY, {
  auth: { persistSession: false },
});

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

interface RoomContext {
  appointmentId: string | null;
  patientId: string;
  providerId: string;
  tenantId: string | null;
  encounterType: string;
  appointmentTimeISO: string | null;
  durationMinutes: number;
  existingSessionId: string | null;
  existingEncounterId: string | null;
}

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Caller may create a room only if they are the appointment's provider or an admin.
async function isProviderOrAdmin(providerId: string | null, userId: string): Promise<boolean> {
  if (providerId && providerId === userId) return true;
  const { data } = await sb
    .from("profiles")
    .select("roles:role_id ( name )")
    .eq("user_id", userId)
    .maybeSingle();
  const roles = data?.roles as { name: string } | { name: string }[] | null | undefined;
  const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name;
  return ADMIN_ROLES.has(roleName ?? "");
}

// telehealth_sessions.encounter_id is NOT NULL, so ensure a (planned) encounter exists.
// We standardize the telehealth encounter on `encounters` (the table this function
// authorizes against). NOTE: this codebase also has a near-duplicate `fhir_encounters`
// table — resolving that duality is out of scope here and flagged in the tracker.
async function ensurePlannedEncounter(ctx: RoomContext, userId: string): Promise<string> {
  if (ctx.existingEncounterId) return ctx.existingEncounterId;

  const dateOfService = (ctx.appointmentTimeISO ?? new Date().toISOString()).slice(0, 10);
  // NOTE: `encounters` uses its own controlled vocabularies (verified live via the
  // encounters_*_check constraints): encounter_type must be 'telehealth' (NOT the
  // appointment's outpatient/er/urgent-care, which is the room-config setting and
  // lives on telehealth_sessions.encounter_type); status must be 'scheduled'.
  const { data: encounter, error } = await sb
    .from("encounters")
    .insert({
      patient_id: ctx.patientId,
      provider_id: ctx.providerId,
      tenant_id: ctx.tenantId,
      encounter_type: "telehealth",
      status: "scheduled",
      visit_mode: "telehealth",
      date_of_service: dateOfService,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !encounter) {
    throw new Error(`Failed to create telehealth encounter: ${error?.message ?? "unknown"}`);
  }
  return encounter.id;
}

// Daily room expiry: for a scheduled visit, expire after the appointment ends (+2h
// buffer) — NOT now+24h, which would expire a room booked days in advance.
function computeRoomExpiry(appointmentTimeISO: string | null, durationMinutes: number): number {
  const nowSec = Math.floor(Date.now() / 1000);
  if (!appointmentTimeISO) return nowSec + 86400; // ad-hoc: 24h
  const endMs = new Date(appointmentTimeISO).getTime() + durationMinutes * 60_000;
  const bufferedEndSec = Math.floor(endMs / 1000) + 7200; // +2h grace
  return Math.max(bufferedEndSec, nowSec + 7200); // never less than now+2h
}

async function createDailyRoom(ctx: RoomContext, roomName: string, isEmergency: boolean) {
  const roomConfig = {
    name: roomName,
    privacy: "private" as const,
    properties: {
      enable_chat: true,
      enable_screenshare: true,
      enable_recording: "cloud" as const,
      enable_knocking: !isEmergency, // patient waits in lobby; provider admits
      enable_prejoin_ui: false,
      enable_advanced_audio: true,
      max_participants: isEmergency ? 10 : 2,
      exp: computeRoomExpiry(ctx.appointmentTimeISO, ctx.durationMinutes),
      sfu_switchover: 0.5,
      metadata: {
        appointment_id: ctx.appointmentId,
        patient_id: ctx.patientId,
        provider_id: ctx.providerId,
        encounter_type: ctx.encounterType,
        created_at: new Date().toISOString(),
      },
    },
  };

  const res = await fetch(`${DAILY_API_URL}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DAILY_API_KEY}` },
    body: JSON.stringify(roomConfig),
  });
  if (!res.ok) {
    const errorText = await res.text();
    logger.error("Daily.co room API error", { errorText, status: res.status });
    throw new Error(`Failed to create Daily.co room: ${res.status}`);
  }
  return await res.json();
}

async function createOwnerToken(roomName: string, userName: string): Promise<string> {
  const res = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DAILY_API_KEY}` },
    body: JSON.stringify({
      properties: { room_name: roomName, user_name: userName, is_owner: true, enable_recording: "cloud" },
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    logger.error("Daily.co owner-token API error", { errorText, status: res.status });
    throw new Error("Failed to create provider meeting token");
  }
  const data = await res.json();
  return data.token as string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // 1. Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization header" }, 401, corsHeaders);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await sb.auth.getUser(token);
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);

    // 2. Resolve invocation context (scheduled appointment vs ad-hoc)
    const body = await req.json();
    const appointmentId: string | undefined = body.appointment_id;
    let ctx: RoomContext;

    if (appointmentId) {
      const { data: appt, error: apptError } = await sb
        .from("telehealth_appointments")
        .select("id, patient_id, provider_id, tenant_id, encounter_type, encounter_id, session_id, appointment_time, duration_minutes")
        .eq("id", appointmentId)
        .single();
      if (apptError || !appt) return jsonResponse({ error: "Appointment not found" }, 404, corsHeaders);
      if (!(await isProviderOrAdmin(appt.provider_id, user.id))) {
        return jsonResponse({ error: "Not authorized to start this appointment" }, 403, corsHeaders);
      }
      ctx = {
        appointmentId: appt.id,
        patientId: appt.patient_id,
        providerId: appt.provider_id,
        tenantId: appt.tenant_id,
        encounterType: appt.encounter_type ?? "outpatient",
        appointmentTimeISO: appt.appointment_time,
        durationMinutes: appt.duration_minutes ?? 30,
        existingSessionId: appt.session_id,
        existingEncounterId: appt.encounter_id,
      };
    } else {
      // Ad-hoc provider-initiated visit: { patient_id, encounter_type }
      const { patient_id, encounter_type } = body;
      if (!patient_id) {
        return jsonResponse({ error: "appointment_id or patient_id is required" }, 400, corsHeaders);
      }
      if (!(await isProviderOrAdmin(null, user.id))) {
        return jsonResponse({ error: "Only providers may start a telehealth visit" }, 403, corsHeaders);
      }
      // Resolve tenant from the caller's profile (provider drives an ad-hoc visit).
      const { data: providerProfile } = await sb
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();
      ctx = {
        appointmentId: null,
        patientId: patient_id,
        providerId: user.id,
        tenantId: providerProfile?.tenant_id ?? null,
        encounterType: encounter_type ?? "outpatient",
        appointmentTimeISO: null,
        durationMinutes: 30,
        existingSessionId: null,
        existingEncounterId: null,
      };
    }

    const isEmergency = ctx.encounterType === "er" || ctx.encounterType === "emergency";

    // 3. Idempotency — a room already exists for this appointment: reuse it, mint a
    //    fresh owner token for the caller (provider re-joining a pre-created room).
    if (ctx.existingSessionId) {
      const { data: existing } = await sb
        .from("telehealth_sessions")
        .select("id, room_name, room_url")
        .eq("id", ctx.existingSessionId)
        .maybeSingle();
      if (existing) {
        const ownerToken = await createOwnerToken(existing.room_name, user.email || "Provider");
        return jsonResponse(
          {
            room_url: `${existing.room_url}?t=${ownerToken}`,
            room_name: existing.room_name,
            session_id: existing.id,
            appointment_id: ctx.appointmentId,
            is_emergency: isEmergency,
            reused: true,
          },
          200,
          corsHeaders,
        );
      }
    }

    // 4. Ensure a planned encounter exists (NOT NULL on the session)
    const encounterId = await ensurePlannedEncounter(ctx, user.id);
    if (ctx.appointmentId && !ctx.existingEncounterId) {
      await sb.from("telehealth_appointments").update({ encounter_id: encounterId }).eq("id", ctx.appointmentId);
    }

    // 5. Create the Daily room + owner token
    const roomName = `telehealth-${ctx.appointmentId ?? encounterId}-${Date.now()}`;
    const roomData = await createDailyRoom(ctx, roomName, isEmergency);
    const ownerToken = await createOwnerToken(roomName, user.email || "Provider");

    // 6. Persist the session (all NOT NULL columns populated)
    const { data: session, error: sessionError } = await sb
      .from("telehealth_sessions")
      .insert({
        encounter_id: encounterId,
        patient_id: ctx.patientId,
        provider_id: ctx.providerId,
        tenant_id: ctx.tenantId,
        room_name: roomName,
        room_url: roomData.url,
        daily_room_id: roomData.id,
        session_token: ownerToken,
        // telehealth_sessions.status check allows {active,completed,cancelled,error}
        // (verified live) — 'active' = room created and joinable; set 'completed' on end.
        status: "active",
        encounter_type: ctx.encounterType,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      logger.error("Error storing telehealth session", { error: sessionError?.message, code: sessionError?.code });
      throw new Error(`Failed to persist telehealth session: ${sessionError?.message ?? "unknown"}`);
    }

    // 7. Bidirectional links: encounter <-> session, and appointment -> session (THE BRIDGE)
    await sb.from("encounters").update({ telehealth_session_id: session.id }).eq("id", encounterId);
    if (ctx.appointmentId) {
      await sb
        .from("telehealth_appointments")
        .update({
          session_id: session.id,
          daily_room_url: roomData.url,
          daily_room_name: roomName,
        })
        .eq("id", ctx.appointmentId);
    }

    // 8. PHI access log (HIPAA)
    await sb.from("phi_access_logs").insert({
      user_id: user.id,
      user_role: "provider",
      patient_id: ctx.patientId,
      action: "telehealth_session",
      data_types: ["telehealth_session"],
      resource_type: "encounter",
      resource_id: encounterId,
      ip_address: req.headers.get("x-forwarded-for") || null,
      metadata: {
        appointment_id: ctx.appointmentId,
        encounter_type: ctx.encounterType,
        reason: `Telehealth ${ctx.encounterType} visit`,
      },
    });

    return jsonResponse(
      {
        room_url: `${roomData.url}?t=${ownerToken}`,
        room_name: roomName,
        session_id: session.id,
        appointment_id: ctx.appointmentId,
        is_emergency: isEmergency,
        reused: false,
      },
      200,
      corsHeaders,
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error("Error in create-telehealth-room", { error: errorMessage });
    return jsonResponse({ error: errorMessage || "Internal server error" }, 500, corsHeaders);
  }
});
