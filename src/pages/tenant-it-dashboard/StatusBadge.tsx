/**
 * StatusBadge — Colored status indicator for IT dashboard entities
 */

import React from 'react';

export const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'active':
      case 'healthy':
      case 'success':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'locked':
      case 'down':
      case 'failure':
      case 'revoked':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pending':
      case 'degraded':
      case 'expired':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`${sizeClasses} font-bold rounded-full border ${getStatusStyles()}`}>
      {status.toUpperCase()}
    </span>
  );
};
