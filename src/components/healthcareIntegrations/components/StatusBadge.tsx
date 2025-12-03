/**
 * StatusBadge - Connection status indicator
 */

import React from 'react';
import { EABadge } from '../../envision-atlus';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const variant =
    status === 'connected' ? 'success' :
    status === 'error' ? 'error' :
    status === 'testing' ? 'warning' :
    'secondary';

  const label =
    status === 'connected' ? 'Connected' :
    status === 'error' ? 'Error' :
    status === 'testing' ? 'Testing' :
    'Disconnected';

  return <EABadge variant={variant}>{label}</EABadge>;
};
