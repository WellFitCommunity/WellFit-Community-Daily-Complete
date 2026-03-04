/**
 * StartChainModal — Modal for starting a new chain run
 *
 * Dynamically builds input fields from the chain's step definitions'
 * input_mapping ($.input.* keys). Submits via chainOrchestrationService.startChain().
 */

import React, { useState, useEffect, useCallback } from 'react';
import { EAButton } from '../../envision-atlus/EAButton';
import { chainOrchestrationService } from '../../../services/mcp/chainOrchestrationService';
import type { ChainDefinition } from '../../../services/mcp/chainOrchestration.types';
import { extractInputFields } from './MCPChainManagementPanel.types';

interface StartChainModalProps {
  chain: ChainDefinition;
  onClose: () => void;
  onStarted: () => void;
}

export const StartChainModal: React.FC<StartChainModalProps> = ({
  chain,
  onClose,
  onStarted,
}) => {
  const [inputFields, setInputFields] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingFields, setLoadingFields] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInputFields = useCallback(async () => {
    const result = await chainOrchestrationService.listChainSteps(chain.id);
    if (result.success) {
      const mappings = result.data.map((step) => step.input_mapping);
      const fields = extractInputFields(mappings);
      setInputFields(fields);
    }
    setLoadingFields(false);
  }, [chain.id]);

  useEffect(() => {
    loadInputFields();
  }, [loadInputFields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const inputParams: Record<string, unknown> = {};
    for (const field of inputFields) {
      if (fieldValues[field]?.trim()) {
        inputParams[field] = fieldValues[field].trim();
      }
    }

    const result = await chainOrchestrationService.startChain(chain.chain_key, inputParams);

    if (result.success) {
      onStarted();
      onClose();
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  };

  const handleFieldChange = (field: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      data-testid="start-chain-modal"
    >
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-white mb-1">Start Chain</h2>
        <p className="text-sm text-slate-400 mb-4">{chain.display_name}</p>

        <form onSubmit={handleSubmit}>
          {loadingFields ? (
            <div className="text-sm text-slate-500 py-4" data-testid="loading-fields">
              Loading input fields...
            </div>
          ) : inputFields.length === 0 ? (
            <div className="text-sm text-slate-500 py-4" data-testid="no-input-fields">
              This chain requires no input parameters.
            </div>
          ) : (
            <div className="space-y-3">
              {inputFields.map((field) => (
                <div key={field}>
                  <label
                    htmlFor={`chain-input-${field}`}
                    className="block text-sm font-medium text-slate-300 mb-1"
                  >
                    {field.replace(/_/g, ' ')}
                  </label>
                  <input
                    id={`chain-input-${field}`}
                    type="text"
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-[#00857a] focus:outline-none"
                    placeholder={field}
                    value={fieldValues[field] || ''}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    data-testid={`input-${field}`}
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-3 text-sm text-red-400 bg-red-900/20 p-2 rounded" data-testid="start-chain-error">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <EAButton
              variant="ghost"
              size="sm"
              type="button"
              onClick={onClose}
              data-testid="cancel-start-chain"
            >
              Cancel
            </EAButton>
            <EAButton
              variant="primary"
              size="sm"
              type="submit"
              loading={loading}
              disabled={loadingFields}
              data-testid="submit-start-chain"
            >
              Start
            </EAButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StartChainModal;
