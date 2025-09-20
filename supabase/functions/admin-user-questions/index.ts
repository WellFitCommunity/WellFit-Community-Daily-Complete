// supabase/functions/admin-user-questions/index.ts
// Handle user questions submission and admin retrieval

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z, type ZodIssue } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ---------- ENVIRONMENT VARIABLES ----------
const getEnv = (key: string, fallbacks: string[] = []): string => {
  const all = [key, ...fallbacks];
  for (const k of all) {
    const val = Deno.env.get(k);
    if (val?.trim()) return val.trim();
  }
  return "";
};

const SB_URL = getEnv("SB_URL", ["SUPABASE_URL"]);
const SB_SECRET_KEY = getEnv("SB_SECRET_KEY", ["SUPABASE_SERVICE_ROLE_KEY"]);

// CORS Configuration - Explicit allowlist for security
const ALLOWED_ORIGINS = [
  "https://thewellfitcommunity.org",
  "https://wellfitcommunity.live",
  "http://localhost:3100",
  "https://localhost:3100"
];

// ---------- VALIDATION SCHEMAS ----------
const SubmitQuestionSchema = z.object({
  question_text: z.string().min(1, "Question text is required").max(1000, "Question too long"),
  category: z.enum(["general", "health", "technical", "account"]).optional().default("general"),
});

const AdminResponseSchema = z.object({
  question_id: z.string().uuid("Invalid question ID"),
  response_text: z.string().min(1, "Response text is required").max(2000, "Response too long"),
});

// ---------- CORS HELPER ----------
function corsHeaders(origin: string | null): { headers: Record<string, string>; allowed: boolean } {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-admin-token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (ALLOWED_ORIGINS.length === 0) {
    // Security: Never allow wildcard origin in production
    return { headers, allowed: false };
  }

  const normalizedOrigin = origin ? new URL(origin).origin : null;
  const allowed = !!(normalizedOrigin && ALLOWED_ORIGINS.includes(normalizedOrigin));

  if (allowed && normalizedOrigin) {
    headers["Access-Control-Allow-Origin"] = normalizedOrigin;
  }

  return { headers, allowed };
}

// ---------- AUTH HELPERS ----------
async function requireUser(req: Request, admin: any) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Authorization required" }), { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data, error } = await admin.auth.getUser(token);

  if (error || !data?.user) {
    throw new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  }

  return data.user;
}

async function requireAdmin(_req: Request, admin: any, userId: string) {
  // Check if user has admin role
  const { data, error } = await admin
    .from("profiles")
    .select("role_id, roles:role_id ( name )")
    .eq("user_id", userId)
    .single();

  if (error || !data?.roles?.name || !["admin", "super_admin"].includes(data.roles.name)) {
    throw new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
  }

  return data.roles.name as "admin" | "super_admin";
}

