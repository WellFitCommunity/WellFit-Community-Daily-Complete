// src/components/admin/ApiKeyManager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase/config'; // Adjust the import path as needed
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

interface ApiKey {
  id: string;
  user_id: string | null;
  org_name: string;
  api_key: string;
  active: boolean;
  usage_count: number;
  last_used: string | null;
  created_at: string;
}

const ApiKeyManager: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from<ApiKey>('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (supabaseError) {
        setError(`Failed to fetch API keys: ${supabaseError.message}`);
        setApiKeys([]);
      } else {
        setApiKeys(data || []);
      }
    } catch {
      setError('Unexpected error fetching API keys.');
      setApiKeys([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);
    setGeneratedKey(null);

    if (!newOrgName.trim()) {
      setFeedbackMessage('Organization name cannot be empty.');
      return;
    }

    const sanitized = newOrgName.trim().toLowerCase().replace(/\s+/g, '-');
    const apiKey = `${sanitized}-${crypto.randomUUID()}`;

    setLoading(true);
    try {
      const { error: insertError } = await supabase
        .from('api_keys')
        .insert([{ org_name: newOrgName, api_key: apiKey, active: true }]);

      if (insertError) {
        setFeedbackMessage(`Error: ${insertError.message}`);
      } else {
        setFeedbackMessage('API Key generated. Copy it now; it won’t be shown again.');
        setGeneratedKey(apiKey);
        setNewOrgName('');
        await fetchApiKeys(false);
      }
    } catch {
      setFeedbackMessage('Unexpected error generating key.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleKeyStatus = async (keyId: string, currentStatus: boolean) => {
    setFeedbackMessage(null);
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('api_keys')
        .update({ active: !currentStatus })
        .eq('id', keyId);

      if (updateError) {
        setFeedbackMessage(`Error updating key: ${updateError.message}`);
      } else {
        setFeedbackMessage(`Key ${!currentStatus ? 'enabled' : 'disabled'}.`);
        await fetchApiKeys(false);
      }
    } catch {
      setFeedbackMessage('Unexpected error updating key status.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async (keyId: string, orgName: string) => {
    if (!window.confirm(`Revoke the API key for "${orgName}"? This cannot be undone.`)) return;
    setFeedbackMessage(null);
    setLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);

      if (deleteError) {
        setFeedbackMessage(`Error revoking key: ${deleteError.message}`);
      } else {
        setFeedbackMessage(`Key for "${orgName}" revoked.`);
        await fetchApiKeys(false);
      }
    } catch {
      setFeedbackMessage('Unexpected error revoking key.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFeedbackMessage('API Key copied to clipboard!');
    } catch {
      setFeedbackMessage('Failed to copy. Please copy manually.');
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  const formatDate = (str: string | null) =>
    str ? new Date(str).toLocaleString() : 'N/A';

  const exportToExcel = () => {
    const data = apiKeys.map(({ id, usage_count, ...rest }) => rest);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'API Keys');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'api_keys.xlsx');
  };

  return (
    <div className="p-6 bg-white shadow rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">API Key Manager</h2>

      {/* Key Generation */}
      <form onSubmit={handleGenerateKey} className="flex mb-6 space-x-2">
        <input
          value={newOrgName}
          onChange={e => setNewOrgName(e.target.value)}
          placeholder="Organization Name"
          className="flex-grow border p-2 rounded"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate Key'}
        </button>
      </form>
      {generatedKey && (
        <div className="mb-4 p-3 bg-green-50 rounded">
          <code className="font-mono break-all">{generatedKey}</code>
          <button
            onClick={() => copyToClipboard(generatedKey)}
            className="ml-2 text-blue-600"
          >Copy</button>
        </div>
      )}

      {feedbackMessage && <div className="mb-4 text-sm text-gray-700">{feedbackMessage}</div>}
      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      {/* Export */}
      <button
        onClick={exportToExcel}
        disabled={loading || apiKeys.length === 0}
        className="mb-4 px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
      >Export to Excel</button>

      {/* Table */}
      {loading && !apiKeys.length && <p>Loading API keys…</p>}
      {!loading && !apiKeys.length && <p>No API keys. Generate one above.</p>}
      {apiKeys.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full table-auto">
            <thead>
              <tr>
                <th className="px-4 py-2 border">Organization</th>
                <th className="px-4 py-2 border">API Key</th>
                <th className="px-4 py-2 border">Status</th>
                <th className="px-4 py-2 border">Usage</th>
                <th className="px-4 py-2 border">Last Used</th>
                <th className="px-4 py-2 border">Created</th>
                <th className="px-4 py-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map(key => (
                <tr key={key.id} className={loading ? 'opacity-50' : ''}>
                  <td className="px-4 py-2 border">{key.org_name}</td>
                  <td className="px-4 py-2 border font-mono">{maskApiKey(key.api_key)}</td>
                  <td className="px-4 py-2 border">{key.active ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-2 border">{key.usage_count}</td>
                  <td className="px-4 py-2 border">{formatDate(key.last_used)}</td>
                  <td className="px-4 py-2 border">{formatDate(key.created_at)}</td>
                  <td className="px-4 py-2 border space-x-2">
                    <button
                      onClick={() => handleToggleKeyStatus(key.id, key.active)}
                      disabled={loading}
                      className="px-2 py-1 border rounded"
                    >{key.active ? 'Disable' : 'Enable'}</button>
                    <button
                      onClick={() => handleRevokeKey(key.id, key.org_name)}
                      disabled={loading}
                      className="px-2 py-1 border rounded text-red-600"
                    >Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ApiKeyManager;
