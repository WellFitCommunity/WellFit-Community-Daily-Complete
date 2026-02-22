// =====================================================
// MCP Tool Definitions
// Purpose: Define all HL7/X12 transformation tools
//          for the MCP tools/list response
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

/** Tool definition shape (matches MCP protocol) */
interface ToolDefinition {
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

/** All MCP tools exposed by this server */
export const TOOLS: Record<string, ToolDefinition> = {
  "ping": PING_TOOL,

  "parse_hl7": {
    description: "Parse an HL7 v2.x message and extract structured data",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Raw HL7 v2.x message" },
        strip_mllp: { type: "boolean", description: "Strip MLLP framing (default: true)" }
      },
      required: ["message"]
    }
  },

  "hl7_to_fhir": {
    description: "Convert HL7 v2.x message to FHIR R4 Bundle",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Raw HL7 v2.x message" }
      },
      required: ["message"]
    }
  },

  "generate_hl7_ack": {
    description: "Generate HL7 ACK response for a message",
    inputSchema: {
      type: "object",
      properties: {
        original_message: { type: "string", description: "Original HL7 message" },
        ack_code: {
          type: "string",
          enum: ["AA", "AE", "AR"],
          description: "Acknowledgment code"
        },
        error_message: { type: "string", description: "Error message for AE/AR" }
      },
      required: ["original_message", "ack_code"]
    }
  },

  "validate_hl7": {
    description: "Validate HL7 v2.x message structure",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Raw HL7 v2.x message" },
        message_type: {
          type: "string",
          description: "Expected message type (ADT, ORU, ORM)"
        }
      },
      required: ["message"]
    }
  },

  "generate_837p": {
    description: "Generate X12 837P claim from claim data",
    inputSchema: {
      type: "object",
      properties: {
        encounter_id: {
          type: "string",
          description: "Encounter UUID to generate claim for"
        },
        claim_data: {
          type: "object",
          description: "Pre-assembled claim data (optional)"
        }
      },
      required: []
    }
  },

  "validate_x12": {
    description: "Validate X12 837P structure and content",
    inputSchema: {
      type: "object",
      properties: {
        x12_content: { type: "string", description: "Raw X12 837P content" }
      },
      required: ["x12_content"]
    }
  },

  "parse_x12": {
    description: "Parse X12 837P and extract structured data",
    inputSchema: {
      type: "object",
      properties: {
        x12_content: { type: "string", description: "Raw X12 837P content" }
      },
      required: ["x12_content"]
    }
  },

  "x12_to_fhir": {
    description: "Convert X12 837P claim to FHIR Claim resource",
    inputSchema: {
      type: "object",
      properties: {
        x12_content: { type: "string", description: "Raw X12 837P content" }
      },
      required: ["x12_content"]
    }
  },

  "get_message_types": {
    description: "Get supported HL7 and X12 message types",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  }
};
