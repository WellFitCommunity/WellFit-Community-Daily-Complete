/**
 * ChainDefinitionList — Chain overview cards
 *
 * Displays available chain definitions with display_name, description,
 * version, and a lazy-fetched step count. Each card has a "Start Chain" button.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { EABadge } from '../../envision-atlus/EABadge';
import { EAButton } from '../../envision-atlus/EAButton';
import type { ChainDefinition } from '../../../services/mcp/chainOrchestration.types';
import { chainOrchestrationService } from '../../../services/mcp/chainOrchestrationService';

interface ChainDefinitionListProps {
  chains: ChainDefinition[];
  onStartChain: (chain: ChainDefinition) => void;
  onEditChain?: (chain: ChainDefinition) => void;
  onDeleteChain?: (chain: ChainDefinition) => void;
}

export const ChainDefinitionList: React.FC<ChainDefinitionListProps> = ({
  chains,
  onStartChain,
  onEditChain,
  onDeleteChain,
}) => {
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({});

  const fetchStepCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    for (const chain of chains) {
      const result = await chainOrchestrationService.listChainSteps(chain.id);
      if (result.success) {
        counts[chain.id] = result.data.length;
      }
    }
    setStepCounts(counts);
  }, [chains]);

  useEffect(() => {
    if (chains.length > 0) {
      fetchStepCounts();
    }
  }, [chains, fetchStepCounts]);

  if (chains.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400" data-testid="no-chains">
        No chain definitions found. Seed chains via migration or edge function.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="chain-definition-list">
      {chains.map((chain) => (
        <div
          key={chain.id}
          className="rounded-lg border border-slate-700 bg-slate-800/50 p-5"
          data-testid={`chain-card-${chain.chain_key}`}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {chain.display_name}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {chain.description || 'No description'}
              </p>
            </div>
            <EABadge variant="info" size="sm">v{chain.version}</EABadge>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-slate-500">
              {stepCounts[chain.id] !== undefined
                ? `${stepCounts[chain.id]} steps`
                : 'Loading steps...'}
            </span>
            <div className="flex items-center gap-2">
              {onEditChain && (
                <EAButton
                  variant="secondary"
                  size="sm"
                  onClick={() => onEditChain(chain)}
                  data-testid={`edit-chain-${chain.chain_key}`}
                >
                  Edit
                </EAButton>
              )}
              {onDeleteChain && (
                <EAButton
                  variant="secondary"
                  size="sm"
                  onClick={() => onDeleteChain(chain)}
                  data-testid={`delete-chain-${chain.chain_key}`}
                >
                  Delete
                </EAButton>
              )}
              <EAButton
                variant="primary"
                size="sm"
                onClick={() => onStartChain(chain)}
                data-testid={`start-chain-${chain.chain_key}`}
              >
                Start Chain
              </EAButton>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChainDefinitionList;
