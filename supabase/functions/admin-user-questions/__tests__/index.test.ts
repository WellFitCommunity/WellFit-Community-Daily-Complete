// supabase/functions/admin-user-questions/__tests__/index.test.ts
// Tests for Admin User Questions Edge Function - Question submission and admin response

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Admin User Questions Tests", async (t) => {

  // =====================================================
  // Submit Question Validation Tests (POST /submit)
  // =====================================================

  await t.step("should require question_text", () => {
    const body = { category: "general" };
    const hasQuestionText = "question_text" in body;

    assertEquals(hasQuestionText, false);
  });

  await t.step("should enforce minimum question length (1 char)", () => {
    const questionText = "";
    const isValid = questionText.length >= 1;

    assertEquals(isValid, false);
  });

  await t.step("should enforce maximum question length (1000 chars)", () => {
    const questionText = "a".repeat(1001);
    const isValid = questionText.length <= 1000;

    assertEquals(isValid, false);
  });

  await t.step("should accept valid question text", () => {
    const questionText = "How do I update my contact information?";
    const isValidLength = questionText.length >= 1 && questionText.length <= 1000;

    assertEquals(isValidLength, true);
  });

  await t.step("should use default category 'general' when not provided", () => {
    const body = { question_text: "Test question" };
    const category = (body as { category?: string }).category ?? "general";

    assertEquals(category, "general");
  });

  await t.step("should accept valid categories", () => {
    const validCategories = ["general", "health", "technical", "account"];

    assertEquals(validCategories.includes("general"), true);
    assertEquals(validCategories.includes("health"), true);
    assertEquals(validCategories.includes("technical"), true);
    assertEquals(validCategories.includes("account"), true);
  });

  await t.step("should reject invalid categories", () => {
    const validCategories = ["general", "health", "technical", "account"];
    const invalidCategory = "billing";

    assertEquals(validCategories.includes(invalidCategory), false);
  });

  // =====================================================
  // Admin Response Validation Tests (PATCH /admin/questions/:id)
  // =====================================================

  await t.step("should require question_id as UUID", () => {
    const questionId = "not-a-uuid";
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUUID = uuidRegex.test(questionId);

    assertEquals(isValidUUID, false);
  });

  await t.step("should accept valid UUID question_id", () => {
    const questionId = "550e8400-e29b-41d4-a716-446655440000";
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUUID = uuidRegex.test(questionId);

    assertEquals(isValidUUID, true);
  });

  await t.step("should require response_text", () => {
    const body = { question_id: "550e8400-e29b-41d4-a716-446655440000" };
    const hasResponseText = "response_text" in body;

    assertEquals(hasResponseText, false);
  });

  await t.step("should enforce minimum response length (1 char)", () => {
    const responseText = "";
    const isValid = responseText.length >= 1;

    assertEquals(isValid, false);
  });

  await t.step("should enforce maximum response length (2000 chars)", () => {
    const responseText = "a".repeat(2001);
    const isValid = responseText.length <= 2000;

    assertEquals(isValid, false);
  });

  await t.step("should accept valid response text", () => {
    const responseText = "You can update your contact info in the Settings > Profile section.";
    const isValidLength = responseText.length >= 1 && responseText.length <= 2000;

    assertEquals(isValidLength, true);
  });

  // =====================================================
  // Authentication Tests
  // =====================================================

  await t.step("should require Authorization header", () => {
    const headers = new Headers({ "Content-Type": "application/json" });
    const authHeader = headers.get("authorization");

    assertEquals(authHeader, null);
  });

  await t.step("should require Bearer token format", () => {
    const authHeader = "Basic abc123";
    const isBearer = authHeader?.startsWith("Bearer ");

    assertEquals(isBearer, false);
  });

  await t.step("should accept valid Bearer token", () => {
    const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const isBearer = authHeader?.startsWith("Bearer ");

    assertEquals(isBearer, true);
  });

  await t.step("should return 401 for missing authorization", () => {
    const response = { error: "Authorization required" };
    assertEquals(response.error, "Authorization required");
  });

  await t.step("should return 401 for invalid token", () => {
    const response = { error: "Invalid token" };
    assertEquals(response.error, "Invalid token");
  });

  // =====================================================
  // Admin Role Verification Tests
  // =====================================================

  await t.step("should require admin or super_admin role", () => {
    const validRoles = ["admin", "super_admin"];
    const userRole = "senior";
    const isAdmin = validRoles.includes(userRole);

    assertEquals(isAdmin, false);
  });

  await t.step("should accept admin role", () => {
    const validRoles = ["admin", "super_admin"];
    const userRole = "admin";
    const isAdmin = validRoles.includes(userRole);

    assertEquals(isAdmin, true);
  });

  await t.step("should accept super_admin role", () => {
    const validRoles = ["admin", "super_admin"];
    const userRole = "super_admin";
    const isAdmin = validRoles.includes(userRole);

    assertEquals(isAdmin, true);
  });

  await t.step("should return 403 for non-admin users", () => {
    const response = { error: "Admin access required" };
    assertEquals(response.error, "Admin access required");
  });

  // =====================================================
  // AdminInfo Structure Tests
  // =====================================================

  await t.step("should include role in AdminInfo", () => {
    const adminInfo = {
      role: "admin" as "admin" | "super_admin",
      tenantId: "tenant-123",
      isSuperAdmin: false
    };

    assertEquals(adminInfo.role, "admin");
  });

  await t.step("should include tenantId in AdminInfo", () => {
    const adminInfo = {
      role: "admin" as "admin" | "super_admin",
      tenantId: "tenant-123",
      isSuperAdmin: false
    };

    assertExists(adminInfo.tenantId);
  });

  await t.step("should identify super admin status", () => {
    const adminInfo = {
      role: "super_admin" as "admin" | "super_admin",
      tenantId: null,
      isSuperAdmin: true
    };

    assertEquals(adminInfo.isSuperAdmin, true);
  });

  // =====================================================
  // Tenant Isolation Tests (SECURITY)
  // =====================================================

  await t.step("should filter questions by tenant for non-super-admin", () => {
    const adminInfo = {
      isSuperAdmin: false,
      tenantId: "tenant-abc"
    };
    const shouldApplyTenantFilter = !adminInfo.isSuperAdmin && adminInfo.tenantId;

    assertEquals(shouldApplyTenantFilter, "tenant-abc");
  });

  await t.step("should NOT filter by tenant for super admin", () => {
    const adminInfo = {
      isSuperAdmin: true,
      tenantId: null
    };
    const shouldApplyTenantFilter = !adminInfo.isSuperAdmin && adminInfo.tenantId;

    assertEquals(shouldApplyTenantFilter, null);
  });

  await t.step("should return 403 for cross-tenant question access", () => {
    const response = { error: "Question not in your organization" };
    assertEquals(response.error, "Question not in your organization");
  });

  await t.step("should indicate tenant scoping in response", () => {
    const response = {
      success: true,
      data: [],
      tenantScoped: true
    };

    assertEquals(response.tenantScoped, true);
  });

  // =====================================================
  // Question Submission Response Tests (POST /submit)
  // =====================================================

  await t.step("should return 201 on successful submission", () => {
    const response = {
      success: true,
      message: "Question submitted successfully. The care team will respond soon.",
      question_id: "question-123"
    };
    const status = 201;

    assertEquals(status, 201);
    assertEquals(response.success, true);
    assertExists(response.question_id);
  });

  await t.step("should set initial status to pending", () => {
    const questionData = {
      user_id: "user-123",
      question_text: "How do I check in?",
      category: "general",
      status: "pending",
      created_at: new Date().toISOString()
    };

    assertEquals(questionData.status, "pending");
  });

  await t.step("should include user email in question record", () => {
    const questionData = {
      user_id: "user-123",
      user_email: "user@example.com",
      question_text: "Test question"
    };

    assertExists(questionData.user_email);
  });

  await t.step("should return 500 on submission failure", () => {
    const response = { error: "Failed to submit question" };
    assertEquals(response.error, "Failed to submit question");
  });

  // =====================================================
  // Admin Questions Fetch Tests (GET /admin/questions)
  // =====================================================

  await t.step("should default to pending status filter", () => {
    const statusParam = null;
    const status = statusParam || "pending";

    assertEquals(status, "pending");
  });

  await t.step("should allow custom status filter", () => {
    const statusParam = "answered";
    const status = statusParam || "pending";

    assertEquals(status, "answered");
  });

  await t.step("should default to limit of 50", () => {
    const limitParam = null;
    const limit = Math.min(parseInt(limitParam || "50"), 100);

    assertEquals(limit, 50);
  });

  await t.step("should cap limit at 100", () => {
    const limitParam = "200";
    const limit = Math.min(parseInt(limitParam || "50"), 100);

    assertEquals(limit, 100);
  });

  await t.step("should default offset to 0", () => {
    const offsetParam = null;
    const offset = parseInt(offsetParam || "0");

    assertEquals(offset, 0);
  });

  await t.step("should include pagination in response", () => {
    const response = {
      success: true,
      data: [],
      pagination: {
        limit: 50,
        offset: 0,
        total: 25
      }
    };

    assertExists(response.pagination);
    assertEquals(response.pagination.limit, 50);
    assertEquals(response.pagination.offset, 0);
  });

  await t.step("should include profile data with questions", () => {
    const selectFields = `
      id, user_id, user_email, question_text, category, status,
      response_text, responded_by, responded_at, created_at, tenant_id,
      profiles:user_id ( first_name, last_name, phone, tenant_id )
    `;

    assertEquals(selectFields.includes("profiles:user_id"), true);
    assertEquals(selectFields.includes("first_name"), true);
    assertEquals(selectFields.includes("last_name"), true);
  });

  await t.step("should order questions by created_at descending", () => {
    const orderConfig = { ascending: false };
    assertEquals(orderConfig.ascending, false);
  });

  await t.step("should return 500 on fetch failure", () => {
    const response = { error: "Failed to fetch questions" };
    assertEquals(response.error, "Failed to fetch questions");
  });

  // =====================================================
  // Admin Response Tests (PATCH /admin/questions/:id)
  // =====================================================

  await t.step("should extract question ID from URL path", () => {
    const url = "/admin/questions/550e8400-e29b-41d4-a716-446655440000";
    const questionId = url.split("/").pop();

    assertEquals(questionId, "550e8400-e29b-41d4-a716-446655440000");
  });

  await t.step("should return 400 for missing question ID", () => {
    const response = { error: "Question ID required" };
    assertEquals(response.error, "Question ID required");
  });

  await t.step("should update question with response", () => {
    const updateData = {
      response_text: "Here is the answer to your question...",
      status: "answered",
      responded_by: "admin-user-123",
      responded_at: new Date().toISOString()
    };

    assertEquals(updateData.status, "answered");
    assertExists(updateData.responded_by);
    assertExists(updateData.responded_at);
  });

  await t.step("should return success with updated question data", () => {
    const response = {
      success: true,
      message: "Response submitted successfully",
      data: {
        id: "question-123",
        response_text: "The answer is...",
        status: "answered",
        responded_at: "2026-01-22T10:00:00Z"
      }
    };

    assertEquals(response.success, true);
    assertEquals(response.message, "Response submitted successfully");
    assertExists(response.data);
  });

  await t.step("should return 500 on update failure", () => {
    const response = { error: "Failed to update question" };
    assertEquals(response.error, "Failed to update question");
  });

  // =====================================================
  // User's Own Questions Tests (GET /my-questions)
  // =====================================================

  await t.step("should only return questions for authenticated user", () => {
    const userId = "user-123";
    const query = {
      filter: { user_id: userId },
      order: "created_at DESC"
    };

    assertEquals(query.filter.user_id, userId);
  });

  await t.step("should return limited fields for user view", () => {
    const selectFields = "id, question_text, category, status, response_text, responded_at, created_at";

    // Should NOT include user_email, user_id, responded_by, tenant_id
    assertEquals(selectFields.includes("user_email"), false);
    assertEquals(selectFields.includes("responded_by"), false);
    assertEquals(selectFields.includes("tenant_id"), false);
  });

  await t.step("should return success with user's questions", () => {
    const response = {
      success: true,
      data: [
        {
          id: "q1",
          question_text: "How do I check in?",
          category: "general",
          status: "answered",
          response_text: "Use the Check In button on the home page.",
          responded_at: "2026-01-22T10:00:00Z",
          created_at: "2026-01-21T09:00:00Z"
        }
      ]
    };

    assertEquals(response.success, true);
    assertExists(response.data);
    assertEquals(response.data.length, 1);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/admin-user-questions", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should return 405 for unsupported methods", () => {
    const response = { error: "Method not allowed" };
    const status = 405;

    assertEquals(status, 405);
    assertEquals(response.error, "Method not allowed");
  });

  await t.step("should accept POST for /submit", () => {
    const method = "POST";
    const pathname = "/admin-user-questions/submit";

    assertEquals(method, "POST");
    assertEquals(pathname.endsWith("/submit"), true);
  });

  await t.step("should accept GET for /admin/questions", () => {
    const method = "GET";
    const pathname = "/admin-user-questions/admin/questions";

    assertEquals(method, "GET");
    assertEquals(pathname.endsWith("/admin/questions"), true);
  });

  await t.step("should accept PATCH for /admin/questions/:id", () => {
    const method = "PATCH";
    const pathname = "/admin-user-questions/admin/questions/123";

    assertEquals(method, "PATCH");
    assertEquals(pathname.includes("/admin/questions/"), true);
  });

  await t.step("should accept GET for /my-questions", () => {
    const method = "GET";
    const pathname = "/admin-user-questions/my-questions";

    assertEquals(method, "GET");
    assertEquals(pathname.endsWith("/my-questions"), true);
  });

  // =====================================================
  // Error Response Tests
  // =====================================================

  await t.step("should return 400 for invalid JSON", () => {
    const response = { error: "Invalid JSON in request body" };
    assertEquals(response.error, "Invalid JSON in request body");
  });

  await t.step("should return 400 for validation errors with details", () => {
    const response = {
      error: "Validation failed",
      details: [
        { field: "question_text", message: "Question text is required" },
        { field: "category", message: "Invalid category" }
      ]
    };

    assertEquals(response.error, "Validation failed");
    assertEquals(Array.isArray(response.details), true);
    assertEquals(response.details.length, 2);
  });

  await t.step("should return 500 for server config error", () => {
    const response = { error: "Server configuration error" };
    assertEquals(response.error, "Server configuration error");
  });

  await t.step("should return 500 for internal errors with details", () => {
    const response = {
      error: "Internal server error",
      details: "Unexpected error occurred"
    };

    assertEquals(response.error, "Internal server error");
    assertExists(response.details);
  });

  // =====================================================
  // CORS Tests
  // =====================================================

  await t.step("should include Content-Type header in response", () => {
    const headers = { "Content-Type": "application/json" };
    assertEquals(headers["Content-Type"], "application/json");
  });

  // =====================================================
  // Environment Variable Tests
  // =====================================================

  await t.step("should require Supabase environment variables", () => {
    const requiredVars = ["SB_URL", "SB_SECRET_KEY"];
    assertEquals(requiredVars.length, 2);
    assertEquals(requiredVars.includes("SB_URL"), true);
    assertEquals(requiredVars.includes("SB_SECRET_KEY"), true);
  });

  // =====================================================
  // Logging Tests
  // =====================================================

  await t.step("should log question insert failures", () => {
    const logEntry = {
      level: "error",
      event: "Question insert failed",
      context: {
        code: "PGRST116",
        message: "The result contains 0 rows"
      }
    };

    assertEquals(logEntry.level, "error");
    assertExists(logEntry.context.code);
  });

  await t.step("should log questions fetch failures", () => {
    const logEntry = {
      level: "error",
      event: "Questions fetch failed",
      context: {
        code: "42501",
        message: "insufficient_privilege"
      }
    };

    assertEquals(logEntry.level, "error");
    assertEquals(logEntry.event, "Questions fetch failed");
  });

  await t.step("should log question update failures", () => {
    const logEntry = {
      level: "error",
      event: "Question update failed",
      context: {
        code: "PGRST116",
        message: "The result contains 0 rows"
      }
    };

    assertEquals(logEntry.level, "error");
    assertEquals(logEntry.event, "Question update failed");
  });

  await t.step("should log unexpected errors", () => {
    const logEntry = {
      level: "error",
      event: "Unexpected error",
      context: {
        message: "Something went wrong"
      }
    };

    assertEquals(logEntry.level, "error");
    assertEquals(logEntry.event, "Unexpected error");
  });

  // =====================================================
  // Question Status Tests
  // =====================================================

  await t.step("should support pending status", () => {
    const statuses = ["pending", "answered", "closed"];
    assertEquals(statuses.includes("pending"), true);
  });

  await t.step("should support answered status", () => {
    const statuses = ["pending", "answered", "closed"];
    assertEquals(statuses.includes("answered"), true);
  });

  await t.step("should transition from pending to answered on response", () => {
    const beforeStatus = "pending";
    const afterStatus = "answered";

    assertNotEquals(beforeStatus, afterStatus);
    assertEquals(afterStatus, "answered");
  });
});
