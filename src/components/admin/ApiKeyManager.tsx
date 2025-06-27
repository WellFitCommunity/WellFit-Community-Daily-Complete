import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface ApiKey {
  id: string; // Primary key of the api_keys table
  user_id: string | null; // Assuming this might be the user who created it, or null
  org_name: string;
  api_key: string;
  active: boolean;
  usage_count: number;
  last_used: string | null;
  created_at: string;
}

const ApiKeyManager: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null); // For fetch errors
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null); // For user feedback on actions

  const [newOrgName, setNewOrgName] = useState<string>('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async (showLoading: boolean = true): Promise<void> => {
    if (showLoading) setLoading(true);
    // Clear previous specific action feedback, but not general fetch errors
    setFeedbackMessage(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (supabaseError) {
        console.error('Error fetching API keys:', supabaseError);
        setError(`Failed to fetch API keys: ${supabaseError.message}. Ensure RLS policies allow select.`);
        setApiKeys([]);
      } else {
        setApiKeys((data as ApiKey[]) || []); // Assert type for data
        setError(null); // Clear previous fetch error if successful
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error('An unexpected error occurred');
      console.error('Unexpected error fetching API keys:', error);
      setError(`An unexpected error occurred: ${error.message}`);
      setApiKeys([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleGenerateKey = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFeedbackMessage(null);
    setGeneratedKey(null);

    if (!newOrgName.trim()) {
      setFeedbackMessage('Organization name cannot be empty.');
      return;
    }

    const sanitizedOrgName = newOrgName.toLowerCase().replace(/\s+/g, '-');
    const apiKey = `${sanitizedOrgName}-${crypto.randomUUID()}`;

    setLoading(true);
    try {
      const { error: insertError } = await supabase
        .from('api_keys')
        .insert([{ org_name: newOrgName, api_key: apiKey, active: true }]);

      if (insertError) {
        console.error('Error generating API key:', insertError);
        setFeedbackMessage(`Error generating key: ${insertError.message}. Check RLS policies for insert.`);
      } else {
        setFeedbackMessage('API Key generated successfully. Copy it now, it will not be shown again.');
        setGeneratedKey(apiKey);
        setNewOrgName(''); // Clear input
        await fetchApiKeys(false); // Refresh list without full loading spinner
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error('An unexpected error occurred');
      console.error('Unexpected error generating key:', error);
      setFeedbackMessage(`An unexpected error occurred: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleKeyStatus = async (keyId: string, currentStatus: boolean): Promise<void> => {
    setFeedbackMessage(null);
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('api_keys')
        .update({ active: !currentStatus })
        .eq('id', keyId);

      if (updateError) {
        console.error('Error toggling key status:', updateError);
        setFeedbackMessage(`Error updating key: ${updateError.message}. Check RLS policies for update.`);
      } else {
        setFeedbackMessage(`Key status updated to ${!currentStatus ? 'Active' : 'Inactive'}.`);
        await fetchApiKeys(false);
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error('An unexpected error occurred');
      console.error('Unexpected error toggling key status:', error);
      setFeedbackMessage(`An unexpected error occurred: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async (keyId: string, orgName: string): Promise<void> => {
    setFeedbackMessage(null);
    if (window.confirm(`Are you sure you want to revoke the API key for "${orgName}"? This action cannot be undone.`)) {
      setLoading(true);
      try {
        const { error: deleteError } = await supabase
          .from('api_keys')
          .delete()
          .eq('id', keyId);

        if (deleteError) {
          console.error('Error revoking key:', deleteError);
          setFeedbackMessage(`Error revoking key: ${deleteError.message}. Check RLS policies for delete.`);
        } else {
          setFeedbackMessage(`Key for "${orgName}" has been revoked.`);
          await fetchApiKeys(false);
        }
      } catch (e) {
        const error = e instanceof Error ? e : new Error('An unexpected error occurred');
        console.error('Unexpected error revoking key:', error);
        setFeedbackMessage(`An unexpected error occurred: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text).then(() => {
      setFeedbackMessage('Generated API Key copied to clipboard!');
    }, (err: unknown) => { // Typed err
      console.error('Failed to copy text: ', err);
      const message = err instanceof Error ? err.message : "Unknown copy error.";
      setFeedbackMessage(`Failed to copy API Key: ${message}. Please copy it manually.`);
    });
  };

  const maskApiKey = (key: string): string => {
    if (!key || key.length < 8) return key; // Or return 'Invalid Key'
    // Show first 4, last 4 characters e.g. "ab12...wxyz"
    // If keys have prefixes like "houston-", adjust accordingly or make it more generic
    const parts = key.split('-');
    if (parts.length > 1) {
        const prefix = parts.slice(0, -1).join('-');
        const lastPart = parts[parts.length -1];
        if (lastPart.length > 8) {
            return `${prefix}-${lastPart.substring(0, 4)}...${lastPart.substring(lastPart.length - 4)}`;
        }
        return `${prefix}-${lastPart.substring(0, Math.max(1, lastPart.length-3))}...`;

    }
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Main component UI
  return (
    <div className="p-6 bg-white shadow-lg rounded-lg mt-6">
      <h2 className="text-2xl font-semibold mb-6 text-gray-700">API Key Management</h2>

      {/* Key Generation Form */}
      <div className="mb-8 p-4 border border-gray-200 rounded-lg">
        <h3 className="text-lg font-medium text-gray-800 mb-3">Generate New API Key</h3>
        <form onSubmit={handleGenerateKey} className="flex items-end space-x-3">
          <div className="flex-grow">
            <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              id="orgName"
              value={newOrgName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOrgName(e.target.value)}
              placeholder="E.g., Houston Branch"
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            disabled={loading || !newOrgName.trim()}
          >
            {loading && !error ? 'Generating...' : 'Generate Key'}
          </button>
        </form>
        {generatedKey && (
          <div className="mt-4 p-3 bg-green-50 border border-green-300 rounded-md">
            <p className="text-sm text-green-700 font-medium">New API Key (Copy this now, it won't be shown again):</p>
            <div className="flex items-center justify-between mt-1">
              <code className="text-sm text-green-900 bg-green-100 p-1 rounded font-mono break-all">{generatedKey}</code>
              <button
                onClick={() => copyToClipboard(generatedKey)}
                className="ml-3 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feedback and Error Messages */}
      {feedbackMessage && (
        <div className={`p-3 mb-4 rounded-md text-sm ${feedbackMessage.startsWith('Error') || feedbackMessage.startsWith('Failed') ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-blue-100 text-blue-700 border border-blue-300'}`}>
          {feedbackMessage}
        </div>
      )}
       {error && ( /* General fetch error display */
        <div className="p-4 mb-4 text-red-500 bg-red-100 border border-red-500 rounded-md">Error: {error}</div>
      )}


      {/* API Keys Table */}
      {loading && apiKeys.length === 0 && <div className="p-4 text-center">Loading API keys...</div>}
      
      {!loading && apiKeys.length === 0 && !error && (
        <p className="text-gray-500 text-center">No API keys found. Generate one above to get started!</p>
      )}

      {apiKeys.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Key (Masked)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {apiKeys.map((key) => (
                <tr key={key.id} className={`hover:bg-gray-50 ${loading && 'opacity-50'}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{key.org_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{maskApiKey(key.api_key)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      key.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {key.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{key.usage_count}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(key.last_used)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(key.created_at)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleToggleKeyStatus(key.id, key.active)}
                      className={`px-3 py-1 text-xs rounded-md ${
                        key.active 
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                        : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}
                      disabled={loading}
                    >
                      {key.active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleRevokeKey(key.id, key.org_name)}
                      className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                      disabled={loading}
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
