/**
 * APIKeyManagementPanel — Create and manage API keys for integrations
 */

import React, { useState } from 'react';
import { Key, Eye, EyeOff, Copy } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { APIKey } from './TenantITDashboard.types';

export const APIKeyManagementPanel: React.FC = () => {
  const [showKey, setShowKey] = useState<string | null>(null);
  const [apiKeys] = useState<APIKey[]>([
    {
      id: '1',
      name: 'EHR Integration',
      key_prefix: 'wf_live_8x7k',
      permissions: ['read:patients', 'write:appointments'],
      created_at: '2024-10-15T09:00:00Z',
      last_used: '2025-01-25T14:30:00Z',
      expires_at: '2025-10-15T09:00:00Z',
      status: 'active'
    },
    {
      id: '2',
      name: 'Lab Results Webhook',
      key_prefix: 'wf_live_3m2n',
      permissions: ['write:lab_results'],
      created_at: '2024-06-01T10:30:00Z',
      last_used: '2025-01-20T11:15:00Z',
      expires_at: null,
      status: 'active'
    },
    {
      id: '3',
      name: 'Old Billing Integration',
      key_prefix: 'wf_live_9p4q',
      permissions: ['read:billing'],
      created_at: '2023-03-01T08:00:00Z',
      last_used: '2024-01-15T09:00:00Z',
      expires_at: '2024-03-01T08:00:00Z',
      status: 'expired'
    }
  ]);

  const handleCopyKey = (keyPrefix: string) => {
    navigator.clipboard.writeText(`${keyPrefix}...`);
    alert('Key prefix copied to clipboard');
  };

  const handleRevokeKey = (keyId: string) => {
    if (window.confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      alert(`API key ${keyId} revoked`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-gray-600">
          Manage API keys for third-party integrations within your organization.
        </p>
        <button className="px-4 py-2 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg border-2 border-black transition-all flex items-center gap-2">
          <Key className="w-5 h-5" />
          Generate New Key
        </button>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.map(key => (
          <div key={key.id} className={`p-4 rounded-lg border-2 ${key.status === 'active' ? 'border-black bg-white hover:border-[#1BA39C]' : 'border-gray-300 bg-gray-50'} transition-all`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${key.status === 'active' ? 'bg-[#C8E63D]' : 'bg-gray-300'} border-2 border-black`}>
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-black">{key.name}</p>
                    <StatusBadge status={key.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="px-2 py-1 bg-gray-100 rounded-sm text-sm font-mono">
                      {showKey === key.id ? `${key.key_prefix}••••••••••••••••` : '••••••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                      className="p-1 hover:bg-gray-200 rounded-sm transition-all"
                    >
                      {showKey === key.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleCopyKey(key.key_prefix)}
                      className="p-1 hover:bg-gray-200 rounded-sm transition-all"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                    <span>Last used: {new Date(key.last_used).toLocaleDateString()}</span>
                    {key.expires_at && (
                      <span className={key.status === 'expired' ? 'text-red-600 font-bold' : ''}>
                        Expires: {new Date(key.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {key.status === 'active' && (
                <button
                  onClick={() => handleRevokeKey(key.id)}
                  className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-lg border border-red-300 transition-all"
                >
                  Revoke
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {key.permissions.map(perm => (
                <span key={perm} className="px-2 py-1 bg-[#E8F8F7] text-[#1BA39C] text-xs font-bold rounded-sm border border-[#1BA39C]">
                  {perm}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
