// Claude Integration Examples for WellFit Community
// These examples demonstrate the dual-model approach for different user roles

import { claudeService, UserRole, RequestType, ClaudeRequestContext, HealthDataContext } from '../services/claudeService';

/**
 * Example 1: Senior Patient Health Question
 * Uses cost-effective Haiku model for simple questions
 */
export async function seniorPatientExample() {


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



    console.log(`💰 Cost: $${response.cost.toFixed(4)} | Model: ${response.model} | Time: ${response.responseTime}ms`);

    return response;
  } catch (error) {

    throw error;
  }
}

/**
 * Example 2: Admin Medical Analytics
 * Uses advanced Sonnet model for complex population analysis
 */
export async function adminAnalyticsExample() {


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



    console.log(`💰 Cost: $${response.cost.toFixed(4)} | Model: ${response.model} | Time: ${response.responseTime}ms`);

    return response;
  } catch (error) {

    throw error;
  }
}

/**
 * Example 3: Health Data Interpretation for Seniors
 * Uses Sonnet 3.5 for balanced capability and cost
 */
export async function healthDataInterpretationExample() {


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



    console.log(`💰 Cost: $${response.cost.toFixed(4)} | Model: ${response.model} | Time: ${response.responseTime}ms`);

    return response;
  } catch (error) {

    throw error;
  }
}

/**
 * Example 4: Risk Assessment for Healthcare Providers
 * Uses advanced model for clinical decision support
 */
export async function riskAssessmentExample() {


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



    console.log(`Risk Factors: ${riskAnalysis.riskFactors.join(', ')}`);
    console.log(`Recommendations: ${riskAnalysis.recommendations.join(', ')}`);


    return riskAnalysis;
  } catch (error) {

    throw error;
  }
}

/**
 * Example 5: Service Status and Monitoring
 * Demonstrates monitoring capabilities
 */
export async function serviceMonitoringExample() {


  try {
    // Test connection
    const connectionTest = await claudeService.testConnection();


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

    throw error;
  }
}

/**
 * Complete Integration Test Suite
 * Runs all examples to demonstrate the system
 */
export async function runCompleteIntegrationTest() {

  console.log('='.repeat(60));

  try {
    // Initialize the service

    await claudeService.initialize();


    // Run all examples


    const results = {
      seniorPatient: await seniorPatientExample(),
      adminAnalytics: await adminAnalyticsExample(),
      healthDataInterpretation: await healthDataInterpretationExample(),
      riskAssessment: await riskAssessmentExample(),
      serviceMonitoring: await serviceMonitoringExample()
    };

    console.log('\n' + '='.repeat(60));








    const totalCost = [
      results.seniorPatient.cost,
      results.adminAnalytics.cost,
      results.healthDataInterpretation.cost
    ].reduce((sum, cost) => sum + cost, 0);

    console.log(`\n💰 Total Test Cost: $${totalCost.toFixed(4)}`);
    console.log('='.repeat(60));

    return results;
  } catch (error) {

    throw error;
  }
}

// Functions are already exported individually above