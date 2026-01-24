// Bed Optimizer - Discharge Planner
// AI-powered discharge recommendations

import type { MCPCostOptimizer } from '../../mcp/mcp-cost-optimizer';
import type { BedBoardEntry } from '../../../types/bed';
import type { DischargeRecommendation, LOSBenchmark } from './types';
import { parseJSONArray } from './utils';

/**
 * Generate AI-powered discharge recommendations
 */
export async function generateDischargeRecommendations(
  optimizer: MCPCostOptimizer,
  tenantId: string,
  bedBoard: BedBoardEntry[],
  losBenchmarks: LOSBenchmark[]
): Promise<DischargeRecommendation[]> {
  const occupiedBeds = bedBoard.filter(b => b.status === 'occupied' && b.patient_id);

  if (occupiedBeds.length === 0) {
    return [];
  }

  // Build prompt for discharge analysis
  const prompt = buildDischargePrompt(occupiedBeds, losBenchmarks);

  const systemPrompt = `You are an expert hospital discharge planner optimizing patient flow.
Analyze occupied beds and recommend discharge priorities to optimize capacity.

DISCHARGE READINESS CRITERIA:
- "ready": All clinical criteria met, disposition confirmed, transportation arranged
- "likely_today": Clinical criteria met, minor pending items (paperwork, meds, education)
- "likely_tomorrow": Clinical criteria expected to be met, disposition planning in progress
- "needs_more_time": Clinical issues pending, not appropriate for discharge today

PRIORITIZATION FACTORS:
1. Length of stay vs benchmark (>90th percentile = priority)
2. Expected discharge orders already written
3. Disposition complexity (home vs SNF)
4. Bed type demand (ICU beds highest priority)
5. Observation patient conversion (>24 hours)

Return JSON array of top 10 discharge candidates:
[
  {
    "patientId": "uuid",
    "patientName": "John D.",
    "bedLabel": "ICU-102A",
    "unitName": "ICU",
    "currentLOS": 4,
    "predictedDischargeDate": "2025-12-07",
    "dischargeReadiness": "likely_today",
    "confidence": 0.85,
    "factors": {
      "clinicalReadiness": "Stable vitals, off pressors",
      "socialFactors": "Family available, lives nearby",
      "pendingItems": ["Final meds list", "D/C instructions"],
      "barriers": []
    },
    "suggestedDisposition": "home",
    "estimatedDischargeTime": "14:00",
    "aiRationale": "Patient meets all clinical criteria..."
  }
]`;

  try {
    const aiResponse = await optimizer.call({
      prompt,
      systemPrompt,
      model: 'claude-sonnet-4-5-20250929',
      complexity: 'complex',
      userId: tenantId,
      context: {
        analysisType: 'discharge_planning'
      }
    });

    const parsed = parseJSONArray<DischargeRecommendation>(aiResponse.response);
    return parsed.slice(0, 10);
  } catch {
    return [];
  }
}

/**
 * Build discharge analysis prompt
 */
function buildDischargePrompt(occupiedBeds: BedBoardEntry[], _losBenchmarks: LOSBenchmark[]): string {
  let prompt = `Analyze these occupied beds for discharge prioritization:\n\n`;

  occupiedBeds.forEach((bed, i) => {
    if (i < 30) { // Limit to 30 for token efficiency
      const assignedDate = bed.assigned_at ? new Date(bed.assigned_at) : null;
      const los = assignedDate
        ? Math.floor((Date.now() - assignedDate.getTime()) / (24 * 60 * 60 * 1000))
        : 0;

      prompt += `${i + 1}. ${bed.bed_label} (${bed.unit_name})\n`;
      prompt += `   Patient: ${bed.patient_name || 'Unknown'} | Acuity: ${bed.patient_acuity || 'N/A'}\n`;
      prompt += `   LOS: ${los} days | Expected D/C: ${bed.expected_discharge_date || 'Not set'}\n\n`;
    }
  });

  prompt += `\nIdentify top 10 discharge candidates with readiness assessment and rationale.`;

  return prompt;
}
