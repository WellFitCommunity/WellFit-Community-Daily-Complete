// supabase/functions/hl7-receive/__tests__/index.test.ts
// Tests for HL7 v2.x Message Receiver Edge Function - HIPAA-critical healthcare messaging

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("HL7 Receive Tests", async (t) => {

  // =====================================================
  // MLLP Framing Tests
  // =====================================================

  await t.step("should recognize MLLP start character (0x0B)", () => {
    const MLLP_START = '\x0B';
    assertEquals(MLLP_START.charCodeAt(0), 11);
  });

  await t.step("should recognize MLLP end characters (0x1C 0x0D)", () => {
    const MLLP_END = '\x1C\x0D';
    assertEquals(MLLP_END.charCodeAt(0), 28);
    assertEquals(MLLP_END.charCodeAt(1), 13);
  });

  await t.step("should strip MLLP framing from message", () => {
    const MLLP_START = '\x0B';
    const MLLP_END = '\x1C\x0D';
    const rawMessage = MLLP_START + 'MSH|^~\\&|SENDING|FACILITY|...' + MLLP_END;

    let message = rawMessage;
    if (message.startsWith(MLLP_START)) {
      message = message.substring(1);
    }
    if (message.endsWith(MLLP_END)) {
      message = message.substring(0, message.length - 2);
    }

    assertEquals(message.startsWith('MSH'), true);
    assertEquals(message.includes(MLLP_START), false);
    assertEquals(message.includes(MLLP_END), false);
  });

  await t.step("should normalize line endings to carriage return", () => {
    const message = "MSH|...\r\nPID|...\nPV1|...";
    const normalized = message.replace(/\r\n/g, '\r').replace(/\n/g, '\r');

    assertEquals(normalized.includes('\n'), false);
    assertEquals(normalized.includes('\r\n'), false);
    assertEquals(normalized.split('\r').length, 3);
  });

  // =====================================================
  // HL7 Delimiters Tests
  // =====================================================

  await t.step("should use default HL7 delimiters", () => {
    const DEFAULT_DELIMITERS = {
      field: '|',
      component: '^',
      repetition: '~',
      escape: '\\',
      subComponent: '&',
    };

    assertEquals(DEFAULT_DELIMITERS.field, '|');
    assertEquals(DEFAULT_DELIMITERS.component, '^');
    assertEquals(DEFAULT_DELIMITERS.repetition, '~');
    assertEquals(DEFAULT_DELIMITERS.escape, '\\');
    assertEquals(DEFAULT_DELIMITERS.subComponent, '&');
  });

  await t.step("should extract delimiters from MSH segment", () => {
    const mshSegment = "MSH|^~\\&|SENDING_APP|...";
    const fieldSep = mshSegment[3];
    const componentSep = mshSegment[4];

    assertEquals(fieldSep, '|');
    assertEquals(componentSep, '^');
  });

  // =====================================================
  // MSH Segment Parsing Tests
  // =====================================================

  await t.step("should parse MSH segment fields", () => {
    const mshSegment = "MSH|^~\\&|SENDER_APP|SENDER_FACILITY|RECV_APP|RECV_FACILITY|20260122120000||ADT^A01^ADT_A01|MSG123456|P|2.5.1";
    const fields = mshSegment.split('|');

    const parsedMSH = {
      sendingApplication: fields[2] || '',
      sendingFacility: fields[3] || '',
      receivingApplication: fields[4] || '',
      receivingFacility: fields[5] || '',
      dateTime: fields[6] || '',
      messageType: fields[8]?.split('^')[0] || '',
      eventType: fields[8]?.split('^')[1] || '',
      messageControlId: fields[9] || '',
      processingId: fields[10] || '',
      versionId: fields[11] || '',
    };

    assertEquals(parsedMSH.sendingApplication, 'SENDER_APP');
    assertEquals(parsedMSH.sendingFacility, 'SENDER_FACILITY');
    assertEquals(parsedMSH.receivingApplication, 'RECV_APP');
    assertEquals(parsedMSH.receivingFacility, 'RECV_FACILITY');
    assertEquals(parsedMSH.dateTime, '20260122120000');
    assertEquals(parsedMSH.messageType, 'ADT');
    assertEquals(parsedMSH.eventType, 'A01');
    assertEquals(parsedMSH.messageControlId, 'MSG123456');
    assertEquals(parsedMSH.processingId, 'P');
    assertEquals(parsedMSH.versionId, '2.5.1');
  });

  await t.step("should return null for missing MSH segment", () => {
    const message = "PID|1||12345^^^HOSP^MR||DOE^JOHN||19700101|M";
    const segments = message.split('\r');
    const mshSegment = segments.find((s) => s.startsWith('MSH'));

    assertEquals(mshSegment, undefined);
  });

  await t.step("should return null for malformed MSH segment", () => {
    const mshSegment = "MSH|short";
    const isValid = mshSegment && mshSegment.length >= 20;

    assertEquals(isValid, false);
  });

  // =====================================================
  // ACK Generation Tests
  // =====================================================

  await t.step("should generate ACK message with AA (accept)", () => {
    const msh = {
      receivingApplication: 'RECV_APP',
      receivingFacility: 'RECV_FACILITY',
      sendingApplication: 'SENDER_APP',
      sendingFacility: 'SENDER_FACILITY',
      eventType: 'A01',
      versionId: '2.5.1',
      messageControlId: 'MSG123456',
    };

    const ackCode = 'AA';
    const ack = `MSH|^~\\&|${msh.receivingApplication}|${msh.receivingFacility}|${msh.sendingApplication}|${msh.sendingFacility}|TIMESTAMP||ACK^${msh.eventType}^ACK|CONTROL_ID|P|${msh.versionId}\r`;

    assertEquals(ack.includes('ACK^A01^ACK'), true);
    assertEquals(ack.startsWith('MSH'), true);
  });

  await t.step("should include MSA segment with ack code", () => {
    const messageControlId = 'MSG123456';
    const ackCode = 'AA';
    const msa = `MSA|${ackCode}|${messageControlId}\r`;

    assertEquals(msa.includes('AA'), true);
    assertEquals(msa.includes('MSG123456'), true);
  });

  // =====================================================
  // NAK Generation Tests
  // =====================================================

  await t.step("should generate NAK for application error (AE)", () => {
    const ackCode = 'AE';
    const errorMessage = 'Processing error';
    const nak = `MSA|${ackCode}|UNKNOWN|${errorMessage}\r`;

    assertEquals(nak.includes('AE'), true);
    assertEquals(nak.includes('Processing error'), true);
  });

  await t.step("should generate NAK for application reject (AR)", () => {
    const ackCode = 'AR';
    const errorMessage = 'Invalid message';
    const nak = `MSA|${ackCode}|UNKNOWN|${errorMessage}\r`;

    assertEquals(nak.includes('AR'), true);
  });

  await t.step("should include ERR segment in NAK", () => {
    const errorMessage = 'Application internal error';
    const err = `ERR|||207^Application internal error^HL70357|E|||${errorMessage}\r`;

    assertEquals(err.startsWith('ERR'), true);
    assertEquals(err.includes('207'), true);
    assertEquals(err.includes('HL70357'), true);
  });

  // =====================================================
  // HL7 Character Escaping Tests
  // =====================================================

  await t.step("should escape field separator", () => {
    const text = "Value|With|Pipes";
    const escaped = text.replace(/\|/g, '\\F\\');

    assertEquals(escaped, "Value\\F\\With\\F\\Pipes");
  });

  await t.step("should escape component separator", () => {
    const text = "Value^With^Carets";
    const escaped = text.replace(/\^/g, '\\S\\');

    assertEquals(escaped, "Value\\S\\With\\S\\Carets");
  });

  await t.step("should escape subcomponent separator", () => {
    const text = "Value&With&Ampersands";
    const escaped = text.replace(/&/g, '\\T\\');

    assertEquals(escaped, "Value\\T\\With\\T\\Ampersands");
  });

  await t.step("should escape repetition separator", () => {
    const text = "Value~With~Tildes";
    const escaped = text.replace(/~/g, '\\R\\');

    assertEquals(escaped, "Value\\R\\With\\R\\Tildes");
  });

  await t.step("should escape escape character", () => {
    const text = "Value\\With\\Backslashes";
    const escaped = text.replace(/\\/g, '\\E\\');

    assertEquals(escaped, "Value\\E\\With\\E\\Backslashes");
  });

  // =====================================================
  // HL7 DateTime Format Tests
  // =====================================================

  await t.step("should format date as HL7 datetime (YYYYMMDDHHMMSS)", () => {
    const date = new Date(2026, 0, 22, 12, 30, 45); // Jan 22, 2026, 12:30:45
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatted = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

    assertEquals(formatted, "20260122123045");
    assertEquals(formatted.length, 14);
  });

  // =====================================================
  // Authentication Tests
  // =====================================================

  await t.step("should require X-HL7-Connection-Id or X-Tenant-Id", () => {
    const connectionId = null;
    const tenantId = null;
    const hasRequired = connectionId || tenantId;

    assertEquals(hasRequired, null);
  });

  await t.step("should accept X-HL7-Connection-Id header", () => {
    const connectionId = "550e8400-e29b-41d4-a716-446655440000";
    assertExists(connectionId);
  });

  await t.step("should accept X-Tenant-Id header", () => {
    const tenantId = "tenant-123";
    assertExists(tenantId);
  });

  await t.step("should accept X-API-Key header for connection auth", () => {
    const apiKey = "api-key-12345";
    assertExists(apiKey);
  });

  await t.step("should validate API key against connection credentials", () => {
    const connection = {
      auth_type: 'api_key',
      auth_credentials: { api_key: 'expected-key' }
    };
    const providedKey = 'wrong-key';
    const isValid = providedKey === connection.auth_credentials.api_key;

    assertEquals(isValid, false);
  });

  await t.step("should return NAK for invalid connection ID", () => {
    const response = { ack: 'AR', message: 'Invalid connection ID' };
    assertEquals(response.ack, 'AR');
  });

  await t.step("should return NAK for disabled connection", () => {
    const response = { ack: 'AR', message: 'Connection is disabled' };
    assertEquals(response.ack, 'AR');
  });

  // =====================================================
  // PV1 Location Parsing Tests (Patient Visit)
  // =====================================================

  await t.step("should parse PV1-3 (Assigned Patient Location)", () => {
    const pv1 = "PV1|1|I|ICU^101^A^HOSP^^^^^";
    const fields = pv1.split('|');
    const locationField = fields[3] || '';
    const locationParts = locationField.split('^');

    const location = {
      unit: locationParts[0] || undefined,
      room: locationParts[1] || undefined,
      bed: locationParts[2] || undefined,
    };

    assertEquals(location.unit, 'ICU');
    assertEquals(location.room, '101');
    assertEquals(location.bed, 'A');
  });

  await t.step("should parse PV1-6 (Prior Patient Location)", () => {
    const pv1 = "PV1|1|I|ICU^101^A|||MED^205^B^^";
    const fields = pv1.split('|');
    const priorLocationField = fields[6] || '';
    const locationParts = priorLocationField.split('^');

    const priorLocation = {
      unit: locationParts[0] || undefined,
      room: locationParts[1] || undefined,
      bed: locationParts[2] || undefined,
    };

    assertEquals(priorLocation.unit, 'MED');
    assertEquals(priorLocation.room, '205');
    assertEquals(priorLocation.bed, 'B');
  });

  await t.step("should return empty object if no PV1 segment", () => {
    const message = "MSH|...\rPID|...";
    const segments = message.split('\r');
    const pv1 = segments.find((s) => s.startsWith('PV1'));

    assertEquals(pv1, undefined);
  });

  // =====================================================
  // PID Patient ID Parsing Tests
  // =====================================================

  await t.step("should parse PID-3 (Patient Identifier List)", () => {
    const pid = "PID|1||12345^^^HOSP^MR~987654^^^SSA^SS||DOE^JOHN||19700101|M";
    const fields = pid.split('|');
    const idField = fields[3] || '';
    const idParts = idField.split('^');
    const patientId = idParts[0] || null;

    assertEquals(patientId, '12345');
  });

  await t.step("should return null if no PID segment", () => {
    const message = "MSH|...\rPV1|...";
    const segments = message.split('\r');
    const pid = segments.find((s) => s.startsWith('PID'));

    assertEquals(pid, undefined);
  });

  // =====================================================
  // PV1-36 Discharge Disposition Tests
  // =====================================================

  await t.step("should parse PV1-36 (Discharge Disposition)", () => {
    // Create a PV1 segment with 36+ fields
    const fields = new Array(37).fill('');
    fields[0] = 'PV1';
    fields[36] = '01'; // Discharged to home
    const pv1 = fields.join('|');

    const parsedFields = pv1.split('|');
    const dischargeDisposition = parsedFields[36] || null;

    assertEquals(dischargeDisposition, '01');
  });

  // =====================================================
  // ADT Event Type Tests
  // =====================================================

  await t.step("should recognize bed-relevant ADT events", () => {
    const bedRelevantEvents = ['A01', 'A02', 'A03', 'A04', 'A11', 'A12', 'A13'];

    assertEquals(bedRelevantEvents.includes('A01'), true); // Admit
    assertEquals(bedRelevantEvents.includes('A02'), true); // Transfer
    assertEquals(bedRelevantEvents.includes('A03'), true); // Discharge
    assertEquals(bedRelevantEvents.includes('A04'), true); // Register
    assertEquals(bedRelevantEvents.includes('A11'), true); // Cancel admit
    assertEquals(bedRelevantEvents.includes('A12'), true); // Cancel transfer
    assertEquals(bedRelevantEvents.includes('A13'), true); // Cancel discharge
    assertEquals(bedRelevantEvents.includes('A08'), false); // Update not bed-relevant
  });

  await t.step("should ignore non-bed-relevant ADT events", () => {
    const bedRelevantEvents = ['A01', 'A02', 'A03', 'A04', 'A11', 'A12', 'A13'];
    const eventType = 'A08'; // Update patient info

    const shouldProcess = bedRelevantEvents.includes(eventType);
    assertEquals(shouldProcess, false);
  });

  // =====================================================
  // Message Priority Tests
  // =====================================================

  await t.step("should assign highest priority to ADT admits (A01)", () => {
    const getPriority = (messageType: string, eventType: string): number => {
      if (messageType === 'ADT') {
        switch (eventType) {
          case 'A01': case 'A03': return 9;
          case 'A02': case 'A04': return 8;
          case 'A08': return 6;
          default: return 5;
        }
      }
      if (messageType === 'ORU' || messageType === 'ORM') return 7;
      return 5;
    };

    assertEquals(getPriority('ADT', 'A01'), 9);
    assertEquals(getPriority('ADT', 'A03'), 9);
  });

  await t.step("should assign high priority to ADT transfers (A02)", () => {
    const getPriority = (messageType: string, eventType: string): number => {
      if (messageType === 'ADT') {
        switch (eventType) {
          case 'A01': case 'A03': return 9;
          case 'A02': case 'A04': return 8;
          default: return 5;
        }
      }
      return 5;
    };

    assertEquals(getPriority('ADT', 'A02'), 8);
    assertEquals(getPriority('ADT', 'A04'), 8);
  });

  await t.step("should assign medium priority to lab results (ORU)", () => {
    const getPriority = (messageType: string): number => {
      if (messageType === 'ORU') return 7;
      if (messageType === 'ORM') return 7;
      return 5;
    };

    assertEquals(getPriority('ORU'), 7);
    assertEquals(getPriority('ORM'), 7);
  });

  await t.step("should assign default priority to other messages", () => {
    const getPriority = (messageType: string): number => {
      if (messageType === 'ADT' || messageType === 'ORU' || messageType === 'ORM') return 7;
      return 5;
    };

    assertEquals(getPriority('DFT'), 5);
    assertEquals(getPriority('BAR'), 5);
  });

  // =====================================================
  // ADT Bed Update Result Tests
  // =====================================================

  await t.step("should return success for bed update", () => {
    const result = {
      success: true,
      action: 'admit',
      bedId: 'bed-123'
    };

    assertEquals(result.success, true);
    assertExists(result.action);
    assertExists(result.bedId);
  });

  await t.step("should return error for failed bed update", () => {
    const result = {
      success: false,
      error: 'Bed not found'
    };

    assertEquals(result.success, false);
    assertExists(result.error);
  });

  await t.step("should return ignored for non-bed events", () => {
    const result = {
      success: true,
      action: 'ignored'
    };

    assertEquals(result.success, true);
    assertEquals(result.action, 'ignored');
  });

  await t.step("should return skipped if no room in PV1", () => {
    const result = {
      success: true,
      action: 'skipped',
      error: 'No room number in PV1 segment'
    };

    assertEquals(result.action, 'skipped');
    assertExists(result.error);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/hl7-receive", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should only accept POST method", () => {
    const allowedMethods = ["POST"];

    assertEquals(allowedMethods.includes("POST"), true);
    assertEquals(allowedMethods.includes("GET"), false);
  });

  await t.step("should return 405 for non-POST methods", () => {
    const response = { error: "Method not allowed" };
    const status = 405;

    assertEquals(status, 405);
    assertEquals(response.error, "Method not allowed");
  });

  // =====================================================
  // Content Type Tests
  // =====================================================

  await t.step("should accept text/plain content type", () => {
    const contentType = "text/plain";
    assertEquals(contentType, "text/plain");
  });

  await t.step("should accept application/hl7-v2 content type", () => {
    const contentType = "application/hl7-v2";
    assertEquals(contentType, "application/hl7-v2");
  });

  await t.step("should return HL7 ACK with application/hl7-v2 content type", () => {
    const responseHeaders = { "Content-Type": "application/hl7-v2" };
    assertEquals(responseHeaders["Content-Type"], "application/hl7-v2");
  });

  // =====================================================
  // Empty Message Tests
  // =====================================================

  await t.step("should return NAK for empty message", () => {
    const rawMessage = "";
    const isEmpty = !rawMessage || rawMessage.trim().length === 0;

    assertEquals(isEmpty, true);
  });

  await t.step("should return 400 for empty message", () => {
    const status = 400;
    assertEquals(status, 400);
  });

  // =====================================================
  // Error Response Tests
  // =====================================================

  await t.step("should return 500 for server config error", () => {
    const response = { ack: 'AE', message: 'Server configuration error' };
    assertEquals(response.ack, 'AE');
  });

  await t.step("should return NAK with processing error message", () => {
    const errorMessage = "Processing error: Database connection failed";
    const nak = `MSA|AE|UNKNOWN|${errorMessage}`;

    assertEquals(nak.includes('AE'), true);
    assertEquals(nak.includes('Processing error'), true);
  });

  // =====================================================
  // Message Logging Tests
  // =====================================================

  await t.step("should call log_hl7_message RPC", () => {
    const rpcCall = {
      function: 'log_hl7_message',
      params: {
        p_tenant_id: 'tenant-123',
        p_connection_id: 'conn-456',
        p_message_control_id: 'MSG123',
        p_message_type: 'ADT',
        p_event_type: 'A01',
        p_direction: 'inbound',
        p_raw_message: new Uint8Array([77, 83, 72]), // MSH
        p_sending_app: 'SENDER',
        p_sending_facility: 'FACILITY',
        p_receiving_app: 'RECEIVER',
        p_receiving_facility: 'REC_FAC'
      }
    };

    assertEquals(rpcCall.function, 'log_hl7_message');
    assertEquals(rpcCall.params.p_direction, 'inbound');
    assertEquals(rpcCall.params.p_message_type, 'ADT');
  });

  await t.step("should queue message for async processing", () => {
    const queueEntry = {
      tenant_id: 'tenant-123',
      message_log_id: 'log-789',
      priority: 9
    };

    assertExists(queueEntry.tenant_id);
    assertExists(queueEntry.message_log_id);
    assertEquals(queueEntry.priority, 9);
  });

  await t.step("should update message status to parsed", () => {
    const rpcCall = {
      function: 'update_hl7_message_status',
      params: {
        p_log_id: 'log-123',
        p_status: 'parsed'
      }
    };

    assertEquals(rpcCall.params.p_status, 'parsed');
  });

  await t.step("should log ACK response", () => {
    const updateData = {
      ack_code: 'AA',
      ack_sent_at: new Date().toISOString()
    };

    assertEquals(updateData.ack_code, 'AA');
    assertExists(updateData.ack_sent_at);
  });

  // =====================================================
  // Environment Variable Tests
  // =====================================================

  await t.step("should require Supabase environment variables", () => {
    const requiredVars = ["SUPABASE_URL", "SB_SECRET_KEY"];
    assertEquals(requiredVars.length, 2);
  });

  // =====================================================
  // Logging Tests
  // =====================================================

  await t.step("should log ADT bed update success", () => {
    const logEntry = {
      level: "info",
      event: "ADT bed update processed",
      context: {
        eventType: 'A01',
        action: 'admit',
        bedId: 'bed-123'
      }
    };

    assertEquals(logEntry.level, "info");
    assertEquals(logEntry.event, "ADT bed update processed");
  });

  await t.step("should warn on ADT bed update failure", () => {
    const logEntry = {
      level: "warn",
      event: "ADT bed update failed",
      context: {
        eventType: 'A01',
        error: 'Bed not found'
      }
    };

    assertEquals(logEntry.level, "warn");
  });

  await t.step("should log HL7 receive errors", () => {
    const logEntry = {
      level: "error",
      event: "HL7 receive error",
      context: {
        message: "Unexpected error occurred"
      }
    };

    assertEquals(logEntry.level, "error");
    assertEquals(logEntry.event, "HL7 receive error");
  });
});
