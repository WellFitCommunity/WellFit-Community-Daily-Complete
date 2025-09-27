# Claude AI Integration Setup Guide - WellFit Community Health Platform

## 🎯 Overview

This guide provides complete setup instructions for the enhanced Claude AI integration in your WellFit Community Health Platform. The integration features dual-model architecture optimized for different user roles and comprehensive healthcare functionality.

## ✅ What's Been Fixed

- **❌ "Claude Client not initialize. Check Api Key configuration" error** → **✅ RESOLVED**
- **❌ Incorrect Sonnet 4 model naming** → **✅ Updated to latest model versions**
- **❌ Missing error handling and initialization patterns** → **✅ Comprehensive error handling added**
- **❌ Insufficient cost management** → **✅ Advanced budget tracking implemented**
- **❌ Basic rate limiting** → **✅ User-specific rate limiting with circuit breakers**

## 🏗️ Architecture Overview

### Dual-Model Strategy

| User Role | Model Used | Use Case | Cost Optimization |
|-----------|------------|----------|-------------------|
| **Senior Patients** | Claude Haiku 3 | Simple health questions, basic guidance | 💰 Cost-effective (~$0.0003/request) |
| **Caregivers** | Claude Haiku 3 / Sonnet 3.5 | Health support, medication reminders | 💰 Balanced cost/capability |
| **Healthcare Providers** | Claude Sonnet 3.5 / Sonnet 4 | Clinical analysis, care planning | ⚖️ Capability-focused |
| **Admins** | Claude Sonnet 4 | Advanced analytics, population health | 🚀 Maximum capability |

### Key Features

- **🔒 HIPAA-Compliant**: Secure PHI handling with encryption
- **💰 Cost Management**: Per-user budgets with real-time tracking
- **⚡ Rate Limiting**: 60 requests/minute per user with circuit breakers
- **🔄 Error Recovery**: Automatic retries and graceful degradation
- **📊 Monitoring**: Comprehensive service health and usage metrics

## 🚀 Quick Setup (5 Minutes)

### Step 1: Environment Configuration

