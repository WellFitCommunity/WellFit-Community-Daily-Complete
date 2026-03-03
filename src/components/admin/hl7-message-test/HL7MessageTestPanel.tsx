/**
 * HL7MessageTestPanel — Admin tool for testing HL7/X12 message operations
 *
 * Main shell component with format tab switching (HL7 v2.x / X12 837P),
 * message input textarea, and result display area.
 *
 * Operation buttons and result renderers are delegated to sub-components:
 * - HL7OperationsPanel: HL7 parse/validate/to_fhir buttons
 * - X12OperationsPanel: X12 parse/validate/to_fhir buttons
 * - ResultDisplay: Typed result renderers (parse, validation, FHIR, message types)
 *
 * Used by: FHIR Interoperability Dashboard (additional tab), standalone admin tool
 */

import React, { useState } from 'react';
import { useHL7X12 } from '../../../hooks/useHL7X12';
import type {
  HL7ParsedMessage,
  HL7ValidationResult,
  X12ParsedClaim,
  X12ValidationResult,
  FHIRBundle,
  FHIRClaim,
  MessageTypeInfo,
} from '../../../services/mcp/mcpHL7X12Client';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
} from '../../envision-atlus';
import {
  FileText,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Copy,
  Info,
} from 'lucide-react';
import type { MessageFormat, HL7Operation, X12Operation } from './types';
import { HL7OperationsPanel, buildHL7Template } from './HL7OperationsPanel';
import { X12OperationsPanel } from './X12OperationsPanel';
import { X12Generate837PPanel } from './X12Generate837PPanel';
import {
  HL7ParseResultDisplay,
  ValidationResultDisplay,
  X12ParseResultDisplay,
  FHIRResultDisplay,
  MessageTypesDisplay,
} from './ResultDisplay';

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
    const content = buildHL7Template(templateName);
    if (content) {
      setMessageInput(content);
      setMessageFormat('hl7');
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
  // Result Renderer (delegates to typed sub-components)
  // =====================================================

  const renderResult = () => {
    if (!result) return null;

    switch (operation) {
      case 'parse_hl7':
        return <HL7ParseResultDisplay data={result as HL7ParsedMessage} />;
      case 'validate_hl7':
      case 'validate_x12':
        return <ValidationResultDisplay data={result as HL7ValidationResult | X12ValidationResult} />;
      case 'hl7_to_fhir':
        return <FHIRResultDisplay data={result as FHIRBundle} />;
      case 'parse_x12':
        return <X12ParseResultDisplay data={result as X12ParsedClaim} />;
      case 'x12_to_fhir':
        return <FHIRResultDisplay data={result as FHIRClaim} />;
      case 'get_message_types':
        return <MessageTypesDisplay data={result as MessageTypeInfo} />;
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
          <button
            onClick={() => { setMessageFormat('generate_837p'); reset(); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              messageFormat === 'generate_837p'
                ? 'bg-[#00857a] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Generate 837P
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

      {/* Generate 837P Mode */}
      {messageFormat === 'generate_837p' && <X12Generate837PPanel />}

      {/* Message Input (HL7 / X12 parse modes only) */}
      {messageFormat !== 'generate_837p' && <><EACard>
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
              <HL7OperationsPanel
                messageInput={messageInput}
                loading={loading}
                currentOperation={operation}
                onOperation={handleHL7Operation}
              />
            ) : (
              <X12OperationsPanel
                messageInput={messageInput}
                loading={loading}
                currentOperation={operation}
                onOperation={handleX12Operation}
              />
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
      </>}
    </div>
  );
};

export default HL7MessageTestPanel;
