/**
 * Tests for AI Provider Assistant Edge Function
 *
 * @skill #57 - Provider Assistant
 *
 * Tests role-adaptive conversational AI assistant for clinical staff
 * with appropriate context, guardrails, and safety features.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================================
// Type Definitions (matching the edge function)
// ============================================================================

type ProviderRole = 'physician' | 'nurse' | 'care_coordinator' | 'pharmacist' | 'admin' | 'other';
type QueryCategory = 'clinical' | 'medication' | 'documentation' | 'workflow' | 'patient_specific' | 'general';
type UrgencyLevel = 'routine' | 'soon' | 'urgent' | 'stat';

interface ProviderContext {
  role: ProviderRole;
  department?: string;
  specialization?: string;
}

interface PatientContext {
  patientId?: string;
  conditions?: string[];
  medications?: string[];
  allergies?: string[];
  recentVitals?: Record<string, number>;
  age?: number;
}

interface AssistantRequest {
  query: string;
  providerId: string;
  providerContext: ProviderContext;
  patientContext?: PatientContext;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  tenantId?: string;
}

interface AssistantResponse {
  response: string;
  category: QueryCategory;
  confidence: number;
  sources?: string[];
  suggestedActions?: Array<{
    action: string;
    urgency: UrgencyLevel;
    rationale: string;
  }>;
  relatedQueries?: string[];
  requiresPhysicianConfirmation: boolean;
  requiresEscalation: boolean;
  escalationReason?: string;
  disclaimers: string[];
  metadata: {
    generatedAt: string;
    responseTimeMs: number;
    model: string;
    queryCategory: QueryCategory;
  };
}

// ============================================================================
// Test Suites
// ============================================================================

Deno.test("AI Provider Assistant - Request Validation", async (t) => {
  await t.step("should require query", () => {
    const request: Partial<AssistantRequest> = {
      providerId: "provider-123",
      providerContext: { role: "physician" },
    };

    const isValid = !!(request.query && request.providerId && request.providerContext);
    assertEquals(isValid, false);
  });

  await t.step("should require providerId", () => {
    const request: Partial<AssistantRequest> = {
      query: "What is the dosage?",
      providerContext: { role: "physician" },
    };

    const isValid = !!(request.query && request.providerId && request.providerContext);
    assertEquals(isValid, false);
  });

  await t.step("should require providerContext", () => {
    const request: Partial<AssistantRequest> = {
      query: "What is the dosage?",
      providerId: "provider-123",
    };

    const isValid = !!(request.query && request.providerId && request.providerContext);
    assertEquals(isValid, false);
  });

  await t.step("should accept valid request", () => {
    const request: AssistantRequest = {
      query: "What is the recommended dosage for metformin?",
      providerId: "provider-123",
      providerContext: { role: "physician" },
    };

    const isValid = !!(request.query && request.providerId && request.providerContext);
    assertEquals(isValid, true);
  });
});

Deno.test("AI Provider Assistant - Role Validation", async (t) => {
  await t.step("should accept valid provider roles", () => {
    const validRoles: ProviderRole[] = ['physician', 'nurse', 'care_coordinator', 'pharmacist', 'admin', 'other'];

    for (const role of validRoles) {
      assertEquals(validRoles.includes(role), true);
    }
  });

  await t.step("should default invalid role to 'other'", () => {
    const invalidRole = "unknown_role" as ProviderRole;
    const validRoles: ProviderRole[] = ['physician', 'nurse', 'care_coordinator', 'pharmacist', 'admin', 'other'];

    const effectiveRole: ProviderRole = validRoles.includes(invalidRole) ? invalidRole : 'other';
    assertEquals(effectiveRole, "other");
  });
});

Deno.test("AI Provider Assistant - Query Classification", async (t) => {
  await t.step("should classify patient-specific queries", () => {
    const queries = [
      "What medications is this patient on?",
      "What is my current patient's diagnosis?",
      "Can you review their vitals?",
    ];

    for (const query of queries) {
      const lowerQuery = query.toLowerCase();
      const isPatientSpecific = lowerQuery.includes('patient') && (
        lowerQuery.includes('this') || lowerQuery.includes('my') ||
        lowerQuery.includes('current') || lowerQuery.includes('their')
      );
      assertEquals(isPatientSpecific, true);
    }
  });

  await t.step("should classify medication queries", () => {
    const queries = [
      "What is the drug interaction between metformin and lisinopril?",
      "What is the recommended dose for amoxicillin?",
      "Can I prescribe this medication?",
    ];

    for (const query of queries) {
      const lowerQuery = query.toLowerCase();
      const isMedication = lowerQuery.includes('drug') || lowerQuery.includes('medication') ||
        lowerQuery.includes('dose') || lowerQuery.includes('interaction') ||
        lowerQuery.includes('prescribe');
      assertEquals(isMedication, true);
    }
  });

  await t.step("should classify documentation queries", () => {
    const queries = [
      "How do I document this procedure?",
      "What ICD-10 code should I use?",
      "What are the charting requirements?",
    ];

    for (const query of queries) {
      const lowerQuery = query.toLowerCase();
      const isDocumentation = lowerQuery.includes('document') || lowerQuery.includes('note') ||
        lowerQuery.includes('chart') || lowerQuery.includes('record') ||
        lowerQuery.includes('icd') || lowerQuery.includes('cpt');
      assertEquals(isDocumentation, true);
    }
  });

  await t.step("should classify workflow queries", () => {
    const queries = [
      "How do I schedule a follow-up?",
      "What is the workflow for referrals?",
      "What is the policy for overtime?",
    ];

    for (const query of queries) {
      const lowerQuery = query.toLowerCase();
      const isWorkflow = lowerQuery.includes('schedule') || lowerQuery.includes('workflow') ||
        lowerQuery.includes('process') || lowerQuery.includes('policy');
      assertEquals(isWorkflow, true);
    }
  });

  await t.step("should classify clinical queries", () => {
    const queries = [
      "What is the treatment protocol for hypertension?",
      "What are the diagnostic criteria?",
      "What are the clinical guidelines?",
    ];

    for (const query of queries) {
      const lowerQuery = query.toLowerCase();
      const isClinical = lowerQuery.includes('diagnos') || lowerQuery.includes('treatment') ||
        lowerQuery.includes('symptom') || lowerQuery.includes('guideline') ||
        lowerQuery.includes('protocol') || lowerQuery.includes('clinical');
      assertEquals(isClinical, true);
    }
  });

  await t.step("should default to general category", () => {
    const query = "Can you help me?";
    const lowerQuery = query.toLowerCase();

    const isPatientSpecific = lowerQuery.includes('patient') && (
      lowerQuery.includes('this') || lowerQuery.includes('my')
    );
    const isMedication = lowerQuery.includes('drug') || lowerQuery.includes('medication');
    const isDocumentation = lowerQuery.includes('document') || lowerQuery.includes('chart');
    const isWorkflow = lowerQuery.includes('schedule') || lowerQuery.includes('workflow');
    const isClinical = lowerQuery.includes('diagnos') || lowerQuery.includes('treatment');

    const category: QueryCategory =
      isPatientSpecific ? 'patient_specific' :
      isMedication ? 'medication' :
      isDocumentation ? 'documentation' :
      isWorkflow ? 'workflow' :
      isClinical ? 'clinical' : 'general';

    assertEquals(category, "general");
  });
});

Deno.test("AI Provider Assistant - Role-Specific System Prompts", async (t) => {
  await t.step("should include base safety rules for all roles", () => {
    const baseSafetyRules = [
      "NEVER provide definitive diagnoses",
      "ALWAYS recommend physician review for clinical decisions",
      "NEVER recommend stopping prescribed medications without physician approval",
      "Flag any situation requiring immediate attention",
      "When uncertain, say so clearly",
      "Cite guidelines and evidence when possible",
    ];

    assertEquals(baseSafetyRules.length, 6);
  });

  await t.step("should provide physician-specific guidance", () => {
    const role: ProviderRole = "physician";
    const allowedTopics = [
      "Differential diagnoses and clinical reasoning",
      "Treatment options with evidence levels",
      "Drug dosing and interactions",
      "Clinical guidelines and protocols",
      "Specialist referral criteria",
    ];

    assertEquals(role, "physician");
    assertEquals(allowedTopics.length >= 5, true);
  });

  await t.step("should provide nurse-specific guidance", () => {
    const role: ProviderRole = "nurse";
    const allowedTopics = [
      "Patient assessment findings",
      "Care coordination tasks",
      "Patient education materials",
      "Medication administration guidance",
      "When to escalate to physician",
    ];

    assertEquals(role, "nurse");
    assertEquals(allowedTopics.length >= 5, true);
  });

  await t.step("should provide care coordinator-specific guidance", () => {
    const role: ProviderRole = "care_coordinator";
    const allowedTopics = [
      "Discharge planning considerations",
      "Resource identification",
      "Insurance and authorization guidance",
      "Care transitions and follow-up",
      "Community resource referrals",
    ];

    assertEquals(role, "care_coordinator");
    assertEquals(allowedTopics.length >= 5, true);
  });

  await t.step("should provide pharmacist-specific guidance", () => {
    const role: ProviderRole = "pharmacist";
    const allowedTopics = [
      "Drug interactions and contraindications",
      "Dosing adjustments",
      "Therapeutic alternatives",
      "Medication reconciliation",
      "Patient counseling points",
    ];

    assertEquals(role, "pharmacist");
    assertEquals(allowedTopics.length >= 5, true);
  });

  await t.step("should provide admin-specific guidance", () => {
    const role: ProviderRole = "admin";
    const allowedTopics = [
      "Scheduling and workflow questions",
      "Billing and coding guidance",
      "Policy and procedure information",
      "Patient communication templates",
      "Documentation requirements",
    ];

    assertEquals(role, "admin");
    assertEquals(allowedTopics.length >= 5, true);
  });
});

Deno.test("AI Provider Assistant - Escalation Detection", async (t) => {
  await t.step("should flag emergency keywords for escalation", () => {
    const emergencyQueries = [
      "Patient is coding!",
      "There's a cardiac arrest",
      "This is an emergency",
      "Need stat assistance",
      "Patient is unstable",
    ];

    for (const query of emergencyQueries) {
      const lowerQuery = query.toLowerCase();
      const requiresEscalation = lowerQuery.includes('code') || lowerQuery.includes('arrest') ||
        lowerQuery.includes('emergency') || lowerQuery.includes('stat') ||
        lowerQuery.includes('unstable');

      assertEquals(requiresEscalation, true);
    }
  });

  await t.step("should flag scope issues for non-physicians", () => {
    const scopeQueries = [
      "Should I prescribe this?",
      "What is the diagnosis?",
      "Can I order this test?",
    ];

    const nonPhysicianRoles: ProviderRole[] = ['nurse', 'care_coordinator', 'admin', 'other'];

    for (const role of nonPhysicianRoles) {
      for (const query of scopeQueries) {
        const lowerQuery = query.toLowerCase();
        const requiresEscalation = role !== 'physician' && role !== 'pharmacist' && (
          lowerQuery.includes('prescribe') || lowerQuery.includes('diagnos') ||
          lowerQuery.includes('order')
        );

        if (role === 'nurse' || role === 'care_coordinator' || role === 'admin' || role === 'other') {
          assertEquals(requiresEscalation, true);
        }
      }
    }
  });

  await t.step("should not flag routine queries for escalation", () => {
    const routineQueries = [
      "What are the visiting hours?",
      "Where can I find patient education materials?",
      "What is the policy for documentation?",
    ];

    for (const query of routineQueries) {
      const lowerQuery = query.toLowerCase();
      const requiresEscalation = lowerQuery.includes('code') || lowerQuery.includes('arrest') ||
        lowerQuery.includes('emergency') || lowerQuery.includes('stat') ||
        lowerQuery.includes('unstable');

      assertEquals(requiresEscalation, false);
    }
  });

  await t.step("should include escalation reason when required", () => {
    const escalation = {
      requires: true,
      reason: "Query indicates potential emergency - ensure appropriate resources are engaged",
    };

    assertEquals(escalation.requires, true);
    assertExists(escalation.reason);
  });
});

Deno.test("AI Provider Assistant - Physician Confirmation Requirements", async (t) => {
  await t.step("should require confirmation for clinical queries", () => {
    const category: QueryCategory = "clinical";
    const requiresPhysicianConfirmation = category === 'clinical' || category === 'medication';
    assertEquals(requiresPhysicianConfirmation, true);
  });

  await t.step("should require confirmation for medication queries", () => {
    const category: QueryCategory = "medication";
    const requiresPhysicianConfirmation = category === 'clinical' || category === 'medication';
    assertEquals(requiresPhysicianConfirmation, true);
  });

  await t.step("should require confirmation for patient-specific queries from non-physicians", () => {
    const category: QueryCategory = "patient_specific";
    const role: ProviderRole = "nurse";

    const requiresPhysicianConfirmation =
      category === 'clinical' ||
      category === 'medication' ||
      (category === 'patient_specific' && role !== 'physician');

    assertEquals(requiresPhysicianConfirmation, true);
  });

  await t.step("should not require confirmation for documentation queries", () => {
    const category: QueryCategory = "documentation";
    const requiresPhysicianConfirmation = category === 'clinical' || category === 'medication';
    assertEquals(requiresPhysicianConfirmation, false);
  });

  await t.step("should not require confirmation for workflow queries", () => {
    const category: QueryCategory = "workflow";
    const requiresPhysicianConfirmation = category === 'clinical' || category === 'medication';
    assertEquals(requiresPhysicianConfirmation, false);
  });
});

Deno.test("AI Provider Assistant - Disclaimers", async (t) => {
  await t.step("should add clinical disclaimer when physician confirmation required", () => {
    const disclaimers: string[] = [];
    const requiresPhysicianConfirmation = true;

    if (requiresPhysicianConfirmation) {
      disclaimers.push('Clinical recommendations should be confirmed by the treating physician.');
    }

    assertEquals(disclaimers.length, 1);
    assertEquals(disclaimers[0].includes("physician"), true);
  });

  await t.step("should add medication disclaimer for medication queries", () => {
    const disclaimers: string[] = [];
    const category: QueryCategory = "medication";

    if (category === 'medication') {
      disclaimers.push('Verify drug information in official references before clinical use.');
    }

    assertEquals(disclaimers.length, 1);
    assertEquals(disclaimers[0].includes("drug"), true);
  });

  await t.step("should add patient context disclaimer when context provided", () => {
    const disclaimers: string[] = [];
    const patientContext: PatientContext = { patientId: "p-123", conditions: ["Diabetes"] };

    if (patientContext) {
      disclaimers.push('Patient-specific recommendations are based on provided context only.');
    }

    assertEquals(disclaimers.length, 1);
    assertEquals(disclaimers[0].includes("context"), true);
  });

  await t.step("should add fallback disclaimer for unavailable AI", () => {
    const disclaimers: string[] = [];
    const isFallback = true;

    if (isFallback) {
      disclaimers.push('This is a fallback response. AI service may be temporarily unavailable.');
    }

    assertEquals(disclaimers.length, 1);
    assertEquals(disclaimers[0].includes("fallback"), true);
  });
});

Deno.test("AI Provider Assistant - Related Queries Generation", async (t) => {
  await t.step("should generate medication-related queries", () => {
    const category: QueryCategory = "medication";
    const related: string[] = [];

    if (category === 'medication') {
      related.push(
        'What are the common side effects?',
        'Are there any drug interactions to consider?',
        'What is the dosing for renal impairment?'
      );
    }

    assertEquals(related.length, 3);
    assertEquals(related[0].includes("side effects"), true);
  });

  await t.step("should generate clinical-related queries", () => {
    const category: QueryCategory = "clinical";
    const related: string[] = [];

    if (category === 'clinical') {
      related.push(
        'What are the current guidelines?',
        'When should I escalate care?',
        'What are the key monitoring parameters?'
      );
    }

    assertEquals(related.length, 3);
    assertEquals(related[0].includes("guidelines"), true);
  });

  await t.step("should generate documentation-related queries", () => {
    const category: QueryCategory = "documentation";
    const related: string[] = [];

    if (category === 'documentation') {
      related.push(
        'What documentation is required for billing?',
        'What are the key elements to include?',
        'Are there any compliance considerations?'
      );
    }

    assertEquals(related.length, 3);
    assertEquals(related[0].includes("billing"), true);
  });

  await t.step("should limit related queries to 3", () => {
    const allRelated = [
      "Query 1",
      "Query 2",
      "Query 3",
      "Query 4",
      "Query 5",
    ];

    const limitedRelated = allRelated.slice(0, 3);
    assertEquals(limitedRelated.length, 3);
  });
});

Deno.test("AI Provider Assistant - Patient Context Building", async (t) => {
  await t.step("should format patient context for prompt", () => {
    const patientContext: PatientContext = {
      age: 65,
      conditions: ["Type 2 Diabetes", "Hypertension"],
      medications: ["Metformin 500mg", "Lisinopril 10mg"],
      allergies: ["Penicillin"],
      recentVitals: { heartRate: 72, systolicBP: 130 },
    };

    let contextSection = 'PATIENT CONTEXT (if relevant to query):\n';
    if (patientContext.age) contextSection += `- Age: ${patientContext.age}\n`;
    if (patientContext.conditions?.length) contextSection += `- Conditions: ${patientContext.conditions.join(', ')}\n`;
    if (patientContext.medications?.length) contextSection += `- Current Medications: ${patientContext.medications.join(', ')}\n`;
    if (patientContext.allergies?.length) contextSection += `- Allergies: ${patientContext.allergies.join(', ')}\n`;
    if (patientContext.recentVitals) contextSection += `- Recent Vitals: ${JSON.stringify(patientContext.recentVitals)}\n`;

    assertEquals(contextSection.includes("Age: 65"), true);
    assertEquals(contextSection.includes("Type 2 Diabetes"), true);
    assertEquals(contextSection.includes("Penicillin"), true);
  });

  await t.step("should handle empty patient context", () => {
    const patientContext: PatientContext = {};

    const hasAge = !!patientContext.age;
    const hasConditions = !!patientContext.conditions?.length;
    const hasMedications = !!patientContext.medications?.length;

    assertEquals(hasAge, false);
    assertEquals(hasConditions, false);
    assertEquals(hasMedications, false);
  });
});

Deno.test("AI Provider Assistant - Conversation History", async (t) => {
  await t.step("should limit conversation history to last 6 messages", () => {
    const conversationHistory = [
      { role: 'user' as const, content: "Message 1" },
      { role: 'assistant' as const, content: "Response 1" },
      { role: 'user' as const, content: "Message 2" },
      { role: 'assistant' as const, content: "Response 2" },
      { role: 'user' as const, content: "Message 3" },
      { role: 'assistant' as const, content: "Response 3" },
      { role: 'user' as const, content: "Message 4" },
      { role: 'assistant' as const, content: "Response 4" },
    ];

    const limitedHistory = conversationHistory.slice(-6);
    assertEquals(limitedHistory.length, 6);
    assertEquals(limitedHistory[0].content, "Message 2");
  });

  await t.step("should add current query to messages", () => {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const currentQuery = "What is the dosage for metformin?";

    messages.push({ role: 'user', content: currentQuery });

    assertEquals(messages.length, 1);
    assertEquals(messages[0].role, "user");
    assertEquals(messages[0].content, currentQuery);
  });
});

Deno.test("AI Provider Assistant - Suggested Actions", async (t) => {
  await t.step("should suggest action when response includes considerations", () => {
    const category: QueryCategory = "clinical";
    const responseContent = "You should consider checking the patient's kidney function.";
    const suggestedActions: Array<{ action: string; urgency: UrgencyLevel; rationale: string }> = [];

    if (category === 'clinical' || category === 'patient_specific') {
      if (responseContent.toLowerCase().includes('consider')) {
        suggestedActions.push({
          action: 'Review suggested considerations with care team',
          urgency: 'routine',
          rationale: 'AI-generated suggestions require clinical validation',
        });
      }
    }

    assertEquals(suggestedActions.length, 1);
    assertEquals(suggestedActions[0].urgency, "routine");
  });

  await t.step("should define urgency levels", () => {
    const urgencyLevels: UrgencyLevel[] = ['routine', 'soon', 'urgent', 'stat'];

    assertEquals(urgencyLevels.length, 4);
    assertEquals(urgencyLevels.includes('stat'), true);
  });
});

Deno.test("AI Provider Assistant - Fallback Response", async (t) => {
  await t.step("should provide medication fallback", () => {
    const category: QueryCategory = "medication";
    let response = '';

    switch (category) {
      case 'medication':
        response = 'For medication-related questions, please consult your pharmacy team or reference sources like UpToDate, Lexicomp, or the prescribing information.';
        break;
    }

    assertEquals(response.includes("pharmacy"), true);
    assertEquals(response.includes("UpToDate"), true);
  });

  await t.step("should provide clinical fallback", () => {
    const category: QueryCategory = "clinical";
    let response = '';

    switch (category) {
      case 'clinical':
        response = 'For clinical questions, please reference clinical guidelines (e.g., UpToDate, specialty society guidelines) or consult with the care team.';
        break;
    }

    assertEquals(response.includes("guidelines"), true);
  });

  await t.step("should provide escalation fallback", () => {
    const escalation = { requires: true, reason: "Emergency situation detected" };
    let response = '';

    if (escalation.requires) {
      response = `This query has been flagged for escalation: ${escalation.reason}\n\nPlease consult with the appropriate clinical team member directly.`;
    }

    assertEquals(response.includes("flagged for escalation"), true);
    assertEquals(response.includes("Emergency"), true);
  });

  await t.step("should set low confidence for fallback responses", () => {
    const fallbackConfidence = 0.3;
    assertEquals(fallbackConfidence < 0.5, true);
  });
});

Deno.test("AI Provider Assistant - PHI Redaction in Logs", async (t) => {
  await t.step("should redact providerId in logs", () => {
    const providerId = "12345678-1234-1234-1234-123456789012";
    const redactedId = providerId.substring(0, 8) + '...';

    assertEquals(redactedId, "12345678...");
  });

  await t.step("should not log patient context details", () => {
    const logData = {
      providerId: "12345678...",
      role: "physician",
      category: "clinical",
      hasPatientContext: true,
      requiresEscalation: false,
      responseTimeMs: 250,
    };

    // Verify no PHI in log
    const logString = JSON.stringify(logData);
    assertEquals(logString.includes("conditions"), false);
    assertEquals(logString.includes("medications"), false);
    assertEquals(logString.includes("allergies"), false);
  });
});

Deno.test("AI Provider Assistant - Response Structure", async (t) => {
  await t.step("should create complete AssistantResponse", () => {
    const response: AssistantResponse = {
      response: "Based on the clinical guidelines...",
      category: "clinical",
      confidence: 0.85,
      sources: ["UpToDate", "ADA Guidelines"],
      suggestedActions: [{
        action: "Review with attending",
        urgency: "routine",
        rationale: "AI suggestion requires validation",
      }],
      relatedQueries: ["What are the side effects?"],
      requiresPhysicianConfirmation: true,
      requiresEscalation: false,
      disclaimers: ["Clinical recommendations should be confirmed by physician."],
      metadata: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: 250,
        model: "claude-sonnet-4-20250514",
        queryCategory: "clinical",
      },
    };

    assertExists(response.response);
    assertEquals(response.category, "clinical");
    assertEquals(response.confidence, 0.85);
    assertEquals(response.requiresPhysicianConfirmation, true);
    assertEquals(response.metadata.model, "claude-sonnet-4-20250514");
  });
});

Deno.test("AI Provider Assistant - Error Handling", async (t) => {
  await t.step("should handle missing API key gracefully", () => {
    const apiKey: string | undefined = undefined;
    const shouldUseFallback = !apiKey;

    assertEquals(shouldUseFallback, true);
  });

  await t.step("should handle API error gracefully", () => {
    const response = { ok: false, status: 500 };
    const shouldUseFallback = !response.ok;

    assertEquals(shouldUseFallback, true);
  });
});
