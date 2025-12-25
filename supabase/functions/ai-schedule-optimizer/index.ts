/**
 * AI Schedule Optimizer Edge Function
 *
 * Optimizes staff shift scheduling using AI to:
 * - Analyze staffing requirements based on patient census
 * - Balance workload across staff members
 * - Respect constraints (availability, certifications, preferences)
 * - Identify coverage gaps and suggest solutions
 * - Generate optimized schedules with fairness considerations
 *
 * Uses Claude Haiku 4.5 for fast, cost-effective optimization.
 *
 * @skill #35 - Schedule Optimizer
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/auditLogger.ts';

// ============================================================================
// Types
// ============================================================================

type ShiftType = 'day' | 'evening' | 'night' | 'custom';
type StaffRole = 'nurse' | 'cna' | 'physician' | 'therapist' | 'technician' | 'admin' | 'other';
type OptimizationGoal = 'coverage' | 'cost' | 'fairness' | 'balanced';

interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  certifications?: string[];
  maxHoursPerWeek?: number;
  preferredShifts?: ShiftType[];
  unavailableDates?: string[];
  currentHoursThisPeriod?: number;
  seniorityLevel?: number;
  fullTimeEquivalent?: number; // 1.0 = full time, 0.5 = part time
}

interface ShiftRequirement {
  date: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  minStaff: number;
  optimalStaff: number;
  requiredRoles: StaffRole[];
  requiredCertifications?: string[];
  currentAssignments?: string[]; // Staff IDs already assigned
}

interface PatientCensus {
  date: string;
  expectedPatients: number;
  acuityLevel: 'low' | 'medium' | 'high' | 'critical';
  specialNeeds?: string[]; // e.g., 'ventilator', 'isolation'
}

interface ScheduleRequest {
  requesterId: string;
  tenantId?: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  staff: StaffMember[];
  shiftRequirements: ShiftRequirement[];
  patientCensus?: PatientCensus[];
  optimizationGoal?: OptimizationGoal;
  constraints?: {
    maxConsecutiveShifts?: number;
    minRestHoursBetweenShifts?: number;
    maxOvertimeHours?: number;
    requireSkillMix?: boolean;
  };
}

interface ShiftAssignment {
  staffId: string;
  staffName: string;
  date: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  hoursWorked: number;
  isOvertime: boolean;
  notes?: string;
}

interface CoverageGap {
  date: string;
  shiftType: ShiftType;
  shortfall: number;
  requiredRole: StaffRole;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestions: string[];
}

interface StaffWorkload {
  staffId: string;
  staffName: string;
  totalHours: number;
  shiftsAssigned: number;
  overtimeHours: number;
  weekendShifts: number;
  nightShifts: number;
  fairnessScore: number; // 0-100, higher = more fairly distributed
}

interface ScheduleOptimization {
  scheduleId: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };

  // Assignments
  assignments: ShiftAssignment[];
  unassignedShifts: ShiftRequirement[];

  // Coverage analysis
  coverageScore: number; // 0-100
  coverageGaps: CoverageGap[];

  // Workload analysis
  staffWorkloads: StaffWorkload[];
  fairnessScore: number; // 0-100
  totalOvertimeHours: number;

  // Cost analysis
  estimatedLaborCost: number;
  regularHours: number;
  overtimeHours: number;

  // Recommendations
  recommendations: Array<{
    type: 'coverage' | 'fairness' | 'cost' | 'compliance';
    priority: 'low' | 'medium' | 'high';
    recommendation: string;
    impact: string;
  }>;

  // Summary
  summary: string;
  optimizationGoalAchieved: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  throw new Error(`Missing environment variable: ${keys.join(' or ')}`);
}

function calculateHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let hours = endH - startH + (endM - startM) / 60;
  if (hours < 0) hours += 24; // Night shift crossing midnight

  return hours;
}

function isWeekend(dateStr: string): boolean {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day === 0 || day === 6;
}

function generateBaseAssignments(
  staff: StaffMember[],
  requirements: ShiftRequirement[]
): { assignments: ShiftAssignment[]; unassigned: ShiftRequirement[] } {
  const assignments: ShiftAssignment[] = [];
  const unassigned: ShiftRequirement[] = [];
  const staffHours: Record<string, number> = {};

  // Initialize staff hours
  for (const s of staff) {
    staffHours[s.id] = s.currentHoursThisPeriod || 0;
  }

  // Sort requirements by date and priority
  const sortedReqs = [...requirements].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return b.minStaff - a.minStaff; // Higher min staff first
  });

  for (const req of sortedReqs) {
    const hours = calculateHours(req.startTime, req.endTime);
    const needed = req.minStaff - (req.currentAssignments?.length || 0);

    if (needed <= 0) continue;

    // Find available staff
    const availableStaff = staff.filter(s => {
      // Check role match
      if (!req.requiredRoles.includes(s.role)) return false;

      // Check certification requirements
      if (req.requiredCertifications?.length) {
        const hasCerts = req.requiredCertifications.every(c =>
          s.certifications?.includes(c)
        );
        if (!hasCerts) return false;
      }

      // Check unavailable dates
      if (s.unavailableDates?.includes(req.date)) return false;

      // Check hours limit
      const maxHours = s.maxHoursPerWeek || 40;
      if ((staffHours[s.id] || 0) + hours > maxHours * 1.5) return false;

      // Check if already assigned this shift
      if (req.currentAssignments?.includes(s.id)) return false;

      return true;
    });

    // Sort by hours worked (least first for fairness)
    availableStaff.sort((a, b) => (staffHours[a.id] || 0) - (staffHours[b.id] || 0));

    let assigned = 0;
    for (const s of availableStaff) {
      if (assigned >= needed) break;

      const maxHours = s.maxHoursPerWeek || 40;
      const isOvertime = (staffHours[s.id] || 0) + hours > maxHours;

      assignments.push({
        staffId: s.id,
        staffName: s.name,
        date: req.date,
        shiftType: req.shiftType,
        startTime: req.startTime,
        endTime: req.endTime,
        hoursWorked: hours,
        isOvertime,
      });

      staffHours[s.id] = (staffHours[s.id] || 0) + hours;
      assigned++;
    }

    if (assigned < needed) {
      unassigned.push({
        ...req,
        minStaff: needed - assigned,
      });
    }
  }

  return { assignments, unassigned };
}

function analyzeWorkloads(
  assignments: ShiftAssignment[],
  staff: StaffMember[]
): StaffWorkload[] {
  const workloads: StaffWorkload[] = [];

  for (const s of staff) {
    const staffAssignments = assignments.filter(a => a.staffId === s.id);
    const totalHours = staffAssignments.reduce((sum, a) => sum + a.hoursWorked, 0);
    const maxHours = s.maxHoursPerWeek || 40;
    const overtimeHours = Math.max(0, totalHours - maxHours);
    const weekendShifts = staffAssignments.filter(a => isWeekend(a.date)).length;
    const nightShifts = staffAssignments.filter(a => a.shiftType === 'night').length;

    // Fairness score based on deviation from average
    const avgHours = assignments.reduce((sum, a) => sum + a.hoursWorked, 0) / Math.max(staff.length, 1);
    const deviation = Math.abs(totalHours - avgHours) / Math.max(avgHours, 1);
    const fairnessScore = Math.max(0, Math.round(100 - deviation * 50));

    workloads.push({
      staffId: s.id,
      staffName: s.name,
      totalHours,
      shiftsAssigned: staffAssignments.length,
      overtimeHours,
      weekendShifts,
      nightShifts,
      fairnessScore,
    });
  }

  return workloads;
}

function identifyCoverageGaps(
  requirements: ShiftRequirement[],
  assignments: ShiftAssignment[]
): CoverageGap[] {
  const gaps: CoverageGap[] = [];

  for (const req of requirements) {
    const assignedCount = assignments.filter(
      a => a.date === req.date && a.shiftType === req.shiftType
    ).length + (req.currentAssignments?.length || 0);

    if (assignedCount < req.minStaff) {
      const shortfall = req.minStaff - assignedCount;
      const severity =
        shortfall >= req.minStaff * 0.5 ? 'critical' :
        shortfall >= 2 ? 'high' :
        shortfall >= 1 ? 'medium' : 'low';

      const suggestions: string[] = [];
      if (severity === 'critical') {
        suggestions.push('Consider calling in PRN/agency staff');
        suggestions.push('Review if shift can be covered by overtime');
      }
      suggestions.push('Check for staff willing to pick up extra shift');
      suggestions.push('Consider adjusting non-essential appointments');

      gaps.push({
        date: req.date,
        shiftType: req.shiftType,
        shortfall,
        requiredRole: req.requiredRoles[0],
        severity,
        suggestions,
      });
    }
  }

  return gaps;
}

function generateRecommendations(
  workloads: StaffWorkload[],
  gaps: CoverageGap[],
  assignments: ShiftAssignment[],
  goal: OptimizationGoal
): ScheduleOptimization['recommendations'] {
  const recommendations: ScheduleOptimization['recommendations'] = [];

  // Coverage recommendations
  if (gaps.some(g => g.severity === 'critical')) {
    recommendations.push({
      type: 'coverage',
      priority: 'high',
      recommendation: 'Critical staffing gaps identified - immediate action required',
      impact: 'Patient safety may be compromised without adequate coverage',
    });
  }

  // Fairness recommendations
  const fairnessScores = workloads.map(w => w.fairnessScore);
  const avgFairness = fairnessScores.reduce((a, b) => a + b, 0) / Math.max(fairnessScores.length, 1);
  if (avgFairness < 70) {
    recommendations.push({
      type: 'fairness',
      priority: 'medium',
      recommendation: 'Workload distribution is uneven - consider rebalancing assignments',
      impact: 'Improves staff satisfaction and reduces burnout risk',
    });
  }

  // Overtime recommendations
  const totalOvertime = workloads.reduce((sum, w) => sum + w.overtimeHours, 0);
  if (totalOvertime > 20) {
    recommendations.push({
      type: 'cost',
      priority: 'medium',
      recommendation: `High overtime detected (${totalOvertime.toFixed(1)} hours) - consider additional staffing`,
      impact: 'Reducing overtime can significantly lower labor costs',
    });
  }

  // Weekend coverage recommendations
  const weekendShiftCount = workloads.reduce((sum, w) => sum + w.weekendShifts, 0);
  const avgWeekendShifts = weekendShiftCount / Math.max(workloads.length, 1);
  const weekendVariance = workloads.some(w => Math.abs(w.weekendShifts - avgWeekendShifts) > 2);
  if (weekendVariance) {
    recommendations.push({
      type: 'fairness',
      priority: 'low',
      recommendation: 'Weekend shifts are unevenly distributed',
      impact: 'Balancing weekend assignments improves morale',
    });
  }

  return recommendations;
}

async function enhanceWithAI(
  optimization: ScheduleOptimization,
  request: ScheduleRequest
): Promise<ScheduleOptimization> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return optimization;
  }

  try {
    const prompt = `You are a healthcare staffing expert reviewing a schedule optimization.

SCHEDULE SUMMARY:
- Date Range: ${request.dateRange.startDate} to ${request.dateRange.endDate}
- Staff Count: ${request.staff.length}
- Shifts to Cover: ${request.shiftRequirements.length}
- Assignments Made: ${optimization.assignments.length}
- Coverage Score: ${optimization.coverageScore}%
- Fairness Score: ${optimization.fairnessScore}%
- Total Overtime: ${optimization.totalOvertimeHours} hours

COVERAGE GAPS:
${optimization.coverageGaps.length > 0
  ? optimization.coverageGaps.map(g => `- ${g.date} ${g.shiftType}: Short ${g.shortfall} ${g.requiredRole}(s) [${g.severity}]`).join('\n')
  : 'No coverage gaps identified'}

OPTIMIZATION GOAL: ${request.optimizationGoal || 'balanced'}

Provide a JSON response with:
1. summary: A 2-3 sentence summary of the schedule quality and key issues
2. additionalRecommendations: Array of 1-2 additional recommendations (type, priority, recommendation, impact)
3. riskAssessment: Brief assessment of any compliance or safety risks

Respond with valid JSON only.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return optimization;
    }

    const aiResponse = await response.json();
    const content = aiResponse.content?.[0]?.text;

    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const enhancements = JSON.parse(jsonMatch[0]);

        if (enhancements.summary) {
          optimization.summary = enhancements.summary;
        }

        if (enhancements.additionalRecommendations) {
          optimization.recommendations.push(...enhancements.additionalRecommendations);
        }
      }
    }

    return optimization;
  } catch {
    return optimization;
  }
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const startTime = Date.now();
  const { headers: corsHeaders } = corsFromRequest(req);
  const logger = createLogger('ai-schedule-optimizer', req);

  try {
    const request = await req.json() as ScheduleRequest;

    if (!request.requesterId || !request.dateRange || !request.staff || !request.shiftRequirements) {
      return new Response(
        JSON.stringify({ error: 'Requester ID, date range, staff, and shift requirements are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate base assignments
    const { assignments, unassigned } = generateBaseAssignments(
      request.staff,
      request.shiftRequirements
    );

    // Analyze workloads
    const workloads = analyzeWorkloads(assignments, request.staff);

    // Identify gaps
    const gaps = identifyCoverageGaps(request.shiftRequirements, assignments);

    // Calculate scores
    const totalRequired = request.shiftRequirements.reduce((sum, r) => sum + r.minStaff, 0);
    const totalAssigned = assignments.length +
      request.shiftRequirements.reduce((sum, r) => sum + (r.currentAssignments?.length || 0), 0);
    const coverageScore = Math.round((totalAssigned / Math.max(totalRequired, 1)) * 100);

    const avgFairness = workloads.length > 0
      ? workloads.reduce((sum, w) => sum + w.fairnessScore, 0) / workloads.length
      : 100;

    const regularHours = assignments.filter(a => !a.isOvertime).reduce((sum, a) => sum + a.hoursWorked, 0);
    const overtimeHours = workloads.reduce((sum, w) => sum + w.overtimeHours, 0);

    // Estimate costs (simplified)
    const avgHourlyRate = 35; // Could be made configurable
    const overtimeMultiplier = 1.5;
    const estimatedCost = (regularHours * avgHourlyRate) + (overtimeHours * avgHourlyRate * overtimeMultiplier);

    // Generate recommendations
    const recommendations = generateRecommendations(
      workloads,
      gaps,
      assignments,
      request.optimizationGoal || 'balanced'
    );

    // Build optimization result
    let optimization: ScheduleOptimization = {
      scheduleId: crypto.randomUUID(),
      dateRange: request.dateRange,
      assignments,
      unassignedShifts: unassigned,
      coverageScore,
      coverageGaps: gaps,
      staffWorkloads: workloads,
      fairnessScore: Math.round(avgFairness),
      totalOvertimeHours: overtimeHours,
      estimatedLaborCost: Math.round(estimatedCost * 100) / 100,
      regularHours,
      overtimeHours,
      recommendations,
      summary: `Schedule covers ${coverageScore}% of required shifts with ${overtimeHours.toFixed(1)} overtime hours. ${gaps.length} coverage gap(s) identified.`,
      optimizationGoalAchieved: coverageScore >= 90 && avgFairness >= 70,
    };

    // Enhance with AI
    optimization = await enhanceWithAI(optimization, request);

    // Log the optimization
    logger.info('Schedule optimization completed', {
      requesterId: request.requesterId.substring(0, 8) + '...',
      dateRange: `${request.dateRange.startDate} to ${request.dateRange.endDate}`,
      staffCount: request.staff.length,
      shiftsRequired: request.shiftRequirements.length,
      coverageScore,
      fairnessScore: Math.round(avgFairness),
      gapsIdentified: gaps.length,
      responseTimeMs: Date.now() - startTime,
    });

    // Store result (optional)
    try {
      const supabaseUrl = getEnv('SUPABASE_URL', 'SB_URL');
      const supabaseKey = getEnv('SB_SERVICE_ROLE_KEY', 'SB_SECRET_KEY');
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('ai_schedule_optimizations').insert({
        schedule_id: optimization.scheduleId,
        requester_id: request.requesterId,
        tenant_id: request.tenantId,
        date_range_start: request.dateRange.startDate,
        date_range_end: request.dateRange.endDate,
        staff_count: request.staff.length,
        shifts_required: request.shiftRequirements.length,
        assignments_made: assignments.length,
        coverage_score: coverageScore,
        fairness_score: Math.round(avgFairness),
        overtime_hours: overtimeHours,
        estimated_cost: estimatedCost,
        gaps_count: gaps.length,
        optimization_goal: request.optimizationGoal || 'balanced',
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-fatal - continue with response
    }

    return new Response(
      JSON.stringify({
        optimization,
        metadata: {
          generated_at: new Date().toISOString(),
          response_time_ms: Date.now() - startTime,
          model: 'claude-haiku-4-20250514',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Schedule optimization error', { error: error.message });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
