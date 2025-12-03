/**
 * ConnectionStatusRow - Shows connection status summary for integration type
 */

import React from 'react';
import { EABadge } from '../../envision-atlus';

interface ConnectionStatusRowProps {
  icon: React.ReactNode;
  label: string;
  connections: Array<{ connectionStatus: string; enabled: boolean }>;
}

export const ConnectionStatusRow: React.FC<ConnectionStatusRowProps> = ({
  icon,
  label,
  connections,
}) => {
  const activeCount = connections.filter(c => c.connectionStatus === 'connected' && c.enabled).length;
  const errorCount = connections.filter(c => c.connectionStatus === 'error').length;
  const totalCount = connections.length;

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {totalCount === 0 ? (
          <EABadge variant="secondary">No connections</EABadge>
        ) : (
          <>
            <EABadge variant={activeCount > 0 ? 'success' : 'secondary'}>
              {activeCount}/{totalCount} active
            </EABadge>
            {errorCount > 0 && (
              <EABadge variant="error">{errorCount} errors</EABadge>
            )}
          </>
        )}
      </div>
    </div>
  );
};
