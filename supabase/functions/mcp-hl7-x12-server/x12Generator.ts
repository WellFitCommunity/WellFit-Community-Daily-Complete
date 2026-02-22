// =====================================================
// X12 837P Claim Generator
// Purpose: Generate X12 837P professional claims from
//          structured claim data
// =====================================================

import type { ClaimData, ControlNumbers } from './types.ts';

/** Pad a string to a fixed length (right-padded with spaces) */
export function padRight(str: string, length: number): string {
  return str.padEnd(length).substring(0, length);
}

/** Map subscriber relationship code to X12 PAT segment code */
export function mapRelationCode(code: string): string {
  const mapping: Record<string, string> = {
    '01': '01', // Spouse
    '19': '19', // Child
    '20': '20', // Employee
    '21': '21', // Unknown
    '39': '39', // Organ Donor
    '40': '40', // Cadaver Donor
    '53': '53', // Life Partner
    'G8': 'G8', // Other
  };
  return mapping[code] || 'G8';
}

/**
 * Generate an X12 837P claim from structured claim data.
 * Produces a complete EDI transaction set including ISA/GS/ST envelopes.
 */
export function generate837P(
  claim: ClaimData,
  controlNumbers: ControlNumbers
): string {
  const segments: string[] = [];
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().replace(/[-:]/g, '').substring(0, 8);
  const timeStr = timestamp.toISOString().replace(/[-:]/g, '').substring(9, 13);

  // ISA - Interchange Control Header
  segments.push(
    `ISA*00*          *00*          *ZZ*${padRight(claim.providerNpi, 15)}*ZZ*${padRight(claim.payerId, 15)}*${dateStr.substring(2)}*${timeStr}*^*00501*${controlNumbers.isa}*0*P*:`
  );

  // GS - Functional Group Header
  segments.push(
    `GS*HC*${claim.providerNpi}*${claim.payerId}*${dateStr}*${timeStr}*${controlNumbers.gs}*X*005010X222A1`
  );

  // ST - Transaction Set Header
  segments.push(`ST*837*${controlNumbers.st}*005010X222A1`);

  // BHT - Beginning of Hierarchical Transaction
  segments.push(`BHT*0019*00*${claim.claimId}*${dateStr}*${timeStr}*CH`);

  // Loop 1000A - Submitter
  segments.push(`NM1*41*2*${claim.providerName}*****46*${claim.providerNpi}`);
  segments.push(`PER*IC*BILLING DEPT*TE*5555555555`);

  // Loop 1000B - Receiver
  segments.push(`NM1*40*2*${claim.payerName}*****46*${claim.payerId}`);

  // Loop 2000A - Billing Provider Hierarchical Level
  segments.push(`HL*1**20*1`);
  segments.push(`PRV*BI*PXC*${claim.providerTaxonomy || '207Q00000X'}`);

  // Loop 2010AA - Billing Provider Name
  segments.push(`NM1*85*2*${claim.providerName}*****XX*${claim.providerNpi}`);
  if (claim.providerAddress) {
    segments.push(`N3*${claim.providerAddress}`);
    segments.push(
      `N4*${claim.providerCity || ''}*${claim.providerState || ''}*${claim.providerZip || ''}`
    );
  }
  segments.push(`REF*EI*${claim.providerTaxId}`);

  // Loop 2000B - Subscriber Hierarchical Level
  segments.push(
    `HL*2*1*22*${claim.subscriberRelation === '18' ? '0' : '1'}`
  );
  segments.push(
    `SBR*P*${claim.subscriberRelation}*****CI*${claim.payerId}`
  );

  // Loop 2010BA - Subscriber Name
  const subFirst = claim.subscriberFirstName || claim.patientFirstName;
  const subLast = claim.subscriberLastName || claim.patientLastName;
  segments.push(
    `NM1*IL*1*${subLast}*${subFirst}****MI*${claim.subscriberId}`
  );
  if (claim.patientAddress) {
    segments.push(`N3*${claim.patientAddress}`);
    segments.push(
      `N4*${claim.patientCity || ''}*${claim.patientState || ''}*${claim.patientZip || ''}`
    );
  }
  segments.push(
    `DMG*D8*${claim.patientDob.replace(/-/g, '')}*${claim.patientGender.charAt(0).toUpperCase()}`
  );

  // Loop 2010BB - Payer Name
  segments.push(
    `NM1*PR*2*${claim.payerName}*****PI*${claim.payerId}`
  );

  // Loop 2000C - Patient Hierarchical Level (if different from subscriber)
  if (claim.subscriberRelation !== '18') {
    segments.push(`HL*3*2*23*0`);
    segments.push(`PAT*${mapRelationCode(claim.subscriberRelation)}`);
    segments.push(
      `NM1*QC*1*${claim.patientLastName}*${claim.patientFirstName}`
    );
    if (claim.patientAddress) {
      segments.push(`N3*${claim.patientAddress}`);
      segments.push(
        `N4*${claim.patientCity || ''}*${claim.patientState || ''}*${claim.patientZip || ''}`
      );
    }
    segments.push(
      `DMG*D8*${claim.patientDob.replace(/-/g, '')}*${claim.patientGender.charAt(0).toUpperCase()}`
    );
  }

  // Loop 2300 - Claim Information
  segments.push(
    `CLM*${claim.claimId}*${claim.totalCharges.toFixed(2)}***${claim.placeOfService}:B:1*Y*A*Y*Y`
  );

  // DTP - Service Date
  const serviceDateFormatted = claim.serviceDate.replace(/-/g, '');
  segments.push(`DTP*472*D8*${serviceDateFormatted}`);

  // HI - Diagnosis Codes
  const diagCodes = claim.diagnoses
    .sort((a, b) => a.sequence - b.sequence)
    .map((d, i) => `${i === 0 ? 'ABK' : 'ABF'}:${d.code.replace('.', '')}`)
    .join('*');
  segments.push(`HI*${diagCodes}`);

  // Loop 2400 - Service Lines
  let lineNumber = 1;
  for (const proc of claim.procedures) {
    segments.push(`LX*${lineNumber}`);

    const modifiers = proc.modifiers?.length
      ? ':' + proc.modifiers.slice(0, 4).join(':')
      : '';

    const diagPointers = proc.diagnosisPointers.join(':');

    segments.push(
      `SV1*HC:${proc.code}${modifiers}*${proc.charges.toFixed(2)}*UN*${proc.units}***${diagPointers}`
    );
    segments.push(`DTP*472*D8*${serviceDateFormatted}`);

    lineNumber++;
  }

  // SE - Transaction Set Trailer
  const segmentCount = segments.length + 1; // +1 for SE itself
  segments.push(`SE*${segmentCount}*${controlNumbers.st}`);

  // GE - Functional Group Trailer
  segments.push(`GE*1*${controlNumbers.gs}`);

  // IEA - Interchange Control Trailer
  segments.push(`IEA*1*${controlNumbers.isa}`);

  return segments.join('~') + '~';
}
