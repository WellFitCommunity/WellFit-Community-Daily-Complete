/**
 * ConnectionCard - Displays connection details with stats
 */

import React from 'react';
import { StatusBadge } from './StatusBadge';

interface ConnectionCardProps {
  name: string;
  type: string;
  status: string;
  lastSync?: string;
  stats?: {
    sent: number;
    received: number;
    errors: number;
  };
}

export const ConnectionCard: React.FC<ConnectionCardProps> = ({
  name,
  type,
  status,
  lastSync,
  stats,
}) => (
  <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
    <div>
      <p className="font-medium">{name}</p>
      <p className="text-sm text-slate-400">
        {type}
        {lastSync && ` | Last sync: ${new Date(lastSync).toLocaleString()}`}
      </p>
    </div>
    <div className="flex items-center gap-4">
      {stats && (
        <div className="text-right text-sm">
          <p className="text-slate-400">
            {stats.sent} sent | {stats.received} received
            {stats.errors > 0 && <span className="text-red-400"> | {stats.errors} errors</span>}
          </p>
        </div>
      )}
      <StatusBadge status={status} />
    </div>
  </div>
);
