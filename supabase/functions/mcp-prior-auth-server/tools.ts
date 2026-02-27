// =====================================================
// MCP Prior Auth Server — Tool Definitions
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

export const TOOLS = {
  "create_prior_auth": {
    description: "Create a new prior authorization request",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        payer_id: { type: "string", description: "Payer identifier" },
        service_codes: {
          type: "array",
          items: { type: "string" },
          description: "CPT/HCPCS codes requiring authorization"
        },
        diagnosis_codes: {
          type: "array",
          items: { type: "string" },
          description: "ICD-10 diagnosis codes"
        },
        urgency: {
          type: "string",
          enum: ["stat", "urgent", "routine"],
          description: "Request urgency (stat=4hr, urgent=72hr, routine=7days)"
        },
        ordering_provider_npi: { type: "string", description: "Ordering provider NPI" },
        rendering_provider_npi: { type: "string", description: "Rendering provider NPI" },
        facility_npi: { type: "string", description: "Facility NPI" },
        payer_name: { type: "string", description: "Payer name" },
        member_id: { type: "string", description: "Member ID" },
        date_of_service: { type: "string", description: "Date of service (YYYY-MM-DD)" },
        clinical_notes: { type: "string", description: "Clinical justification" },
        requested_units: { type: "number", description: "Requested units" },
        tenant_id: { type: "string", description: "Tenant UUID" }
      },
      required: ["patient_id", "payer_id", "service_codes", "diagnosis_codes", "tenant_id"]
    }
  },
  "submit_prior_auth": {
    description: "Submit a prior authorization request to the payer",
    inputSchema: {
      type: "object",
      properties: {
        prior_auth_id: { type: "string", description: "Prior authorization UUID" }
      },
      required: ["prior_auth_id"]
    }
  },
  "get_prior_auth": {
    description: "Get prior authorization details by ID or auth number",
    inputSchema: {
      type: "object",
      properties: {
        prior_auth_id: { type: "string", description: "Prior authorization UUID" },
        auth_number: { type: "string", description: "Authorization number" }
      }
    }
  },
  "get_patient_prior_auths": {
    description: "Get all prior authorizations for a patient",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        status: {
          type: "string",
          enum: ["all", "active", "pending", "completed"],
          description: "Status filter"
        }
      },
      required: ["patient_id"]
    }
  },
  "record_decision": {
    description: "Record a payer decision on a prior authorization",
    inputSchema: {
      type: "object",
      properties: {
        prior_auth_id: { type: "string", description: "Prior authorization UUID" },
        decision_type: {
          type: "string",
          enum: ["approved", "denied", "partial_approval", "pended", "cancelled"],
          description: "Decision type"
        },
        auth_number: { type: "string", description: "Authorization number (for approvals)" },
        approved_units: { type: "number", description: "Approved units" },
        approved_start_date: { type: "string", description: "Approval start date" },
        approved_end_date: { type: "string", description: "Approval end date (expiration)" },
        denial_reason_code: { type: "string", description: "Denial reason code" },
        denial_reason_description: { type: "string", description: "Denial reason text" },
        appeal_deadline: { type: "string", description: "Appeal deadline date" },
        decision_reason: { type: "string", description: "Decision notes" },
        tenant_id: { type: "string", description: "Tenant UUID" }
      },
      required: ["prior_auth_id", "decision_type", "tenant_id"]
    }
  },
  "create_appeal": {
    description: "Create an appeal for a denied prior authorization",
    inputSchema: {
      type: "object",
      properties: {
        prior_auth_id: { type: "string", description: "Prior authorization UUID" },
        decision_id: { type: "string", description: "Decision UUID to appeal" },
        appeal_reason: { type: "string", description: "Reason for appeal" },
        appeal_type: {
          type: "string",
          enum: ["reconsideration", "peer_to_peer", "external_review"],
          description: "Type of appeal"
        },
        clinical_rationale: { type: "string", description: "Clinical rationale" },
        tenant_id: { type: "string", description: "Tenant UUID" }
      },
      required: ["prior_auth_id", "appeal_reason", "tenant_id"]
    }
  },
  "check_prior_auth_required": {
    description: "Check if prior authorization is required for a claim",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        service_codes: {
          type: "array",
          items: { type: "string" },
          description: "CPT/HCPCS codes"
        },
        date_of_service: { type: "string", description: "Date of service" },
        tenant_id: { type: "string", description: "Tenant UUID" }
      },
      required: ["patient_id", "service_codes", "date_of_service", "tenant_id"]
    }
  },
  "get_pending_prior_auths": {
    description: "Get pending prior authorizations approaching deadline",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string", description: "Tenant UUID" },
        hours_threshold: { type: "number", description: "Hours until deadline (default 24)" }
      },
      required: ["tenant_id"]
    }
  },
  "get_prior_auth_statistics": {
    description: "Get prior authorization statistics for dashboard",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string", description: "Tenant UUID" },
        start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
        end_date: { type: "string", description: "End date (YYYY-MM-DD)" }
      },
      required: ["tenant_id"]
    }
  },
  "cancel_prior_auth": {
    description: "Cancel a prior authorization request",
    inputSchema: {
      type: "object",
      properties: {
        prior_auth_id: { type: "string", description: "Prior authorization UUID" },
        reason: { type: "string", description: "Cancellation reason" }
      },
      required: ["prior_auth_id"]
    }
  },
  "to_fhir_claim": {
    description: "Convert prior authorization to FHIR Claim resource (Da Vinci PAS)",
    inputSchema: {
      type: "object",
      properties: {
        prior_auth_id: { type: "string", description: "Prior authorization UUID" }
      },
      required: ["prior_auth_id"]
    }
  },
  "ping": PING_TOOL
};
