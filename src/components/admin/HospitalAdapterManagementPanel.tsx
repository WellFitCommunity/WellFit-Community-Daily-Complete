import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  Play,
  Pause,
  Activity,
  AlertTriangle,
  Info,
  ExternalLink
} from 'lucide-react';
import { UniversalAdapterRegistry, AdapterMetadata, AdapterConfig } from '../../adapters/UniversalAdapterRegistry';
import { supabase } from '../../lib/supabaseClient';

interface ConnectionStatus {
  adapterId: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  lastSync?: string;
  error?: string;
  capabilities?: string[];
}

const HospitalAdapterManagementPanel: React.FC = () => {
  const [adapters, setAdapters] = useState<AdapterMetadata[]>([]);
  const [connections, setConnections] = useState<Map<string, ConnectionStatus>>(new Map());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedAdapter, setSelectedAdapter] = useState<AdapterMetadata | null>(null);
  const [configForm, setConfigForm] = useState<Partial<AdapterConfig>>({
    endpoint: '',
    authType: 'oauth2',
    apiKey: '',
    syncSchedule: '0 */6 * * *', // Every 6 hours
  });
  const [testingAdapter, setTestingAdapter] = useState<string | null>(null);
  const [autoDetectUrl, setAutoDetectUrl] = useState('');
  const [detecting, setDetecting] = useState(false);

  const registry = UniversalAdapterRegistry.getInstance();

  useEffect(() => {
    loadAdapters();
    loadConnectionStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAdapters = () => {
    const allAdapters = registry.listAdapters();
    setAdapters(allAdapters);
  };

  const loadConnectionStatuses = async () => {
    // Load from database - simulated for now
    // In production, this would query adapter_connections table
    const statusMap = new Map<string, ConnectionStatus>();

    // Example: Check which adapters are currently connected
    registry.listAdapters().forEach(adapter => {
      const connection = registry.getConnection(adapter.id);
      if (connection) {
        statusMap.set(adapter.id, {
          adapterId: adapter.id,
          status: 'connected',
          lastSync: new Date().toISOString(),
          capabilities: Object.entries(adapter.capabilities)
            .filter(([_, enabled]) => enabled)
            .map(([cap]) => cap)
        });
      } else {
        statusMap.set(adapter.id, {
          adapterId: adapter.id,
          status: 'disconnected'
        });
      }
    });

    setConnections(statusMap);
  };

  const handleAutoDetect = async () => {
    if (!autoDetectUrl.trim()) {
      alert('Please enter a FHIR endpoint URL');
      return;
    }

    setDetecting(true);
    try {
      const detected = await registry.detectAdapter(autoDetectUrl);
      if (detected) {
        alert(`Detected: ${detected.name} (${detected.vendor})\nProtocol: ${detected.protocols.join(', ')}`);
        setSelectedAdapter(detected);
        setConfigForm({
          ...configForm,
          endpoint: autoDetectUrl
        });
      } else {
        alert('Could not auto-detect adapter type. Please select manually or check the endpoint URL.');
      }
    } catch (error) {

      alert('Auto-detection failed. Please check the endpoint URL and try again.');
    } finally {
      setDetecting(false);
    }
  };

  const handleTestConnection = async (adapterId: string) => {
    setTestingAdapter(adapterId);

    // Update status to testing
    const newStatus = new Map(connections);
    const existingConnection = connections.get(adapterId);
    if (existingConnection) {
      newStatus.set(adapterId, {
        ...existingConnection,
        status: 'testing'
      });
      setConnections(newStatus);
    }

    try {
      const adapter = registry.getAdapter(adapterId);
      if (!adapter) throw new Error('Adapter not found');

      const testConfig: AdapterConfig = {
        endpoint: configForm.endpoint || 'https://test.example.com/fhir',
        authType: configForm.authType || 'api-key',
        apiKey: configForm.apiKey || 'test-key',
        syncSchedule: configForm.syncSchedule || '0 */6 * * *'
      };

      const result = await registry.testAdapter(adapterId, testConfig);

      const statusMap = new Map(connections);
      statusMap.set(adapterId, {
        adapterId,
        status: result.success ? 'connected' : 'error',
        error: result.error,
        capabilities: result.capabilities,
        lastSync: new Date().toISOString()
      });
      setConnections(statusMap);

      if (result.success) {
        alert(`✅ Connection successful!\n\nCapabilities detected:\n${result.capabilities?.join('\n') || 'None'}`);
      } else {
        alert(`❌ Connection failed:\n\n${result.error}`);
      }
    } catch (error: any) {
      const statusMap = new Map(connections);
      statusMap.set(adapterId, {
        adapterId,
        status: 'error',
        error: error.message
      });
      setConnections(statusMap);
      alert(`❌ Test failed: ${error.message}`);
    } finally {
      setTestingAdapter(null);
    }
  };

  const handleConnect = async (adapterId: string) => {
    try {
      const config: AdapterConfig = {
        endpoint: configForm.endpoint || '',
        authType: configForm.authType || 'api-key',
        apiKey: configForm.apiKey,
        clientId: configForm.clientId,
        clientSecret: configForm.clientSecret,
        username: configForm.username,
        password: configForm.password,
        syncSchedule: configForm.syncSchedule || '0 */6 * * *',
        dataMapping: configForm.dataMapping
      };

      await registry.connect(adapterId, config);

      // Save configuration to database
      const { error } = await supabase
        .from('adapter_connections')
        .upsert({
          adapter_id: adapterId,
          config: config,
          status: 'active',
          last_sync: new Date().toISOString()
        });

      if (error) throw error;

      loadConnectionStatuses();
      alert('✅ Adapter connected successfully!');
      setShowAddDialog(false);
    } catch (error: any) {

      alert(`❌ Connection failed: ${error.message}`);
    }
  };

  const handleDisconnect = async (adapterId: string) => {
    if (!window.confirm('Are you sure you want to disconnect this adapter?')) return;

    try {
      registry.disconnect(adapterId);

      // Update database
      await supabase
        .from('adapter_connections')
        .update({ status: 'inactive' })
        .eq('adapter_id', adapterId);

      loadConnectionStatuses();
      alert('Adapter disconnected successfully.');
    } catch (error: any) {

      alert(`Failed to disconnect: ${error.message}`);
    }
  };

  const getStatusBadge = (status: ConnectionStatus['status']) => {
    const badges = {
      connected: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Connected' },
      disconnected: { color: 'bg-gray-100 text-gray-800', icon: XCircle, text: 'Disconnected' },
      error: { color: 'bg-red-100 text-red-800', icon: AlertTriangle, text: 'Error' },
      testing: { color: 'bg-blue-100 text-blue-800', icon: RefreshCw, text: 'Testing...' }
    };

    const badge = badges[status];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <Icon className={`w-4 h-4 ${status === 'testing' ? 'animate-spin' : ''}`} />
        {badge.text}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="w-8 h-8" />
              Hospital EHR/EMR Adapter Management
            </h1>
            <p className="mt-2 text-blue-100">
              Connect to Epic, Cerner, Athenahealth, and other healthcare systems
            </p>
          </div>
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Connection
          </button>
        </div>
      </div>

      {/* Auto-Detection Tool */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
        <div className="flex items-start gap-3 mb-4">
          <Info className="w-6 h-6 text-blue-600 mt-1" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Auto-Detect EHR System</h2>
            <p className="text-gray-600 mt-1">
              Enter your hospital's FHIR endpoint URL and we'll automatically detect the system type
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={autoDetectUrl}
            onChange={(e) => setAutoDetectUrl(e.target.value)}
            placeholder="https://fhir.hospital.org/api/FHIR/R4"
            className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleAutoDetect}
            disabled={detecting}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {detecting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Detecting...
              </>
            ) : (
              <>
                <Activity className="w-5 h-5" />
                Auto-Detect
              </>
            )}
          </button>
        </div>

        {selectedAdapter && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-semibold">
              ✅ Detected: {selectedAdapter.name} ({selectedAdapter.vendor})
            </p>
            <p className="text-green-700 text-sm mt-1">
              Protocol: {selectedAdapter.protocols.join(', ')} • Version: {selectedAdapter.version}
            </p>
          </div>
        )}
      </div>

      {/* Adapter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adapters.map((adapter) => {
          const connectionStatus = connections.get(adapter.id) || { adapterId: adapter.id, status: 'disconnected' };
          const isConnected = connectionStatus.status === 'connected';

          return (
            <div
              key={adapter.id}
              className="bg-white rounded-xl border-2 border-gray-200 hover:border-blue-400 transition-colors p-6"
            >
              {/* Adapter Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{adapter.name}</h3>
                  <p className="text-sm text-gray-600">{adapter.vendor}</p>
                  <p className="text-xs text-gray-500 mt-1">Version {adapter.version}</p>
                </div>
                {getStatusBadge(connectionStatus.status)}
              </div>

              {/* Protocols */}
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Protocols:</p>
                <div className="flex flex-wrap gap-2">
                  {adapter.protocols.map((protocol) => (
                    <span
                      key={protocol}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded"
                    >
                      {protocol}
                    </span>
                  ))}
                </div>
              </div>

              {/* Capabilities */}
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Capabilities:</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {Object.entries(adapter.capabilities)
                    .filter(([_, enabled]) => enabled)
                    .slice(0, 6)
                    .map(([cap]) => (
                      <div key={cap} className="flex items-center gap-1 text-gray-600">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        {cap}
                      </div>
                    ))}
                  {Object.values(adapter.capabilities).filter(Boolean).length > 6 && (
                    <div className="text-gray-500">+{Object.values(adapter.capabilities).filter(Boolean).length - 6} more</div>
                  )}
                </div>
              </div>

              {/* Connection Info */}
              {isConnected && connectionStatus.lastSync && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-800">
                    <strong>Last Sync:</strong> {new Date(connectionStatus.lastSync).toLocaleString()}
                  </p>
                </div>
              )}

              {connectionStatus.error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-800">
                    <strong>Error:</strong> {connectionStatus.error}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {isConnected ? (
                  <>
                    <button
                      onClick={() => handleDisconnect(adapter.id)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
                    >
                      <Pause className="w-4 h-4" />
                      Disconnect
                    </button>
                    <button
                      onClick={() => handleTestConnection(adapter.id)}
                      disabled={testingAdapter === adapter.id}
                      className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${testingAdapter === adapter.id ? 'animate-spin' : ''}`} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setSelectedAdapter(adapter);
                        setShowAddDialog(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm"
                    >
                      <Play className="w-4 h-4" />
                      Connect
                    </button>
                    <button
                      onClick={() => handleTestConnection(adapter.id)}
                      disabled={testingAdapter === adapter.id}
                      className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${testingAdapter === adapter.id ? 'animate-spin' : ''}`} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedAdapter ? `Configure ${selectedAdapter.name}` : 'Add New Connection'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Endpoint */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  FHIR Endpoint URL *
                </label>
                <input
                  type="text"
                  value={configForm.endpoint}
                  onChange={(e) => setConfigForm({ ...configForm, endpoint: e.target.value })}
                  placeholder="https://fhir.hospital.org/api/FHIR/R4"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Auth Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Authentication Type *
                </label>
                <select
                  value={configForm.authType}
                  onChange={(e) => setConfigForm({ ...configForm, authType: e.target.value as any })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="oauth2">OAuth 2.0</option>
                  <option value="api-key">API Key</option>
                  <option value="basic">Basic Auth</option>
                  <option value="saml">SAML</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Conditional Auth Fields */}
              {configForm.authType === 'api-key' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    API Key *
                  </label>
                  <input
                    type="password"
                    value={configForm.apiKey || ''}
                    onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                    placeholder="Enter API key"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {configForm.authType === 'oauth2' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Client ID *
                    </label>
                    <input
                      type="text"
                      value={configForm.clientId || ''}
                      onChange={(e) => setConfigForm({ ...configForm, clientId: e.target.value })}
                      placeholder="Enter client ID"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Client Secret *
                    </label>
                    <input
                      type="password"
                      value={configForm.clientSecret || ''}
                      onChange={(e) => setConfigForm({ ...configForm, clientSecret: e.target.value })}
                      placeholder="Enter client secret"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {configForm.authType === 'basic' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={configForm.username || ''}
                      onChange={(e) => setConfigForm({ ...configForm, username: e.target.value })}
                      placeholder="Enter username"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={configForm.password || ''}
                      onChange={(e) => setConfigForm({ ...configForm, password: e.target.value })}
                      placeholder="Enter password"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Sync Schedule */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sync Schedule (Cron Expression)
                </label>
                <input
                  type="text"
                  value={configForm.syncSchedule}
                  onChange={(e) => setConfigForm({ ...configForm, syncSchedule: e.target.value })}
                  placeholder="0 */6 * * *"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: Every 6 hours (0 */6 * * *)
                </p>
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setSelectedAdapter(null);
                  setConfigForm({
                    endpoint: '',
                    authType: 'oauth2',
                    apiKey: '',
                    syncSchedule: '0 */6 * * *',
                  });
                }}
                className="px-6 py-2 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {selectedAdapter && (
                <>
                  <button
                    onClick={() => handleTestConnection(selectedAdapter.id)}
                    disabled={testingAdapter === selectedAdapter.id}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Test Connection
                  </button>
                  <button
                    onClick={() => handleConnect(selectedAdapter.id)}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    Save & Connect
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Documentation Link */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <ExternalLink className="w-6 h-6 text-blue-600 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-blue-900">Need Help?</h3>
            <p className="text-blue-800 mt-1">
              Check out our Universal Adapter System documentation for detailed setup instructions
            </p>
            <div className="mt-3 flex gap-3">
              <a
                href="/docs/UNIVERSAL_ADAPTER_SYSTEM.md"
                className="text-blue-600 hover:text-blue-700 font-semibold underline"
              >
                View Full Documentation
              </a>
              <a
                href="/docs/QUICK_START_ADAPTER.md"
                className="text-blue-600 hover:text-blue-700 font-semibold underline"
              >
                Quick Start Guide
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HospitalAdapterManagementPanel;
