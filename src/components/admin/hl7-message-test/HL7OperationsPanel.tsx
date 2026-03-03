/**
 * HL7OperationsPanel — HL7 v2.x parse/validate/to_fhir operation buttons
 *
 * Renders action buttons for HL7 operations. Template loading is handled
 * by the buildHL7Template utility exported from this module.
 *
 * Used by: HL7MessageTestPanel (main shell)
 */

import React from 'react';
import { HL7_TEMPLATES } from '../../../services/mcp/mcpHL7X12Client';
import {
  EAButton,
} from '../../envision-atlus';
import {
  FileText,
  CheckCircle,
  ArrowRightLeft,
  Loader2,
} from 'lucide-react';
import type { HL7Operation } from './types';

// =====================================================
// Props
// =====================================================

interface HL7OperationsPanelProps {
  messageInput: string;
  loading: boolean;
  currentOperation: string | null;
  onOperation: (op: HL7Operation) => void;
}

// =====================================================
// Template Loader Utility
// =====================================================

/**
 * Build HL7 template content from a named template.
 * Returns the message string or null if template is unknown.
 */
export function buildHL7Template(templateName: string): string | null {
  const timestamp = new Date().toISOString().slice(0, 19);
  const formattedTimestamp = timestamp.replace(/[-:T]/g, '').slice(0, 14);

  switch (templateName) {
    case 'ADT_A01':
      return HL7_TEMPLATES.ADT_A01({
        controlId: `MSG${Date.now()}`,
        sendingApp: 'ENVISION_ATLUS',
        sendingFacility: 'WELLFIT_HOSPITAL',
        patientId: 'PAT-001',
        patientName: { family: 'DOE', given: 'JANE' },
        dob: '19500315',
        gender: 'F',
        encounterId: `ENC-${Date.now()}`,
        admitDate: formattedTimestamp,
      });
    case 'ADT_A03':
      return HL7_TEMPLATES.ADT_A03({
        controlId: `MSG${Date.now()}`,
        sendingApp: 'ENVISION_ATLUS',
        sendingFacility: 'WELLFIT_HOSPITAL',
        patientId: 'PAT-001',
        encounterId: `ENC-${Date.now()}`,
        dischargeDate: formattedTimestamp,
      });
    case 'ORU_R01':
      return HL7_TEMPLATES.ORU_R01({
        controlId: `MSG${Date.now()}`,
        sendingApp: 'ENVISION_ATLUS',
        sendingFacility: 'WELLFIT_LAB',
        patientId: 'PAT-001',
        observationCode: '8867-4',
        observationValue: '72',
        observationUnit: 'bpm',
        observationDate: formattedTimestamp,
      });
    default:
      return null;
  }
}

// =====================================================
// Component
// =====================================================

export const HL7OperationsPanel: React.FC<HL7OperationsPanelProps> = ({
  messageInput,
  loading,
  currentOperation,
  onOperation,
}) => {
  const disabled = loading || !messageInput.trim();

  return (
    <>
      <EAButton
        variant="primary"
        onClick={() => onOperation('parse')}
        disabled={disabled}
        icon={loading && currentOperation === 'parse_hl7' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      >
        Parse HL7
      </EAButton>
      <EAButton
        variant="secondary"
        onClick={() => onOperation('validate')}
        disabled={disabled}
        icon={loading && currentOperation === 'validate_hl7' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
      >
        Validate
      </EAButton>
      <EAButton
        variant="secondary"
        onClick={() => onOperation('to_fhir')}
        disabled={disabled}
        icon={loading && currentOperation === 'hl7_to_fhir' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
      >
        Convert to FHIR
      </EAButton>
    </>
  );
};
