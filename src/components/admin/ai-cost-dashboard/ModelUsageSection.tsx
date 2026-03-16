/**
 * ModelUsageSection - Model distribution display with progress bars
 *
 * Purpose: Show AI model usage breakdown (Haiku vs Sonnet)
 * Used by: AICostDashboard (left column)
 */

import React from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../../envision-atlus';
import { ProgressBar } from './ProgressBar';
import type { ModelDistribution } from './AICostDashboard.types';

interface ModelUsageSectionProps {
  modelDistribution: ModelDistribution[];
}

export const ModelUsageSection: React.FC<ModelUsageSectionProps> = ({ modelDistribution }) => {
  return (
    <EACard aria-label="Model Usage">
      <EACardHeader>
        <h2 className="text-lg font-semibold text-white">Model Usage</h2>
      </EACardHeader>
      <EACardContent>
        {modelDistribution.map((model) => (
          <div key={model.model} className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-white">{model.model}</span>
              <span className="text-slate-400">{model.calls.toLocaleString()} calls</span>
            </div>
            <ProgressBar
              label=""
              value={model.percentage}
              max={100}
              color={model.model.includes('Haiku') ? 'bg-green-500' : 'bg-blue-500'}
            />
            <div className="text-sm text-slate-500">
              Est. cost: ${model.cost.toFixed(2)}
            </div>
          </div>
        ))}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-sm text-slate-400">
            <span className="text-green-400">Haiku</span> is 60% cheaper than{' '}
            <span className="text-blue-400">Sonnet</span> for simple tasks.
          </p>
        </div>
      </EACardContent>
    </EACard>
  );
};