// ---------- HELPER FUNCTIONS ----------
function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// ---------- MAIN HANDLER ----------
serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const { headers, allowed } = corsHeaders(origin);

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // Check CORS
  if (!allowed) {
    return jsonResponse({ error: "Origin not allowed" }, 403, headers);
  }

  try {
    // Environment check
    if (!SB_URL || !SB_SECRET_KEY) {
      return jsonResponse({ error: "Server configuration error" }, 500, headers);
    }

    const admin = createClient(SB_URL, SB_SECRET_KEY);
    const url = new URL(req.url);

    // ---------- SUBMIT QUESTION (POST) ----------
    if (req.method === "POST" && url.pathname.endsWith("/submit")) {
      const user = await requireUser(req, admin);

      const rawBody = await req.json().catch(() => null);
      if (!rawBody) {
        return jsonResponse({ error: "Invalid JSON in request body" }, 400, headers);
      }

      const validation = SubmitQuestionSchema.safeParse(rawBody);
      if (!validation.success) {
        const errors = validation.error.issues.map((issue: ZodIssue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        return jsonResponse({ error: "Validation failed", details: errors }, 400, headers);
      }

      const { question_text, category } = validation.data;

      // Insert question
      const { data: questionData, error: insertError } = await admin
        .from("user_questions")
        .insert({
          user_id: user.id,
          user_email: user.email ?? null,
          question_text,
          category,
          status: "pending",
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("[question] insert failed:", insertError);
        return jsonResponse({ error: "Failed to submit question" }, 500, headers);
      }

      return jsonResponse(
        {
          success: true,
          message: "Question submitted successfully. The care team will respond soon.",
          question_id: questionData.id,
        },
        201,
        headers,
      );
    }

    // ---------- GET QUESTIONS FOR ADMIN (GET) ----------
    if (req.method === "GET" && url.pathname.endsWith("/admin/questions")) {
      const user = await requireUser(req, admin);
      await requireAdmin(req, admin, user.id);

      const status = url.searchParams.get("status") || "pending";
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
      const offset = parseInt(url.searchParams.get("offset") || "0");

      const { data: questions, error } = await admin
        .from("user_questions")
        .select(
          `
          id,
          user_id,
          user_email,
          question_text,
          category,
          status,
          response_text,
          responded_by,
          responded_at,
          created_at,
          profiles:user_id ( first_name, last_name, phone )
          `,
        )
        .eq("status", status)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("[questions] fetch failed:", error);
        return jsonResponse({ error: "Failed to fetch questions" }, 500, headers);
      }

      return jsonResponse(
        {
          success: true,
          data: questions,
          pagination: {
            limit,
            offset,
            total: questions.length,
          },
        },
        200,
        headers,
      );
    }

    // ---------- RESPOND TO QUESTION (PATCH) ----------
    if (req.method === "PATCH" && url.pathname.includes("/admin/questions/")) {
      const user = await requireUser(req, admin);
      await requireAdmin(req, admin, user.id);

      const questionId = url.pathname.split("/").pop();
      if (!questionId) {
        return jsonResponse({ error: "Question ID required" }, 400, headers);
      }

      const rawBody = await req.json().catch(() => null);
      if (!rawBody) {
        return jsonResponse({ error: "Invalid JSON in request body" }, 400, headers);
      }

      const validation = AdminResponseSchema.safeParse({
        ...rawBody,
        question_id: questionId,
      });
      if (!validation.success) {
        const errors = validation.error.issues.map((issue: ZodIssue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        return jsonResponse({ error: "Validation failed", details: errors }, 400, headers);
      }

      const { response_text } = validation.data;

      // Update question with response
      const { data: updatedQuestion, error: updateError } = await admin
        .from("user_questions")
        .update({
          response_text,
          status: "answered",
          responded_by: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq("id", questionId)
        .select()
        .single();

      if (updateError) {
        console.error("[question] update failed:", updateError);
        return jsonResponse({ error: "Failed to update question" }, 500, headers);
      }

      return jsonResponse(
        {
          success: true,
          message: "Response submitted successfully",
          data: updatedQuestion,
        },
        200,
        headers,
      );
    }

    // ---------- GET USER'S OWN QUESTIONS (GET) ----------
    if (req.method === "GET" && url.pathname.endsWith("/my-questions")) {
      const user = await requireUser(req, admin);

      const { data: questions, error } = await admin
        .from("user_questions")
        .select("id, question_text, category, status, response_text, responded_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[my-questions] fetch failed:", error);
        return jsonResponse({ error: "Failed to fetch questions" }, 500, headers);
      }

      return jsonResponse(
        {
          success: true,
          data: questions,
        },
        200,
        headers,
      );
    }

    // ---------- DEFAULT: METHOD NOT ALLOWED ----------
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  } catch (error) {
    console.error("[user-questions] unexpected error:", error);

    // Handle thrown Response objects (from auth functions)
    if (error instanceof Response) {
      return error;
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: "Internal server error", details: errorMessage }, 500, headers);
  }
});
