// src/components/admin/ApiKeyManager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

// Define the shape of your API key record
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
      // Remove generic on .from() to avoid TSX conflict
      const { data, error: supabaseError } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (supabaseError) {
        setError(`Failed to fetch API keys: ${supabaseError.message}`);
        setApiKeys([]);
      } else {
        setApiKeys((data as ApiKey[]) || []);
      }
    } catch (e) {
      console.error(e);
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
        setFeedbackMessage(`Error generating API key: ${insertError.message}`);
      } else {
        setFeedbackMessage('API Key generated. Copy it now; it won’t be shown again.');
        setGeneratedKey(apiKey);
        setNewOrgName('');
        await fetchApiKeys(false);
      }
    } catch (e) {
      console.error(e);
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
        setFeedbackMessage(`Error updating key status: ${updateError.message}`);
      } else {
        setFeedbackMessage(`Key ${!currentStatus ? 'enabled' : 'disabled'}.`);
        await fetchApiKeys(false);
      }
    } catch (e) {
      console.error(e);
      setFeedbackMessage('Unexpected error updating key status.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async (keyId: string, orgName: string) => {
    if (!window.confirm(`Revoke the API key for "${orgName}"? This action cannot be undone.`)) return;
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
    } catch (e) {
      console.error(e);
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

  const maskApiKey = (key: string) =>
    key.length <= 8 ? key : `${key.slice(0, 4)}...${key.slice(-4)}`;

  const formatDate = (str: string | null) => (str ? new Date(str).toLocaleString() : 'N/A');

  const exportToExcel = () => {
    const sheetData = apiKeys.map(({ id, usage_count, ...rest }) => rest);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'API Keys');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'api_keys.xlsx');
  };

  return (
    <div className="p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">API Key Manager</h2>

      <form onSubmit={handleGenerateKey} className="flex space-x-2 mb-6">
        <input
          value={newOrgName}
          onChange={e => setNewOrgName(e.target.value)}
          placeholder="Organization Name"
          className="flex-grow border rounded p-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </form>

      {generatedKey && (
        <div className="mb-4 p-3 bg-green-50 rounded">
          <code className="font-mono break-all">{generatedKey}</code>
          <button onClick={() => copyToClipboard(generatedKey)} className="ml-2 text-blue-600">
            Copy
          </button>
        </div>
      )}

      {(feedbackMessage || error) && (
        <div className={`mb-4 p-2 rounded text-sm ${error ? 'text-red-700 bg-red-100' : 'text-gray-700 bg-gray-100'}`}>
          {error || feedbackMessage}
        </div>
      )}

      <button
        onClick={exportToExcel}
        disabled={loading || apiKeys.length === 0}
        className="mb-4 px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
      >Export to Excel</button>

      {loading && !apiKeys.length && <p>Loading API keys…</p>}
      {!loading && !apiKeys.length && <p>No API keys found.</p>}

      {apiKeys.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                <th className="border px-4 py-2">Org</th>
                <th className="border px-4 py-2">Key</th>
                <th className="border px-4 py-2">Status</th>
                <th className="border px-4 py-2">Usage</th>
                <th className="border px-4 py-2">Last Used</th>
                <th className="border px-4 py-2">Created</th>
                <th className="border px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map(key => (
                <tr key={key.id} className={loading ? 'opacity-50' : ''}>
                  <td className="border px-4 py-2">{key.org_name}</td>
                  <td className="border px-4 py-2 font-mono">{maskApiKey(key.api_key)}</td>
                  <td className="border px-4 py-2">{key.active ? 'Active' : 'Inactive'}</td>
                  <td className="border px-4 py-2">{key.usage_count}</td>
                  <td className="border px-4 py-2">{formatDate(key.last_used)}</td>
                  <td className="border px-4 py-2">{formatDate(key.created_at)}</td>
                  <td className="border px-4 py-2 space-x-2">
                    <button
                      onClick={() => handleToggleKeyStatus(key.id, key.active)}
                      disabled={loading}
                      className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded disabled:opacity-50"
                    >
                      {key.active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleRevokeKey(key.id, key.org_name)}
                      disabled={loading}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                    >
                      Revoke
                    </button>
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
