// =====================================================
// MCP HL7/X12 Transformer Server
// Purpose: Bidirectional HL7 v2.x, X12, and FHIR transformation
// Features: Message parsing, validation, conversion, generation
// =====================================================

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("mcp-hl7-x12-server");

// Environment
const SERVICE_KEY = SB_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase credentials");

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// =====================================================
// HL7 v2.x Parser
// =====================================================

interface HL7Segment {
  name: string;
  fields: string[];
}

interface HL7Message {
  segments: HL7Segment[];
  messageType: string;
  messageControlId: string;
  version: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  dateTime: string;
}

interface ParseResult {
  success: boolean;
  message?: HL7Message;
  errors: string[];
  warnings: string[];
}

function stripMLLP(message: string): string {
  // Remove MLLP framing if present (0x0B at start, 0x1C 0x0D at end)
  let cleaned = message;
  if (cleaned.charCodeAt(0) === 0x0B) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.endsWith('\x1C\r') || cleaned.endsWith('\x1C\n')) {
    cleaned = cleaned.slice(0, -2);
  } else if (cleaned.endsWith('\x1C')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned.trim();
}

function parseHL7Message(rawMessage: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const message = stripMLLP(rawMessage);
    const lines = message.split(/\r?\n/).filter(l => l.trim());

    if (lines.length === 0) {
      return { success: false, errors: ['Empty message'], warnings };
    }

    // Parse MSH segment first to get delimiters
    const mshLine = lines.find(l => l.startsWith('MSH'));
    if (!mshLine) {
      return { success: false, errors: ['Missing MSH segment'], warnings };
    }

    const fieldSeparator = mshLine[3] || '|';
    const encodingChars = mshLine.substring(4, 8);
    const componentSeparator = encodingChars[0] || '^';

    const segments: HL7Segment[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const segmentName = line.substring(0, 3);
      const fieldsRaw = line.split(fieldSeparator);

      // For MSH, the separator counts as field 1
      const fields = segmentName === 'MSH'
        ? [segmentName, fieldSeparator, ...fieldsRaw.slice(1)]
        : fieldsRaw;

      segments.push({ name: segmentName, fields });
    }

    // Extract key fields from MSH
    const msh = segments.find(s => s.name === 'MSH');
    if (!msh) {
      return { success: false, errors: ['Could not parse MSH segment'], warnings };
    }

    const messageTypeField = msh.fields[9] || '';
    const messageTypeParts = messageTypeField.split(componentSeparator);
    const messageType = messageTypeParts.length >= 2
      ? `${messageTypeParts[0]}_${messageTypeParts[1]}`
      : messageTypeParts[0] || 'UNKNOWN';

    const parsedMessage: HL7Message = {
      segments,
      messageType,
      messageControlId: msh.fields[10] || '',
      version: msh.fields[12] || '2.5',
      sendingApplication: msh.fields[3] || '',
      sendingFacility: msh.fields[4] || '',
      receivingApplication: msh.fields[5] || '',
      receivingFacility: msh.fields[6] || '',
      dateTime: msh.fields[7] || ''
    };

    // Validate required segments based on message type
    if (messageType.startsWith('ADT')) {
      if (!segments.find(s => s.name === 'PID')) {
        warnings.push('ADT message missing PID segment');
      }
      if (!segments.find(s => s.name === 'PV1')) {
        warnings.push('ADT message missing PV1 segment');
      }
    } else if (messageType.startsWith('ORU')) {
      if (!segments.find(s => s.name === 'OBR')) {
        warnings.push('ORU message missing OBR segment');
      }
    }

    return { success: true, message: parsedMessage, errors, warnings };

  } catch (error) {
    return {
      success: false,
      errors: [`Parse error: ${error instanceof Error ? error.message : 'Unknown'}`],
      warnings
    };
  }
}

// =====================================================
// HL7 to FHIR Conversion
// =====================================================

