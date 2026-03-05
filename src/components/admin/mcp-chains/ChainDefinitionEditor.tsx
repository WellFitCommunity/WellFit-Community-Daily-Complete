/**
 * ChainDefinitionEditor — Create/Edit chain definitions and steps
 *
 * Full-screen modal for CRUD operations on chain definitions.
 * Supports adding, editing, reordering, and removing steps.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { EAButton } from '../../envision-atlus/EAButton';
import { EAAlert } from '../../envision-atlus/EAAlert';
import { EABadge } from '../../envision-atlus/EABadge';
import { chainOrchestrationService } from '../../../services/mcp/chainOrchestrationService';
import type { ChainDefinition } from '../../../services/mcp/chainOrchestration.types';
import { ChainStepEditor } from './ChainStepEditor';

// ============================================================
// Types
// ============================================================

interface ChainDefinitionEditorProps {
  /** Existing chain to edit, or null for create mode */
  chain: ChainDefinition | null;
  onSave: () => void;
  onCancel: () => void;
}

/** Draft step for local editing before save */
export interface DraftStep {
  id?: string;
  step_order: number;
  step_key: string;
  display_name: string;
  mcp_server: string;
  tool_name: string;
  requires_approval: boolean;
  approval_role: string | null;
  is_conditional: boolean;
  condition_expression: string | null;
  is_placeholder: boolean;
  placeholder_message: string | null;
  timeout_ms: number;
  max_retries: number;
  input_mapping: Record<string, string>;
}

const EMPTY_STEP: DraftStep = {
  step_order: 1,
  step_key: '',
  display_name: '',
  mcp_server: '',
  tool_name: '',
  requires_approval: false,
  approval_role: null,
  is_conditional: false,
  condition_expression: null,
  is_placeholder: false,
  placeholder_message: null,
  timeout_ms: 30000,
  max_retries: 0,
  input_mapping: {},
};

// ============================================================
// Component
// ============================================================

