/**
 * MCPChainManagementPanel — Main orchestration management panel
 *
 * 3 tabs: Overview (chain definitions), Runs (history + detail), Approvals (pending queue).
 * 30s polling with exponential backoff on errors.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EAButton } from '../../envision-atlus/EAButton';
import { EAAlert } from '../../envision-atlus/EAAlert';
import { chainOrchestrationService } from '../../../services/mcp/chainOrchestrationService';
import type {
  ChainDefinition,
  ChainRun,
} from '../../../services/mcp/chainOrchestration.types';
import type { ChainManagementTab } from './MCPChainManagementPanel.types';
import { TAB_LABELS } from './MCPChainManagementPanel.types';
import { ChainDefinitionList } from './ChainDefinitionList';
import { ChainRunsList } from './ChainRunsList';
import { ChainApprovalQueue } from './ChainApprovalQueue';
import { StartChainModal } from './StartChainModal';
import { ChainDefinitionEditor } from './ChainDefinitionEditor';

// ============================================================
// Constants
// ============================================================

const INITIAL_POLL_INTERVAL = 30_000;
const MAX_POLL_INTERVAL = 300_000;
const MAX_CONSECUTIVE_ERRORS = 5;
const TABS: ChainManagementTab[] = ['overview', 'runs', 'approvals'];

// ============================================================
// Component
// ============================================================

const MCPChainManagementPanel: React.FC = () => {
  // Data state
  const [chains, setChains] = useState<ChainDefinition[]>([]);
  const [runs, setRuns] = useState<ChainRun[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<ChainManagementTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startChainTarget, setStartChainTarget] = useState<ChainDefinition | null>(null);
  const [editorTarget, setEditorTarget] = useState<ChainDefinition | null | undefined>(undefined);
  // undefined = closed, null = create mode, ChainDefinition = edit mode
  const [deleteTarget, setDeleteTarget] = useState<ChainDefinition | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Polling refs
  const consecutiveErrorsRef = useRef(0);
  const currentIntervalRef = useRef(INITIAL_POLL_INTERVAL);
  const pollingPausedRef = useRef(false);

  // --------------------------------------------------------
  // Data loading
  // --------------------------------------------------------

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      consecutiveErrorsRef.current = 0;
      currentIntervalRef.current = INITIAL_POLL_INTERVAL;
      pollingPausedRef.current = false;
    }

    const [chainsResult, runsResult] = await Promise.all([
      chainOrchestrationService.listChains(),
      chainOrchestrationService.listChainRuns({ limit: 50 }),
    ]);

    if (chainsResult.success) {
      setChains(chainsResult.data);
    }

    if (runsResult.success) {
      setRuns(runsResult.data);
    }

    if (chainsResult.success && runsResult.success) {
      setError(null);
      consecutiveErrorsRef.current = 0;
      currentIntervalRef.current = INITIAL_POLL_INTERVAL;
    } else {
      const errMsg = !chainsResult.success
        ? chainsResult.error.message
        : !runsResult.success
          ? runsResult.error.message
          : 'Unknown error';
      setError(errMsg);
      consecutiveErrorsRef.current += 1;
      currentIntervalRef.current = Math.min(
        currentIntervalRef.current * 2,
        MAX_POLL_INTERVAL
      );

      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        pollingPausedRef.current = true;
      }
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  // --------------------------------------------------------
  // Polling
  // --------------------------------------------------------

  useEffect(() => {
    loadData();

    const intervalId = setInterval(() => {
      if (!pollingPausedRef.current) {
        loadData();
      }
    }, currentIntervalRef.current);

    return () => clearInterval(intervalId);
  }, [loadData]);

  // --------------------------------------------------------
  // Handlers
  // --------------------------------------------------------

  const handleRefresh = () => loadData(true);

  const handleStartChain = (chain: ChainDefinition) => {
    setStartChainTarget(chain);
  };

  const handleChainStarted = () => {
    setActiveTab('runs');
    loadData(true);
  };

  const handleApprovalAction = () => {
    loadData(true);
  };

  const handleEditChain = (chain: ChainDefinition) => {
    setEditorTarget(chain);
  };

  const handleCreateChain = () => {
    setEditorTarget(null);
  };

  const handleEditorSaved = () => {
    setEditorTarget(undefined);
    loadData(true);
  };

  const handleDeleteChain = (chain: ChainDefinition) => {
    setDeleteTarget(chain);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await chainOrchestrationService.deleteChainDefinition(deleteTarget.id);
    setDeleting(false);
    if (result.success) {
      setDeleteTarget(null);
      loadData(true);
    } else {
      setError(result.error.message);
      setDeleteTarget(null);
    }
  };

  // --------------------------------------------------------
  // Derived state
  // --------------------------------------------------------

  const approvalCount = runs.filter((r) => r.status === 'awaiting_approval').length;

  // --------------------------------------------------------
  // Render
  // --------------------------------------------------------

  return (
    <div data-testid="mcp-chain-management-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">MCP Chain Orchestration</h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage multi-server pipelines, monitor runs, and approve clinical gates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EAButton
            variant="primary"
            size="sm"
            onClick={handleCreateChain}
            data-testid="create-chain-btn"
          >
            + New Chain
          </EAButton>
          <EAButton
            variant="secondary"
            size="sm"
            loading={refreshing}
            onClick={handleRefresh}
            data-testid="refresh-chains"
          >
            Refresh
          </EAButton>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <EAAlert variant="warning" title="Data Load Error" data-testid="chain-error-alert">
          {error}
          {pollingPausedRef.current && ' — Polling paused due to repeated errors.'}
        </EAAlert>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-16" data-testid="chain-loading">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00857a]" />
          <span className="ml-3 text-slate-400">Loading chain data...</span>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-slate-700 mb-4" data-testid="chain-tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-[#00857a] border-b-2 border-[#00857a]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                onClick={() => setActiveTab(tab)}
                data-testid={`tab-${tab}`}
              >
                {TAB_LABELS[tab]}
                {tab === 'approvals' && approvalCount > 0 && (
                  <span className="ml-2 bg-amber-600 text-white text-xs rounded-full px-2 py-0.5">
                    {approvalCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <ChainDefinitionList
              chains={chains}
              onStartChain={handleStartChain}
              onEditChain={handleEditChain}
              onDeleteChain={handleDeleteChain}
            />
          )}

          {activeTab === 'runs' && (
            <ChainRunsList runs={runs} onRefresh={handleRefresh} />
          )}

          {activeTab === 'approvals' && (
            <ChainApprovalQueue
              runs={runs}
              onApprovalAction={handleApprovalAction}
            />
          )}
        </>
      )}

      {/* Start chain modal */}
      {startChainTarget && (
        <StartChainModal
          chain={startChainTarget}
          onClose={() => setStartChainTarget(null)}
          onStarted={handleChainStarted}
        />
      )}

      {/* Chain definition editor (create/edit) */}
      {editorTarget !== undefined && (
        <ChainDefinitionEditor
          chain={editorTarget}
          onSave={handleEditorSaved}
          onCancel={() => setEditorTarget(undefined)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="delete-chain-dialog">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md">
            <h3 className="text-lg font-bold text-white mb-2">Delete Chain?</h3>
            <p className="text-slate-300 mb-4">
              Are you sure you want to delete <strong>{deleteTarget.display_name}</strong>?
              This cannot be undone. Chains with existing runs cannot be deleted.
            </p>
            <div className="flex justify-end gap-3">
              <EAButton variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </EAButton>
              <EAButton
                variant="primary"
                size="sm"
                loading={deleting}
                onClick={confirmDelete}
                data-testid="confirm-delete-btn"
              >
                Delete
              </EAButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPChainManagementPanel;
