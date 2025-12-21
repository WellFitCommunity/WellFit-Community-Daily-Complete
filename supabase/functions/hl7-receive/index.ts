/**
 * HL7 v2.x Message Receiver Edge Function
 *
 * Receives HL7 v2.x messages via HTTP (from MLLP-to-HTTP gateways like Rhapsody, Mirth, etc.)
 * Parses, validates, translates to FHIR, and stores the results.
 *
 * Endpoint: POST /functions/v1/hl7-receive
 *
 * Headers:
 * - Authorization: Bearer <service_role_key> or API key
 * - X-HL7-Connection-Id: UUID of the HL7 connection (optional)
 * - X-Tenant-Id: Tenant UUID (required if no connection ID)
 * - Content-Type: text/plain or application/hl7-v2
 *
 * Body: Raw HL7 v2.x message (with or without MLLP framing)
 *
 * Response: HL7 ACK message
 */

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

// MLLP framing characters
const MLLP_START = '\x0B';
const MLLP_END = '\x1C\x0D';

// HL7 Delimiters
interface HL7Delimiters {
  field: string;
  component: string;
  repetition: string;
  escape: string;
  subComponent: string;
}

const DEFAULT_DELIMITERS: HL7Delimiters = {
  field: '|',
  component: '^',
  repetition: '~',
  escape: '\\',
  subComponent: '&',
};

interface ParsedMSH {
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  dateTime: string;
  messageType: string;
  eventType: string;
  messageControlId: string;
  processingId: string;
  versionId: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get raw HL7 message
    const rawMessage = await req.text();

    if (!rawMessage || rawMessage.trim().length === 0) {
      return new Response(
        generateNAK('', 'AR', 'Empty message received'),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/hl7-v2' },
        }
      );
    }

    // Strip MLLP framing if present
    let message = rawMessage;
    if (message.startsWith(MLLP_START)) {
      message = message.substring(1);
    }
    if (message.endsWith(MLLP_END)) {
      message = message.substring(0, message.length - 2);
    }

    // Normalize line endings
    message = message.replace(/\r\n/g, '\r').replace(/\n/g, '\r');

    // Parse MSH segment to get basic info
    const msh = parseMSH(message);
    if (!msh) {
      return new Response(
        generateNAK('', 'AR', 'Invalid HL7 message: MSH segment not found or malformed'),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/hl7-v2' },
        }
      );
    }

    // Get connection or tenant info from headers
    const connectionId = req.headers.get('X-HL7-Connection-Id');
    const tenantId = req.headers.get('X-Tenant-Id');
    const apiKey = req.headers.get('X-API-Key');
    const authHeader = req.headers.get('Authorization');

    // Validate authentication
    const supabaseUrl = SUPABASE_URL!;
    const supabaseServiceKey = SB_SECRET_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        generateNAK(msh.messageControlId, 'AE', 'Server configuration error'),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/hl7-v2' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine tenant ID
    let resolvedTenantId = tenantId;

    if (connectionId) {
      // Look up connection to get tenant and validate
      const { data: connection, error: connError } = await supabase
        .from('hl7_connections')
        .select('tenant_id, enabled, auth_type, auth_credentials')
        .eq('id', connectionId)
        .single();

      if (connError || !connection) {
        return new Response(
          generateNAK(msh.messageControlId, 'AR', 'Invalid connection ID'),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/hl7-v2' },
          }
        );
      }

      if (!connection.enabled) {
        return new Response(
          generateNAK(msh.messageControlId, 'AR', 'Connection is disabled'),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/hl7-v2' },
          }
        );
      }

      // Validate API key if required
      if (connection.auth_type === 'api_key') {
        const expectedKey = connection.auth_credentials?.api_key;
        if (!apiKey || apiKey !== expectedKey) {
          return new Response(
            generateNAK(msh.messageControlId, 'AR', 'Invalid API key'),
            {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/hl7-v2' },
            }
          );
        }
      }

      resolvedTenantId = connection.tenant_id;
    } else if (!tenantId) {
      // Must have either connection ID or tenant ID
      return new Response(
        generateNAK(msh.messageControlId, 'AR', 'Missing X-HL7-Connection-Id or X-Tenant-Id header'),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/hl7-v2' },
        }
      );
    }

    // Log the message
    const { data: logEntry, error: logError } = await supabase.rpc('log_hl7_message', {
      p_tenant_id: resolvedTenantId,
      p_connection_id: connectionId || null,
      p_message_control_id: msh.messageControlId,
      p_message_type: msh.messageType,
      p_event_type: msh.eventType,
      p_direction: 'inbound',
      p_raw_message: new TextEncoder().encode(message),
      p_sending_app: msh.sendingApplication,
      p_sending_facility: msh.sendingFacility,
      p_receiving_app: msh.receivingApplication,
      p_receiving_facility: msh.receivingFacility,
    });

    if (logError) {
      console.error('Failed to log HL7 message:', logError);
      // Continue processing even if logging fails
    }

    const logId = logEntry;

    // Queue for async processing (full parsing and FHIR translation)
    if (logId) {
      const { error: queueError } = await supabase
        .from('hl7_message_queue')
        .insert({
          tenant_id: resolvedTenantId,
          message_log_id: logId,
          priority: getPriority(msh.messageType, msh.eventType),
        });

      if (queueError) {
        console.error('Failed to queue message:', queueError);
      }
    }

    // Update status to parsed (basic validation passed)
    if (logId) {
      await supabase.rpc('update_hl7_message_status', {
        p_log_id: logId,
        p_status: 'parsed',
      });
    }

    // Generate and return ACK
    const ack = generateACK(msh, 'AA');

    // Log ACK if we have a log entry
    if (logId) {
      await supabase
        .from('hl7_message_log')
        .update({
          ack_code: 'AA',
          ack_sent_at: new Date().toISOString(),
        })
        .eq('id', logId);
    }

    return new Response(ack, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/hl7-v2' },
    });
  } catch (error) {
    console.error('HL7 receive error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      generateNAK('', 'AE', `Processing error: ${errorMessage}`),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/hl7-v2' },
      }
    );
  }
});