export const ChainDefinitionEditor: React.FC<ChainDefinitionEditorProps> = ({
  chain,
  onSave,
  onCancel,
}) => {
  const isEditMode = !!chain;

  // Chain definition fields
  const [chainKey, setChainKey] = useState(chain?.chain_key ?? '');
  const [displayName, setDisplayName] = useState(chain?.display_name ?? '');
  const [description, setDescription] = useState(chain?.description ?? '');

  // Steps
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load existing steps in edit mode
  const loadSteps = useCallback(async () => {
    if (!chain) return;
    const result = await chainOrchestrationService.listChainSteps(chain.id);
    if (result.success) {
      setSteps(result.data.map((s) => ({ ...s })));
    }
  }, [chain]);

  useEffect(() => {
    loadSteps();
  }, [loadSteps]);

  // --------------------------------------------------------
  // Step management
  // --------------------------------------------------------

  const addStep = () => {
    const newStep: DraftStep = {
      ...EMPTY_STEP,
      step_order: steps.length + 1,
    };
    setSteps([...steps, newStep]);
    setEditingStepIndex(steps.length);
  };

  const updateStep = (index: number, updated: DraftStep) => {
    const newSteps = [...steps];
    newSteps[index] = updated;
    setSteps(newSteps);
  };

  const removeStep = (index: number) => {
    const newSteps = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, step_order: i + 1 }));
    setSteps(newSteps);
    setEditingStepIndex(null);
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const newSteps = [...steps];
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps.map((s, i) => ({ ...s, step_order: i + 1 })));
  };

  // --------------------------------------------------------
  // Save
  // --------------------------------------------------------

  const handleSave = async () => {
    setError(null);
    setSuccessMsg(null);

    if (!chainKey.trim() || !displayName.trim()) {
      setError('Chain key and display name are required.');
      return;
    }

    if (steps.length === 0) {
      setError('At least one step is required.');
      return;
    }

    for (const step of steps) {
      if (!step.step_key.trim() || !step.display_name.trim() || !step.mcp_server.trim() || !step.tool_name.trim()) {
        setError(`Step ${step.step_order}: step_key, display_name, mcp_server, and tool_name are required.`);
        return;
      }
    }

    setSaving(true);

    try {
      if (isEditMode && chain) {
        // Update chain definition
        const updateResult = await chainOrchestrationService.updateChainDefinition(chain.id, {
          display_name: displayName,
          description: description || null,
        });

        if (!updateResult.success) {
          setError(updateResult.error.message);
          setSaving(false);
          return;
        }

        // Sync steps: delete removed, update existing, create new
        const existingStepIds = new Set(steps.filter((s) => s.id).map((s) => s.id));
        const originalSteps = await chainOrchestrationService.listChainSteps(chain.id);

        if (originalSteps.success) {
          for (const orig of originalSteps.data) {
            if (!existingStepIds.has(orig.id)) {
              await chainOrchestrationService.deleteStepDefinition(orig.id);
            }
          }
        }

        for (const step of steps) {
          const { id, ...stepData } = step;
          if (id) {
            await chainOrchestrationService.updateStepDefinition(id, stepData);
          } else {
            await chainOrchestrationService.createStepDefinition(chain.id, stepData);
          }
        }
      } else {
        // Create chain definition
        const createResult = await chainOrchestrationService.createChainDefinition(
          chainKey,
          displayName,
          description || null
        );

        if (!createResult.success) {
          setError(createResult.error.message);
          setSaving(false);
          return;
        }

        // Create all steps
        for (const step of steps) {
          const { id: _id, ...stepData } = step;
          await chainOrchestrationService.createStepDefinition(createResult.data.id, stepData);
        }
      }

      setSuccessMsg(isEditMode ? 'Chain definition updated.' : 'Chain definition created.');
      setTimeout(onSave, 800);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------
  // Render
  // --------------------------------------------------------

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      data-testid="chain-definition-editor"
    >
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {isEditMode ? 'Edit Chain Definition' : 'Create Chain Definition'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-white text-2xl">&times;</button>
        </div>

        {error && <EAAlert variant="warning" title="Validation Error">{error}</EAAlert>}
        {successMsg && <EAAlert variant="success">{successMsg}</EAAlert>}

        {/* Chain fields */}
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="chain-key" className="block text-sm font-medium text-slate-300 mb-1">Chain Key</label>
            <input
              id="chain-key"
              type="text"
              value={chainKey}
              onChange={(e) => setChainKey(e.target.value)}
              disabled={isEditMode}
              placeholder="e.g. claims_pipeline"
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white disabled:opacity-50"
              data-testid="chain-key-input"
            />
          </div>
          <div>
            <label htmlFor="chain-display-name" className="block text-sm font-medium text-slate-300 mb-1">Display Name</label>
            <input
              id="chain-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Claims Processing Pipeline"
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
              data-testid="chain-display-name-input"
            />
          </div>
          <div>
            <label htmlFor="chain-description" className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              id="chain-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this chain do?"
              rows={2}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
              data-testid="chain-description-input"
            />
          </div>
        </div>

        {/* Steps */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Steps ({steps.length})</h3>
            <EAButton variant="secondary" size="sm" onClick={addStep} data-testid="add-step-btn">
              + Add Step
            </EAButton>
          </div>

          {steps.length === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">No steps defined. Click &quot;+ Add Step&quot; to begin.</p>
          ) : (
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div
                  key={`step-${index}`}
                  className="rounded border border-slate-600 bg-slate-900/50 p-3"
                  data-testid={`step-row-${index}`}
                >
                  {editingStepIndex === index ? (
                    <ChainStepEditor
                      step={step}
                      onSave={(updated) => {
                        updateStep(index, updated);
                        setEditingStepIndex(null);
                      }}
                      onCancel={() => setEditingStepIndex(null)}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500 font-mono w-6">{step.step_order}</span>
                        <div>
                          <span className="text-white font-medium">{step.display_name || step.step_key || '(unnamed)'}</span>
                          <span className="text-slate-400 text-sm ml-2">{step.mcp_server}/{step.tool_name}</span>
                        </div>
                        {step.requires_approval && <EABadge variant="elevated" size="sm">Approval</EABadge>}
                        {step.is_conditional && <EABadge variant="info" size="sm">Conditional</EABadge>}
                        {step.is_placeholder && <EABadge variant="neutral" size="sm">Placeholder</EABadge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveStep(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          aria-label="Move step up"
                        >
                          &#x25B2;
                        </button>
                        <button
                          onClick={() => moveStep(index, 'down')}
                          disabled={index === steps.length - 1}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          aria-label="Move step down"
                        >
                          &#x25BC;
                        </button>
                        <button
                          onClick={() => setEditingStepIndex(index)}
                          className="px-2 py-1 text-sm text-slate-300 hover:text-white"
                          data-testid={`edit-step-${index}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeStep(index)}
                          className="px-2 py-1 text-sm text-red-400 hover:text-red-300"
                          data-testid={`remove-step-${index}`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
          <EAButton variant="secondary" onClick={onCancel} data-testid="cancel-editor">Cancel</EAButton>
          <EAButton
            variant="primary"
            loading={saving}
            onClick={handleSave}
            data-testid="save-chain-btn"
          >
            {isEditMode ? 'Save Changes' : 'Create Chain'}
          </EAButton>
        </div>
      </div>
    </div>
  );
};

export default ChainDefinitionEditor;
