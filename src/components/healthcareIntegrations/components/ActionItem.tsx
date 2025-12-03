/**
 * ActionItem - Clickable alert item for dashboard action items
 */

import React from 'react';

const AlertIcon = () => <span className="text-lg">⚠️</span>;

interface ActionItemProps {
  type: 'critical' | 'warning';
  count: number;
  label: string;
  onClick: () => void;
}

export const ActionItem: React.FC<ActionItemProps> = ({ type, count, label, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
      type === 'critical'
        ? 'bg-red-900/30 hover:bg-red-900/50 border border-red-700'
        : 'bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-700'
    }`}
  >
    <div className="flex items-center gap-2">
      <AlertIcon />
      <span>
        <span className="font-semibold">{count}</span> {label}
      </span>
    </div>
    <span className="text-slate-400">→</span>
  </button>
);
