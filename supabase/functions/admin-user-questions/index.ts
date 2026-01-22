// supabase/functions/admin-user-questions/index.ts
// Handle user questions submission and admin retrieval

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z, type ZodIssue } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("admin-user-questions");

// ---------- ENVIRONMENT VARIABLES ----------
const SB_URL = Deno.env.get("SB_URL") || SUPABASE_URL || "";
const SB_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") || SB_SECRET_KEY || "";

// ---------- VALIDATION SCHEMAS ----------
const SubmitQuestionSchema = z.object({
  question_text: z.string().min(1, "Question text is required").max(1000, "Question too long"),
  category: z.enum(["general", "health", "technical", "account"]).optional().default("general"),
});

const AdminResponseSchema = z.object({
  question_id: z.string().uuid("Invalid question ID"),
  response_text: z.string().min(1, "Response text is required").max(2000, "Response too long"),
});

// ---------- AUTH HELPERS ----------
async function requireUser(req: Request, admin: SupabaseClient) {
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

interface AdminInfo {
  role: "admin" | "super_admin";
  tenantId: string | null;
  isSuperAdmin: boolean;
}

async function requireAdmin(_req: Request, admin: SupabaseClient, userId: string): Promise<AdminInfo> {
  // Check if user has admin role and get tenant context
  const { data, error } = await admin
    .from("profiles")
    .select("role_id, tenant_id, roles:role_id ( name )")
    .eq("user_id", userId)
    .single();

  if (error || !data?.roles?.name || !["admin", "super_admin"].includes(data.roles.name)) {
    throw new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
  }

  // Check if super admin (can see all tenants)
  const { data: superAdminData } = await admin
    .from("super_admin_users")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return {
    role: data.roles.name as "admin" | "super_admin",
    tenantId: data.tenant_id,
    isSuperAdmin: !!superAdminData
  };
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
  // Handle preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers } = corsFromRequest(req);

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
        logger.error("Question insert failed", {
          code: insertError.code,
          message: insertError.message
        });
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
    // SECURITY: Questions are filtered by tenant_id (non-super-admins see only their tenant)
    if (req.method === "GET" && url.pathname.endsWith("/admin/questions")) {
      const user = await requireUser(req, admin);
      const adminInfo = await requireAdmin(req, admin, user.id);

      const status = url.searchParams.get("status") || "pending";
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
      const offset = parseInt(url.searchParams.get("offset") || "0");

      // Build query with tenant filtering
      let query = admin
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
          tenant_id,
          profiles:user_id ( first_name, last_name, phone, tenant_id )
          `,
        )
        .eq("status", status)
        .order("created_at", { ascending: false });

      // SECURITY: Non-super-admins only see questions from their tenant
      if (!adminInfo.isSuperAdmin && adminInfo.tenantId) {
        query = query.eq("tenant_id", adminInfo.tenantId);
      }

      const { data: questions, error } = await query.range(offset, offset + limit - 1);

      if (error) {
        logger.error("Questions fetch failed", {
          code: error.code,
          message: error.message
        });
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
          tenantScoped: !adminInfo.isSuperAdmin,
        },
        200,
        headers,
      );
    }

    // ---------- RESPOND TO QUESTION (PATCH) ----------
    // SECURITY: Verify admin can only respond to questions in their tenant
    if (req.method === "PATCH" && url.pathname.includes("/admin/questions/")) {
      const user = await requireUser(req, admin);
      const adminInfo = await requireAdmin(req, admin, user.id);

      const questionId = url.pathname.split("/").pop();
      if (!questionId) {
        return jsonResponse({ error: "Question ID required" }, 400, headers);
      }

      // SECURITY: Verify question belongs to admin's tenant (unless super-admin)
      if (!adminInfo.isSuperAdmin && adminInfo.tenantId) {
        const { data: question } = await admin
          .from("user_questions")
          .select("tenant_id")
          .eq("id", questionId)
          .single();

        if (question && question.tenant_id !== adminInfo.tenantId) {
          return jsonResponse({ error: "Question not in your organization" }, 403, headers);
        }
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
        logger.error("Question update failed", {
          code: updateError.code,
          message: updateError.message
        });
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
        logger.error("My questions fetch failed", {
          code: error.code,
          message: error.message
        });
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
  } catch (err: unknown) {
    // Handle thrown Response objects (from auth functions)
    if (err instanceof Response) {
      return err;
    }

    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Unexpected error", { message: errorMessage });
    return jsonResponse({ error: "Internal server error", details: errorMessage }, 500, headers);
  }
});
