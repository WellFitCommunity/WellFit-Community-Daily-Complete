/**
 * HL7MessageTestPanel — Admin tool for testing HL7/X12 message operations
 *
 * Provides a UI for pasting HL7 v2.x or X12 837P messages and running
 * parse, validate, and FHIR conversion operations via the MCP HL7-X12 server.
 *
 * Used by: FHIR Interoperability Dashboard (additional tab), standalone admin tool
 */

import React, { useState } from 'react';
import { useHL7X12 } from '../../hooks/useHL7X12';
import { HL7_TEMPLATES } from '../../services/mcp/mcpHL7X12Client';
import type {
  HL7ParsedMessage,
  HL7ValidationResult,
  X12ParsedClaim,
  X12ValidationResult,
  FHIRBundle,
  FHIRClaim,
  MessageTypeInfo,
} from '../../services/mcp/mcpHL7X12Client';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
} from '../envision-atlus';
import {
  FileText,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  AlertTriangle,
  Loader2,
  Copy,
  Trash2,
  Info,
} from 'lucide-react';

// =====================================================
// Types
// =====================================================

type MessageFormat = 'hl7' | 'x12';
type HL7Operation = 'parse' | 'validate' | 'to_fhir';
type X12Operation = 'parse' | 'validate' | 'to_fhir';

// =====================================================
// Component
// =====================================================

