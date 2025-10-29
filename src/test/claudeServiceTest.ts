// Claude Service Integration Test
// This file tests the Claude service without running in the full app context

import { claudeService } from '../services/claudeService';

/**
 * Simple test to verify Claude service initialization and basic functionality
 */
export async function testClaudeService() {

  console.log('='.repeat(50));

  try {
    // Test 1: Service initialization

    await claudeService.initialize();


    // Test 2: Connection test

    const connectionResult = await claudeService.testConnection();



    if (!connectionResult.success) {

      return false;
    }

    // Test 3: Health check

    const healthCheck = await claudeService.healthCheck();


    // Test 4: Service status

    const status = claudeService.getServiceStatus();







    // Test 5: Legacy method compatibility

    const legacyResponse = await claudeService.chatWithHealthAssistant(
      "Hello, this is a test message to verify the Claude integration is working."
    );

    console.log(`"${legacyResponse.substring(0, 100)}..."`);

    console.log('\n' + '='.repeat(50));



    console.log('='.repeat(50));

    return true;

  } catch (error) {



    if (error instanceof Error) {
      if (error.message.includes('ANTHROPIC_API_KEY')) {




      }
    }

    return false;
  }
}

// Self-executing test if run directly
if (require.main === module) {
  testClaudeService().then(success => {
    process.exit(success ? 0 : 1);
  });
}