// supabase/functions/enrollClient/index.ts
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.28.0";
import { z } from "https://esm.sh/zod@3.21.4";

// ──── ENVIRONMENT VALIDATION ────────────────────────────────────────────────
const SUPABASE_URL              = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

// ──── CLIENTS ────────────────────────────────────────────────────────────────
const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon    = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ──── INPUT SCHEMA ────────────────────────────────────────────────────────────
const EnrollSchema = z.object({
  phone:      z.string().regex(/^\+\d{10,15}$/, "Must be full E.164 number"),
  password:   z.string().min(8, "Password must be at least 8 characters"),
  first_name: z.string().min(1, "First name required"),
  last_name:  z.string().min(1, "Last name required"),
  email:      z.string().email().optional(),
});

// ──── FUNCTION ───────────────────────────────────────────────────────────────
serve(async (req) => {
  const headers = new Headers({
    "Content-Type":               "application/json",
    "Access-Control-Allow-Origin":  req.headers.get("Origin") ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    // ──── AUTHENTICATE & AUTHORIZE ─────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers });
    }
    const jwt = authHeader.split(" ")[1];
    const { data: { user }, error: userErr } = await supabaseAnon.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401, headers });
    }

    // Check for super_admin role
    const { data: roleRecord, error: roleErr } = await supabaseService
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", user.id)
      .eq("roles.name", "super_admin")
      .single();
    if (roleErr || !roleRecord) {
      return new Response(JSON.stringify({ error: "Insufficient privileges" }), { status: 403, headers });
    }

    // ──── VALIDATE INPUT ───────────────────────────────────────────────────────
    const body = await req.json();
    const parseResult = EnrollSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0].message }),
        { status: 400, headers }
      );
    }
    const { phone, password, first_name, last_name, email } = parseResult.data;

    // ──── CREATE AUTH USER ─────────────────────────────────────────────────────
    const { data: newAuthUser, error: authErr } = await supabaseService.auth.admin.createUser({
      phone,
      password,
      user_metadata: { first_name, last_name },
      phone_confirm: true,
    });
    if (authErr || !newAuthUser) {
      return new Response(JSON.stringify({ error: authErr?.message ?? "User creation failed" }), { status: 400, headers });
    }

    // ──── INSERT PROFILE ───────────────────────────────────────────────────────
    const { data: profile, error: profileErr } = await supabaseService
      .from("profiles")
      .insert([{
        user_id:    newAuthUser.id,
        phone,
        first_name,
        last_name,
        email:      email ?? null,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();
    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: profileErr?.message ?? "Profile insertion failed" }), { status: 500, headers });
    }

    // ──── SUCCESS ──────────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ success: true, user_id: newAuthUser.id }),
      { status: 201, headers }
    );

  } catch (err: any) {
    console.error("EnrollClient Error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: err.status || 500, headers }
    );
  }
});
