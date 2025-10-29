/**
 * Guardian Agent Test Page
 * Allows testing and demonstration of Guardian Agent capabilities
 */

import React, { useState } from 'react';
import { getGuardianAgent } from '../services/guardian-agent';

export const GuardianTestPage: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const agent = getGuardianAgent();

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const simulateTypeError = async () => {
    addResult('🔴 Simulating: Type error (undefined access)');
    await agent.reportIssue(
      new Error('Cannot read property "data" of undefined'),
      {
        component: 'GuardianTestPage',
        filePath: '/src/pages/GuardianTestPage.tsx',
        lineNumber: 42,
        environmentState: { testType: 'type_error' },
        recentActions: ['simulate_type_error']
      }
    );
    addResult('✅ Error reported - Check /admin/guardian dashboard');
  };

  const simulateAPIError = async () => {
    addResult('🔴 Simulating: API authentication failure');
    await agent.reportIssue(
      new Error('401 Unauthorized - Token expired'),
      {
        component: 'GuardianTestPage',
        apiEndpoint: '/api/test',
        environmentState: { statusCode: 401, testType: 'api_error' },
        recentActions: ['simulate_api_error']
      }
    );
    addResult('✅ Error reported - Guardian Agent should attempt session recovery');
  };

  const simulateSecurityIssue = async () => {
    addResult('🔴 Simulating: PHI exposure in logs');
    await agent.reportIssue(
      new Error('PHI detected: Patient SSN logged to console'),
      {
        component: 'GuardianTestPage',
        environmentState: {
          phiType: 'SSN',
          testType: 'security_issue'
        },
        recentActions: ['simulate_security_issue']
      }
    );
    addResult('✅ Security issue reported - Guardian Agent should lockdown');
  };

  const simulateMemoryLeak = async () => {
    addResult('🔴 Simulating: Memory leak detected');
    await agent.reportIssue(
      new Error('Memory usage exceeded threshold: 95%'),
      {
        component: 'GuardianTestPage',
        environmentState: {
          memoryUsage: 95,
          testType: 'memory_leak'
        },
        recentActions: ['simulate_memory_leak']
      }
    );
    addResult('✅ Memory issue reported - Guardian Agent should cleanup resources');
  };

  const simulateDatabaseError = async () => {
    addResult('🔴 Simulating: Database connection failure');
    await agent.reportIssue(
      new Error('Connection lost: ECONNREFUSED'),
      {
        component: 'GuardianTestPage',
        databaseQuery: 'SELECT * FROM patients',
        environmentState: { testType: 'database_error' },
        recentActions: ['simulate_database_error']
      }
    );
    addResult('✅ Database error reported - Guardian Agent should retry with backoff');
  };

  const simulateRaceCondition = async () => {
    addResult('🔴 Simulating: Race condition in state updates');
    await agent.reportIssue(
      new Error('Concurrent modification detected'),
      {
        component: 'GuardianTestPage',
        environmentState: { testType: 'race_condition' },
        recentActions: ['simulate_race_condition']
      }
    );
    addResult('✅ Race condition reported - Guardian Agent should rollback state');
  };

  const simulateRateLimitError = async () => {
    addResult('🔴 Simulating: Rate limit exceeded');
    await agent.reportIssue(
      new Error('429 Too Many Requests - Rate limit exceeded'),
      {
        component: 'GuardianTestPage',
        apiEndpoint: '/api/test',
        environmentState: { statusCode: 429, testType: 'rate_limit' },
        recentActions: ['simulate_rate_limit']
      }
    );
    addResult('✅ Rate limit error reported - Guardian Agent should enable circuit breaker');
  };

  const simulateNetworkTimeout = async () => {
    addResult('🔴 Simulating: Network timeout');
    await agent.reportIssue(
      new Error('504 Gateway Timeout'),
      {
        component: 'GuardianTestPage',
        apiEndpoint: '/api/slow-endpoint',
        environmentState: { statusCode: 504, testType: 'timeout' },
        recentActions: ['simulate_timeout']
      }
    );
    addResult('✅ Timeout reported - Guardian Agent should retry or circuit break');
  };

  const getHealth = () => {
    const health = agent.getHealth();
    addResult(`📊 Agent Health: ${health.status.toUpperCase()}`);
    addResult(`📊 Active Issues: ${health.details.activeIssues}`);
    addResult(`📊 Healing in Progress: ${health.details.healingInProgress}`);
    addResult(`📊 Success Rate: ${health.details.successRate.toFixed(1)}%`);
  };

  const getStatistics = () => {
    const stats = agent.getStatistics();
    addResult(`📊 Issues Detected: ${stats.agentMetrics.issuesDetected}`);
    addResult(`📊 Issues Healed: ${stats.agentMetrics.issuesHealed}`);
    addResult(`📊 Success Rate: ${stats.agentMetrics.successRate.toFixed(1)}%`);
    addResult(`📊 Avg Detection Time: ${stats.agentMetrics.avgTimeToDetect.toFixed(0)}ms`);
    addResult(`📊 Avg Healing Time: ${stats.agentMetrics.avgTimeToHeal.toFixed(0)}ms`);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">🛡️ Guardian Agent Test Panel</h1>
          <p className="text-gray-300">
            Simulate different error types and watch the Guardian Agent detect and heal them autonomously.
            Check the dashboard at <code className="bg-gray-800 px-2 py-1 rounded">/admin/guardian</code> for real-time monitoring.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Test Buttons */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Error Simulations</h2>

            <button
              onClick={simulateTypeError}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors flex items-center justify-between"
            >
              <span>Type Error (Undefined Access)</span>
              <span className="text-sm opacity-75">Type Mismatch</span>
            </button>

            <button
              onClick={simulateAPIError}
              className="w-full px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold transition-colors flex items-center justify-between"
            >
              <span>API Authentication Failure</span>
              <span className="text-sm opacity-75">401 Error</span>
            </button>

            <button
              onClick={simulateSecurityIssue}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors flex items-center justify-between"
            >
              <span>PHI Security Issue</span>
              <span className="text-sm opacity-75">HIPAA Critical</span>
            </button>

            <button
              onClick={simulateMemoryLeak}
              className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors flex items-center justify-between"
            >
              <span>Memory Leak</span>
              <span className="text-sm opacity-75">Resource Issue</span>
            </button>

            <button
              onClick={simulateDatabaseError}
              className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold transition-colors flex items-center justify-between"
            >
              <span>Database Connection Failure</span>
              <span className="text-sm opacity-75">Connection Lost</span>
            </button>

            <button
              onClick={simulateRaceCondition}
              className="w-full px-6 py-3 bg-pink-600 hover:bg-pink-700 rounded-lg font-semibold transition-colors flex items-center justify-between"
            >
              <span>Race Condition</span>
              <span className="text-sm opacity-75">State Corruption</span>
            </button>

            <button
              onClick={simulateRateLimitError}
              className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors flex items-center justify-between"
            >
              <span>Rate Limit Exceeded</span>
              <span className="text-sm opacity-75">429 Error</span>
            </button>

            <button
              onClick={simulateNetworkTimeout}
              className="w-full px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-semibold transition-colors flex items-center justify-between"
            >
              <span>Network Timeout</span>
              <span className="text-sm opacity-75">504 Error</span>
            </button>

            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-lg font-bold mb-3">Agent Information</h3>
              <div className="space-y-2">
                <button
                  onClick={getHealth}
                  className="w-full px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
                >
                  Get Agent Health Status
                </button>

                <button
                  onClick={getStatistics}
                  className="w-full px-6 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg font-semibold transition-colors"
                >
                  Get Agent Statistics
                </button>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Test Results</h2>
              <button
                onClick={clearResults}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Clear
              </button>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 h-[600px] overflow-y-auto font-mono text-sm">
              {testResults.length === 0 ? (
                <div className="text-gray-400 text-center py-8">
                  No tests run yet. Click a button to simulate an error.
                </div>
              ) : (
                <div className="space-y-1">
                  {testResults.map((result, index) => (
                    <div
                      key={index}
                      className={`${
                        result.includes('🔴') ? 'text-red-400' :
                        result.includes('✅') ? 'text-green-400' :
                        result.includes('📊') ? 'text-blue-400' :
                        'text-gray-300'
                      }`}
                    >
                      {result}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
              <h3 className="font-bold mb-2">💡 What to Check</h3>
              <ul className="text-sm space-y-1 text-gray-300">
                <li>• Navigate to <code className="bg-gray-800 px-1 rounded">/admin/guardian</code> dashboard</li>
                <li>• Watch "Active Issues" section for detected errors</li>
                <li>• Monitor "Healing in Progress" for auto-healing</li>
                <li>• Check "Recent Healings" for completed actions</li>
                <li>• View "Knowledge Base" to see learned patterns</li>
                <li>• Check browser console for Guardian Agent logs</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">About Each Test</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-bold text-blue-400 mb-1">Type Error</h4>
              <p className="text-gray-300">Tests handling of undefined/null access errors. Agent should add null checks or fallback to cache.</p>
            </div>
            <div>
              <h4 className="font-bold text-yellow-400 mb-1">API Auth Failure</h4>
              <p className="text-gray-300">Tests authentication token refresh. Agent should attempt session recovery automatically.</p>
            </div>
            <div>
              <h4 className="font-bold text-red-400 mb-1">PHI Security</h4>
              <p className="text-gray-300">Tests HIPAA compliance. Agent should immediately lockdown and log security event.</p>
            </div>
            <div>
              <h4 className="font-bold text-purple-400 mb-1">Memory Leak</h4>
              <p className="text-gray-300">Tests resource management. Agent should cleanup resources and force garbage collection.</p>
            </div>
            <div>
              <h4 className="font-bold text-orange-400 mb-1">Database Error</h4>
              <p className="text-gray-300">Tests connection resilience. Agent should retry with exponential backoff.</p>
            </div>
            <div>
              <h4 className="font-bold text-pink-400 mb-1">Race Condition</h4>
              <p className="text-gray-300">Tests state management. Agent should rollback to last known good state.</p>
            </div>
            <div>
              <h4 className="font-bold text-indigo-400 mb-1">Rate Limit</h4>
              <p className="text-gray-300">Tests API throttling. Agent should enable circuit breaker and fallback to cache.</p>
            </div>
            <div>
              <h4 className="font-bold text-cyan-400 mb-1">Network Timeout</h4>
              <p className="text-gray-300">Tests timeout handling. Agent should isolate dependency and use alternative paths.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuardianTestPage;
