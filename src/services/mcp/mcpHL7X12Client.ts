/**
 * HL7/X12 Transformer MCP Client
 *
 * Browser-safe client for HL7 v2.x and X12 healthcare message transformations.
 * Provides bidirectional conversion between HL7, X12, and FHIR formats.
 *
 * Tools available:
 * - parse_hl7: Parse HL7 v2.x messages to structured data
 * - hl7_to_fhir: Convert HL7 to FHIR R4 Bundle
 * - generate_hl7_ack: Generate ACK responses
 * - validate_hl7: Validate HL7 message structure
 * - generate_837p: Generate X12 837P claims
 * - validate_x12: Validate X12 structure
 * - parse_x12: Parse X12 to structured data
 * - x12_to_fhir: Convert X12 to FHIR Claim
 * - get_message_types: Get supported message types
 *
 * Decomposed 2026-06-01 (CLAUDE.md Commandment #12, 600-line limit). The type
 * surface lives in ./hl7-x12/types.ts and the templates/helpers/code maps in
 * ./hl7-x12/constants.ts; both are re-exported below so import paths are stable.
 */

import { getSupabaseAuthToken } from './mcpHelpers';
import type {
  HL7ParsedMessage,
  HL7ValidationResult,
  HL7ACK,
  X12ClaimData,
  X12GeneratedClaim,
  X12ParsedClaim,
  X12ValidationResult,
  FHIRBundle,
  FHIRClaim,
  MessageTypeInfo,
  X12278Request,
  X12278Response,
  X12278Generated,
  HL7X12Result,
} from './hl7-x12/types';

// Re-export the full type surface + constants so existing import paths keep working.
export type {
  HL7MessageType,
  HL7Segment,
  HL7ParsedMessage,
  HL7ValidationResult,
  HL7ACK,
  X12ClaimData,
  X12GeneratedClaim,
  X12ParsedClaim,
  X12ValidationResult,
  FHIRBundle,
  FHIRClaim,
  MessageTypeInfo,
  X12278ActionCode,
  X12278CertificationType,
  X12278DecisionCode,
  X12278Request,
  X12278Response,
  X12278Generated,
  HL7X12Result,
} from './hl7-x12/types';
export {
  HL7_TEMPLATES,
  X12_HELPERS,
  X12_278_ACTION_CODES,
  X12_278_CERTIFICATION_TYPES,
  X12_278_SERVICE_TYPE_CODES,
} from './hl7-x12/constants';

// =====================================================
// Client Class
// =====================================================

