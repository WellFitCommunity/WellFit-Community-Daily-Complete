import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Save, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle, Wifi } from 'lucide-react';
import { clearinghouseMCP, type PayerInfo } from '../../services/mcp/mcpClearinghouseClient';
import { auditLogger } from '../../services/auditLogger';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

interface ClearinghouseConfig {
  provider: 'waystar' | 'change_healthcare' | 'availity';
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  submitterId: string;
}

export function ClearinghouseConfigPanel() {
  const { user } = useAuth();
  const { theme } = useDashboardTheme();
  const [config, setConfig] = useState<ClearinghouseConfig>({
    provider: 'waystar',
    apiUrl: '',
    clientId: '',
    clientSecret: '',
    submitterId: ''
  });
  const [showSecret, setShowSecret] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'not_configured' | 'error'>('unknown');
  const [payerList, setPayerList] = useState<PayerInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // Call function to get config + secrets from Vault
      const { data, error } = await supabase.rpc('get_clearinghouse_credentials');

      if (error) throw error;

      if (data && data.length > 0) {
        const creds = data[0];
        setConfig({
          provider: creds.provider || 'waystar',
          apiUrl: creds.api_url || '',
          clientId: creds.client_id || '',
          clientSecret: creds.client_secret || '',
          submitterId: creds.submitter_id || ''
        });
      }
    } catch (error: unknown) {

    }
  };

  const saveConfig = async () => {
    if (!user) return;

    setSaving(true);
    setMessage('');

    try {
      // Call function to save config + secrets to Vault
      const { error } = await supabase.rpc('update_clearinghouse_config', {
        p_provider: config.provider,
        p_api_url: config.apiUrl,
        p_client_id: config.clientId,
        p_client_secret: config.clientSecret,
        p_submitter_id: config.submitterId
      });

      if (error) throw error;

      setMessage('✅ Configuration saved securely in Vault!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: unknown) {

      setMessage('❌ Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestStatus('testing');
    setConnectionStatus('unknown');
    setPayerList([]);
    setMessage('');

    try {
      const result = await clearinghouseMCP.testConnection();

      if (result.success && result.data?.connected) {
        setTestStatus('success');
        setConnectionStatus('connected');
        setMessage('✅ Clearinghouse connected! Credentials are valid.');

        // Load available payers
        try {
          const payerResult = await clearinghouseMCP.getPayerList();
          if (payerResult.success && payerResult.data?.payers) {
            setPayerList(payerResult.data.payers.slice(0, 5));
          }
        } catch (payerErr: unknown) {
          await auditLogger.error(
            'CLEARINGHOUSE_PAYER_LIST_FAILED',
            payerErr instanceof Error ? payerErr : new Error(String(payerErr)),
            {}
          );
        }
      } else {
        setTestStatus('error');
        setConnectionStatus('not_configured');
        setMessage('');
      }
    } catch (err: unknown) {
      setTestStatus('error');
      setConnectionStatus('not_configured');
      await auditLogger.error(
        'CLEARINGHOUSE_TEST_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        {}
      );
    }

    setTimeout(() => setTestStatus('idle'), 5000);
  };

  const getProviderDefaults = (provider: string) => {
    switch (provider) {
      case 'waystar':
        return {
          apiUrl: 'https://api.waystar.com/v1',
          docs: 'https://developers.waystar.com/'
        };
      case 'change_healthcare':
        return {
          apiUrl: 'https://api.changehealthcare.com/',
          docs: 'https://developers.changehealthcare.com/'
        };
      case 'availity':
        return {
          apiUrl: 'https://api.availity.com/v1',
          docs: 'https://developer.availity.com/'
        };
      default:
        return { apiUrl: '', docs: '' };
    }
  };

  const defaults = getProviderDefaults(config.provider);

  return (
    <div className="max-w-4xl mx-auto p-6" aria-label="Clearinghouse Configuration Panel">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Clearinghouse Configuration
          </h2>
          <p className="text-gray-600">
            Configure your clearinghouse connection for automated claim submission
          </p>
        </div>

        {/* Provider Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Clearinghouse Provider
          </label>
          <select
            value={config.provider}
            onChange={(e) => {
              const provider = e.target.value as 'waystar' | 'change_healthcare' | 'availity';
              const defaults = getProviderDefaults(provider);
              setConfig({ ...config, provider, apiUrl: defaults.apiUrl });
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
          >
            <option value="waystar">Waystar (Most Popular)</option>
            <option value="change_healthcare">Change Healthcare (Largest Network)</option>
            <option value="availity">Availity (Free/Low-Cost)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Documentation: <a href={defaults.docs} target="_blank" rel="noopener noreferrer" className="text-[var(--ea-primary,#00857a)] hover:underline">{defaults.docs}</a>
          </p>
        </div>

        {/* API URL */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            API URL
          </label>
          <input
            type="url"
            value={config.apiUrl}
            onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
            placeholder="https://api.waystar.com/v1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
          />
          <p className="text-xs text-gray-500 mt-1">
            Production API endpoint (not sandbox)
          </p>
        </div>

        {/* Client ID */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Client ID
          </label>
          <input
            type="text"
            value={config.clientId}
            onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
            placeholder="abc123-your-org-id"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
          />
          <p className="text-xs text-gray-500 mt-1">
            Provided by your clearinghouse account rep
          </p>
        </div>

        {/* Client Secret */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Client Secret
          </label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={config.clientSecret}
              onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
              placeholder="sk_live_xyz789..."
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            />
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showSecret ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Keep this secret secure - never share publicly
          </p>
        </div>

        {/* Submitter ID */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Submitter ID (NPI or Assigned ID)
          </label>
          <input
            type="text"
            value={config.submitterId}
            onChange={(e) => setConfig({ ...config, submitterId: e.target.value })}
            placeholder="1234567890"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
          />
          <p className="text-xs text-gray-500 mt-1">
            Your organization's NPI or clearinghouse-assigned submitter ID
          </p>
        </div>

        {/* Not Configured Banner */}
        {connectionStatus === 'not_configured' && (
          <div className="mb-6 p-4 rounded-lg border bg-orange-50 border-orange-200 text-orange-900" role="alert">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-orange-600" />
              <div>
                <p className="font-semibold mb-1">Clearinghouse not configured</p>
                <p className="text-sm">Add vendor credentials in Supabase secrets:</p>
                <ul className="mt-1 text-sm font-mono list-disc list-inside space-y-0.5 text-orange-800">
                  <li>CLEARINGHOUSE_API_KEY</li>
                  <li>CLEARINGHOUSE_ENDPOINT</li>
                  <li>CLEARINGHOUSE_SENDER_ID</li>
                </ul>
                <p className="text-xs mt-2 text-orange-700">Supported vendors: Waystar, Change Healthcare, Availity</p>
              </div>
            </div>
          </div>
        )}

        {/* Connected Status + Payer List */}
        {connectionStatus === 'connected' && (
          <div className="mb-6 p-4 rounded-lg border bg-green-50 border-green-200">
            <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
              <Wifi className="h-4 w-4" />
              Connected
              {payerList.length > 0 && (
                <span className="ml-2 text-sm font-normal text-green-700">
                  — {payerList.length}+ payers available
                </span>
              )}
            </div>
            {payerList.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {payerList.map(p => (
                  <span key={p.id} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status Message (success/general) */}
        {message && connectionStatus !== 'not_configured' && (
          <div className={`mb-6 p-4 rounded-lg border ${
            testStatus === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : testStatus === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-[var(--ea-primary,#00857a)]/5 border-[var(--ea-primary,#00857a)]/20 text-[var(--ea-primary,#00857a)]'
          }`}>
            {message}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={saveConfig}
            disabled={saving || !config.apiUrl || !config.clientId || !config.clientSecret}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors ${theme.buttonPrimary}`}
          >
            <Save className="h-5 w-5" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>

          <button
            onClick={testConnection}
            disabled={testStatus === 'testing'}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {testStatus === 'testing' ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Testing...
              </>
            ) : testStatus === 'success' ? (
              <>
                <CheckCircle className="h-5 w-5" />
                Test Successful
              </>
            ) : testStatus === 'error' ? (
              <>
                <XCircle className="h-5 w-5" />
                Test Failed
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5" />
                Test Connection
              </>
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            How to Get Your API Credentials:
          </h3>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>
              <strong>Waystar:</strong> Contact sales at waystar.com or call 1-888-639-2666
            </li>
            <li>
              <strong>Change Healthcare:</strong> Visit changehealthcare.com/contact
            </li>
            <li>
              <strong>Availity:</strong> Register at availity.com (free for some states)
            </li>
            <li>Tell them you need API access for electronic 837P claim submission</li>
            <li>They'll provide your Client ID, Client Secret, and Submitter ID</li>
            <li>Enter those credentials here and click "Test Connection"</li>
          </ol>
        </div>

        {/* Cost Information */}
        <div className="mt-4 p-4 bg-[var(--ea-primary,#00857a)]/5 rounded-lg border border-[var(--ea-primary,#00857a)]/20">
          <h3 className="text-sm font-semibold text-[var(--ea-primary,#00857a)] mb-2">
            Estimated Costs:
          </h3>
          <ul className="text-sm text-[var(--ea-primary,#00857a)]/80 space-y-1">
            <li><strong>Waystar:</strong> ~$500-1,200/month (setup + monthly + per-claim fees)</li>
            <li><strong>Change Healthcare:</strong> ~$400-1,000/month</li>
            <li><strong>Availity:</strong> FREE (portal) or ~$100-300/month (API access)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
