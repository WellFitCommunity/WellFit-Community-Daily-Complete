/**
 * ChainStepEditor — Form for editing a single chain step definition
 *
 * Inline editor within ChainDefinitionEditor. Supports all step fields:
 * server, tool, approval gates, conditions, placeholders, timeouts, retries, input mapping.
 */

import React, { useState } from 'react';
import { EAButton } from '../../envision-atlus/EAButton';
import type { DraftStep } from './ChainDefinitionEditor';

// ============================================================
// Known MCP servers for dropdown
// ============================================================

const KNOWN_MCP_SERVERS = [
  'mcp-fhir-server',
  'mcp-hl7-x12-server',
  'mcp-clearinghouse-server',
  'mcp-prior-auth-server',
  'mcp-npi-registry-server',
  'mcp-cms-coverage-server',
  'mcp-medical-codes-server',
  'mcp-medical-coding-server',
  'mcp-claude-server',
  'mcp-postgres-server',
  'mcp-edge-functions-server',
  'mcp-pubmed-server',
  'mcp-cultural-competency-server',
];

// ============================================================
// Component
// ============================================================

interface ChainStepEditorProps {
  step: DraftStep;
  onSave: (updated: DraftStep) => void;
  onCancel: () => void;
}

export const ChainStepEditor: React.FC<ChainStepEditorProps> = ({
  step,
  onSave,
  onCancel,
}) => {
  const [draft, setDraft] = useState<DraftStep>({ ...step });
  const [mappingKey, setMappingKey] = useState('');
  const [mappingValue, setMappingValue] = useState('');

  const update = <K extends keyof DraftStep>(key: K, value: DraftStep[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const addMapping = () => {
    if (!mappingKey.trim() || !mappingValue.trim()) return;
    update('input_mapping', { ...draft.input_mapping, [mappingKey]: mappingValue });
    setMappingKey('');
    setMappingValue('');
  };

  const removeMapping = (key: string) => {
    const { [key]: _, ...rest } = draft.input_mapping;
    update('input_mapping', rest);
  };

  return (
    <div className="space-y-3" data-testid="chain-step-editor" aria-label="Chain Step Editor">
      {/* Row 1: Key + Display Name */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="step-key" className="block text-xs text-slate-400 mb-1">Step Key</label>
          <input
            id="step-key"
            type="text"
            value={draft.step_key}
            onChange={(e) => update('step_key', e.target.value)}
            placeholder="e.g. validate_codes"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            data-testid="step-key-input"
          />
        </div>
        <div>
          <label htmlFor="step-display-name" className="block text-xs text-slate-400 mb-1">Display Name</label>
          <input
            id="step-display-name"
            type="text"
            value={draft.display_name}
            onChange={(e) => update('display_name', e.target.value)}
            placeholder="e.g. Validate Billing Codes"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            data-testid="step-display-name-input"
          />
        </div>
      </div>

      {/* Row 2: MCP Server + Tool Name */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="step-server" className="block text-xs text-slate-400 mb-1">MCP Server</label>
          <select
            id="step-server"
            value={draft.mcp_server}
            onChange={(e) => update('mcp_server', e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            data-testid="step-server-select"
          >
            <option value="">Select server...</option>
            {KNOWN_MCP_SERVERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="step-tool" className="block text-xs text-slate-400 mb-1">Tool Name</label>
          <input
            id="step-tool"
            type="text"
            value={draft.tool_name}
            onChange={(e) => update('tool_name', e.target.value)}
            placeholder="e.g. validate_billing_codes"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            data-testid="step-tool-input"
          />
        </div>
      </div>

      {/* Row 3: Timeout + Retries */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="step-timeout" className="block text-xs text-slate-400 mb-1">Timeout (ms)</label>
          <input
            id="step-timeout"
            type="number"
            value={draft.timeout_ms}
            onChange={(e) => update('timeout_ms', parseInt(e.target.value, 10) || 30000)}
            min={1000}
            max={300000}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            data-testid="step-timeout-input"
          />
        </div>
        <div>
          <label htmlFor="step-retries" className="block text-xs text-slate-400 mb-1">Max Retries</label>
          <input
            id="step-retries"
            type="number"
            value={draft.max_retries}
            onChange={(e) => update('max_retries', parseInt(e.target.value, 10) || 0)}
            min={0}
            max={5}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            data-testid="step-retries-input"
          />
        </div>
      </div>

      {/* Row 4: Flags */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={draft.requires_approval}
            onChange={(e) => update('requires_approval', e.target.checked)}
            data-testid="step-approval-checkbox"
          />
          Requires Approval
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={draft.is_conditional}
            onChange={(e) => update('is_conditional', e.target.checked)}
            data-testid="step-conditional-checkbox"
          />
          Conditional
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={draft.is_placeholder}
            onChange={(e) => update('is_placeholder', e.target.checked)}
            data-testid="step-placeholder-checkbox"
          />
          Placeholder
        </label>
      </div>

      {/* Conditional fields */}
      {draft.requires_approval && (
        <div>
          <label htmlFor="step-approval-role" className="block text-xs text-slate-400 mb-1">Approval Role</label>
          <input
            id="step-approval-role"
            type="text"
            value={draft.approval_role ?? ''}
            onChange={(e) => update('approval_role', e.target.value || null)}
            placeholder="e.g. physician, billing_admin"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            data-testid="step-approval-role-input"
          />
        </div>
      )}

      {draft.is_conditional && (
        <div>
          <label htmlFor="step-condition" className="block text-xs text-slate-400 mb-1">Condition Expression (JSONPath)</label>
          <input
            id="step-condition"
            type="text"
            value={draft.condition_expression ?? ''}
            onChange={(e) => update('condition_expression', e.target.value || null)}
            placeholder="e.g. $.steps.check_prior_auth.prior_auth_required == true"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            data-testid="step-condition-input"
          />
        </div>
      )}

      {draft.is_placeholder && (
        <div>
          <label htmlFor="step-placeholder-msg" className="block text-xs text-slate-400 mb-1">Placeholder Message</label>
          <input
            id="step-placeholder-msg"
            type="text"
            value={draft.placeholder_message ?? ''}
            onChange={(e) => update('placeholder_message', e.target.value || null)}
            placeholder="e.g. Clearinghouse integration pending"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            data-testid="step-placeholder-msg-input"
          />
        </div>
      )}

      {/* Input Mapping */}
      <div>
        <p className="text-xs text-slate-400 mb-1">Input Mapping (JSONPath)</p>
        {Object.entries(draft.input_mapping).length > 0 && (
          <div className="space-y-1 mb-2">
            {Object.entries(draft.input_mapping).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <code className="text-emerald-400">{key}</code>
                <span className="text-slate-500">&rarr;</span>
                <code className="text-blue-400">{value}</code>
                <button
                  onClick={() => removeMapping(key)}
                  className="text-red-400 hover:text-red-300 ml-1 focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
                  aria-label={`Remove mapping ${key}`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={mappingKey}
            onChange={(e) => setMappingKey(e.target.value)}
            placeholder="param_name"
            className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            data-testid="mapping-key-input"
          />
          <input
            type="text"
            value={mappingValue}
            onChange={(e) => setMappingValue(e.target.value)}
            placeholder="$.input.patient_id"
            className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            data-testid="mapping-value-input"
          />
          <button
            onClick={addMapping}
            className="px-2 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            data-testid="add-mapping-btn"
          >
            Add
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <EAButton variant="secondary" size="sm" onClick={onCancel} data-testid="cancel-step-edit">
          Cancel
        </EAButton>
        <EAButton variant="primary" size="sm" onClick={() => onSave(draft)} data-testid="save-step-btn">
          Done
        </EAButton>
      </div>
    </div>
  );
};

export default ChainStepEditor;
