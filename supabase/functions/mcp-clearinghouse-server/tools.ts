// =====================================================
// MCP Tool Definitions
// Purpose: Define all clearinghouse tools for the
//          MCP tools/list response
// =====================================================

import { PING_TOOL } from '../_shared/mcpServerBase.ts';
import type { ToolDefinition } from './types.ts';

/** All MCP tools exposed by this server */
export const TOOLS: Record<string, ToolDefinition> = {
  'ping': PING_TOOL,

  'submit_claim': {
    description: 'Submit an 837P/837I claim to the clearinghouse for processing',
    inputSchema: {
      type: 'object',
      properties: {
        claim: {
          type: 'object',
          description: 'Claim submission data including X12 content',
          properties: {
            claim_id: { type: 'string' },
            x12_content: { type: 'string' },
            claim_type: { type: 'string', enum: ['837P', '837I'] },
            payer_id: { type: 'string' },
            payer_name: { type: 'string' },
            patient_id: { type: 'string' },
            total_charge: { type: 'number' }
          },
          required: ['claim_id', 'x12_content', 'claim_type', 'payer_id', 'patient_id', 'total_charge']
        }
      },
      required: ['claim']
    }
  },

  'check_claim_status': {
    description: 'Check the status of a submitted claim (X12 276/277)',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'object',
          description: 'Claim status inquiry parameters',
          properties: {
            payer_id: { type: 'string' },
            claim_id: { type: 'string' },
            patient_id: { type: 'string' },
            provider_npi: { type: 'string' },
            date_of_service_from: { type: 'string' },
            date_of_service_to: { type: 'string' },
            trace_number: { type: 'string' }
          },
          required: ['payer_id', 'provider_npi', 'date_of_service_from']
        }
      },
      required: ['request']
    }
  },

  'verify_eligibility': {
    description: 'Verify patient insurance eligibility (X12 270/271)',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'object',
          description: 'Eligibility verification request',
          properties: {
            payer_id: { type: 'string' },
            subscriber_id: { type: 'string' },
            subscriber_first_name: { type: 'string' },
            subscriber_last_name: { type: 'string' },
            subscriber_dob: { type: 'string' },
            provider_npi: { type: 'string' },
            provider_name: { type: 'string' },
            service_type_codes: { type: 'array', items: { type: 'string' } },
            date_of_service: { type: 'string' },
            dependent: {
              type: 'object',
              properties: {
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                dob: { type: 'string' },
                relationship_code: { type: 'string' }
              }
            }
          },
          required: ['payer_id', 'subscriber_id', 'subscriber_first_name', 'subscriber_last_name', 'subscriber_dob', 'provider_npi', 'date_of_service']
        }
      },
      required: ['request']
    }
  },

  'process_remittance': {
    description: 'Process ERA/835 remittance advice from payer',
    inputSchema: {
      type: 'object',
      properties: {
        x12_content: { type: 'string', description: 'X12 835 remittance content' }
      },
      required: ['x12_content']
    }
  },

  'submit_prior_auth': {
    description: 'Submit prior authorization request (X12 278)',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'object',
          description: 'Prior authorization request',
          properties: {
            payer_id: { type: 'string' },
            patient_id: { type: 'string' },
            subscriber_id: { type: 'string' },
            provider_npi: { type: 'string' },
            service_type: { type: 'string' },
            service_codes: { type: 'array', items: { type: 'string' } },
            diagnosis_codes: { type: 'array', items: { type: 'string' } },
            date_of_service: { type: 'string' },
            urgency: { type: 'string', enum: ['routine', 'urgent', 'stat'] },
            clinical_notes: { type: 'string' }
          },
          required: ['payer_id', 'patient_id', 'subscriber_id', 'provider_npi', 'service_type', 'service_codes', 'diagnosis_codes', 'date_of_service', 'urgency']
        }
      },
      required: ['request']
    }
  },

  'test_connection': {
    description: 'Test clearinghouse connection and credentials',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },

  'get_payer_list': {
    description: 'Get list of supported payers for the configured clearinghouse',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search term to filter payers' },
        state: { type: 'string', description: 'Filter by state code' },
        type: { type: 'string', enum: ['commercial', 'medicare', 'medicaid', 'tricare', 'workers_comp'], description: 'Filter by payer type' }
      },
      required: []
    }
  },

  'get_submission_stats': {
    description: 'Get claim submission statistics and metrics',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        payer_id: { type: 'string', description: 'Filter by payer' }
      },
      required: []
    }
  },

  'get_rejection_reasons': {
    description: 'Get common claim rejection reasons and remediation guidance',
    inputSchema: {
      type: 'object',
      properties: {
        rejection_code: { type: 'string', description: 'Specific rejection code to look up' },
        category: { type: 'string', enum: ['patient', 'provider', 'coding', 'timing', 'authorization', 'other'], description: 'Filter by category' }
      },
      required: []
    }
  }
};