export class HL7X12MCPClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-hl7-x12-server`;
  }

  /**
   * Get authentication token from localStorage
   */
  private getAuthToken(): string {
    return getSupabaseAuthToken();
  }

  /**
   * Make authenticated request to MCP server
   */
  private async request<T>(tool: string, params: Record<string, unknown> = {}): Promise<HL7X12Result<T>> {
    const token = this.getAuthToken();
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: tool,
            arguments: params
          },
          id: Date.now()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `HTTP ${response.status}`
        };
      }

      const result = await response.json();

      if (result.error) {
        return {
          success: false,
          error: result.error.message || 'MCP call failed'
        };
      }

      // Extract data from MCP response format
      const content = result.result?.content?.[0];
      if (content?.type === 'json') {
        return {
          success: true,
          data: content.data as T,
          metadata: result.result?.metadata
        };
      } else if (content?.type === 'text') {
        try {
          return {
            success: true,
            data: JSON.parse(content.text) as T,
            metadata: result.result?.metadata
          };
        } catch {
          return {
            success: true,
            data: content.text as unknown as T,
            metadata: result.result?.metadata
          };
        }
      }

      return {
        success: true,
        data: result.result as T,
        metadata: result.result?.metadata
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  // =====================================================
  // HL7 Operations
  // =====================================================

  /**
   * Parse an HL7 v2.x message into structured data
   */
  async parseHL7(message: string): Promise<HL7X12Result<HL7ParsedMessage>> {
    return this.request<HL7ParsedMessage>('parse_hl7', { message });
  }

  /**
   * Convert HL7 v2.x message to FHIR R4 Bundle
   */
  async hl7ToFHIR(message: string): Promise<HL7X12Result<FHIRBundle>> {
    return this.request<FHIRBundle>('hl7_to_fhir', { message });
  }

  /**
   * Generate HL7 ACK response for a message
   */
  async generateHL7ACK(
    originalControlId: string,
    ackCode: 'AA' | 'AE' | 'AR',
    textMessage?: string
  ): Promise<HL7X12Result<HL7ACK>> {
    return this.request<HL7ACK>('generate_hl7_ack', {
      original_control_id: originalControlId,
      ack_code: ackCode,
      text_message: textMessage
    });
  }

  /**
   * Validate HL7 v2.x message structure
   */
  async validateHL7(message: string): Promise<HL7X12Result<HL7ValidationResult>> {
    return this.request<HL7ValidationResult>('validate_hl7', { message });
  }

  // =====================================================
  // X12 Operations
  // =====================================================

  /**
   * Generate X12 837P claim from claim data
   */
  async generate837P(claimData: X12ClaimData): Promise<HL7X12Result<X12GeneratedClaim>> {
    return this.request<X12GeneratedClaim>('generate_837p', { claim_data: claimData });
  }

  /**
   * Validate X12 837P structure and content
   */
  async validateX12(x12Content: string): Promise<HL7X12Result<X12ValidationResult>> {
    return this.request<X12ValidationResult>('validate_x12', { x12_content: x12Content });
  }

  /**
   * Parse X12 837P into structured data
   */
  async parseX12(x12Content: string): Promise<HL7X12Result<X12ParsedClaim>> {
    return this.request<X12ParsedClaim>('parse_x12', { x12_content: x12Content });
  }

  /**
   * Convert X12 837P to FHIR Claim resource
   */
  async x12ToFHIR(x12Content: string): Promise<HL7X12Result<FHIRClaim>> {
    return this.request<FHIRClaim>('x12_to_fhir', { x12_content: x12Content });
  }

  // =====================================================
  // X12 278 Prior Authorization Operations
  // =====================================================

  /**
   * Generate X12 278 prior authorization request
   * CMS-0057-F compliant
   */
  async generate278Request(request: X12278Request): Promise<HL7X12Result<X12278Generated>> {
    return this.request<X12278Generated>('generate_278_request', { request_data: request });
  }

  /**
   * Parse X12 278 prior authorization response
   */
  async parse278Response(x12Content: string): Promise<HL7X12Result<X12278Response>> {
    return this.request<X12278Response>('parse_278_response', { x12_content: x12Content });
  }

  /**
   * Validate X12 278 message structure
   */
  async validate278(x12Content: string): Promise<HL7X12Result<X12ValidationResult>> {
    return this.request<X12ValidationResult>('validate_278', { x12_content: x12Content });
  }

  // =====================================================
  // Utility Operations
  // =====================================================

  /**
   * Get supported message types for HL7 and X12
   */
  async getMessageTypes(): Promise<HL7X12Result<MessageTypeInfo>> {
    return this.request<MessageTypeInfo>('get_message_types', {});
  }
}

// =====================================================
// Singleton Instance
// =====================================================

export const hl7x12MCP = new HL7X12MCPClient();

// =====================================================
// Convenience Functions
// =====================================================

/**
 * Parse HL7 v2.x message
 */
export async function parseHL7Message(message: string): Promise<HL7X12Result<HL7ParsedMessage>> {
  return hl7x12MCP.parseHL7(message);
}

/**
 * Convert HL7 message to FHIR Bundle
 */
export async function convertHL7ToFHIR(message: string): Promise<HL7X12Result<FHIRBundle>> {
  return hl7x12MCP.hl7ToFHIR(message);
}

/**
 * Validate HL7 message structure
 */
export async function validateHL7Message(message: string): Promise<HL7X12Result<HL7ValidationResult>> {
  return hl7x12MCP.validateHL7(message);
}

/**
 * Generate HL7 ACK response
 */
export async function generateACK(
  controlId: string,
  ackCode: 'AA' | 'AE' | 'AR',
  errorText?: string
): Promise<HL7X12Result<HL7ACK>> {
  return hl7x12MCP.generateHL7ACK(controlId, ackCode, errorText);
}

/**
 * Generate X12 837P professional claim
 */
export async function generate837PClaim(claimData: X12ClaimData): Promise<HL7X12Result<X12GeneratedClaim>> {
  return hl7x12MCP.generate837P(claimData);
}

/**
 * Parse X12 837P claim
 */
export async function parseX12Claim(x12Content: string): Promise<HL7X12Result<X12ParsedClaim>> {
  return hl7x12MCP.parseX12(x12Content);
}

/**
 * Validate X12 837P claim
 */
export async function validateX12Claim(x12Content: string): Promise<HL7X12Result<X12ValidationResult>> {
  return hl7x12MCP.validateX12(x12Content);
}

/**
 * Convert X12 claim to FHIR format
 */
export async function convertX12ToFHIR(x12Content: string): Promise<HL7X12Result<FHIRClaim>> {
  return hl7x12MCP.x12ToFHIR(x12Content);
}

/**
 * Get all supported message types
 */
export async function getSupportedMessageTypes(): Promise<HL7X12Result<MessageTypeInfo>> {
  return hl7x12MCP.getMessageTypes();
}

// =====================================================
// X12 278 Prior Authorization Convenience Functions
// =====================================================

/**
 * Generate X12 278 prior authorization request
 * CMS-0057-F compliant for January 2027 mandate
 */
export async function generate278PriorAuthRequest(request: X12278Request): Promise<HL7X12Result<X12278Generated>> {
  return hl7x12MCP.generate278Request(request);
}

/**
 * Parse X12 278 prior authorization response from payer
 */
export async function parse278PriorAuthResponse(x12Content: string): Promise<HL7X12Result<X12278Response>> {
  return hl7x12MCP.parse278Response(x12Content);
}

/**
 * Validate X12 278 message structure
 */
export async function validate278Message(x12Content: string): Promise<HL7X12Result<X12ValidationResult>> {
  return hl7x12MCP.validate278(x12Content);
}
