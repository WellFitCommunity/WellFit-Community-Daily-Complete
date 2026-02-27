// =====================================================
// MCP Edge Functions Server — Function Whitelist
// SECURITY: Only allow specific, safe functions to be invoked
// =====================================================

export interface FunctionDefinition {
  name: string;
  description: string;
  category: 'analytics' | 'reports' | 'workflow' | 'integration' | 'utility';
  requiresAuth: boolean;
  parameters?: Record<string, { type: string; description: string; required?: boolean }>;
  sideEffects: 'none' | 'read' | 'write';
}

export const ALLOWED_FUNCTIONS: Record<string, FunctionDefinition> = {
  // Analytics functions (read-only)
  "get-welfare-priorities": {
    name: "get-welfare-priorities",
    description: "Get prioritized welfare check list based on weather and risk factors",
    category: "analytics",
    requiresAuth: true,
    sideEffects: "read",
    parameters: {
      tenant_id: { type: "string", description: "Tenant ID", required: true },
      limit: { type: "number", description: "Max results" }
    }
  },
  "calculate-readmission-risk": {
    name: "calculate-readmission-risk",
    description: "Calculate readmission risk for a patient",
    category: "analytics",
    requiresAuth: true,
    sideEffects: "read",
    parameters: {
      patient_id: { type: "string", description: "Patient ID", required: true }
    }
  },
  "sdoh-passive-detect": {
    name: "sdoh-passive-detect",
    description: "Run SDOH passive detection for a tenant",
    category: "analytics",
    requiresAuth: true,
    sideEffects: "write",
    parameters: {
      tenant_id: { type: "string", description: "Tenant ID", required: true }
    }
  },
  // Report generation functions
  "generate-engagement-report": {
    name: "generate-engagement-report",
    description: "Generate patient engagement report",
    category: "reports",
    requiresAuth: true,
    sideEffects: "read",
    parameters: {
      patient_id: { type: "string", description: "Patient ID", required: true },
      start_date: { type: "string", description: "Report start date" },
      end_date: { type: "string", description: "Report end date" }
    }
  },
  "generate-quality-report": {
    name: "generate-quality-report",
    description: "Generate quality measures report",
    category: "reports",
    requiresAuth: true,
    sideEffects: "read",
    parameters: {
      tenant_id: { type: "string", description: "Tenant ID", required: true },
      period: { type: "string", description: "Reporting period (quarter/year)" }
    }
  },
  // Integration functions
  "enhanced-fhir-export": {
    name: "enhanced-fhir-export",
    description: "Export patient data as FHIR bundle",
    category: "integration",
    requiresAuth: true,
    sideEffects: "read",
    parameters: {
      patient_id: { type: "string", description: "Patient ID", required: true },
      resources: { type: "array", description: "FHIR resource types to include" }
    }
  },
  "hl7-receive": {
    name: "hl7-receive",
    description: "Process incoming HL7 message",
    category: "integration",
    requiresAuth: true,
    sideEffects: "write",
    parameters: {
      message: { type: "string", description: "HL7 message content", required: true },
      message_type: { type: "string", description: "HL7 message type (ADT, ORM, etc.)" }
    }
  },
  "generate-837p": {
    name: "generate-837p",
    description: "Generate 837P claim file",
    category: "integration",
    requiresAuth: true,
    sideEffects: "read",
    parameters: {
      claim_id: { type: "string", description: "Claim ID", required: true }
    }
  },
  // Workflow functions
  "process-shift-handoff": {
    name: "process-shift-handoff",
    description: "Process shift handoff data",
    category: "workflow",
    requiresAuth: true,
    sideEffects: "write",
    parameters: {
      shift_id: { type: "string", description: "Shift ID", required: true },
      action: { type: "string", description: "Action (create/accept/complete)" }
    }
  },
  "create-care-alert": {
    name: "create-care-alert",
    description: "Create a care coordination alert",
    category: "workflow",
    requiresAuth: true,
    sideEffects: "write",
    parameters: {
      patient_id: { type: "string", description: "Patient ID", required: true },
      alert_type: { type: "string", description: "Alert type", required: true },
      message: { type: "string", description: "Alert message", required: true }
    }
  },
  // Utility functions
  "send-sms": {
    name: "send-sms",
    description: "Send SMS notification",
    category: "utility",
    requiresAuth: true,
    sideEffects: "write",
    parameters: {
      to: { type: "string", description: "Phone number", required: true },
      message: { type: "string", description: "SMS content", required: true },
      template: { type: "string", description: "Optional template name" }
    }
  },
  "hash-pin": {
    name: "hash-pin",
    description: "Hash a caregiver PIN",
    category: "utility",
    requiresAuth: false,
    sideEffects: "none",
    parameters: {
      pin: { type: "string", description: "4-digit PIN", required: true }
    }
  },
  "verify-pin": {
    name: "verify-pin",
    description: "Verify a caregiver PIN",
    category: "utility",
    requiresAuth: false,
    sideEffects: "read",
    parameters: {
      pin: { type: "string", description: "PIN to verify", required: true },
      hash: { type: "string", description: "Stored hash", required: true }
    }
  }
};

// Functions that should NEVER be invoked via MCP (security)
export const BLOCKED_FUNCTIONS = new Set([
  'register',
  'enrollClient',
  'admin-create-user',
  'delete-user',
  'service-role-query',
]);
