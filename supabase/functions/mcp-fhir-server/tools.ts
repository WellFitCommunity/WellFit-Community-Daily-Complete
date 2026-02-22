// =====================================================
// MCP FHIR Server - Tool Definitions & Table Mappings
// Purpose: FHIR resource type mapping and MCP tool schema definitions
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

// =====================================================
// FHIR Resource Type -> Database Table Mapping
// =====================================================

export const FHIR_TABLES: Record<string, string> = {
  'Patient': 'profiles',
  'MedicationRequest': 'fhir_medication_requests',
  'Condition': 'fhir_conditions',
  'DiagnosticReport': 'fhir_diagnostic_reports',
  'Procedure': 'fhir_procedures',
  'Observation': 'fhir_observations',
  'Immunization': 'fhir_immunizations',
  'CarePlan': 'fhir_care_plans',
  'CareTeam': 'fhir_care_teams',
  'Practitioner': 'fhir_practitioners',
  'PractitionerRole': 'fhir_practitioner_roles',
  'Encounter': 'fhir_encounters',
  'DocumentReference': 'fhir_document_references',
  'AllergyIntolerance': 'fhir_allergies',
  'Goal': 'fhir_goals',
  'Location': 'fhir_locations',
  'Organization': 'fhir_organizations',
  'Medication': 'fhir_medications',
};

export const SUPPORTED_RESOURCES = Object.keys(FHIR_TABLES);

// =====================================================
// MCP Tool Schema Definitions
// =====================================================

export const TOOLS: Record<string, {
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}> = {
  "ping": PING_TOOL,

  "export_patient_bundle": {
    description: "Export a complete FHIR Bundle for a patient",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        resources: {
          type: "array",
          items: { type: "string", enum: SUPPORTED_RESOURCES },
          description: "Resource types to include (default: all)"
        },
        start_date: { type: "string", description: "Filter start date (ISO 8601)" },
        end_date: { type: "string", description: "Filter end date (ISO 8601)" },
        include_ai_assessments: { type: "boolean", description: "Include AI risk assessments" }
      },
      required: ["patient_id"]
    }
  },

  "get_resource": {
    description: "Get a specific FHIR resource by ID",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: { type: "string", enum: SUPPORTED_RESOURCES, description: "FHIR resource type" },
        resource_id: { type: "string", description: "Resource UUID" }
      },
      required: ["resource_type", "resource_id"]
    }
  },

  "search_resources": {
    description: "Search FHIR resources with filters",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: { type: "string", enum: SUPPORTED_RESOURCES, description: "FHIR resource type" },
        patient_id: { type: "string", description: "Filter by patient" },
        status: { type: "string", description: "Filter by status" },
        category: { type: "string", description: "Filter by category" },
        code: { type: "string", description: "Filter by code" },
        date_from: { type: "string", description: "Filter from date" },
        date_to: { type: "string", description: "Filter to date" },
        limit: { type: "number", description: "Max results (default 50)" }
      },
      required: ["resource_type"]
    }
  },

  "create_resource": {
    description: "Create a new FHIR resource",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: { type: "string", enum: SUPPORTED_RESOURCES, description: "FHIR resource type" },
        data: { type: "object", description: "Resource data (FHIR-compliant)" },
        patient_id: { type: "string", description: "Patient to associate with" }
      },
      required: ["resource_type", "data"]
    }
  },

  "update_resource": {
    description: "Update an existing FHIR resource",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: { type: "string", enum: SUPPORTED_RESOURCES, description: "FHIR resource type" },
        resource_id: { type: "string", description: "Resource UUID" },
        data: { type: "object", description: "Fields to update" }
      },
      required: ["resource_type", "resource_id", "data"]
    }
  },

  "validate_resource": {
    description: "Validate FHIR resource against schema",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: { type: "string", enum: SUPPORTED_RESOURCES, description: "FHIR resource type" },
        data: { type: "object", description: "Resource data to validate" }
      },
      required: ["resource_type", "data"]
    }
  },

  "get_patient_summary": {
    description: "Get a clinical summary for a patient (CCD-style)",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        include_sections: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "demographics", "conditions", "medications", "allergies",
              "immunizations", "vitals", "procedures", "goals", "careplans"
            ]
          },
          description: "Sections to include (default: all)"
        }
      },
      required: ["patient_id"]
    }
  },

  "get_observations": {
    description: "Get observations/vitals for a patient",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        category: {
          type: "string",
          enum: ["vital-signs", "laboratory", "survey", "activity"],
          description: "Observation category"
        },
        code: { type: "string", description: "LOINC code filter" },
        date_from: { type: "string", description: "Filter from date" },
        date_to: { type: "string", description: "Filter to date" },
        limit: { type: "number", description: "Max results" }
      },
      required: ["patient_id"]
    }
  },

  "get_medication_list": {
    description: "Get active medications for a patient",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        status: {
          type: "string",
          enum: ["active", "completed", "stopped", "cancelled", "all"],
          description: "Medication status filter"
        },
        include_history: { type: "boolean", description: "Include historical medications" }
      },
      required: ["patient_id"]
    }
  },

  "get_condition_list": {
    description: "Get diagnoses/conditions for a patient",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        clinical_status: {
          type: "string",
          enum: ["active", "recurrence", "relapse", "inactive", "remission", "resolved"],
          description: "Clinical status filter"
        },
        category: {
          type: "string",
          description: "Category filter (problem-list-item, encounter-diagnosis)"
        }
      },
      required: ["patient_id"]
    }
  },

  "get_sdoh_assessments": {
    description: "Get Social Determinants of Health assessments",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        domain: {
          type: "string",
          enum: [
            "food-insecurity", "housing-instability", "transportation",
            "financial-strain", "social-isolation", "all"
          ],
          description: "SDOH domain filter"
        }
      },
      required: ["patient_id"]
    }
  },

  "get_care_team": {
    description: "Get care team members for a patient",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "Patient UUID" },
        include_contact_info: { type: "boolean", description: "Include provider contact details" }
      },
      required: ["patient_id"]
    }
  },

  "list_ehr_connections": {
    description: "List configured EHR/FHIR connections",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string", description: "Tenant UUID" },
        status: {
          type: "string",
          enum: ["active", "inactive", "error"],
          description: "Connection status filter"
        }
      },
      required: []
    }
  },

  "trigger_ehr_sync": {
    description: "Trigger synchronization with external EHR",
    inputSchema: {
      type: "object",
      properties: {
        connection_id: { type: "string", description: "EHR connection UUID" },
        patient_id: { type: "string", description: "Specific patient to sync (optional)" },
        direction: {
          type: "string",
          enum: ["pull", "push", "bidirectional"],
          description: "Sync direction"
        },
        resources: {
          type: "array",
          items: { type: "string" },
          description: "Resource types to sync"
        }
      },
      required: ["connection_id"]
    }
  }
};
