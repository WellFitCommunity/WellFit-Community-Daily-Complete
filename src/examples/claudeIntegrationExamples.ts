// Claude Integration Examples for WellFit Community
// These examples demonstrate the dual-model approach for different user roles

import { claudeService, UserRole, RequestType, ClaudeRequestContext, HealthDataContext } from '../services/claudeService';

/**
 * Example 1: Senior Patient Health Question
 * Uses cost-effective Haiku model for simple questions
 */
export async function seniorPatientExample() {
  console.log('🧓 Senior Patient Example: Simple Health Question');

  const context: ClaudeRequestContext = {
    userId: 'senior-patient-123',
    userRole: UserRole.SENIOR_PATIENT,
    requestId: `senior-q-${Date.now()}`,
    timestamp: new Date(),
    requestType: RequestType.HEALTH_QUESTION
  };

  try {
    const response = await claudeService.generateSeniorHealthGuidance(
      "I forgot to take my blood pressure medication this morning. What should I do?",
      context
    );

    console.log('✅ Senior Patient Response:');
    console.log(response.content);
    console.log(`💰 Cost: $${response.cost.toFixed(4)} | Model: ${response.model} | Time: ${response.responseTime}ms`);

    return response;
  } catch (error) {
    console.error('❌ Senior patient example failed:', error);
    throw error;
  }
}

/**
 * Example 2: Admin Medical Analytics
 * Uses advanced Sonnet model for complex population analysis
 */
export async function adminAnalyticsExample() {
  console.log('👨‍💼 Admin Example: Population Health Analytics');

  // Sample population data
  const healthData: HealthDataContext[] = [
    {
      patientId: 'patient-001',
      demographics: { age: 75, gender: 'female' },
      currentConditions: [
        { condition: 'Hypertension', severity: 'moderate' },
        { condition: 'Type 2 Diabetes', severity: 'mild' }
      ],
      medications: [
        { name: 'Lisinopril', dosage: '10mg', frequency: 'Daily', purpose: 'Blood pressure control' }
      ],
      recentVitals: {
        bloodPressure: '140/90',
        heartRate: 72,
        bloodSugar: 145,
        lastUpdated: new Date().toISOString()
      }
    },
    {
      patientId: 'patient-002',
      demographics: { age: 82, gender: 'male' },
      currentConditions: [
        { condition: 'Arthritis', severity: 'moderate' },
        { condition: 'High Cholesterol', severity: 'mild' }
      ],
      medications: [
        { name: 'Ibuprofen', dosage: '400mg', frequency: 'As needed', purpose: 'Pain management' }
      ],
      recentVitals: {
        bloodPressure: '135/85',
        heartRate: 68,
        weight: 165,
        lastUpdated: new Date().toISOString()
      }
    }
  ];

  const context: ClaudeRequestContext = {
    userId: 'admin-001',
    userRole: UserRole.ADMIN,
    requestId: `admin-analytics-${Date.now()}`,
    timestamp: new Date(),
    requestType: RequestType.ANALYTICS
  };

  try {
    const response = await claudeService.generateMedicalAnalytics(
      "Analyze this patient population for cardiovascular risk factors and recommend preventive care interventions",
      healthData,
      context
    );

    console.log('✅ Admin Analytics Response:');
    console.log(response.content);
    console.log(`💰 Cost: $${response.cost.toFixed(4)} | Model: ${response.model} | Time: ${response.responseTime}ms`);

    return response;
  } catch (error) {
    console.error('❌ Admin analytics example failed:', error);
    throw error;
  }
}

/**
 * Example 3: Health Data Interpretation for Seniors
 * Uses Sonnet 3.5 for balanced capability and cost
 */
export async function healthDataInterpretationExample() {
  console.log('📊 Health Data Interpretation Example');

  const healthContext: HealthDataContext = {
    patientId: 'patient-health-data',
    demographics: { age: 78, gender: 'female' },
    currentConditions: [
      { condition: 'Hypertension', severity: 'moderate' }
    ],
    medications: [
      { name: 'Amlodipine', dosage: '5mg', frequency: 'Daily', purpose: 'Blood pressure control' }
    ],
    recentVitals: {
      bloodPressure: '142/88',
      heartRate: 75,
      weight: 155,
      bloodSugar: 98,
      lastUpdated: new Date().toISOString()
    }
  };

  const context: ClaudeRequestContext = {
    userId: 'health-data-patient',
    userRole: UserRole.SENIOR_PATIENT,
    requestId: `health-data-${Date.now()}`,
    timestamp: new Date(),
    requestType: RequestType.HEALTH_INSIGHTS,
    healthContext
  };

  try {
    const response = await claudeService.generateSeniorHealthGuidance(
      "Can you explain what my recent health measurements mean?",
      context
    );

    console.log('✅ Health Data Interpretation Response:');
    console.log(response.content);
    console.log(`💰 Cost: $${response.cost.toFixed(4)} | Model: ${response.model} | Time: ${response.responseTime}ms`);

    return response;
  } catch (error) {
    console.error('❌ Health data interpretation example failed:', error);
    throw error;
  }
}

/**
 * Example 4: Risk Assessment for Healthcare Providers
 * Uses advanced model for clinical decision support
 */
