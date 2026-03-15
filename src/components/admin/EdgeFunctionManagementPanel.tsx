/**
 * EdgeFunctionManagementPanel — Admin UI for edge function invocation and monitoring
 *
 * Purpose: Browse, invoke, and batch-execute whitelisted edge functions via MCP
 * Used by: IntelligentAdminPanel via sectionDefinitions
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Play, RefreshCw, Loader2, CheckCircle, XCircle, Zap, Info, Layers } from 'lucide-react';
import { EdgeFunctionsMCPClient } from '../../services/mcp/mcpEdgeFunctionsClient';
import type { AllowedFunctionName } from '../../services/mcp/mcpEdgeFunctionsClient';
import { auditLogger } from '../../services/auditLogger';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

interface FunctionDef {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, unknown>;
  hasSideEffects: boolean;
}

interface InvocationResult {
  functionName: string;
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
  timestamp: string;
}

type ViewMode = 'browse' | 'invoke' | 'batch';
type CategoryFilter = 'all' | 'analytics' | 'reports' | 'workflow' | 'integration' | 'utility';

const CATEGORIES: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'All Categories' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'reports', label: 'Reports' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'integration', label: 'Integration' },
  { value: 'utility', label: 'Utility' },
];

const EdgeFunctionManagementPanel: React.FC = () => {
  useDashboardTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [functions, setFunctions] = useState<FunctionDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedFunction, setSelectedFunction] = useState<FunctionDef | null>(null);
  const [payload, setPayload] = useState('{}');
  const [invoking, setInvoking] = useState(false);
  const [results, setResults] = useState<InvocationResult[]>([]);
  const [batchFunctions, setBatchFunctions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => EdgeFunctionsMCPClient.getInstance(), []);

  const loadFunctions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const category = categoryFilter === 'all' ? undefined : categoryFilter;
      const definitions = await client.listFunctions(category);
      setFunctions(definitions.map(d => ({
        name: d.name,
        description: d.description,
        category: d.category,
        parameters: (d.parameters ?? {}) as Record<string, unknown>,
        hasSideEffects: d.sideEffects !== 'none',
      })));
    } catch (err: unknown) {
      await auditLogger.error(
        'EDGE_FUNCTION_LIST_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { categoryFilter }
      );
      setError('Failed to load edge functions');
    } finally {
      setLoading(false);
    }
  }, [client, categoryFilter]);

  useEffect(() => {
    loadFunctions();
  }, [loadFunctions]);

  const handleInvoke = useCallback(async () => {
    if (!selectedFunction) return;

    setInvoking(true);
    setError(null);
    try {
      let parsedPayload: Record<string, unknown> = {};
      if (payload.trim() && payload.trim() !== '{}') {
        parsedPayload = JSON.parse(payload) as Record<string, unknown>;
      }

      const result = await client.invokeFunction(selectedFunction.name as AllowedFunctionName, parsedPayload);
      const invocationResult: InvocationResult = {
        functionName: selectedFunction.name,
        success: result.success,
        data: result.data,
        error: result.error,
        executionTimeMs: result.executionTimeMs,
        timestamp: new Date().toISOString(),
      };
      setResults(prev => [invocationResult, ...prev].slice(0, 20));

      await auditLogger.info('EDGE_FUNCTION_INVOKED', {
        functionName: selectedFunction.name,
        success: result.success,
        executionTimeMs: result.executionTimeMs,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('JSON')) {
        setError('Invalid JSON payload');
      } else {
        setError(`Invocation failed: ${errorMsg}`);
      }
      await auditLogger.error(
        'EDGE_FUNCTION_INVOKE_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { functionName: selectedFunction.name }
      );
    } finally {
      setInvoking(false);
    }
  }, [client, selectedFunction, payload]);

  const handleBatchInvoke = useCallback(async () => {
    if (batchFunctions.length === 0) return;

    setInvoking(true);
    setError(null);
    try {
      const invocations = batchFunctions.map(name => ({ function_name: name as AllowedFunctionName }));
      const batchResult = await client.batchInvoke(invocations);

      if (batchResult.results && batchResult.results.length > 0) {
        const batchResults: InvocationResult[] = batchResult.results.map(r => ({
          functionName: r.function_name,
          success: r.success,
          data: r.data,
          error: r.error,
          executionTimeMs: r.executionTimeMs,
          timestamp: new Date().toISOString(),
        }));
        setResults(prev => [...batchResults, ...prev].slice(0, 20));
      }

      await auditLogger.info('EDGE_FUNCTION_BATCH_INVOKED', {
        functions: batchFunctions,
        count: batchFunctions.length,
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'EDGE_FUNCTION_BATCH_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { functions: batchFunctions }
      );
      setError('Batch invocation failed');
    } finally {
      setInvoking(false);
    }
  }, [client, batchFunctions]);

  const toggleBatchFunction = useCallback((name: string) => {
    setBatchFunctions(prev =>
      prev.includes(name)
        ? prev.filter(f => f !== name)
        : [...prev, name]
    );
  }, []);

  const handleSelectFunction = useCallback((fn: FunctionDef) => {
    setSelectedFunction(fn);
    setPayload('{}');
    setViewMode('invoke');
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-amber-600" />
          <h2 className="text-xl font-semibold text-gray-900">Edge Function Management</h2>
        </div>
        <div className="flex items-center gap-2">
          {(['browse', 'batch'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition min-h-[44px] ${
                viewMode === mode
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {mode === 'browse' ? 'Browse' : 'Batch'}
            </button>
          ))}
          <button
            onClick={loadFunctions}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 transition min-h-[44px] min-w-[44px]"
            aria-label="Refresh functions"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800" role="alert">
          {error}
        </div>
      )}

      {/* Category Filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
          Category:
        </label>
        <select
          id="category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-base"
        >
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Browse Mode */}
      {viewMode === 'browse' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Loading functions...</p>
            </div>
          ) : functions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No functions found for this category
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Function</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Category</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Description</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Side Effects</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {functions.map(fn => (
                  <tr key={fn.name} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-3 text-sm font-mono text-gray-900">{fn.name}</td>
                    <td className="px-6 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-[var(--ea-primary,#00857a)]/10 text-[var(--ea-primary,#00857a)]">
                        {fn.category}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {fn.description}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {fn.hasSideEffects ? (
                        <span className="text-amber-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-green-600">No</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleSelectFunction(fn)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition text-sm min-h-[44px]"
                        >
                          <Play className="w-3 h-3" /> Invoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Invoke Mode */}
      {viewMode === 'invoke' && selectedFunction && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Play className="w-5 h-5 text-amber-600" />
              Invoke: {selectedFunction.name}
            </h3>
            <button
              onClick={() => setViewMode('browse')}
              className="px-3 py-2 text-gray-600 hover:text-gray-900 transition min-h-[44px]"
            >
              Back to Browse
            </button>
          </div>

          {/* Function Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-700">{selectedFunction.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Category: {selectedFunction.category} |
                  Side Effects: {selectedFunction.hasSideEffects ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </div>

          {/* Payload Input */}
          <div className="mb-4">
            <label htmlFor="function-payload" className="block text-sm font-medium text-gray-700 mb-2">
              JSON Payload
            </label>
            <textarea
              id="function-payload"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder='{"key": "value"}'
            />
          </div>

          {/* Invoke Button */}
          <button
            onClick={handleInvoke}
            disabled={invoking}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50 min-h-[44px]"
          >
            {invoking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Execute Function
          </button>
        </div>
      )}

      {/* Batch Mode */}
      {viewMode === 'batch' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-600" />
              Batch Invocation
            </h3>
            <button
              onClick={handleBatchInvoke}
              disabled={invoking || batchFunctions.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50 min-h-[44px]"
            >
              {invoking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Run {batchFunctions.length} Functions
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Select functions to execute in sequence. Functions run one at a time, stopping on first error.
          </p>
          <div className="space-y-2">
            {functions.map(fn => (
              <label
                key={fn.name}
                htmlFor={`batch-${fn.name}`}
                className={`flex items-center gap-3 p-3 rounded-lg border transition cursor-pointer ${
                  batchFunctions.includes(fn.name)
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  id={`batch-${fn.name}`}
                  type="checkbox"
                  checked={batchFunctions.includes(fn.name)}
                  onChange={() => toggleBatchFunction(fn.name)}
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <div>
                  <span className="font-mono text-sm text-gray-900">{fn.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{fn.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Execution History */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Execution History</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {results.map((result, idx) => (
              <div key={`${result.functionName}-${result.timestamp}-${idx}`} className="px-6 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-mono text-sm text-gray-900">{result.functionName}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {result.executionTimeMs}ms
                  </span>
                </div>
                {result.error && (
                  <p className="text-sm text-red-600 mt-1">{result.error}</p>
                )}
                {result.success && result.data != null && (
                  <pre className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2 max-h-24 overflow-auto font-mono">
                    {JSON.stringify(result.data, null, 2).substring(0, 500)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EdgeFunctionManagementPanel;