/**
 * Parse MSH segment from raw HL7 message
 */
function parseMSH(message: string): ParsedMSH | null {
  const segments = message.split('\r');
  const mshSegment = segments.find((s) => s.startsWith('MSH'));

  if (!mshSegment || mshSegment.length < 20) {
    return null;
  }

  // Extract delimiters from MSH
  const fieldSep = mshSegment[3];
  const componentSep = mshSegment[4];

  const fields = mshSegment.split(fieldSep);

  // MSH.9 contains message type
  const messageTypeField = fields[8] || '';
  const messageTypeParts = messageTypeField.split(componentSep);

  return {
    sendingApplication: fields[2] || '',
    sendingFacility: fields[3] || '',
    receivingApplication: fields[4] || '',
    receivingFacility: fields[5] || '',
    dateTime: fields[6] || '',
    messageType: messageTypeParts[0] || '',
    eventType: messageTypeParts[1] || '',
    messageControlId: fields[9] || `MSG${Date.now()}`,
    processingId: fields[10] || 'P',
    versionId: fields[11] || '2.5.1',
  };
}

/**
 * Generate ACK message
 */
function generateACK(msh: ParsedMSH, ackCode: 'AA' | 'AE' | 'AR'): string {
  const now = new Date();
  const timestamp = formatHL7DateTime(now);
  const controlId = `ACK${Date.now()}`;

  let ack = `MSH|^~\\&|${msh.receivingApplication}|${msh.receivingFacility}|${msh.sendingApplication}|${msh.sendingFacility}|${timestamp}||ACK^${msh.eventType}^ACK|${controlId}|P|${msh.versionId}\r`;
  ack += `MSA|${ackCode}|${msh.messageControlId}\r`;

  return ack;
}

/**
 * Generate NAK (negative acknowledgment) message
 */
function generateNAK(controlId: string, ackCode: 'AE' | 'AR', errorMessage: string): string {
  const now = new Date();
  const timestamp = formatHL7DateTime(now);
  const nakControlId = `NAK${Date.now()}`;

  let nak = `MSH|^~\\&|WELLFIT|WELLFIT|UNKNOWN|UNKNOWN|${timestamp}||ACK|${nakControlId}|P|2.5.1\r`;
  nak += `MSA|${ackCode}|${controlId || 'UNKNOWN'}|${escapeHL7(errorMessage)}\r`;
  nak += `ERR|||207^Application internal error^HL70357|E|||${escapeHL7(errorMessage)}\r`;

  return nak;
}

/**
 * Format date as HL7 datetime
 */
function formatHL7DateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/**
 * Escape special characters in HL7 text
 */
function escapeHL7(text: string): string {
  return text
    .replace(/\\/g, '\\E\\')
    .replace(/\|/g, '\\F\\')
    .replace(/\^/g, '\\S\\')
    .replace(/&/g, '\\T\\')
    .replace(/~/g, '\\R\\')
    .replace(/\r/g, '')
    .replace(/\n/g, '');
}

/**
 * Determine message priority for queue ordering
 */
function getPriority(messageType: string, eventType: string): number {
  // Higher number = higher priority

  // Emergency/stat messages get highest priority
  if (messageType === 'ADT') {
    switch (eventType) {
      case 'A01': // Admit
      case 'A03': // Discharge
        return 9;
      case 'A02': // Transfer
      case 'A04': // Register
        return 8;
      case 'A08': // Update
        return 6;
      default:
        return 5;
    }
  }

  // Lab results are important
  if (messageType === 'ORU') {
    return 7;
  }

  // Orders
  if (messageType === 'ORM') {
    return 7;
  }

  return 5;
}