export const HL7MessageTestPanel: React.FC = () => {
  const [messageFormat, setMessageFormat] = useState<MessageFormat>('hl7');
  const [messageInput, setMessageInput] = useState('');
  const {
    result,
    operation,
    loading,
    error,
    parseHL7,
    validateHL7,
    convertHL7ToFHIR,
    parseX12,
    validateX12,
    convertX12ToFHIR,
    getMessageTypes,
    reset,
  } = useHL7X12();

  const [messageTypesLoaded, setMessageTypesLoaded] = useState(false);

  // =====================================================
  // Handlers
  // =====================================================

  const handleHL7Operation = async (op: HL7Operation) => {
    if (!messageInput.trim()) return;
    switch (op) {
      case 'parse':
        await parseHL7(messageInput);
        break;
      case 'validate':
        await validateHL7(messageInput);
        break;
      case 'to_fhir':
        await convertHL7ToFHIR(messageInput);
        break;
    }
  };

  const handleX12Operation = async (op: X12Operation) => {
    if (!messageInput.trim()) return;
    switch (op) {
      case 'parse':
        await parseX12(messageInput);
        break;
      case 'validate':
        await validateX12(messageInput);
        break;
      case 'to_fhir':
        await convertX12ToFHIR(messageInput);
        break;
    }
  };

  const handleLoadTemplate = (templateName: string) => {
    const timestamp = new Date().toISOString().slice(0, 19);
    switch (templateName) {
      case 'ADT_A01':
        setMessageInput(HL7_TEMPLATES.ADT_A01({
          controlId: `MSG${Date.now()}`,
          sendingApp: 'ENVISION_ATLUS',
          sendingFacility: 'WELLFIT_HOSPITAL',
          patientId: 'PAT-001',
          patientName: { family: 'DOE', given: 'JANE' },
          dob: '19500315',
          gender: 'F',
          encounterId: `ENC-${Date.now()}`,
          admitDate: timestamp.replace(/[-:T]/g, '').slice(0, 14),
        }));
        setMessageFormat('hl7');
        break;
      case 'ADT_A03':
        setMessageInput(HL7_TEMPLATES.ADT_A03({
          controlId: `MSG${Date.now()}`,
          sendingApp: 'ENVISION_ATLUS',
          sendingFacility: 'WELLFIT_HOSPITAL',
          patientId: 'PAT-001',
          encounterId: `ENC-${Date.now()}`,
          dischargeDate: timestamp.replace(/[-:T]/g, '').slice(0, 14),
        }));
        setMessageFormat('hl7');
        break;
      case 'ORU_R01':
        setMessageInput(HL7_TEMPLATES.ORU_R01({
          controlId: `MSG${Date.now()}`,
          sendingApp: 'ENVISION_ATLUS',
          sendingFacility: 'WELLFIT_LAB',
          patientId: 'PAT-001',
          observationCode: '8867-4',
          observationValue: '72',
          observationUnit: 'bpm',
          observationDate: timestamp.replace(/[-:T]/g, '').slice(0, 14),
        }));
        setMessageFormat('hl7');
        break;
    }
    reset();
  };

  const handleLoadMessageTypes = async () => {
    await getMessageTypes();
    setMessageTypesLoaded(true);
  };

  const handleCopyResult = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    }
  };

  const handleClear = () => {
    setMessageInput('');
    reset();
  };

  // =====================================================
  // Result Renderers
  // =====================================================

  const renderHL7ParseResult = (data: HL7ParsedMessage) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoChip label="Type" value={`${data.message_type}^${data.event_type}`} />
        <InfoChip label="Version" value={data.version} />
        <InfoChip label="Control ID" value={data.control_id} />
        <InfoChip label="Segments" value={String(data.segments.length)} />
      </div>
      {data.patient && (
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Patient</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <InfoChip label="ID" value={data.patient.id} />
            <InfoChip label="Name" value={`${data.patient.name.family}, ${data.patient.name.given}`} />
            {data.patient.dob && <InfoChip label="DOB" value={data.patient.dob} />}
            {data.patient.gender && <InfoChip label="Gender" value={data.patient.gender} />}
          </div>
        </div>
      )}
      {data.encounter && (
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Encounter</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <InfoChip label="ID" value={data.encounter.id} />
            <InfoChip label="Class" value={data.encounter.class} />
            {data.encounter.location && <InfoChip label="Location" value={data.encounter.location} />}
          </div>
        </div>
      )}
    </div>
  );

  const renderValidationResult = (data: HL7ValidationResult | X12ValidationResult) => (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {data.valid ? (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold">Valid</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="h-5 w-5" />
            <span className="font-semibold">Invalid</span>
          </div>
        )}
        {'segment_count' in data && data.segment_count !== undefined && (
          <span className="text-xs text-slate-400">({data.segment_count} segments)</span>
        )}
      </div>
      {data.errors.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-red-400">Errors</h4>
          {data.errors.map((err, i) => (
            <div key={i} className="text-sm text-red-300 bg-red-900/20 rounded px-3 py-1.5 border border-red-800/30">
              {err}
            </div>
          ))}
        </div>
      )}
      {data.warnings.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-amber-400">Warnings</h4>
          {data.warnings.map((warn, i) => (
            <div key={i} className="text-sm text-amber-300 bg-amber-900/20 rounded px-3 py-1.5 border border-amber-800/30">
              {warn}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderX12ParseResult = (data: X12ParsedClaim) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoChip label="Control #" value={data.control_number} />
        <InfoChip label="Type" value={data.transaction_type} />
        <InfoChip label="Segments" value={String(data.segment_count)} />
        <InfoChip label="Loops" value={String(data.loop_count)} />
      </div>
      {data.claims.map((claim, i) => (
        <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">
            Claim: {claim.claim_id} — ${(claim.total_charge ?? 0).toFixed(2)}
          </h4>
          <div className="space-y-1">
            {claim.service_lines.map((line, j) => (
              <div key={j} className="text-sm text-slate-400 flex justify-between">
                <span>Line {line.line_number}: {line.cpt_code}</span>
                <span>${(line.charge_amount ?? 0).toFixed(2)} x{line.units}</span>
              </div>
            ))}
          </div>
          {claim.diagnoses.length > 0 && (
            <div className="mt-2 text-xs text-slate-500">
              Dx: {claim.diagnoses.join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderFHIRResult = (data: FHIRBundle | FHIRClaim) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <InfoChip label="Resource Type" value={data.resourceType} />
        {'type' in data && typeof data.type === 'string' && (
          <InfoChip label="Bundle Type" value={data.type} />
        )}
        {'total' in data && typeof data.total === 'number' && (
          <InfoChip label="Entries" value={String(data.total)} />
        )}
      </div>
      <pre className="bg-slate-900 rounded-lg p-3 text-xs text-slate-300 overflow-auto max-h-64 border border-slate-700">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );

  const renderMessageTypes = (data: MessageTypeInfo) => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2">HL7 v2.x Message Types</h4>
        <div className="space-y-2">
          {data.hl7_types.map((type, i) => (
            <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="font-medium text-white">{type.type}</div>
              <div className="text-xs text-slate-400">{type.description}</div>
              <div className="text-xs text-slate-500 mt-1">Events: {type.events.join(', ')}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2">X12 Transaction Types</h4>
        <div className="space-y-2">
          {data.x12_types.map((type, i) => (
            <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="font-medium text-white">{type.type}</div>
              <div className="text-xs text-slate-400">{type.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderResult = () => {
    if (!result) return null;

    switch (operation) {
      case 'parse_hl7':
        return renderHL7ParseResult(result as HL7ParsedMessage);
      case 'validate_hl7':
      case 'validate_x12':
        return renderValidationResult(result as HL7ValidationResult | X12ValidationResult);
      case 'hl7_to_fhir':
        return renderFHIRResult(result as FHIRBundle);
      case 'parse_x12':
        return renderX12ParseResult(result as X12ParsedClaim);
      case 'x12_to_fhir':
        return renderFHIRResult(result as FHIRClaim);
      case 'get_message_types':
        return renderMessageTypes(result as MessageTypeInfo);
      default:
        return (
          <pre className="bg-slate-900 rounded-lg p-3 text-xs text-slate-300 overflow-auto max-h-64 border border-slate-700">
            {JSON.stringify(result, null, 2)}
          </pre>
        );
    }
  };

  // =====================================================
  // Render
  // =====================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <EACard>
        <EACardHeader icon={<FileText className="h-5 w-5 text-[#00857a]" />}>
          <div className="flex items-center justify-between w-full">
            <div>
              <h3 className="text-lg font-semibold text-white">HL7 / X12 Message Lab</h3>
              <p className="text-sm text-slate-400">Parse, validate, and convert healthcare messages via MCP</p>
            </div>
            <EAButton
              variant="secondary"
              onClick={handleLoadMessageTypes}
              disabled={loading || messageTypesLoaded}
              icon={<Info className="h-4 w-4" />}
            >
              {messageTypesLoaded ? 'Types Loaded' : 'View Message Types'}
            </EAButton>
          </div>
        </EACardHeader>
      </EACard>

      {/* Format Toggle + Templates */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => { setMessageFormat('hl7'); reset(); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              messageFormat === 'hl7'
                ? 'bg-[#00857a] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            HL7 v2.x
          </button>
          <button
            onClick={() => { setMessageFormat('x12'); reset(); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              messageFormat === 'x12'
                ? 'bg-[#00857a] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            X12 837P
          </button>
        </div>

        {messageFormat === 'hl7' && (
          <div className="flex gap-2">
            <span className="text-xs text-slate-500 self-center">Templates:</span>
            {['ADT_A01', 'ADT_A03', 'ORU_R01'].map(t => (
              <button
                key={t}
                onClick={() => handleLoadTemplate(t)}
                className="px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition"
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Message Input */}
      <EACard>
        <EACardHeader icon={<FileText className="h-4 w-4 text-slate-400" />}>
          <span className="text-sm font-medium text-slate-300">
            {messageFormat === 'hl7' ? 'HL7 v2.x Message' : 'X12 837P Content'}
          </span>
        </EACardHeader>
        <EACardContent>
          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder={messageFormat === 'hl7'
              ? 'Paste HL7 v2.x message here (MSH|^~\\&|...)'
              : 'Paste X12 837P content here (ISA*00*...)'
            }
            className="w-full h-48 bg-slate-900 text-slate-200 font-mono text-xs p-4 rounded-lg border border-slate-700 focus:border-[#00857a] focus:outline-none resize-y"
            spellCheck={false}
          />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
            {messageFormat === 'hl7' ? (
              <>
                <EAButton
                  variant="primary"
                  onClick={() => handleHL7Operation('parse')}
                  disabled={loading || !messageInput.trim()}
                  icon={loading && operation === 'parse_hl7' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                >
                  Parse HL7
                </EAButton>
                <EAButton
                  variant="secondary"
                  onClick={() => handleHL7Operation('validate')}
                  disabled={loading || !messageInput.trim()}
                  icon={loading && operation === 'validate_hl7' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                >
                  Validate
                </EAButton>
                <EAButton
                  variant="secondary"
                  onClick={() => handleHL7Operation('to_fhir')}
                  disabled={loading || !messageInput.trim()}
                  icon={loading && operation === 'hl7_to_fhir' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                >
                  Convert to FHIR
                </EAButton>
              </>
            ) : (
              <>
                <EAButton
                  variant="primary"
                  onClick={() => handleX12Operation('parse')}
                  disabled={loading || !messageInput.trim()}
                  icon={loading && operation === 'parse_x12' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                >
                  Parse X12
                </EAButton>
                <EAButton
                  variant="secondary"
                  onClick={() => handleX12Operation('validate')}
                  disabled={loading || !messageInput.trim()}
                  icon={loading && operation === 'validate_x12' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                >
                  Validate
                </EAButton>
                <EAButton
                  variant="secondary"
                  onClick={() => handleX12Operation('to_fhir')}
                  disabled={loading || !messageInput.trim()}
                  icon={loading && operation === 'x12_to_fhir' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                >
                  Convert to FHIR
                </EAButton>
              </>
            )}

            <div className="ml-auto">
              <EAButton
                variant="secondary"
                onClick={handleClear}
                icon={<Trash2 className="h-4 w-4" />}
              >
                Clear
              </EAButton>
            </div>
          </div>
        </EACardContent>
      </EACard>

      {/* Error Display */}
      {error && (
        <EAAlert variant="critical">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </EAAlert>
      )}

      {/* Result Display */}
      {result && (
        <EACard>
          <EACardHeader icon={<CheckCircle className="h-5 w-5 text-[#00857a]" />}>
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-medium text-slate-300">
                Result: {operation?.replace(/_/g, ' ').toUpperCase()}
              </span>
              <button
                onClick={handleCopyResult}
                className="text-slate-400 hover:text-white transition p-1"
                title="Copy JSON to clipboard"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </EACardHeader>
          <EACardContent>
            {renderResult()}
          </EACardContent>
        </EACard>
      )}
    </div>
  );
};

// =====================================================
// Helper Components
// =====================================================

const InfoChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-800/50 rounded px-3 py-2 border border-slate-700">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-sm text-white font-mono truncate" title={value}>{value}</div>
  </div>
);

export default HL7MessageTestPanel;
