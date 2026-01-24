// Bed Optimizer - Bed Assignment Matcher
// AI-powered optimal bed matching for incoming patients

import type { MCPCostOptimizer } from '../../mcp/mcp-cost-optimizer';
import type { AccuracyTrackingService } from '../accuracyTrackingService';
import { ServiceResult, success, failure } from '../../_base';
import type { IncomingPatient, BedAssignmentRecommendation, AvailableBedWithUnit } from './types';
import { BedOptimizerValidator } from './validator';
import { getAvailableBeds } from './dataAccess';
import { parseJSON } from './utils';
import { trackBedAssignment } from './accuracyTracking';

/**
 * Recommend optimal bed for incoming patient
 */
export async function recommendBedAssignment(
  optimizer: MCPCostOptimizer,
  accuracyTracker: AccuracyTrackingService,
  tenantId: string,
  patient: IncomingPatient
): Promise<ServiceResult<BedAssignmentRecommendation>> {
  BedOptimizerValidator.validateUUID(tenantId, 'tenantId');

  try {
    // Get available beds
    const { data: availableBeds, error } = await getAvailableBeds(tenantId);

    if (error || !availableBeds || availableBeds.length === 0) {
      return failure('NOT_FOUND', 'No available beds found');
    }

    // Build AI prompt for bed matching
    const prompt = buildBedMatchingPrompt(patient, availableBeds as AvailableBedWithUnit[]);

    const systemPrompt = `You are an expert hospital bed assignment specialist.
Match the incoming patient to the optimal available bed based on:

1. ACUITY MATCH: Patient acuity must be within unit's capability
2. EQUIPMENT MATCH: Required equipment must be available (telemetry, isolation, etc.)
3. UNIT PREFERENCE: Match to preferred unit type when possible
4. BED TYPE: Match bariatric, pediatric, or specialty bed needs
5. PROXIMITY: Consider nursing workflow efficiency

SCORING:
- Perfect match: 95-100
- Good match: 80-94
- Acceptable: 60-79
- Suboptimal: 40-59
- Not recommended: <40

Return JSON:
{
  "recommendedBedId": "uuid",
  "bedLabel": "3N-105A",
  "unitName": "Med-Surg North",
  "matchScore": 92,
  "matchFactors": {
    "acuityMatch": true,
    "equipmentMatch": true,
    "isolationMatch": true,
    "unitPreference": true,
    "proximityToNurseStation": false
  },
  "alternativeBeds": [
    {"bedId": "uuid", "bedLabel": "3S-102B", "matchScore": 85, "reason": "Further from nurses station"}
  ],
  "aiRationale": "This bed is optimal because..."
}`;

    const aiResponse = await optimizer.call({
      prompt,
      systemPrompt,
      model: 'claude-sonnet-4-5-20250929',
      complexity: 'complex',
      userId: tenantId,
      context: {
        taskType: 'bed_assignment'
      }
    });

    const parsed = parseJSON(aiResponse.response);

    // Safely extract matchFactors from parsed response
    const matchFactorsRaw = parsed.matchFactors as Record<string, unknown> | undefined;

    // Validate and construct the recommendation
    const recommendation: BedAssignmentRecommendation = {
      recommendedBedId: String(parsed.recommendedBedId || ''),
      bedLabel: String(parsed.bedLabel || ''),
      unitName: String(parsed.unitName || ''),
      matchScore: Number(parsed.matchScore) || 0,
      matchFactors: {
        acuityMatch: Boolean(matchFactorsRaw?.acuityMatch),
        equipmentMatch: Boolean(matchFactorsRaw?.equipmentMatch),
        isolationMatch: Boolean(matchFactorsRaw?.isolationMatch),
        unitPreference: Boolean(matchFactorsRaw?.unitPreference),
        proximityToNurseStation: Boolean(matchFactorsRaw?.proximityToNurseStation),
      },
      alternativeBeds: Array.isArray(parsed.alternativeBeds)
        ? (parsed.alternativeBeds as Array<{bedId: string; bedLabel: string; matchScore: number; reason: string}>)
        : [],
      aiRationale: String(parsed.aiRationale || ''),
    };

    // Track for accuracy monitoring
    await trackBedAssignment(accuracyTracker, tenantId, patient, recommendation);

    return success(recommendation);
  } catch (err: unknown) {
    return failure('OPERATION_FAILED', `Failed to recommend bed: ${err instanceof Error ? err.message : 'Unknown error'}`, err);
  }
}

/**
 * Build bed matching prompt
 */
function buildBedMatchingPrompt(patient: IncomingPatient, availableBeds: AvailableBedWithUnit[]): string {
  let prompt = `Find optimal bed for incoming patient:\n\n`;

  prompt += `=== PATIENT REQUIREMENTS ===\n`;
  prompt += `- Acuity: ${patient.acuityLevel}\n`;
  prompt += `- Diagnosis: ${patient.diagnosis || 'Not specified'}\n`;
  prompt += `- Telemetry needed: ${patient.requiresTelemetry ? 'YES' : 'No'}\n`;
  prompt += `- Isolation needed: ${patient.requiresIsolation ? 'YES' : 'No'}\n`;
  prompt += `- Negative pressure: ${patient.requiresNegativePressure ? 'YES' : 'No'}\n`;
  prompt += `- Bariatric: ${patient.isBariatric ? 'YES' : 'No'}\n`;
  prompt += `- Preferred unit: ${patient.preferredUnitType || 'Any'}\n`;
  prompt += `- Expected LOS: ${patient.expectedLOS || 'Unknown'} days\n`;
  prompt += `- Admission source: ${patient.admissionSource}\n`;

  prompt += `\n=== AVAILABLE BEDS (${availableBeds.length}) ===\n`;
  availableBeds.slice(0, 20).forEach((bed, i) => {
    prompt += `${i + 1}. ${bed.bed_label} (${bed.hospital_units.unit_name})\n`;
    prompt += `   Type: ${bed.bed_type} | Tele: ${bed.has_telemetry} | Iso: ${bed.has_isolation_capability} | NegP: ${bed.has_negative_pressure}\n`;
  });

  prompt += `\nRecommend the best bed match with scoring and rationale.`;

  return prompt;
}
