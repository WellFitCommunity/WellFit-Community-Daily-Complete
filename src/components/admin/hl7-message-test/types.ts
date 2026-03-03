/**
 * Types for the HL7 Message Test Panel
 *
 * Local type aliases for message format selection and operation types.
 * Domain types (HL7ParsedMessage, FHIRBundle, etc.) come from mcpHL7X12Client.
 */

export type MessageFormat = 'hl7' | 'x12' | 'generate_837p';
export type HL7Operation = 'parse' | 'validate' | 'to_fhir';
export type X12Operation = 'parse' | 'validate' | 'to_fhir';