export async function riskAssessmentExample() {
  console.log('⚠️ Risk Assessment Example');

  // Sample functional assessment data
  const assessmentData = {
    walking_ability: 'Requires assistance',
    stair_climbing: 'Unable without support',
    sitting_ability: 'Independent',
    standing_ability: 'Requires assistance',
    toilet_transfer: 'Independent with equipment',
    bathing_ability: 'Requires partial assistance',
    meal_preparation: 'Unable to prepare meals',
    medication_management: 'Requires reminders',
    fall_risk_factors: ['Previous falls', 'Balance issues', 'Medication side effects'],
    medical_risk_score: 6,
    mobility_risk_score: 8,
    cognitive_risk_score: 3,
    social_risk_score: 5
  };

  try {
    const riskAnalysis = await claudeService.analyzeRiskAssessment(assessmentData);

    console.log('✅ Risk Assessment Analysis:');
    console.log(`Risk Level: ${riskAnalysis.suggestedRiskLevel}`);
    console.log(`Risk Factors: ${riskAnalysis.riskFactors.join(', ')}`);
    console.log(`Recommendations: ${riskAnalysis.recommendations.join(', ')}`);
    console.log(`Clinical Notes: ${riskAnalysis.clinicalNotes}`);

    return riskAnalysis;
  } catch (error) {
    console.error('❌ Risk assessment example failed:', error);
    throw error;
  }
}

/**
 * Example 5: Service Status and Monitoring
 * Demonstrates monitoring capabilities
 */
export async function serviceMonitoringExample() {
  console.log('📈 Service Monitoring Example');

  try {
    // Test connection
    const connectionTest = await claudeService.testConnection();
    console.log('Connection Test:', connectionTest);

    // Get service status
    const status = claudeService.getServiceStatus();
    console.log('Service Status:', {
      initialized: status.isInitialized,
      healthy: status.isHealthy,
      lastHealthCheck: status.lastHealthCheck,
      circuitBreaker: status.circuitBreakerState,
      apiKeyValid: status.apiKeyValid,
      modelsAvailable: status.modelsAvailable.length
    });

    // Get cost information
    const costInfo = claudeService.getCostInfo('example-user');
    console.log('Cost Info:', {
      dailySpend: `$${costInfo.dailySpend.toFixed(2)}`,
      monthlySpend: `$${costInfo.monthlySpend.toFixed(2)}`,
      remainingBudget: `$${costInfo.remainingBudget.toFixed(2)}`
    });

    // Get rate limit info
    const rateLimitInfo = claudeService.getRateLimitInfo('example-user');
    console.log('Rate Limit Info:', {
      remaining: rateLimitInfo.remaining,
      limit: rateLimitInfo.limit,
      resetTime: rateLimitInfo.resetTime
    });

    // Get spending summary
    const spendingSummary = claudeService.getSpendingSummary();
    console.log('Spending Summary:', {
      totalDaily: `$${spendingSummary.totalDaily.toFixed(2)}`,
      totalMonthly: `$${spendingSummary.totalMonthly.toFixed(2)}`,
      activeUsers: spendingSummary.userCount
    });

    return { connectionTest, status, costInfo, rateLimitInfo, spendingSummary };
  } catch (error) {
    console.error('❌ Service monitoring example failed:', error);
    throw error;
  }
}

/**
 * Complete Integration Test Suite
 * Runs all examples to demonstrate the system
 */
export async function runCompleteIntegrationTest() {
  console.log('🚀 Starting Complete Claude Integration Test Suite');
  console.log('='.repeat(60));

  try {
    // Initialize the service
    console.log('1️⃣ Initializing Claude service...');
    await claudeService.initialize();
    console.log('✅ Service initialized successfully\n');

    // Run all examples
    console.log('2️⃣ Running integration examples...\n');

    const results = {
      seniorPatient: await seniorPatientExample(),
      adminAnalytics: await adminAnalyticsExample(),
      healthDataInterpretation: await healthDataInterpretationExample(),
      riskAssessment: await riskAssessmentExample(),
      serviceMonitoring: await serviceMonitoringExample()
    };

    console.log('\n' + '='.repeat(60));
    console.log('🎉 All integration tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log(`• Senior Patient Response: ${results.seniorPatient.content.length} characters`);
    console.log(`• Admin Analytics: ${results.adminAnalytics.content.length} characters`);
    console.log(`• Health Data Interpretation: ${results.healthDataInterpretation.content.length} characters`);
    console.log(`• Risk Assessment: ${results.riskAssessment.suggestedRiskLevel} risk level`);
    console.log(`• Service Monitoring: ${results.serviceMonitoring.status.isHealthy ? 'Healthy' : 'Unhealthy'}`);

    const totalCost = [
      results.seniorPatient.cost,
      results.adminAnalytics.cost,
      results.healthDataInterpretation.cost
    ].reduce((sum, cost) => sum + cost, 0);

    console.log(`\n💰 Total Test Cost: $${totalCost.toFixed(4)}`);
    console.log('='.repeat(60));

    return results;
  } catch (error) {
    console.error('❌ Integration test suite failed:', error);
    throw error;
  }
}

// Functions are already exported individually above