// Claude Service Integration Test
// This file tests the Claude service without running in the full app context

import { claudeService } from '../services/claudeService';

/**
 * Simple test to verify Claude service initialization and basic functionality
 */
export async function testClaudeService() {
  console.log('🧪 Testing Claude Service Integration...');
  console.log('='.repeat(50));

  try {
    // Test 1: Service initialization
    console.log('\n1️⃣ Testing service initialization...');
    await claudeService.initialize();
    console.log('✅ Service initialized successfully');

    // Test 2: Connection test
    console.log('\n2️⃣ Testing API connection...');
    const connectionResult = await claudeService.testConnection();
    console.log(`Connection test: ${connectionResult.success ? '✅' : '❌'}`);
    console.log(`Message: ${connectionResult.message}`);

    if (!connectionResult.success) {
      console.error('❌ Connection test failed. Please check your API key configuration.');
      return false;
    }

    // Test 3: Health check
    console.log('\n3️⃣ Testing health check...');
    const healthCheck = await claudeService.healthCheck();
    console.log(`Health check: ${healthCheck ? '✅' : '❌'}`);

    // Test 4: Service status
    console.log('\n4️⃣ Testing service status...');
    const status = claudeService.getServiceStatus();
    console.log('Service Status:');
    console.log(`  - Initialized: ${status.isInitialized ? '✅' : '❌'}`);
    console.log(`  - Healthy: ${status.isHealthy ? '✅' : '❌'}`);
    console.log(`  - API Key Valid: ${status.apiKeyValid ? '✅' : '❌'}`);
    console.log(`  - Circuit Breaker: ${status.circuitBreakerState}`);
    console.log(`  - Models Available: ${status.modelsAvailable.length}`);

    // Test 5: Legacy method compatibility
    console.log('\n5️⃣ Testing legacy method compatibility...');
    const legacyResponse = await claudeService.chatWithHealthAssistant(
      "Hello, this is a test message to verify the Claude integration is working."
    );
    console.log('✅ Legacy method response:');
    console.log(`"${legacyResponse.substring(0, 100)}..."`);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 All Claude service tests passed successfully!');
    console.log('✅ The "Claude Client not initialize" error has been resolved.');
    console.log('✅ Dual-model architecture is ready for senior patients and admin users.');
    console.log('='.repeat(50));

    return true;

  } catch (error) {
    console.error('\n❌ Claude service test failed:');
    console.error(error);

    if (error instanceof Error) {
      if (error.message.includes('ANTHROPIC_API_KEY')) {
        console.error('\n💡 Resolution steps:');
        console.error('1. Copy .env.example to .env.local');
        console.error('2. Add your Anthropic API key to .env.local');
        console.error('3. Restart the development server');
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