/**
 * X12OperationsPanel — X12 837P parse/validate/to_fhir operation buttons
 *
 * Renders action buttons for X12 operations. No templates are provided
 * for X12 (the user pastes raw 837P content).
 *
 * Used by: HL7MessageTestPanel (main shell)
 */

import React from 'react';
import {
  EAButton,
} from '../../envision-atlus';
import {
  FileText,
  CheckCircle,
  ArrowRightLeft,
  Loader2,
} from 'lucide-react';
import type { X12Operation } from './types';

// =====================================================
// Props
// =====================================================

interface X12OperationsPanelProps {
  messageInput: string;
  loading: boolean;
  currentOperation: string | null;
  onOperation: (op: X12Operation) => void;
}

// =====================================================
// Component
// =====================================================

export const X12OperationsPanel: React.FC<X12OperationsPanelProps> = ({
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
        icon={loading && currentOperation === 'parse_x12' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      >
        Parse X12
      </EAButton>
      <EAButton
        variant="secondary"
        onClick={() => onOperation('validate')}
        disabled={disabled}
        icon={loading && currentOperation === 'validate_x12' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
      >
        Validate
      </EAButton>
      <EAButton
        variant="secondary"
        onClick={() => onOperation('to_fhir')}
        disabled={disabled}
        icon={loading && currentOperation === 'x12_to_fhir' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
      >
        Convert to FHIR
      </EAButton>
    </>
  );
};
