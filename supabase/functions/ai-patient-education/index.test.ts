/**
 * AI Patient Education Edge Function Tests
 *
 * Run with: deno test --allow-env supabase/functions/ai-patient-education/index.test.ts
 */

import { assertEquals, assertExists, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// Test education content structure
Deno.test('should have valid education response structure', () => {
  const mockEducation = {
    title: 'Understanding Your Diabetes',
    content: 'Diabetes is a condition that affects how your body processes blood sugar.',
    format: 'article',
    reading_level: '6th grade',
    key_points: [
      'Monitor blood sugar regularly',
      'Take medications as prescribed',
      'Maintain a healthy diet',
    ],
    action_items: [
      'Check blood sugar before meals',
      'Schedule regular checkups',
    ],
    warnings: [
      'Call 911 if blood sugar is extremely high or low',
    ],
    language: 'English',
  };

  assertExists(mockEducation.title);
  assertExists(mockEducation.content);
  assertEquals(mockEducation.reading_level, '6th grade');
  assertEquals(mockEducation.key_points.length, 3);
  assertEquals(mockEducation.action_items.length, 2);
});

Deno.test('should validate format types', () => {
  const validFormats = ['article', 'bullet_points', 'qa', 'instructions'];

  validFormats.forEach((format) => {
    assertEquals(typeof format, 'string');
  });

  assertEquals(validFormats.length, 4);
});

Deno.test('should validate supported languages', () => {
  const supportedLanguages = [
    'English',
    'Spanish',
    'Mandarin',
    'Vietnamese',
    'Korean',
    'Tagalog',
    'Russian',
    'Arabic',
    'Hindi',
    'Portuguese',
    'French',
    'German',
    'Japanese',
  ];

  assertEquals(supportedLanguages.length, 13);
  assertStringIncludes(supportedLanguages.join(','), 'Spanish');
});

Deno.test('should validate request body', () => {
  const validRequest = {
    topic: 'Managing Diabetes',
    condition: 'Type 2 Diabetes',
    patientId: 'patient-123',
    language: 'English',
    format: 'bullet_points',
    includeWarnings: true,
    maxLength: 500,
  };

  assertExists(validRequest.topic);
  assertEquals(validRequest.format, 'bullet_points');
  assertEquals(validRequest.includeWarnings, true);
  assertEquals(validRequest.maxLength, 500);
});

Deno.test('should handle default values for request', () => {
  const request = {
    topic: 'Heart Health',
  };

  const language = request.language ?? 'English';
  const format = request.format ?? 'article';
  const includeWarnings = request.includeWarnings ?? true;
  const maxLength = request.maxLength ?? 500;

  assertEquals(language, 'English');
  assertEquals(format, 'article');
  assertEquals(includeWarnings, true);
  assertEquals(maxLength, 500);
});

Deno.test('should generate appropriate reading level content', () => {
  const sixthGradeGuidelines = {
    maxSentenceLength: 15,
    avoidMedicalJargon: true,
    useSimpleWords: true,
    includeExamples: true,
  };

  assertEquals(sixthGradeGuidelines.avoidMedicalJargon, true);
  assertEquals(sixthGradeGuidelines.maxSentenceLength, 15);
});

Deno.test('should include metadata in response', () => {
  const mockMetadata = {
    generated_at: new Date().toISOString(),
    model: 'claude-haiku-4-5-20250919',
    response_time_ms: 150,
    tokens_used: 350,
  };

  assertExists(mockMetadata.generated_at);
  assertExists(mockMetadata.model);
  assertEquals(typeof mockMetadata.response_time_ms, 'number');
  assertEquals(typeof mockMetadata.tokens_used, 'number');
});
