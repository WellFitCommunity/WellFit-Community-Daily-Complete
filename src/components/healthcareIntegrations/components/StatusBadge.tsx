/**
 * StatusBadge - Connection status indicator
 */

import React from 'react';
import { EABadge } from '../../envision-atlus';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  // Map status to EABadge variants: critical, high, elevated, normal, info, neutral
  const variant =
    status === 'connected' ? 'normal' :
    status === 'error' ? 'critical' :
    status === 'testing' ? 'elevated' :
    'neutral';

  const label =
    status === 'connected' ? 'Connected' :
    status === 'error' ? 'Error' :
    status === 'testing' ? 'Testing' :
    'Disconnected';

  return <EABadge variant={variant}>{label}</EABadge>;
};
