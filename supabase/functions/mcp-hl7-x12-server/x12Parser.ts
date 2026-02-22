// =====================================================
// X12 837P Parser
// Purpose: Parse X12 837P claims into structured data
// =====================================================

import type { X12ParsedData } from './types.ts';

/**
 * Parse an X12 837P claim and extract structured data.
 * Extracts control numbers, claim info, diagnoses, procedures,
 * patient/payer/provider names, and service dates.
 */
export function parseX12(x12Content: string): X12ParsedData {
  const segments = x12Content.split('~').filter(s => s.trim());

  const result: X12ParsedData = {
    interchangeControlNumber: '',
    groupControlNumber: '',
    transactionSetControlNumber: '',
    claimId: '',
    totalCharges: 0,
    diagnoses: [],
    procedures: [],
    patientName: '',
    payerName: '',
    providerName: '',
    serviceDate: ''
  };

  for (const segment of segments) {
    const fields = segment.split('*');
    const segmentId = fields[0];

    switch (segmentId) {
      case 'ISA':
        result.interchangeControlNumber = fields[13] || '';
        break;
      case 'GS':
        result.groupControlNumber = fields[6] || '';
        break;
      case 'ST':
        result.transactionSetControlNumber = fields[2] || '';
        break;
      case 'CLM':
        result.claimId = fields[1] || '';
        result.totalCharges = parseFloat(fields[2] || '0');
        break;
      case 'HI':
        // Parse diagnosis codes
        for (let i = 1; i < fields.length; i++) {
          const diagParts = fields[i].split(':');
          if (diagParts.length >= 2) {
            result.diagnoses.push(diagParts[1]);
          }
        }
        break;
      case 'SV1': {
        // Parse service line
        const hcParts = (fields[1] || '').split(':');
        result.procedures.push({
          code: hcParts[1] || hcParts[0] || '',
          charges: parseFloat(fields[2] || '0'),
          units: parseInt(fields[4] || '1', 10)
        });
        break;
      }
      case 'NM1': {
        const qualifier = fields[1];
        const name = fields[3] || '';
        if (qualifier === 'IL' || qualifier === 'QC') {
          result.patientName = `${fields[4] || ''} ${name}`.trim();
        } else if (qualifier === 'PR') {
          result.payerName = name;
        } else if (qualifier === '85' || qualifier === '41') {
          result.providerName = name;
        }
        break;
      }
      case 'DTP':
        if (fields[1] === '472') { // Service date
          const dateVal = fields[3] || '';
          if (dateVal.length === 8) {
            result.serviceDate = `${dateVal.substring(0, 4)}-${dateVal.substring(4, 6)}-${dateVal.substring(6, 8)}`;
          }
        }
        break;
    }
  }

  return result;
}
