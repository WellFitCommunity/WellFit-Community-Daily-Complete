/**
 * HL7 v2.x Integration Service
 *
 * Main entry point for HL7 v2.x message processing.
 * Provides unified API for parsing, translating, and processing HL7 messages.
 */

export { HL7Parser, hl7Parser } from './HL7Parser';
export { HL7ToFHIRTranslator, createHL7ToFHIRTranslator, TranslationResult } from './HL7ToFHIRTranslator';
export * from '../../types/hl7v2';
