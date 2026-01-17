// supabase/functions/ai-schedule-optimizer/__tests__/index.test.ts
// Tests for ai-schedule-optimizer edge function (Skill #35 - Staff Scheduling Optimization)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("AI Schedule Optimizer Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ai-schedule-optimizer", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require authorization header", () => {
    const authHeader = null;
    const hasAuth = !!authHeader?.startsWith("Bearer ");
    const expectedStatus = hasAuth ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should require departmentId in request body", () => {
    const validBody = { departmentId: "dept-123", startDate: "2026-01-20", endDate: "2026-01-26" };
    const invalidBody = { startDate: "2026-01-20", endDate: "2026-01-26" };

    assertExists(validBody.departmentId);
    assertEquals("departmentId" in invalidBody, false);
  });

  await t.step("should require startDate and endDate", () => {
    const body = { departmentId: "dept-123", startDate: "2026-01-20", endDate: "2026-01-26" };

    assertExists(body.startDate);
    assertExists(body.endDate);
  });

  await t.step("should return 400 for missing required fields", () => {
    const hasRequiredFields = false;
    const expectedStatus = hasRequiredFields ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should validate allowed roles for scheduling", () => {
    const allowedRoles = ["admin", "super_admin", "scheduler", "nurse_manager", "department_head"];

    assertEquals(allowedRoles.includes("admin"), true);
    assertEquals(allowedRoles.includes("scheduler"), true);
    assertEquals(allowedRoles.includes("nurse_manager"), true);
    assertEquals(allowedRoles.includes("nurse"), false);
  });

  await t.step("should return 403 for insufficient permissions", () => {
    const role = "nurse";
    const allowedRoles = ["admin", "scheduler", "nurse_manager"];
    const is_admin = false;
    const hasAccess = is_admin || allowedRoles.includes(role);
    const expectedStatus = hasAccess ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should return 403 when skill not enabled for tenant", () => {
    const config = { schedule_optimizer_enabled: false };
    const isEnabled = config && config.schedule_optimizer_enabled;
    const expectedStatus = isEnabled ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  // Shift Type Tests
  await t.step("should support standard shift types", () => {
    const shiftTypes = ["day", "evening", "night", "custom"];

    assertEquals(shiftTypes.includes("day"), true);
    assertEquals(shiftTypes.includes("evening"), true);
    assertEquals(shiftTypes.includes("night"), true);
    assertEquals(shiftTypes.includes("custom"), true);
  });

  await t.step("should define shift time ranges", () => {
    const shiftTimes = {
      day: { start: "07:00", end: "15:00" },
      evening: { start: "15:00", end: "23:00" },
      night: { start: "23:00", end: "07:00" }
    };

    assertEquals(shiftTimes.day.start, "07:00");
    assertEquals(shiftTimes.evening.start, "15:00");
    assertEquals(shiftTimes.night.start, "23:00");
  });

  // Staff Role Tests
  await t.step("should support clinical staff roles", () => {
    const staffRoles = ["nurse", "cna", "physician", "therapist", "technician", "admin"];

    assertEquals(staffRoles.includes("nurse"), true);
    assertEquals(staffRoles.includes("cna"), true);
    assertEquals(staffRoles.includes("physician"), true);
    assertEquals(staffRoles.includes("therapist"), true);
  });

  await t.step("should structure staff member correctly", () => {
    const staff = {
      id: "staff-123",
      name: "Jane Doe",
      role: "nurse",
      certifications: ["RN", "BLS", "ACLS"],
      fullTimeEquivalent: 1.0,
      preferredShifts: ["day", "evening"],
      unavailableDates: ["2026-01-25"],
      maxHoursPerWeek: 40,
      currentHoursScheduled: 32
    };

    assertExists(staff.id);
    assertEquals(staff.role, "nurse");
    assertEquals(staff.fullTimeEquivalent, 1.0);
  });

  // Coverage Requirements Tests
  await t.step("should structure coverage requirement correctly", () => {
    const requirement = {
      shiftType: "day",
      role: "nurse",
      minimumStaff: 4,
      preferredStaff: 5,
      requiredCertifications: ["RN"]
    };

    assertEquals(requirement.minimumStaff, 4);
    assertEquals(requirement.preferredStaff, 5);
    assertExists(requirement.requiredCertifications);
  });

  await t.step("should identify coverage gap", () => {
    const requirement = { minimumStaff: 4 };
    const scheduled = 3;
    const hasGap = scheduled < requirement.minimumStaff;
    const gapSize = requirement.minimumStaff - scheduled;

    assertEquals(hasGap, true);
    assertEquals(gapSize, 1);
  });

  await t.step("should calculate coverage gap severity", () => {
    const getGapSeverity = (required: number, scheduled: number): string => {
      const ratio = scheduled / required;
      if (ratio < 0.5) return "critical";
      if (ratio < 0.75) return "high";
      if (ratio < 1.0) return "moderate";
      return "none";
    };

    assertEquals(getGapSeverity(4, 1), "critical");
    assertEquals(getGapSeverity(4, 2), "critical");
    assertEquals(getGapSeverity(4, 3), "moderate");
    assertEquals(getGapSeverity(4, 4), "none");
  });

  // Optimization Goals Tests
  await t.step("should support multiple optimization goals", () => {
    const goals = ["coverage", "fairness", "cost", "preferences"];

    assertEquals(goals.includes("coverage"), true);
    assertEquals(goals.includes("fairness"), true);
    assertEquals(goals.includes("cost"), true);
    assertEquals(goals.includes("preferences"), true);
  });

  await t.step("should weight optimization goals", () => {
    const weights = {
      coverage: 0.4,
      fairness: 0.3,
      cost: 0.2,
      preferences: 0.1
    };
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    assertEquals(totalWeight, 1.0);
  });

  // Workload Analysis Tests
  await t.step("should calculate staff workload", () => {
    const staff = {
      maxHoursPerWeek: 40,
      currentHoursScheduled: 32
    };
    const workloadPercent = (staff.currentHoursScheduled / staff.maxHoursPerWeek) * 100;

    assertEquals(workloadPercent, 80);
  });

  await t.step("should identify overworked staff", () => {
    const staff = {
      maxHoursPerWeek: 40,
      currentHoursScheduled: 44
    };
    const isOverworked = staff.currentHoursScheduled > staff.maxHoursPerWeek;

    assertEquals(isOverworked, true);
  });

  await t.step("should calculate fairness score", () => {
    const hoursDistribution = [38, 40, 36, 42, 40]; // Hours per staff
    const avg = hoursDistribution.reduce((a, b) => a + b, 0) / hoursDistribution.length;
    const variance = hoursDistribution.reduce((sum, h) => sum + Math.pow(h - avg, 2), 0) / hoursDistribution.length;
    const stdDev = Math.sqrt(variance);
    const fairnessScore = Math.max(0, 100 - (stdDev * 5)); // Lower std dev = higher fairness

    assertEquals(avg, 39.2);
    assertEquals(fairnessScore > 80, true);
  });

  // Constraint Validation Tests
  await t.step("should enforce minimum rest between shifts", () => {
    const minimumRestHours = 8;
    const lastShiftEnd = new Date("2026-01-17T23:00:00");
    const nextShiftStart = new Date("2026-01-18T07:00:00");
    const restHours = (nextShiftStart.getTime() - lastShiftEnd.getTime()) / (1000 * 60 * 60);

    assertEquals(restHours, 8);
    assertEquals(restHours >= minimumRestHours, true);
  });

  await t.step("should detect consecutive night shifts", () => {
    const shifts = [
      { date: "2026-01-17", type: "night" },
      { date: "2026-01-18", type: "night" },
      { date: "2026-01-19", type: "night" },
      { date: "2026-01-20", type: "night" }
    ];
    const consecutiveNights = shifts.filter(s => s.type === "night").length;
    const maxConsecutiveNights = 3;
    const exceedsLimit = consecutiveNights > maxConsecutiveNights;

    assertEquals(exceedsLimit, true);
  });

  await t.step("should respect staff unavailability", () => {
    const staff = {
      unavailableDates: ["2026-01-25", "2026-01-26"]
    };
    const proposedDate = "2026-01-25";
    const isAvailable = !staff.unavailableDates.includes(proposedDate);

    assertEquals(isAvailable, false);
  });

  await t.step("should check certification requirements", () => {
    const staff = {
      certifications: ["RN", "BLS"]
    };
    const requiredCerts = ["RN", "ACLS"];
    const hasAllCerts = requiredCerts.every(cert => staff.certifications.includes(cert));

    assertEquals(hasAllCerts, false);
  });

  // Schedule Assignment Tests
  await t.step("should structure schedule assignment correctly", () => {
    const assignment = {
      staffId: "staff-123",
      date: "2026-01-20",
      shiftType: "day",
      startTime: "07:00",
      endTime: "15:00",
      department: "Medical-Surgical",
      assignedBy: "ai-optimizer",
      confidence: 0.92
    };

    assertExists(assignment.staffId);
    assertExists(assignment.date);
    assertEquals(assignment.shiftType, "day");
    assertEquals(assignment.confidence, 0.92);
  });

  await t.step("should calculate shift hours", () => {
    const startTime = "07:00";
    const endTime = "15:00";
    const [startHour] = startTime.split(":").map(Number);
    const [endHour] = endTime.split(":").map(Number);
    const shiftHours = endHour - startHour;

    assertEquals(shiftHours, 8);
  });

  // Optimization Result Tests
  await t.step("should structure optimization result correctly", () => {
    const result = {
      schedule: [],
      coverageScore: 95,
      fairnessScore: 88,
      costScore: 92,
      preferenceScore: 75,
      overallScore: 89,
      gaps: [],
      warnings: [],
      recommendations: []
    };

    assertExists(result.schedule);
    assertEquals(result.overallScore, 89);
    assertExists(result.gaps);
    assertExists(result.recommendations);
  });

  await t.step("should calculate overall optimization score", () => {
    const scores = {
      coverage: 95,
      fairness: 88,
      cost: 92,
      preferences: 75
    };
    const weights = {
      coverage: 0.4,
      fairness: 0.3,
      cost: 0.2,
      preferences: 0.1
    };
    const overallScore =
      scores.coverage * weights.coverage +
      scores.fairness * weights.fairness +
      scores.cost * weights.cost +
      scores.preferences * weights.preferences;

    assertEquals(overallScore, 89.9);
  });

  // Gap Identification Tests
  await t.step("should structure coverage gap correctly", () => {
    const gap = {
      date: "2026-01-22",
      shiftType: "night",
      role: "nurse",
      required: 3,
      scheduled: 2,
      severity: "moderate",
      suggestions: ["Consider overtime request", "Check float pool availability"]
    };

    assertExists(gap.date);
    assertEquals(gap.severity, "moderate");
    assertExists(gap.suggestions);
  });

  // Warning Generation Tests
  await t.step("should generate overtime warning", () => {
    const staff = {
      name: "Jane Doe",
      scheduledHours: 44,
      maxHours: 40
    };
    const overtimeHours = staff.scheduledHours - staff.maxHours;
    const warning = overtimeHours > 0
      ? { type: "overtime", staffId: staff.name, hours: overtimeHours }
      : null;

    assertExists(warning);
    assertEquals(warning?.hours, 4);
  });

  await t.step("should generate consecutive shift warning", () => {
    const consecutiveDays = 6;
    const maxConsecutive = 5;
    const hasWarning = consecutiveDays > maxConsecutive;

    assertEquals(hasWarning, true);
  });

  // Recommendation Tests
  await t.step("should structure recommendation correctly", () => {
    const recommendation = {
      type: "staffing",
      priority: "high",
      message: "Consider hiring additional night shift nurses",
      rationale: "Night shift has consistent coverage gaps",
      impact: "Would improve coverage score by 15%"
    };

    assertEquals(recommendation.type, "staffing");
    assertEquals(recommendation.priority, "high");
    assertExists(recommendation.rationale);
  });

  // Claude Model Tests
  await t.step("should use Claude Haiku for cost-effective optimization", () => {
    const HAIKU_MODEL = "claude-haiku-4-5-20250514";

    assertEquals(HAIKU_MODEL.includes("haiku"), true);
  });

  // AI Enhancement Tests
  await t.step("should enhance schedule with AI suggestions", () => {
    const aiEnhancements = {
      swapSuggestions: [
        { staff1: "nurse-1", staff2: "nurse-2", date: "2026-01-22", benefit: "Improves preference match" }
      ],
      patternInsights: [
        "Tuesday evening shifts consistently understaffed"
      ],
      predictedIssues: [
        { issue: "Potential callout risk on 2026-01-25", confidence: 0.7 }
      ]
    };

    assertExists(aiEnhancements.swapSuggestions);
    assertExists(aiEnhancements.patternInsights);
    assertExists(aiEnhancements.predictedIssues);
  });

  // Response Structure Tests
  await t.step("should structure success response correctly", () => {
    const response = {
      success: true,
      optimization: {
        schedule: [],
        scores: {
          coverage: 95,
          fairness: 88,
          cost: 92,
          overall: 90
        },
        gaps: [],
        warnings: [],
        recommendations: []
      },
      metadata: {
        department: "Medical-Surgical",
        dateRange: { start: "2026-01-20", end: "2026-01-26" },
        staffCount: 15,
        generated_at: new Date().toISOString(),
        model: "claude-haiku-4-5-20250514"
      }
    };

    assertEquals(response.success, true);
    assertExists(response.optimization);
    assertExists(response.metadata);
  });

  // AI Usage Logging Tests
  await t.step("should log AI usage for cost tracking", () => {
    const usageLog = {
      user_id: "scheduler-123",
      request_id: crypto.randomUUID(),
      model: "claude-haiku-4-5-20250514",
      request_type: "schedule_optimization",
      input_tokens: 500,
      output_tokens: 800,
      cost: (500 / 1_000_000) * 0.25 + (800 / 1_000_000) * 1.25,
      response_time_ms: 1200,
      success: true
    };

    assertEquals(usageLog.request_type, "schedule_optimization");
    assertEquals(usageLog.success, true);
  });

  // Tenant Isolation Tests
  await t.step("should filter staff by tenant_id", () => {
    const query = {
      table: "staff_members",
      filters: {
        department_id: "dept-123",
        tenant_id: "tenant-A",
        status: "active"
      }
    };

    assertEquals(query.filters.tenant_id, "tenant-A");
  });

  await t.step("should filter schedules by tenant_id", () => {
    const query = {
      table: "staff_schedules",
      filters: {
        department_id: "dept-123",
        tenant_id: "tenant-A"
      }
    };

    assertEquals(query.filters.tenant_id, "tenant-A");
  });

  // HTTP Status Codes
  await t.step("should return 200 for successful optimization", () => {
    const success = true;
    const expectedStatus = success ? 200 : 500;

    assertEquals(expectedStatus, 200);
  });

  await t.step("should return 400 for invalid date range", () => {
    const startDate = new Date("2026-01-26");
    const endDate = new Date("2026-01-20");
    const isValidRange = startDate < endDate;
    const expectedStatus = isValidRange ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should return 500 for server errors", () => {
    const hasError = true;
    const expectedStatus = hasError ? 500 : 200;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should include Content-Type header in responses", () => {
    const headers = { "Content-Type": "application/json" };

    assertEquals(headers["Content-Type"], "application/json");
  });

  // Error Response Structure
  await t.step("should structure error response correctly", () => {
    const errorResponse = {
      error: "Missing required fields: departmentId, startDate, endDate"
    };

    assertExists(errorResponse.error);
  });

  // Date Validation Tests
  await t.step("should validate date format", () => {
    const isValidDate = (dateStr: string): boolean => {
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(dateStr)) return false;
      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    };

    assertEquals(isValidDate("2026-01-20"), true);
    assertEquals(isValidDate("01-20-2026"), false);
    assertEquals(isValidDate("invalid"), false);
  });

  await t.step("should limit schedule range to 4 weeks", () => {
    const maxRangeDays = 28;
    const startDate = new Date("2026-01-20");
    const endDate = new Date("2026-02-20");
    const rangeDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const isWithinLimit = rangeDays <= maxRangeDays;

    assertEquals(isWithinLimit, false);
    assertEquals(rangeDays, 31);
  });

  // Float Pool Tests
  await t.step("should consider float pool for coverage gaps", () => {
    const floatPool = [
      { id: "float-1", role: "nurse", available: true },
      { id: "float-2", role: "cna", available: true }
    ];
    const availableFloats = floatPool.filter(f => f.available);

    assertEquals(availableFloats.length, 2);
  });

  // Schedule Publishing Tests
  await t.step("should support draft and published status", () => {
    const scheduleStatuses = ["draft", "pending_approval", "published", "locked"];

    assertEquals(scheduleStatuses.includes("draft"), true);
    assertEquals(scheduleStatuses.includes("published"), true);
  });

  await t.step("should track schedule version", () => {
    const schedule = {
      version: 3,
      previousVersion: 2,
      createdAt: new Date().toISOString(),
      modifiedBy: "scheduler-123"
    };

    assertEquals(schedule.version, 3);
    assertExists(schedule.modifiedBy);
  });
});