function hl7ToFHIR(hl7Message: HL7Message): { bundle: any; resourceCount: number } {
  const resources: any[] = [];
  const componentSep = '^';

  // Extract patient from PID segment
  const pid = hl7Message.segments.find(s => s.name === 'PID');
  if (pid) {
    const nameParts = (pid.fields[5] || '').split(componentSep);
    const patient = {
      resourceType: 'Patient',
      id: `patient-${pid.fields[3]?.split(componentSep)[0] || Date.now()}`,
      identifier: pid.fields[3] ? [{
        system: 'http://hospital.example.org/mrn',
        value: pid.fields[3].split(componentSep)[0]
      }] : undefined,
      name: [{
        family: nameParts[0] || '',
        given: [nameParts[1], nameParts[2]].filter(Boolean)
      }],
      gender: pid.fields[8]?.toLowerCase() === 'f' ? 'female' : pid.fields[8]?.toLowerCase() === 'm' ? 'male' : 'unknown',
      birthDate: formatHL7Date(pid.fields[7])
    };
    resources.push(patient);
  }

  // Extract encounter from PV1 segment
  const pv1 = hl7Message.segments.find(s => s.name === 'PV1');
  if (pv1) {
    const encounter = {
      resourceType: 'Encounter',
      id: `encounter-${pv1.fields[19] || Date.now()}`,
      status: mapPV1Status(pv1.fields[45]),
      class: { code: pv1.fields[2] || 'AMB' },
      period: {
        start: formatHL7Date(pv1.fields[44]),
        end: formatHL7Date(pv1.fields[45])
      },
      location: pv1.fields[3] ? [{
        location: { display: pv1.fields[3].split(componentSep).join(' - ') }
      }] : undefined
    };
    resources.push(encounter);
  }

  // Extract observations from OBX segments
  const obxSegments = hl7Message.segments.filter(s => s.name === 'OBX');
  for (const obx of obxSegments) {
    const codeParts = (obx.fields[3] || '').split(componentSep);
    const observation = {
      resourceType: 'Observation',
      id: `observation-${obx.fields[4] || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: mapOBXStatus(obx.fields[11]),
      code: {
        coding: [{
          system: codeParts[2] === 'LN' ? 'http://loinc.org' : 'http://local.code',
          code: codeParts[0],
          display: codeParts[1]
        }]
      },
      valueQuantity: obx.fields[5] && obx.fields[6] ? {
        value: parseFloat(obx.fields[5]),
        unit: obx.fields[6]
      } : undefined,
      valueString: !obx.fields[6] ? obx.fields[5] : undefined,
      effectiveDateTime: formatHL7Date(obx.fields[14])
    };
    resources.push(observation);
  }

  // Extract diagnoses from DG1 segments
  const dg1Segments = hl7Message.segments.filter(s => s.name === 'DG1');
  for (const dg1 of dg1Segments) {
    const codeParts = (dg1.fields[3] || '').split(componentSep);
    const condition = {
      resourceType: 'Condition',
      id: `condition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      code: {
        coding: [{
          system: codeParts[2] === 'I10' ? 'http://hl7.org/fhir/sid/icd-10-cm' : 'http://local.code',
          code: codeParts[0],
          display: codeParts[1]
        }]
      },
      clinicalStatus: { coding: [{ code: 'active' }] },
      onsetDateTime: formatHL7Date(dg1.fields[5])
    };
    resources.push(condition);
  }

  // Extract allergies from AL1 segments
  const al1Segments = hl7Message.segments.filter(s => s.name === 'AL1');
  for (const al1 of al1Segments) {
    const allergy = {
      resourceType: 'AllergyIntolerance',
      id: `allergy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: al1.fields[2]?.toLowerCase() === 'da' ? 'allergy' : 'intolerance',
      code: {
        text: al1.fields[3]?.split(componentSep)[1] || al1.fields[3]
      },
      reaction: al1.fields[5] ? [{
        manifestation: [{ text: al1.fields[5] }],
        severity: mapAllergySeverity(al1.fields[4])
      }] : undefined
    };
    resources.push(allergy);
  }

  return {
    bundle: {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: resources.map(r => ({
        fullUrl: `urn:uuid:${r.id}`,
        resource: r
      }))
    },
    resourceCount: resources.length
  };
}

function formatHL7Date(hl7Date?: string): string | undefined {
  if (!hl7Date || hl7Date.length < 8) return undefined;
  const year = hl7Date.substring(0, 4);
  const month = hl7Date.substring(4, 6);
  const day = hl7Date.substring(6, 8);
  if (hl7Date.length >= 12) {
    const hour = hl7Date.substring(8, 10);
    const minute = hl7Date.substring(10, 12);
    return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
  }
  return `${year}-${month}-${day}`;
}

function mapPV1Status(status?: string): string {
  const mapping: Record<string, string> = {
    'P': 'planned', 'A': 'arrived', 'I': 'in-progress',
    'F': 'finished', 'C': 'cancelled'
  };
  return mapping[status || ''] || 'unknown';
}

function mapOBXStatus(status?: string): string {
  const mapping: Record<string, string> = {
    'F': 'final', 'P': 'preliminary', 'C': 'corrected',
    'X': 'cancelled', 'I': 'registered'
  };
  return mapping[status || ''] || 'unknown';
}

function mapAllergySeverity(severity?: string): string {
  const mapping: Record<string, string> = {
    'SV': 'severe', 'MO': 'moderate', 'MI': 'mild', 'U': 'mild'
  };
  return mapping[severity || ''] || 'moderate';
}

// =====================================================
// X12 837P Generator
// =====================================================

interface ClaimData {
  claimId: string;
  encounterId: string;
  patientId: string;
  // Patient info
  patientFirstName: string;
  patientLastName: string;
  patientDob: string;
  patientGender: string;
  patientAddress?: string;
  patientCity?: string;
  patientState?: string;
  patientZip?: string;
  // Subscriber info
  subscriberId: string;
  subscriberFirstName?: string;
  subscriberLastName?: string;
  subscriberRelation: string;
  // Payer info
  payerId: string;
  payerName: string;
  // Provider info
  providerId: string;
  providerNpi: string;
  providerName: string;
  providerTaxId: string;
  providerTaxonomy?: string;
  providerAddress?: string;
  providerCity?: string;
  providerState?: string;
  providerZip?: string;
  // Claim details
  serviceDate: string;
  totalCharges: number;
  placeOfService: string;
  // Diagnoses (ICD-10)
  diagnoses: Array<{ code: string; sequence: number }>;
  // Procedures
  procedures: Array<{
    code: string;
    modifiers?: string[];
    units: number;
    charges: number;
    diagnosisPointers: number[];
  }>;
}

function generate837P(claim: ClaimData, controlNumbers: { isa: string; gs: string; st: string }): string {
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
    segments.push(`N4*${claim.providerCity || ''}*${claim.providerState || ''}*${claim.providerZip || ''}`);
  }
  segments.push(`REF*EI*${claim.providerTaxId}`);

  // Loop 2000B - Subscriber Hierarchical Level
  segments.push(`HL*2*1*22*${claim.subscriberRelation === '18' ? '0' : '1'}`);
  segments.push(`SBR*P*${claim.subscriberRelation}*****CI*${claim.payerId}`);

  // Loop 2010BA - Subscriber Name
  const subFirst = claim.subscriberFirstName || claim.patientFirstName;
  const subLast = claim.subscriberLastName || claim.patientLastName;
  segments.push(`NM1*IL*1*${subLast}*${subFirst}****MI*${claim.subscriberId}`);
  if (claim.patientAddress) {
    segments.push(`N3*${claim.patientAddress}`);
    segments.push(`N4*${claim.patientCity || ''}*${claim.patientState || ''}*${claim.patientZip || ''}`);
  }
  segments.push(`DMG*D8*${claim.patientDob.replace(/-/g, '')}*${claim.patientGender.charAt(0).toUpperCase()}`);

  // Loop 2010BB - Payer Name
  segments.push(`NM1*PR*2*${claim.payerName}*****PI*${claim.payerId}`);

  // Loop 2000C - Patient Hierarchical Level (if different from subscriber)
  if (claim.subscriberRelation !== '18') {
    segments.push(`HL*3*2*23*0`);
    segments.push(`PAT*${mapRelationCode(claim.subscriberRelation)}`);
    segments.push(`NM1*QC*1*${claim.patientLastName}*${claim.patientFirstName}`);
    if (claim.patientAddress) {
      segments.push(`N3*${claim.patientAddress}`);
      segments.push(`N4*${claim.patientCity || ''}*${claim.patientState || ''}*${claim.patientZip || ''}`);
    }
    segments.push(`DMG*D8*${claim.patientDob.replace(/-/g, '')}*${claim.patientGender.charAt(0).toUpperCase()}`);
  }

  // Loop 2300 - Claim Information
  segments.push(`CLM*${claim.claimId}*${claim.totalCharges.toFixed(2)}***${claim.placeOfService}:B:1*Y*A*Y*Y`);

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

function padRight(str: string, length: number): string {
  return str.padEnd(length).substring(0, length);
}

function mapRelationCode(code: string): string {
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

// =====================================================
// X12 Validator
// =====================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  segmentCount: number;
}

function validateX12(x12Content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const segments = x12Content.split('~').filter(s => s.trim());
  const segmentCount = segments.length;

  if (segmentCount === 0) {
    return { valid: false, errors: ['Empty X12 content'], warnings, segmentCount: 0 };
  }

  // Check for required segments
  const segmentNames = segments.map(s => s.split('*')[0]);

  const requiredSegments = ['ISA', 'GS', 'ST', 'BHT', 'NM1', 'CLM', 'SE', 'GE', 'IEA'];
  for (const req of requiredSegments) {
    if (!segmentNames.includes(req)) {
      errors.push(`Missing required segment: ${req}`);
    }
  }

  // Validate ISA segment (must be first)
  if (segmentNames[0] !== 'ISA') {
    errors.push('First segment must be ISA');
  } else {
    const isaFields = segments[0].split('*');
    if (isaFields.length < 16) {
      errors.push('ISA segment has insufficient fields');
    }
  }

  // Validate IEA segment (must be last)
  if (segmentNames[segmentNames.length - 1] !== 'IEA') {
    errors.push('Last segment must be IEA');
  }

  // Validate segment count in SE matches actual
  const seSegment = segments.find(s => s.startsWith('SE*'));
  if (seSegment) {
    const seFields = seSegment.split('*');
    const declaredCount = parseInt(seFields[1] || '0', 10);
    const stIndex = segmentNames.indexOf('ST');
    const seIndex = segmentNames.indexOf('SE');
    const actualCount = seIndex - stIndex + 1;

    if (declaredCount !== actualCount) {
      warnings.push(`SE segment count mismatch: declared ${declaredCount}, actual ${actualCount}`);
    }
  }

  // Check for at least one service line
  if (!segmentNames.includes('LX') || !segmentNames.includes('SV1')) {
    warnings.push('No service line segments (LX/SV1) found');
  }

  // Check diagnosis codes
  const hiSegment = segments.find(s => s.startsWith('HI*'));
  if (!hiSegment) {
    errors.push('Missing HI segment (diagnosis codes)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    segmentCount
  };
}

// =====================================================
// MCP Tools Definition
// =====================================================

const TOOLS = {
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
        ack_code: { type: "string", enum: ["AA", "AE", "AR"], description: "Acknowledgment code" },
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
        message_type: { type: "string", description: "Expected message type (ADT, ORU, ORM)" }
      },
      required: ["message"]
    }
  },
  "generate_837p": {
    description: "Generate X12 837P claim from claim data",
    inputSchema: {
      type: "object",
      properties: {
        encounter_id: { type: "string", description: "Encounter UUID to generate claim for" },
        claim_data: { type: "object", description: "Pre-assembled claim data (optional)" }
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

// =====================================================
// X12 Parser
// =====================================================

function parseX12(x12Content: string): {
  interchangeControlNumber: string;
  groupControlNumber: string;
  transactionSetControlNumber: string;
  claimId: string;
  totalCharges: number;
  diagnoses: string[];
  procedures: Array<{ code: string; charges: number; units: number }>;
  patientName: string;
  payerName: string;
  providerName: string;
  serviceDate: string;
} {
  const segments = x12Content.split('~').filter(s => s.trim());

  let result = {
    interchangeControlNumber: '',
    groupControlNumber: '',
    transactionSetControlNumber: '',
    claimId: '',
    totalCharges: 0,
    diagnoses: [] as string[],
    procedures: [] as Array<{ code: string; charges: number; units: number }>,
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
      case 'SV1':
        // Parse service line
        const hcParts = (fields[1] || '').split(':');
        result.procedures.push({
          code: hcParts[1] || hcParts[0] || '',
          charges: parseFloat(fields[2] || '0'),
          units: parseInt(fields[4] || '1', 10)
        });
        break;
      case 'NM1':
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

// =====================================================
// X12 to FHIR Conversion
// =====================================================

function x12ToFHIR(x12Content: string): { claim: any; bundle: any } {
  const parsed = parseX12(x12Content);

  const claim = {
    resourceType: 'Claim',
    id: `claim-${parsed.claimId || Date.now()}`,
    status: 'active',
    type: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/claim-type',
        code: 'professional'
      }]
    },
    use: 'claim',
    created: new Date().toISOString(),
    provider: {
      display: parsed.providerName
    },
    insurer: {
      display: parsed.payerName
    },
    patient: {
      display: parsed.patientName
    },
    total: {
      value: parsed.totalCharges,
      currency: 'USD'
    },
    diagnosis: parsed.diagnoses.map((code, idx) => ({
      sequence: idx + 1,
      diagnosisCodeableConcept: {
        coding: [{
          system: 'http://hl7.org/fhir/sid/icd-10-cm',
          code: code
        }]
      }
    })),
    item: parsed.procedures.map((proc, idx) => ({
      sequence: idx + 1,
      productOrService: {
        coding: [{
          system: 'http://www.ama-assn.org/go/cpt',
          code: proc.code
        }]
      },
      quantity: { value: proc.units },
      unitPrice: { value: proc.charges, currency: 'USD' },
      net: { value: proc.charges * proc.units, currency: 'USD' }
    })),
    billablePeriod: parsed.serviceDate ? {
      start: parsed.serviceDate,
      end: parsed.serviceDate
    } : undefined
  };

  return {
    claim,
    bundle: {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: [{ fullUrl: `urn:uuid:${claim.id}`, resource: claim }]
    }
  };
}

// =====================================================
// HL7 ACK Generator
// =====================================================

function generateHL7Ack(originalMessage: string, ackCode: string, errorMessage?: string): string {
  const parseResult = parseHL7Message(originalMessage);
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);

  const ack = [
    `MSH|^~\\&|WELLFIT|WELLFIT|${parseResult.message?.sendingApplication || ''}|${parseResult.message?.sendingFacility || ''}|${timestamp}||ACK^${parseResult.message?.messageType?.split('_')[1] || 'A01'}|${Date.now()}|P|2.5`,
    `MSA|${ackCode}|${parseResult.message?.messageControlId || ''}${errorMessage ? `|${errorMessage}` : ''}`
  ];

  if (ackCode !== 'AA' && errorMessage) {
    ack.push(`ERR|||${ackCode}|E|||${errorMessage}`);
  }

  return ack.join('\r');
}

// =====================================================
// Audit Logging
// =====================================================

async function logTransformation(params: {
  userId?: string;
  operation: string;
  inputFormat: string;
  outputFormat: string;
  success: boolean;
  executionTimeMs: number;
  errorMessage?: string;
}) {
  try {
    await sb.from("mcp_transformation_logs").insert({
      user_id: params.userId,
      operation: params.operation,
      input_format: params.inputFormat,
      output_format: params.outputFormat,
      success: params.success,
      execution_time_ms: params.executionTimeMs,
      error_message: params.errorMessage,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    try {
      await sb.from("claude_usage_logs").insert({
        user_id: params.userId,
        request_id: crypto.randomUUID(),
        request_type: `mcp_hl7x12_${params.operation}`,
        response_time_ms: params.executionTimeMs,
        success: params.success,
        error_message: params.errorMessage,
        created_at: new Date().toISOString()
      });
    } catch (innerErr: unknown) {
      logger.error("Audit log fallback failed", {
        originalError: err instanceof Error ? err.message : String(err),
        fallbackError: innerErr instanceof Error ? innerErr.message : String(innerErr)
      });
    }
  }
}

// =====================================================
// Request Handler
// =====================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const { method, params } = await req.json();

    // MCP Protocol: List tools
    if (method === "tools/list") {
      return new Response(JSON.stringify({
        tools: Object.entries(TOOLS).map(([name, def]) => ({ name, ...def }))
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: Call tool
    if (method === "tools/call") {
      const { name: toolName, arguments: toolArgs } = params;
      const startTime = Date.now();

      if (!TOOLS[toolName as keyof typeof TOOLS]) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      let result: any;

      switch (toolName) {
        case "parse_hl7": {
          const { message } = toolArgs;
          const parseResult = parseHL7Message(message);

          result = {
            success: parseResult.success,
            messageType: parseResult.message?.messageType,
            messageControlId: parseResult.message?.messageControlId,
            version: parseResult.message?.version,
            sendingApplication: parseResult.message?.sendingApplication,
            sendingFacility: parseResult.message?.sendingFacility,
            segments: parseResult.message?.segments.map(s => ({
              name: s.name,
              fieldCount: s.fields.length
            })),
            errors: parseResult.errors,
            warnings: parseResult.warnings
          };
          break;
        }

        case "hl7_to_fhir": {
          const { message } = toolArgs;
          const parseResult = parseHL7Message(message);

          if (!parseResult.success || !parseResult.message) {
            throw new Error(`Parse failed: ${parseResult.errors.join(', ')}`);
          }

          const conversion = hl7ToFHIR(parseResult.message);
          result = {
            bundle: conversion.bundle,
            resourceCount: conversion.resourceCount,
            sourceMessageType: parseResult.message.messageType
          };
          break;
        }

        case "generate_hl7_ack": {
          const { original_message, ack_code, error_message } = toolArgs;
          const ack = generateHL7Ack(original_message, ack_code, error_message);
          result = {
            ack_message: ack,
            ack_code
          };
          break;
        }

        case "validate_hl7": {
          const { message, message_type } = toolArgs;
          const parseResult = parseHL7Message(message);

          const validationResult = {
            valid: parseResult.success && parseResult.errors.length === 0,
            messageType: parseResult.message?.messageType,
            expectedType: message_type,
            typeMatch: !message_type || parseResult.message?.messageType?.startsWith(message_type),
            segmentCount: parseResult.message?.segments.length || 0,
            errors: parseResult.errors,
            warnings: parseResult.warnings
          };

          if (message_type && !validationResult.typeMatch) {
            validationResult.errors.push(`Expected ${message_type}, got ${parseResult.message?.messageType}`);
            validationResult.valid = false;
          }

          result = validationResult;
          break;
        }

        case "generate_837p": {
          const { encounter_id, claim_data } = toolArgs;

          if (claim_data) {
            // Use provided claim data
            const controlNumbers = {
              isa: String(Date.now()).slice(-9).padStart(9, '0'),
              gs: String(Date.now()).slice(-9).padStart(9, '0'),
              st: String(Date.now()).slice(-4).padStart(4, '0')
            };

            const x12Content = generate837P(claim_data, controlNumbers);
            const validation = validateX12(x12Content);

            result = {
              x12_content: x12Content,
              control_numbers: controlNumbers,
              segment_count: validation.segmentCount,
              validation
            };
          } else if (encounter_id) {
            // Fetch encounter data and generate claim
            const { data: encounter, error: encError } = await sb
              .from('encounters')
              .select('*, patient:patients(*), provider:practitioners(*)')
              .eq('id', encounter_id)
              .single();

            if (encError || !encounter) {
              throw new Error(`Encounter not found: ${encError?.message}`);
            }

            // Build claim data from encounter
            // This is a simplified version - production would need more data
            result = {
              message: 'Encounter-based generation requires complete billing setup',
              encounter_id,
              patient_id: encounter.patient_id,
              status: 'data_incomplete'
            };
          } else {
            throw new Error('Either encounter_id or claim_data required');
          }
          break;
        }

        case "validate_x12": {
          const { x12_content } = toolArgs;
          result = validateX12(x12_content);
          break;
        }

        case "parse_x12": {
          const { x12_content } = toolArgs;
          result = parseX12(x12_content);
          break;
        }

        case "x12_to_fhir": {
          const { x12_content } = toolArgs;
          const conversion = x12ToFHIR(x12_content);
          result = {
            claim: conversion.claim,
            bundle: conversion.bundle
          };
          break;
        }

        case "get_message_types": {
          result = {
            hl7: {
              supported: ['ADT_A01', 'ADT_A02', 'ADT_A03', 'ADT_A04', 'ADT_A08', 'ORU_R01', 'ORM_O01'],
              versions: ['2.3', '2.3.1', '2.4', '2.5', '2.5.1', '2.6', '2.7', '2.8']
            },
            x12: {
              supported: ['837P'],
              versions: ['005010X222A1']
            },
            fhir: {
              supported: ['Patient', 'Encounter', 'Observation', 'Condition', 'AllergyIntolerance', 'Claim'],
              version: 'R4'
            }
          };
          break;
        }

        default:
          throw new Error(`Tool ${toolName} not implemented`);
      }

      const executionTimeMs = Date.now() - startTime;

      // Audit log
      await logTransformation({
        userId: toolArgs.userId,
        operation: toolName,
        inputFormat: toolName.includes('hl7') ? 'HL7' : toolName.includes('x12') ? 'X12' : 'mixed',
        outputFormat: toolName.includes('fhir') ? 'FHIR' : toolName.includes('ack') ? 'HL7' : 'structured',
        success: true,
        executionTimeMs
      });

      return new Response(JSON.stringify({
        content: [{ type: "json", data: result }],
        metadata: {
          tool: toolName,
          executionTimeMs
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error(`Unknown MCP method: ${method}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({
      error: {
        code: "internal_error",
        message: errorMessage
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
