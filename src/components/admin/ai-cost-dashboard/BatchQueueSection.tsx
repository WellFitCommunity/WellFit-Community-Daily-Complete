/**
 * BatchQueueSection - Batch inference queue status display
 *
 * Purpose: Show batch queue state, processing counts, and savings
 * Used by: AICostDashboard (left column)
 */

import React from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../../envision-atlus';
import type { QueueStats } from '../../../services/ai/batchInference';
import type { BatchStats } from './AICostDashboard.types';

interface BatchQueueSectionProps {
  queueStats: QueueStats | null;
  batchStats: BatchStats | null;
}

export const BatchQueueSection: React.FC<BatchQueueSectionProps> = ({ queueStats, batchStats }) => {
  return (
    <EACard>
      <EACardHeader>
        <h2 className="text-lg font-semibold text-white">Batch Queue</h2>
      </EACardHeader>
      <EACardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {queueStats?.totalQueued ?? 0}
            </div>
            <div className="text-sm text-slate-400">Queued</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-400">
              {batchStats?.processingCount ?? 0}
            </div>
            <div className="text-sm text-slate-400">Processing</div>
          </div>
        </div>

        {queueStats && (
          <div className="space-y-2">
            <div className="text-sm text-slate-300 font-medium">By Type:</div>
            {Object.entries(queueStats.byType)
              .filter(([, count]) => count > 0)
              .map(([type, count]) => (
                <div key={type} className="flex justify-between text-sm">
                  <span className="text-slate-400">{type.replace(/_/g, ' ')}</span>
                  <span className="text-white">{count}</span>
                </div>
              ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Total Processed</span>
            <span className="text-white">
              {(batchStats?.totalRequestsProcessed ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-slate-400">Batch Savings</span>
            <span className="text-green-400">
              ${(batchStats?.totalCostSaved ?? 0).toFixed(2)}
            </span>
          </div>
        </div>
      </EACardContent>
    </EACard>
  );
};
