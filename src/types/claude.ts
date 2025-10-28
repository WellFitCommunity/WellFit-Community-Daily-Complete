// Type definitions for Claude integration in WellFit Community

// User role definitions for model selection
export enum UserRole {
  SENIOR_PATIENT = 'senior_patient',
  ADMIN = 'admin',
  HEALTHCARE_PROVIDER = 'healthcare_provider',
  CAREGIVER = 'caregiver'
}

// Available Claude models with specific use cases
export enum ClaudeModel {
  HAIKU_3 = 'claude-3-haiku-20240307', // Legacy - being phased out
  HAIKU_4_5 = 'claude-haiku-4-5-20250919', // LATEST: Ultra-fast, intelligent UI/UX personalization and pattern recognition
  SONNET_3_5 = 'claude-3-5-sonnet-20241022', // Legacy - upgrade to 4.5
  SONNET_4 = 'claude-3-5-sonnet-20241022', // Legacy reference
  SONNET_4_5 = 'claude-sonnet-4-5-20250929', // LATEST: Best for billing, revenue, medical coding - accuracy critical
  OPUS_4_1 = 'claude-opus-4-1-20250805' // Advanced model for complex reasoning (reserved for future use)
}

// Request types for determining appropriate model
export enum RequestType {
  HEALTH_QUESTION = 'health_question',
  MEDICATION_GUIDANCE = 'medication_guidance',
  ANALYTICS = 'analytics',
  FHIR_ANALYSIS = 'fhir_analysis',
  RISK_ASSESSMENT = 'risk_assessment',
  CLINICAL_NOTES = 'clinical_notes',
  HEALTH_INSIGHTS = 'health_insights',
  // NEW: Smart dashboard and personalization types (use Haiku 4.5)
  UI_PERSONALIZATION = 'ui_personalization',
  USAGE_PATTERN_ANALYSIS = 'usage_pattern_analysis',
  DASHBOARD_PREDICTION = 'dashboard_prediction',
  // Revenue-critical types (use Sonnet 4.5)
  MEDICAL_BILLING = 'medical_billing',
  REVENUE_OPTIMIZATION = 'revenue_optimization',
  CLAIMS_PROCESSING = 'claims_processing',
  CPT_ICD_CODING = 'cpt_icd_coding',
  // NEW: Claude Care Assistant types
  TRANSLATION = 'translation', // Language translation with cultural context (use Haiku 4.5)
  ADMINISTRATIVE_TASK = 'administrative_task' // Administrative task automation (varies by role)
}

// Health data context for Claude requests
export interface HealthDataContext {
  patientId: string;
  demographics: {
    age: number;
    gender: string;
    primaryLanguage?: string;
  };
  currentConditions: Array<{
    condition: string;
    severity: 'mild' | 'moderate' | 'severe';
    onsetDate?: string;
  }>;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    purpose: string;
  }>;
  recentVitals: {
    bloodPressure?: string;
    heartRate?: number;
    weight?: number;
    bloodSugar?: number;
    lastUpdated: string;
  };
}

// Request context for Claude service calls
export interface ClaudeRequestContext {
  userId: string;
  userRole: UserRole;
  requestId: string;
  timestamp: Date;
  requestType: RequestType;
  healthContext?: HealthDataContext;
  emergencyContact?: string;
}

// Response from Claude service
export interface ClaudeResponse {
  content: string;
  model: ClaudeModel;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
  cost: number;
  responseTime: number;
  qualityScore?: number;
  requestId: string;
}

// Error types for Claude service
export interface ClaudeError {
  code: string;
  message: string;
  statusCode?: number;
  originalError?: any;
  requestId?: string;
}

// Model selection criteria
export interface ModelSelectionCriteria {
  userRole: UserRole;
  requestType: RequestType;
  complexity: 'simple' | 'moderate' | 'complex';
  budgetTier: 'standard' | 'premium';
}

// Cost tracking information
export interface CostInfo {
  estimatedCost: number;
  actualCost: number;
  dailySpend: number;
  monthlySpend: number;
  remainingBudget: number;
}

// Service health status
export interface ServiceStatus {
  isInitialized: boolean;
  isHealthy: boolean;
  lastHealthCheck: Date;
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  apiKeyValid: boolean;
  modelsAvailable: ClaudeModel[];
}