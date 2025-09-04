import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Environment variables with better validation
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SB_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SB_PUB_KEY = Deno.env.get("SB_PUBLISHABLE_API_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

if (!SUPABASE_URL || !SB_SECRET_KEY) {
  throw new Error("Missing required environment variables: SUPABASE_URL and SB_SECRET_KEY");
}

const admin = createClient(SUPABASE_URL, SB_SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, SB_PUB_KEY);

// Enhanced schema with better validation
const schema = z.object({
  pin: z.string()
    .regex(/^\d{4,8}$/, "PIN must be 4–8 digits")
    .refine((pin) => pin.length >= 4, "PIN must be at least 4 digits")
    .refine((pin) => !/^(.)\1+$/.test(pin), "PIN cannot be all the same digit") // No 1111, 2222, etc.
    .refine((pin) => !/^(1234|2345|3456|4567|5678|6789|0123)/.test(pin), "PIN cannot be sequential"), // No 1234, etc.
  role: z.enum(["admin", "super_admin"]).default("admin")
});

async function getCaller(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { id: null as string | null, roles: [] as string[] };
  }
  
  const token = authHeader.slice(7);
  if (!token) return { id: null, roles: [] };

  try {
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data?.user?.id) return { id: null, roles: [] };
    
    const id = data.user.id;

    // Get user roles with error handling
    const { data: rows, error: roleError } = await admin
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", id);

    if (roleError) {
      console.error("Role fetch error:", roleError);
      return { id, roles: [] };
    }

    const roles = (rows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    return { id, roles };
  } catch (error) {
    console.error("Auth error:", error);
    return { id: null, roles: [] };
  }
}

// Rate limiting helper (simple in-memory for this function)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_REQUESTS = 3; // 3 attempts per window
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const current = rateLimitMap.get(identifier);

  if (!current || now > current.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (current.count >= RATE_LIMIT_REQUESTS) {
    return false;
  }

  current.count++;
  return true;
}

serve(async (req) => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGINS") ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }), 
      { status: 405, headers }
    );
  }

  try {
    // Rate limiting check
    const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";
    
    if (!checkRateLimit(`pin-set:${clientIp}`)) {
      return new Response(
        JSON.stringify({ error: "Too many PIN set attempts. Please try again in 15 minutes." }), 
        { status: 429, headers }
      );
    }

    // Authentication and authorization
    const { id, roles } = await getCaller(req);
    if (!id) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        { status: 401, headers }
      );
    }

    const hasAdminRole = roles.includes("admin") || roles.includes("super_admin");
    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "Admin privileges required" }), 
        { status: 403, headers }
      );
    }

    // Input validation
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return new Response(
        JSON.stringify({ 
          error: firstError.message,
          field: firstError.path.join('.')
        }), 
        { status: 400, headers }
      );
    }

    const { pin, role } = parsed.data;

    // Additional role validation - super_admin can set any role, admin can only set admin
    if (role === "super_admin" && !roles.includes("super_admin")) {
      return new Response(
        JSON.stringify({ error: "Only super_admin can set super_admin PIN" }), 
        { status: 403, headers }
      );
    }

    // Hash the PIN with a higher cost factor for better security
    const pin_hash = await bcrypt.hash(pin, 12); // Higher cost = more secure

    // Upsert the PIN with audit info
    const { error } = await admin
      .from("admin_pins")
      .upsert({ 
        user_id: id, 
        role, 
        pin_hash, 
        updated_at: new Date().toISOString(),
        updated_by_ip: clientIp
      }, {
        onConflict: 'user_id,role' // Handle conflicts properly
      });

    if (error) {
      console.error("PIN upsert error:", error);
      throw new Error("Failed to update PIN");
    }

    // Optional: Log the PIN change for audit purposes
    await admin
      .from("admin_audit_log")
      .insert({
        user_id: id,
        action: "pin_updated",
        target_role: role,
        ip_address: clientIp,
        user_agent: req.headers.get("user-agent"),
        timestamp: new Date().toISOString()
      })
      .catch((err) => console.warn("Audit log failed:", err)); // Don't fail the request if audit fails

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "PIN updated successfully",
        role: role 
      }), 
      { status: 200, headers }
    );

  } catch (error: any) {
    console.error("admin_set_pin error:", error);
    
    // Don't leak internal error details to client
    const userMessage = error.message?.includes("Failed to update PIN") 
      ? "Failed to update PIN. Please try again."
      : "An internal error occurred";

    return new Response(
      JSON.stringify({ error: userMessage }), 
      { status: 500, headers }
    );
  }
});