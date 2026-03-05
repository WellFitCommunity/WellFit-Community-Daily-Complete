// =====================================================
// X12 278 Prior Authorization Request Generator
// Purpose: Generate X12 278 Health Care Services Review
//          requests per ASC X12N 278 (005010X217)
// CMS-0057-F compliant for January 2027 mandate
// =====================================================

import type { PriorAuthRequestData, ControlNumbers, Generated278Result } from './types.ts';
import { padRight } from './x12Generator.ts';

/** Map certification type code to UM02 value */
function mapCertificationType(code: string): string {
  const mapping: Record<string, string> = {
    'I': 'I',   // Initial
    'R': 'R',   // Renewal/Recertification
    'S': 'S',   // Revised
    'E': 'E',   // Extension
    'A': 'A',   // Appeal
  };
  return mapping[code] || 'I';
}

/** Format date string (YYYY-MM-DD or YYYYMMDD) to X12 CCYYMMDD */
function formatDateX12(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Generate an X12 278 Health Care Services Review Request.
 * Produces a complete EDI transaction set per ASC X12N 278 (005010X217).
 *
 * Hierarchy:
 *   2000A — Utilization Management Organization (payer/receiver)
 *   2000B — Requester (requesting provider)
 *   2000C — Subscriber
 *   2000D — Patient (if different from subscriber)
 *   2000E — Patient Event (service details)
 *   2000F — Service (procedure-level)
 */
export function generate278Request(
  data: PriorAuthRequestData,
  controlNumbers: ControlNumbers
): Generated278Result {
  const segments: string[] = [];
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().replace(/[-:]/g, '').substring(0, 8);
  const timeStr = timestamp.toISOString().replace(/[-:]/g, '').substring(9, 13);

  // ISA - Interchange Control Header
  segments.push(
    `ISA*00*          *00*          *ZZ*${padRight(data.requesting_provider.npi, 15)}*ZZ*${padRight(data.receiver.id, 15)}*${dateStr.substring(2)}*${timeStr}*^*00501*${controlNumbers.isa}*0*P*:`
  );

  // GS - Functional Group Header (HI = Health Care Services Review)
  segments.push(
    `GS*HI*${data.requesting_provider.npi}*${data.receiver.id}*${dateStr}*${timeStr}*${controlNumbers.gs}*X*005010X217`
  );

  // ST - Transaction Set Header (278 = Health Care Services Review)
  segments.push(`ST*278*${controlNumbers.st}*005010X217`);

  // BHT - Beginning of Hierarchical Transaction
  // BHT01: 0007 = Information Source, Subscriber, Dependent
  // BHT02: 11 = Request
  // BHT06: 18 = Original (resubmission would be different)
  segments.push(
    `BHT*0007*11*${data.transaction_set_id}*${dateStr}*${timeStr}*18`
  );

  // =====================================================
  // Loop 2000A - Utilization Management Organization (UMO)
  // =====================================================
  segments.push(`HL*1**20*1`);

  // Loop 2010A - UMO Name
  segments.push(
    `NM1*X3*2*${data.receiver.name}*****PI*${data.receiver.id}`
  );

  // =====================================================
  // Loop 2000B - Requester (Provider)
  // =====================================================
  segments.push(`HL*2*1*21*1`);

  // Loop 2010B - Requester Name
  segments.push(
    `NM1*1P*2*${data.requesting_provider.name}*****XX*${data.requesting_provider.npi}`
  );
  if (data.requesting_provider.address) {
    segments.push(`N3*${data.requesting_provider.address.street}`);
    segments.push(
      `N4*${data.requesting_provider.address.city}*${data.requesting_provider.address.state}*${data.requesting_provider.address.zip}`
    );
  }
  if (data.requesting_provider.contact_name || data.requesting_provider.contact_phone) {
    const contactParts = ['IC'];
    contactParts.push(data.requesting_provider.contact_name || '');
    if (data.requesting_provider.contact_phone) {
      contactParts.push('TE');
      contactParts.push(data.requesting_provider.contact_phone);
    }
    segments.push(`PER*${contactParts.join('*')}`);
  }
  if (data.requesting_provider.taxonomy) {
    segments.push(`PRV*RF*PXC*${data.requesting_provider.taxonomy}`);
  }

  // =====================================================
  // Loop 2000C - Subscriber
  // =====================================================
  const hasPatient = !!data.patient;
  segments.push(`HL*3*2*22*${hasPatient ? '1' : '0'}`);

  // Loop 2010C - Subscriber Name
  segments.push(
    `NM1*IL*1*${data.subscriber.last_name}*${data.subscriber.first_name}****MI*${data.subscriber.member_id}`
  );
  if (data.subscriber.address) {
    segments.push(`N3*${data.subscriber.address.street}`);
    segments.push(
      `N4*${data.subscriber.address.city}*${data.subscriber.address.state}*${data.subscriber.address.zip}`
    );
  }
  segments.push(
    `DMG*D8*${formatDateX12(data.subscriber.dob)}*${data.subscriber.gender}`
  );
  if (data.subscriber.group_number) {
    segments.push(`REF*6P*${data.subscriber.group_number}`);
  }

  // =====================================================
  // Loop 2000D - Patient (if different from subscriber)
  // =====================================================
  let hlCounter = 4;
  if (data.patient) {
    segments.push(`HL*${hlCounter}*3*23*1`);
    hlCounter++;

    // PAT - Patient relationship
    segments.push(`PAT*${data.patient.relationship}`);

    // Loop 2010D - Patient Name
    segments.push(
      `NM1*QC*1*${data.patient.last_name}*${data.patient.first_name}`
    );
    segments.push(
      `DMG*D8*${formatDateX12(data.patient.dob)}*${data.patient.gender}`
    );
  }

  // =====================================================
  // Loop 2000E - Patient Event
  // =====================================================
  const eventHlParent = hasPatient ? (hlCounter - 1).toString() : '3';
  segments.push(`HL*${hlCounter}*${eventHlParent}*EV*1`);
  const eventHl = hlCounter;
  hlCounter++;

  // UM - Health Care Services Review Information
  // UM01: Certification type (I/R/S/E/A)
  // UM02: Service type code
  // UM03: Level of service (if provided)
  const umParts = [
    'UM',
    mapCertificationType(data.certification_type),
    data.service_type_code,
    data.level_of_service || ''
  ];
  segments.push(umParts.join('*'));

  // Urgency/priority
  if (data.urgency_code) {
    segments.push(`HCR*A1*${data.urgency_code}`);
  }

  // DTP - Service dates
  if (data.admission_date) {
    segments.push(`DTP*435*D8*${formatDateX12(data.admission_date)}`);
  }
  if (data.discharge_date) {
    segments.push(`DTP*096*D8*${formatDateX12(data.discharge_date)}`);
  }
  segments.push(`DTP*472*D8*${formatDateX12(data.service_date_from)}`);
  if (data.service_date_to) {
    segments.push(`DTP*472*D8*${formatDateX12(data.service_date_to)}`);
  }

  // HI - Diagnosis codes
  if (data.diagnoses.length > 0) {
    const diagCodes = data.diagnoses
      .map(d => `${d.qualifier}:${d.code_type}:${d.code.replace('.', '')}`)
      .join('*');
    segments.push(`HI*${diagCodes}`);
  }

  // Loop 2010EA - Patient Event Provider (rendering provider)
  if (data.rendering_provider) {
    segments.push(
      `NM1*71*1*${data.rendering_provider.name}*****XX*${data.rendering_provider.npi}`
    );
    if (data.rendering_provider.taxonomy) {
      segments.push(`PRV*PE*PXC*${data.rendering_provider.taxonomy}`);
    }
  }

  // Facility
  if (data.facility) {
    segments.push(
      `NM1*FA*2*${data.facility.name}*****XX*${data.facility.npi}`
    );
    if (data.facility.address) {
      segments.push(`N3*${data.facility.address.street}`);
      segments.push(
        `N4*${data.facility.address.city}*${data.facility.address.state}*${data.facility.address.zip}`
      );
    }
  }

  // =====================================================
  // Loop 2000F - Service (one per procedure)
  // =====================================================
  for (const proc of data.procedures) {
    segments.push(`HL*${hlCounter}*${eventHl}*SS*0`);
    hlCounter++;

    // SV1 or SV2 for procedure info
    const modifiers = proc.modifier_codes?.length
      ? ':' + proc.modifier_codes.slice(0, 4).join(':')
      : '';

    if (proc.code_type === 'HC') {
      segments.push(
        `SV1*HC:${proc.code}${modifiers}***${proc.quantity}*${proc.unit_type}`
      );
    } else {
      // ICD-10-PCS (institutional)
      segments.push(
        `SV2**IV:${proc.code}***${proc.quantity}*${proc.unit_type}`
      );
    }

    if (proc.description) {
      segments.push(`MSG*${proc.description}`);
    }
  }

  // Attachments
  if (data.attachments?.length) {
    for (const att of data.attachments) {
      segments.push(`PWK*${att.type}*${att.transmission_code}${att.control_number ? `***AC*${att.control_number}` : ''}`);
    }
  }

  // Notes
  if (data.notes) {
    segments.push(`MSG*${data.notes.substring(0, 264)}`);
  }

  // SE - Transaction Set Trailer
  const segmentCount = segments.length + 1; // +1 for SE itself
  segments.push(`SE*${segmentCount}*${controlNumbers.st}`);

  // GE - Functional Group Trailer
  segments.push(`GE*1*${controlNumbers.gs}`);

  // IEA - Interchange Control Trailer
  segments.push(`IEA*1*${controlNumbers.isa}`);

  const x12Content = segments.join('~') + '~';

  return {
    x12_content: x12Content,
    control_number: data.control_number,
    transaction_set_id: data.transaction_set_id,
    segment_count: segments.length
  };
}
