/**
 * HL7 Message Test Panel — Barrel re-export
 *
 * Re-exports both named and default exports so existing import paths work:
 * - Named: import { HL7MessageTestPanel } from './hl7-message-test'
 * - Default: lazy(() => import('./hl7-message-test'))
 */

export { HL7MessageTestPanel } from './HL7MessageTestPanel';
export { default } from './HL7MessageTestPanel';