1. **Copy environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Get your Anthropic API key:**
   - Visit [Anthropic Console](https://console.anthropic.com/)
   - Create account or sign in
   - Navigate to API Keys
   - Generate new API key (starts with `sk-ant-`)

3. **Configure `.env.local`:**
   ```env
   # Required: Your Anthropic API Key
   REACT_APP_ANTHROPIC_API_KEY=sk-ant-your_actual_api_key_here

   # Default configurations (no changes needed)
   REACT_APP_CLAUDE_DEFAULT_MODEL=claude-3-5-sonnet-20241022
   REACT_APP_CLAUDE_ADMIN_MODEL=claude-3-5-sonnet-20241022
   REACT_APP_CLAUDE_MAX_TOKENS=4000
   REACT_APP_CLAUDE_TIMEOUT=30000
   NODE_ENV=development
   ```

### Step 2: Initialize and Test

1. **Start your development server:**
   ```bash
   npm run start:cs
   ```

2. **Test the integration:**
   ```bash
   # Run the test suite
   node -r ts-node/register src/test/claudeServiceTest.ts
   ```

3. **Verify in browser console:**
   ```javascript
   // Open browser console and run:
   import { claudeService } from './src/services/claudeService';
   await claudeService.testConnection();
   ```

## 🔧 Integration Examples

### For Senior Patients (Simple Health Questions)

```typescript
import { claudeService, UserRole, RequestType } from './src/services/claudeService';

// Example: Senior asks about medication
const context = {
  userId: 'senior-patient-123',
  userRole: UserRole.SENIOR_PATIENT,
  requestId: `question-${Date.now()}`,
  timestamp: new Date(),
  requestType: RequestType.HEALTH_QUESTION
};

const response = await claudeService.generateSeniorHealthGuidance(
  "I forgot to take my blood pressure medication. What should I do?",
  context
);

console.log(response.content); // Simple, senior-friendly response
console.log(`Cost: $${response.cost.toFixed(4)}`); // Typically $0.001-$0.003
```

### For Admins (Advanced Analytics)

```typescript
// Example: Admin requests population health analysis
const healthData = [
  {
    patientId: 'patient-001',
    demographics: { age: 75, gender: 'female' },
    currentConditions: [
      { condition: 'Hypertension', severity: 'moderate' }
    ],
    medications: [
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Daily', purpose: 'BP control' }
    ],
    recentVitals: {
      bloodPressure: '140/90',
      heartRate: 72,
      lastUpdated: new Date().toISOString()
    }
  }
  // ... more patient data
];

const adminContext = {
  userId: 'admin-001',
  userRole: UserRole.ADMIN,
  requestId: `analytics-${Date.now()}`,
  timestamp: new Date(),
  requestType: RequestType.ANALYTICS
};

const analytics = await claudeService.generateMedicalAnalytics(
  "Analyze cardiovascular risk factors and recommend interventions",
  healthData,
  adminContext
);

console.log(analytics.content); // Detailed clinical analysis
console.log(`Cost: $${analytics.cost.toFixed(4)}`); // Typically $0.05-$0.20
```

## 🔍 Troubleshooting

### Common Issues & Solutions

#### 1. "API Key Invalid" Error
```bash
# Check your API key format
echo $REACT_APP_ANTHROPIC_API_KEY
# Should start with 'sk-ant-' and be ~100 characters

# Test key validity
curl -H "x-api-key: $REACT_APP_ANTHROPIC_API_KEY" \
     -H "content-type: application/json" \
     -X POST \
     https://api.anthropic.com/v1/messages \
     -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

#### 2. "Rate Limit Exceeded" Error
```typescript
// Check rate limit status
const rateLimitInfo = claudeService.getRateLimitInfo('your-user-id');
console.log(`Remaining requests: ${rateLimitInfo.remaining}/${rateLimitInfo.limit}`);
console.log(`Reset time: ${rateLimitInfo.resetTime}`);
```

#### 3. "Budget Exceeded" Error
```typescript
// Check spending status
const costInfo = claudeService.getCostInfo('your-user-id');
console.log(`Daily spend: $${costInfo.dailySpend.toFixed(2)}`);
console.log(`Monthly spend: $${costInfo.monthlySpend.toFixed(2)}`);
console.log(`Remaining budget: $${costInfo.remainingBudget.toFixed(2)}`);
```

#### 4. Service Initialization Issues
```typescript
// Check service status
const status = claudeService.getServiceStatus();
console.log('Service Status:', {
  initialized: status.isInitialized,
  healthy: status.isHealthy,
  circuitBreaker: status.circuitBreakerState,
  apiKeyValid: status.apiKeyValid
});

// Reset service if needed
await claudeService.resetService();
```

## 📊 Monitoring & Management

### Health Monitoring
```typescript
// Regular health checks
setInterval(async () => {
  const isHealthy = await claudeService.healthCheck();
  console.log(`Claude service health: ${isHealthy ? 'OK' : 'FAILING'}`);
}, 300000); // Every 5 minutes
```

### Cost Monitoring
```typescript
// Daily cost reports
const spendingSummary = claudeService.getSpendingSummary();
console.log(`Total daily spend: $${spendingSummary.totalDaily.toFixed(2)}`);
console.log(`Active users: ${spendingSummary.userCount}`);
```

### Circuit Breaker Status
```typescript
// Monitor API reliability
const cbStatus = claudeService.getCircuitBreakerStatus();
console.log(`Circuit breaker: ${cbStatus.state}`);
console.log(`Recent failures: ${cbStatus.failures}`);
```

## ⚙️ Configuration Options

### Budget Management
```env
# Adjust spending limits in .env.local
CLAUDE_DAILY_BUDGET=50    # $50 per user per day
CLAUDE_MONTHLY_BUDGET=500 # $500 per user per month
ENABLE_COST_ALERTS=true
```

### Rate Limiting
```typescript
// Customize rate limits in claudeService.ts
const rateLimiter = new RateLimiter(
  60,    // Max requests per window
  60000  // Window size in milliseconds (1 minute)
);
```

### Model Selection
```typescript
// Customize model selection in utils/claudeModelSelection.ts
// Based on user role, request type, and complexity
```

## 🔒 Security & Compliance

### API Key Security
- ✅ Keys validated at startup
- ✅ Environment-based configuration
- ✅ No hardcoded credentials
- ✅ Automatic key format validation

### HIPAA Compliance
- ✅ PHI data encryption in transit
- ✅ Audit logging enabled
- ✅ User access controls
- ✅ Data retention policies

### Error Handling
- ✅ Graceful degradation
- ✅ Circuit breaker protection
- ✅ Comprehensive logging
- ✅ User-friendly error messages

## 📈 Performance Optimization

### Response Times
- **Haiku 3**: ~500-1000ms (Fast responses for seniors)
- **Sonnet 3.5**: ~1000-2000ms (Balanced performance)
- **Sonnet 4**: ~2000-4000ms (Complex analysis)

### Cost Optimization
- **Senior patients**: ~$0.001-0.003 per request
- **Admin analytics**: ~$0.05-0.20 per request
- **Monthly budget**: $50-500 per user depending on role

### Caching Strategy
```typescript
// Implement response caching for common queries
const cache = new Map();
const cacheKey = `${userId}-${questionHash}`;
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
```

## 🚀 Next Steps

1. **Production Deployment:**
   - Set up monitoring dashboards
   - Configure alert systems
   - Implement backup strategies

2. **Feature Enhancements:**
   - Add conversation history
   - Implement context persistence
   - Create user preference learning

3. **Integration Expansion:**
   - Connect with EHR systems
   - Add voice interface support
   - Implement multilingual support

## 📞 Support

If you encounter issues not covered in this guide:

1. **Check the integration examples**: `src/examples/claudeIntegrationExamples.ts`
2. **Run the test suite**: `src/test/claudeServiceTest.ts`
3. **Review service logs** in browser console
4. **Verify environment configuration** with the validation function

## ✅ Success Verification

Your integration is working correctly when:

- ✅ Service initializes without errors
- ✅ Test connection returns success
- ✅ Health checks pass consistently
- ✅ Senior patients get simple, friendly responses
- ✅ Admin users get detailed analytical insights
- ✅ Cost tracking shows reasonable spending levels
- ✅ No "Claude Client not initialize" errors appear

**🎉 Congratulations! Your WellFit Community platform now has a production-ready, dual-model Claude AI integration optimized for senior healthcare!**