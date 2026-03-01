/**
 * MCPKeyManagementPanel - Admin UI for MCP API key lifecycle
 *
 * Purpose: Create, rotate, revoke, and monitor MCP keys
 * Used by: Admin panel (super_admin only)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  mcpKeyManagementService,
  type MCPKey,
  type MCPKeyCreateResult,
  type KeyStatus,
} from '../../services/mcpKeyManagementService';

// =====================================================
// Sub-components
// =====================================================

/** Status badge with color coding */
const StatusBadge: React.FC<{ status: KeyStatus }> = ({ status }) => {
  const styles: Record<KeyStatus, string> = {
    active: 'bg-green-100 text-green-800',
    expired: 'bg-gray-100 text-gray-800',
    revoked: 'bg-red-100 text-red-800',
    expiring_soon: 'bg-yellow-100 text-yellow-800',
  };
  const labels: Record<KeyStatus, string> = {
    active: 'Active',
    expired: 'Expired',
    revoked: 'Revoked',
    expiring_soon: 'Expiring Soon',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

/** Available MCP scopes */
const AVAILABLE_SCOPES = [
  'mcp:admin',
  'mcp:fhir',
  'mcp:prior_auth',
  'mcp:hl7_x12',
  'mcp:clearinghouse',
  'mcp:cms_coverage',
  'mcp:npi_registry',
  'mcp:postgres',
  'mcp:medical_codes',
  'mcp:edge_functions',
  'mcp:claude',
  'mcp:read_only',
];

// =====================================================
// Create Key Dialog
// =====================================================

interface CreateKeyFormProps {
  onCreated: (result: MCPKeyCreateResult) => void;
  onCancel: () => void;
}

const CreateKeyForm: React.FC<CreateKeyFormProps> = ({ onCreated, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiresIn, setExpiresIn] = useState<string>('90');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedScopes.length === 0) return;

    setSubmitting(true);
    setError(null);

    let expiresAt: string | undefined;
    if (expiresIn !== 'never') {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(expiresIn, 10));
      expiresAt = d.toISOString();
    }

    const result = await mcpKeyManagementService.createKey({
      name: name.trim(),
      scopes: selectedScopes,
      description: description.trim() || undefined,
      expires_at: expiresAt,
    });

    setSubmitting(false);

    if (result.success) {
      onCreated(result.data);
    } else {
      setError(result.error.message);
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-blue-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New MCP Key</h3>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Key Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Claude Desktop Integration"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            required
            maxLength={255}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expires In</label>
          <select
            value={expiresIn}
            onChange={e => setExpiresIn(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">1 year</option>
            <option value="never">Never</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          maxLength={500}
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Scopes *</label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_SCOPES.map(scope => (
            <button
              key={scope}
              type="button"
              onClick={() => toggleScope(scope)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedScopes.includes(scope)
                  ? 'bg-blue-100 border-blue-400 text-blue-800'
                  : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {scope}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !name.trim() || selectedScopes.length === 0}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
        >
          {submitting ? 'Creating...' : 'Create Key'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// =====================================================
// Raw Key Display (shown once after creation)
// =====================================================

interface RawKeyDisplayProps {
  result: MCPKeyCreateResult;
  onDismiss: () => void;
}

const RawKeyDisplay: React.FC<RawKeyDisplayProps> = ({ result, onDismiss }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.raw_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-yellow-900 mb-2">Key Created Successfully</h3>
      <p className="text-sm text-yellow-800 mb-4">
        Copy this key now. It will never be shown again.
      </p>
      <div className="flex items-center gap-2 mb-4">
        <code className="flex-1 bg-white border border-yellow-200 rounded px-3 py-2 text-sm font-mono break-all">
          {result.raw_key}
        </code>
        <button
          onClick={handleCopy}
          className="px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 min-h-[44px] min-w-[44px]"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-xs text-yellow-700 mb-3">
        Prefix: <code>{result.key_prefix}</code> | ID: <code>{result.key_id}</code>
      </p>
      <button
        onClick={onDismiss}
        className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 min-h-[44px]"
      >
        I have saved this key
      </button>
    </div>
  );
};

// =====================================================
// Key Table Row
// =====================================================

interface KeyRowProps {
  mcpKey: MCPKey & { status: KeyStatus };
  onRevoke: (id: string) => void;
  onRotate: (id: string, key: MCPKey) => void;
}

const KeyRow: React.FC<KeyRowProps> = ({ mcpKey, onRevoke, onRotate }) => {
  const isActionable = mcpKey.status === 'active' || mcpKey.status === 'expiring_soon';

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900">{mcpKey.name}</div>
        <div className="text-xs text-gray-500 font-mono">{mcpKey.key_prefix}...</div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={mcpKey.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {mcpKey.scopes.map(s => (
            <span key={s} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
              {s.replace('mcp:', '')}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {mcpKey.last_used_at
          ? new Date(mcpKey.last_used_at).toLocaleDateString()
          : 'Never'}
        <div className="text-gray-400">{mcpKey.use_count} uses</div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {mcpKey.expires_at
          ? new Date(mcpKey.expires_at).toLocaleDateString()
          : 'Never'}
      </td>
      <td className="px-4 py-3">
        {isActionable && (
          <div className="flex gap-2">
            <button
              onClick={() => onRotate(mcpKey.id, mcpKey)}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 min-h-[32px]"
            >
              Rotate
            </button>
            <button
              onClick={() => onRevoke(mcpKey.id)}
              className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 min-h-[32px]"
            >
              Revoke
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};

// =====================================================
// Expiry Alert Banner
// =====================================================

interface ExpiryAlertProps {
  keys: (MCPKey & { status: KeyStatus })[];
  onRotate: (id: string, key: MCPKey) => void;
}

const ExpiryAlert: React.FC<ExpiryAlertProps> = ({ keys, onRotate }) => {
  const expiring = keys.filter(k => k.status === 'expiring_soon');
  const expired = keys.filter(k => k.status === 'expired');

  if (expiring.length === 0 && expired.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <h4 className="text-sm font-semibold text-amber-900 mb-2">Key Expiry Alerts</h4>
      {expired.length > 0 && (
        <div className="text-sm text-red-700 mb-2">
          {expired.length} key(s) have expired and need rotation.
        </div>
      )}
      {expiring.map(k => (
        <div key={k.id} className="flex items-center justify-between text-sm py-1">
          <span className="text-amber-800">
            <strong>{k.name}</strong> expires{' '}
            {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : ''}
          </span>
          <button
            onClick={() => onRotate(k.id, k)}
            className="px-2 py-1 text-xs bg-amber-200 text-amber-900 rounded hover:bg-amber-300 min-h-[32px]"
          >
            Rotate Now
          </button>
        </div>
      ))}
    </div>
  );
};

// =====================================================
// Main Panel
// =====================================================

const MCPKeyManagementPanel: React.FC = () => {
  const [keys, setKeys] = useState<(MCPKey & { status: KeyStatus })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<MCPKeyCreateResult | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    const result = await mcpKeyManagementService.listKeys();
    if (result.success) {
      setKeys(result.data);
      setError(null);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreated = (result: MCPKeyCreateResult) => {
    setNewKeyResult(result);
    setShowCreate(false);
    loadKeys();
  };

  const handleRevoke = async (keyId: string) => {
    const result = await mcpKeyManagementService.revokeKey(keyId, 'Manually revoked by admin');
    if (result.success) {
      setRevokeConfirm(null);
      loadKeys();
    } else {
      setError(result.error.message);
    }
  };

  const handleRotate = async (keyId: string, key: MCPKey) => {
    const result = await mcpKeyManagementService.rotateKey(keyId, key);
    if (result.success) {
      setNewKeyResult(result.data);
      loadKeys();
    } else {
      setError(result.error.message);
    }
  };

  const activeCount = keys.filter(k => k.status === 'active').length;
  const expiringCount = keys.filter(k => k.status === 'expiring_soon').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{activeCount} active</span>
            {expiringCount > 0 && (
              <span className="text-amber-600 font-medium">{expiringCount} expiring</span>
            )}
            <span>{keys.length} total</span>
          </div>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 min-h-[44px]"
          >
            Create Key
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* New key display */}
      {newKeyResult && (
        <RawKeyDisplay result={newKeyResult} onDismiss={() => setNewKeyResult(null)} />
      )}

      {/* Expiry alerts */}
      <ExpiryAlert keys={keys} onRotate={handleRotate} />

      {/* Create form */}
      {showCreate && (
        <CreateKeyForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
      )}

      {/* Revoke confirmation */}
      {revokeConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-800 mb-3">
            Are you sure you want to revoke this key? This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleRevoke(revokeConfirm)}
              className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 min-h-[44px]"
            >
              Confirm Revoke
            </button>
            <button
              onClick={() => setRevokeConfirm(null)}
              className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keys table */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          <span className="ml-2 text-gray-500 text-sm">Loading keys...</span>
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No MCP keys found</p>
          <p className="text-sm">Create a key to enable machine-to-machine MCP authentication.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Scopes</th>
                <th className="px-4 py-3">Last Used</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <KeyRow
                  key={k.id}
                  mcpKey={k}
                  onRevoke={id => setRevokeConfirm(id)}
                  onRotate={handleRotate}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MCPKeyManagementPanel;
