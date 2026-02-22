// =====================================================
// HL7 ACK Generator
// Purpose: Generate HL7 v2.x acknowledgment (ACK) messages
// =====================================================

import { parseHL7Message } from './hl7Parser.ts';

/**
 * Generate an HL7 ACK response for a received message.
 * Supports AA (accept), AE (application error), and AR (application reject).
 */
export function generateHL7Ack(
  originalMessage: string,
  ackCode: string,
  errorMessage?: string
): string {
  const parseResult = parseHL7Message(originalMessage);
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .substring(0, 14);

  const sendingApp = parseResult.message?.sendingApplication || '';
  const sendingFac = parseResult.message?.sendingFacility || '';
  const msgType = parseResult.message?.messageType?.split('_')[1] || 'A01';
  const controlId = parseResult.message?.messageControlId || '';

  const ack = [
    `MSH|^~\\&|WELLFIT|WELLFIT|${sendingApp}|${sendingFac}|${timestamp}||ACK^${msgType}|${Date.now()}|P|2.5`,
    `MSA|${ackCode}|${controlId}${errorMessage ? `|${errorMessage}` : ''}`
  ];

  if (ackCode !== 'AA' && errorMessage) {
    ack.push(`ERR|||${ackCode}|E|||${errorMessage}`);
  }

  return ack.join('\r');
}
