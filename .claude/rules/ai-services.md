# AI Services Standards

This codebase contains **40+ AI-powered services** using Claude. All AI services must follow these patterns.

## Skill Registration
All AI services must be registered in the `ai_skills` database table:

| Field | Purpose |
|-------|---------|
| `skill_key` | Unique identifier (e.g., `care_team_chat_summarizer`) |
| `skill_number` | Sequential number for tracking/billing |
| `description` | What the skill does |
| `model` | Which Claude model to use |
| `is_active` | Whether skill is enabled |

## AI Service Pattern
```typescript
import { auditLogger } from '../auditLogger';
import { ServiceResult, success, failure } from './_base';

export async function analyzePatientRisk(
  input: PatientRiskInput
): Promise<ServiceResult<RiskAnalysis>> {
  // 1. Log AI operation start
  await auditLogger.ai('AI_RISK_ANALYSIS_START', {
    patientId: input.patientId,
    skillKey: 'risk_analyzer'
  });

  try {
    // 2. Call AI service
    const result = await callClaudeAPI(input);

    // 3. Log success
    await auditLogger.ai('AI_RISK_ANALYSIS_COMPLETE', {
      patientId: input.patientId,
      riskLevel: result.riskLevel
    });

    return success(result);
  } catch (err: unknown) {
    // 4. Log failure with auditLogger (never console.log)
    await auditLogger.error('AI_RISK_ANALYSIS_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { patientId: input.patientId }
    );
    return failure('AI_ERROR', 'Risk analysis failed');
  }
}
```

## AI Model Version Pinning — REQUIRED

**Every AI skill must specify an exact model ID. Never use `latest` or unversioned references.**

Clinical AI decisions must be reproducible. When Anthropic deprecates a model, update the `ai_skills.model` column explicitly — do not auto-upgrade.

| Do This | Not This |
|---------|----------|
| `model: 'claude-sonnet-4-5-20250929'` | `model: 'claude-sonnet'` |
| `model: 'claude-haiku-4-5-20251001'` | `model: 'latest'` |

**When a model is deprecated:** Update `ai_skills.model` for affected skills, test outputs, then deploy. This is a conscious migration, not an automatic one.

## Structured AI Output — REQUIRED FOR NEW FUNCTIONS

**All new AI edge functions must define a JSON response schema.** Do not parse free-text responses with regex or string splitting.

```typescript
// ✅ GOOD - Structured output with defined schema
const response = await anthropic.messages.create({
  model: skillConfig.model,
  messages: [...],
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'risk_assessment', schema: RiskAssessmentSchema }
  }
});

// ❌ BAD - Parsing free-text response
const text = response.content[0].text;
const riskLevel = text.match(/Risk Level: (\w+)/)?.[1]; // fragile
```

**Existing AI functions are grandfathered** but should be migrated to structured output when next modified.

## AI Transparency for Patients (HTI-2 Readiness)

Every AI skill registered in `ai_skills` must have:
- `description` — Technical description (for developers/auditors)
- `patient_description` — Plain-language explanation (for patients: "This tool checks if your medications interact with each other")

This supports ONC HTI-2 Algorithm Transparency requirements.

## AI Cost Tracking
- All AI calls are tracked for billing purposes
- Use `/cost-check` skill to analyze AI spending
- Monitor token usage in production
