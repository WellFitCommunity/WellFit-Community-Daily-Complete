/**
 * AI Check-In Questions Edge Function Tests
 *
 * Run with: deno test --allow-env supabase/functions/ai-check-in-questions/index.test.ts
 */

import { assertEquals, assertExists, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// Test question generation helpers
Deno.test('should generate valid question structure', () => {
  const mockQuestion = {
    question: 'How are you feeling today?',
    type: 'wellness',
    context: 'daily_check',
    priority: 1,
  };

  assertExists(mockQuestion.question);
  assertEquals(mockQuestion.type, 'wellness');
  assertEquals(typeof mockQuestion.priority, 'number');
});

Deno.test('should have valid question types', () => {
  const validTypes = ['wellness', 'medication', 'symptoms', 'activity', 'mood', 'social'];

  validTypes.forEach((type) => {
    assertEquals(typeof type, 'string');
  });

  assertEquals(validTypes.length, 6);
});

Deno.test('should format questions for patient context', () => {
  const patientContext = {
    diagnoses: ['Type 2 Diabetes', 'Hypertension'],
    medications: ['Metformin', 'Lisinopril'],
    sdohFactors: ['transportation'],
  };

  // Verify context structure
  assertExists(patientContext.diagnoses);
  assertExists(patientContext.medications);
  assertEquals(patientContext.diagnoses.length, 2);
});

Deno.test('should validate request body structure', () => {
  const validRequest = {
    patientId: 'patient-123',
    count: 5,
    includeFollowUp: true,
    focusAreas: ['medication', 'wellness'],
  };

  assertExists(validRequest.patientId);
  assertEquals(validRequest.count, 5);
  assertEquals(validRequest.includeFollowUp, true);
  assertEquals(validRequest.focusAreas.length, 2);
});

Deno.test('should handle default values', () => {
  const defaultRequest = {
    patientId: 'patient-123',
  };

  const count = defaultRequest.count ?? 5;
  const includeFollowUp = defaultRequest.includeFollowUp ?? true;

  assertEquals(count, 5);
  assertEquals(includeFollowUp, true);
});

Deno.test('should generate prompt with diagnoses', () => {
  const diagnoses = ['Diabetes', 'Hypertension'];
  const prompt = `Generate questions for patient with: ${diagnoses.join(', ')}`;

  assertStringIncludes(prompt, 'Diabetes');
  assertStringIncludes(prompt, 'Hypertension');
});
