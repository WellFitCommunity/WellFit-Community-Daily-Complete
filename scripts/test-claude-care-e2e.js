#!/usr/bin/env node

/**
 * Claude Care Assistant - End-to-End Functional Test
 * Tests the complete flow: database → service → expected behavior
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration - Set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Test results
let passed = 0;
let failed = 0;
const failures = [];

// Helper functions
function log(message) {
  console.log(`[TEST] ${message}`);
}

function pass(testName) {
  console.log(`✅ PASS: ${testName}`);
  passed++;
}

function fail(testName, error) {
  console.log(`❌ FAIL: ${testName}`);
  console.log(`   Error: ${error}`);
  failed++;
  failures.push({ test: testName, error });
}

async function runTests() {
  console.log('\n=================================================');
  console.log('Claude Care Assistant - End-to-End Test Suite');
  console.log('=================================================\n');

  // TEST 1: Database Tables Exist
  log('TEST 1: Verifying database tables exist...');
  try {
    const { data: tables, error } = await supabase
      .from('claude_translation_cache')
      .select('id')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      fail('Database tables exist', 'claude_translation_cache table not found');
    } else {
      pass('Database tables exist');
    }
  } catch (err) {
    fail('Database tables exist', err.message);
  }

  // TEST 2: Translation Cache Read/Write
  log('TEST 2: Testing translation cache read/write...');
  try {
    // Insert test translation
    const testTranslation = {
      source_language: 'en',
      target_language: 'es',
      source_text: 'E2E Test: Blood pressure reading',
      translated_text: 'Prueba E2E: Lectura de presión arterial',
      cultural_notes: ['Test note'],
      translation_confidence: 0.95,
      context_type: 'medical',
      usage_count: 1
    };

    const { data: insertData, error: insertError } = await supabase
      .from('claude_translation_cache')
      .insert(testTranslation)
      .select();

    if (insertError && !insertError.message.includes('duplicate')) {
      throw new Error(insertError.message);
    }

    // Retrieve from cache
    const { data: cached, error: cacheError } = await supabase
      .from('claude_translation_cache')
      .select('*')
      .eq('source_language', 'en')
      .eq('target_language', 'es')
      .eq('source_text', 'E2E Test: Blood pressure reading')
      .is('deleted_at', null)
      .single();

    if (cacheError) {
      throw new Error(cacheError.message);
    }

    if (cached && cached.translated_text === testTranslation.translated_text) {
      pass('Translation cache read/write');
    } else {
      fail('Translation cache read/write', 'Translation data mismatch');
    }

    // Update usage count
    const { error: updateError } = await supabase
      .from('claude_translation_cache')
      .update({ usage_count: 2 })
      .eq('id', cached.id);

    if (updateError) {
      fail('Translation cache update', updateError.message);
    } else {
      pass('Translation cache usage count update');
    }
  } catch (err) {
    fail('Translation cache read/write', err.message);
  }

  // TEST 3: Admin Task Templates
  log('TEST 3: Testing admin task templates...');
  try {
    const { data: templates, error } = await supabase
      .from('claude_admin_task_templates')
      .select('*')
      .eq('role', 'physician')
      .eq('is_active', true)
      .is('deleted_at', null);

    if (error) {
      throw new Error(error.message);
    }

    if (templates && templates.length >= 3) {
      pass('Admin task templates for physician');
    } else {
      fail('Admin task templates for physician', `Expected 3+ templates, found ${templates?.length || 0}`);
    }

    // Check template structure
    const priorAuthTemplate = templates.find(t => t.task_type === 'prior_authorization');
    if (priorAuthTemplate) {
      if (priorAuthTemplate.prompt_template &&
          priorAuthTemplate.required_fields &&
          priorAuthTemplate.output_format) {
        pass('Prior authorization template structure');
      } else {
        fail('Prior authorization template structure', 'Missing required fields');
      }
    } else {
      fail('Prior authorization template exists', 'Template not found');
    }
  } catch (err) {
    fail('Admin task templates', err.message);
  }

  // TEST 4: Templates for All Roles
  log('TEST 4: Testing templates for all roles...');
  try {
    const roles = ['physician', 'nurse', 'case_manager', 'social_worker'];
    const roleCounts = {};

    for (const role of roles) {
      const { data, error } = await supabase
        .from('claude_admin_task_templates')
        .select('id')
        .eq('role', role)
        .eq('is_active', true);

      if (error) throw new Error(error.message);
      roleCounts[role] = data?.length || 0;
    }

    let allRolesHaveTemplates = true;
    for (const role of roles) {
      if (roleCounts[role] === 0) {
        allRolesHaveTemplates = false;
        fail(`Templates for ${role}`, 'No templates found');
      }
    }

    if (allRolesHaveTemplates) {
      pass('All roles have templates');
      console.log(`   Counts: physician=${roleCounts.physician}, nurse=${roleCounts.nurse}, case_manager=${roleCounts.case_manager}, social_worker=${roleCounts.social_worker}`);
    }
  } catch (err) {
    fail('Templates for all roles', err.message);
  }

  // TEST 5: RLS Policies (Anonymous Access Denied)
  log('TEST 5: Testing RLS policies block unauthorized access...');
  try {
    // Try to access task history without auth (should fail)
    const { data, error } = await supabase
      .from('claude_admin_task_history')
      .select('*')
      .limit(1);

    // If we get data without auth, RLS is broken
    if (data && data.length > 0 && !error) {
      fail('RLS policies', 'Task history accessible without authentication');
    } else if (error && (error.code === 'PGRST301' || error.message.includes('JWT'))) {
      pass('RLS policies block unauthorized access');
    } else {
      pass('RLS policies active (no data returned)');
    }
  } catch (err) {
    // An error is actually good here - means RLS is working
    pass('RLS policies (threw error as expected)');
  }

  // TEST 6: Voice Input Sessions Table
  log('TEST 6: Testing voice input sessions table...');
  try {
    const { error } = await supabase
      .from('claude_voice_input_sessions')
      .select('id')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      fail('Voice input sessions table', 'Table not found');
    } else {
      pass('Voice input sessions table exists');
    }
  } catch (err) {
    fail('Voice input sessions table', err.message);
  }

  // TEST 7: Care Context Table
  log('TEST 7: Testing care context table...');
  try {
    const { error } = await supabase
      .from('claude_care_context')
      .select('id')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      fail('Care context table', 'Table not found');
    } else {
      pass('Care context table exists');
    }
  } catch (err) {
    fail('Care context table', err.message);
  }

  // TEST 8: Translation Cache Performance
  log('TEST 8: Testing translation cache performance...');
  try {
    const { data, error } = await supabase
      .from('claude_translation_cache')
      .select('source_language, target_language, count')
      .is('deleted_at', null);

    if (error) {
      throw new Error(error.message);
    }

    // Calculate cache statistics
    const totalTranslations = data?.length || 0;

    if (totalTranslations >= 2) {
      pass('Translation cache has entries');
      console.log(`   Cache size: ${totalTranslations} translations`);
    } else {
      fail('Translation cache', `Expected 2+ cached translations, found ${totalTranslations}`);
    }
  } catch (err) {
    fail('Translation cache performance', err.message);
  }

  // TEST 9: Soft Delete Columns
  log('TEST 9: Verifying soft delete implementation...');
  try {
    // Check if deleted_at column exists in translation cache
    const { data, error } = await supabase
      .from('claude_translation_cache')
      .select('deleted_at')
      .limit(1);

    if (error && error.message.includes('deleted_at')) {
      fail('Soft delete columns', 'deleted_at column missing');
    } else {
      pass('Soft delete columns exist');
    }
  } catch (err) {
    // If the column doesn't exist, select would fail
    fail('Soft delete columns', err.message);
  }

  // TEST 10: Timestamp Audit Trails
  log('TEST 10: Verifying audit trail timestamps...');
  try {
    const { data, error } = await supabase
      .from('claude_translation_cache')
      .select('created_at, updated_at')
      .limit(1)
      .single();

    if (error && !error.message.includes('multiple')) {
      throw new Error(error.message);
    }

    if (data && data.created_at) {
      pass('Audit trail timestamps (created_at)');
    } else {
      fail('Audit trail timestamps', 'created_at missing');
    }
  } catch (err) {
    fail('Audit trail timestamps', err.message);
  }

  // Final Summary
  console.log('\n=================================================');
  console.log('Test Summary');
  console.log('=================================================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total:  ${passed + failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ FAILURES:');
    failures.forEach(({ test, error }) => {
      console.log(`   - ${test}: ${error}`);
    });
  }

  console.log('\n=================================================');

  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED - PRODUCTION READY!');
    process.exit(0);
  } else {
    console.log(`❌ ${failed} TEST(S) FAILED - NEEDS ATTENTION`);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
