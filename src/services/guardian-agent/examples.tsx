/**
 * Guardian Agent - Real-World Usage Examples
 * Copy these examples into your application
 */

import React, { useEffect } from 'react';
import { getGuardianAgent, useGuardianAgent, useIssueMonitor } from './index';

// ============================================================================
// EXAMPLE 1: Basic Setup in App.tsx
// ============================================================================

export function AppWithGuardianAgent() {
  useEffect(() => {
    // Initialize and start the Guardian Agent
    const agent = getGuardianAgent({
      autoHealEnabled: true,
      learningEnabled: true,
      hipaaComplianceMode: true,
      requireApprovalForCritical: false,
      maxConcurrentHealings: 5
    });

    agent.start();
    console.log('🛡️ Guardian Agent is protecting your application');

    // Cleanup on unmount
    return () => {
      agent.stop();
    };
  }, []);

  return (
    <div>
      {/* Your app content */}
    </div>
  );
}

// ============================================================================
// EXAMPLE 2: Error Boundary Integration
// ============================================================================

import { GuardianErrorBoundary } from '../../components/GuardianErrorBoundary';

export function AppWithErrorBoundary() {
  return (
    <GuardianErrorBoundary>
      {/* Your entire app */}
      <YourApp />
    </GuardianErrorBoundary>
  );
}

// ============================================================================
// EXAMPLE 3: Manual Error Reporting with Context
// ============================================================================

export function PatientProfileComponent({ patientId }: { patientId: string }) {
  const loadPatientData = async () => {
    try {
      const response = await fetch(`/api/patients/${patientId}`);

      if (!response.ok) {
        throw new Error(`Failed to load patient: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Manually report to Guardian Agent with rich context
      getGuardianAgent().reportIssue(error as Error, {
        component: 'PatientProfile',
        apiEndpoint: `/api/patients/${patientId}`,
        userId: 'current-user-id',
        environmentState: {
          patientId,
          attemptNumber: 1
        },
        recentActions: ['navigate_to_profile', 'fetch_patient_data']
      });

      throw error; // Re-throw for local handling
    }
  };

  return <div>Patient Profile</div>;
}

// ============================================================================
// EXAMPLE 4: Real-Time Health Monitoring Widget
// ============================================================================

export function SystemHealthWidget() {
  const { health, statistics } = useGuardianAgent();

  if (!health || health.status === 'healthy') {
    return null; // Don't show anything when healthy
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white shadow-xl rounded-lg p-4 border-l-4 border-yellow-500">
      <div className="flex items-center space-x-3">
        <div className="text-2xl">
          {health.status === 'degraded' ? '⚠️' : '🚨'}
        </div>
        <div>
          <div className="font-bold text-gray-800">
            System Health: {health.status.toUpperCase()}
          </div>
          <div className="text-sm text-gray-600">
            {health.details.activeIssues} active issues
          </div>
          {health.details.healingInProgress > 0 && (
            <div className="text-xs text-blue-600 mt-1">
              🔧 Guardian Agent is healing ({health.details.healingInProgress} in progress)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 5: Admin Security Alert Monitor
// ============================================================================

export function SecurityAlertMonitor() {
  useIssueMonitor(
    (issue) => {
      // Send notification to admin
      console.error('🚨 CRITICAL SECURITY ISSUE:', issue);

      // You could trigger:
      // - Email notification
      // - Slack alert
      // - SMS to on-call engineer
      // - PagerDuty incident

      // Example notification
      if (typeof window !== 'undefined' && 'Notification' in window) {
        new Notification('Security Issue Detected', {
          body: issue.signature.description,
          icon: '/alert-icon.png',
          tag: issue.id
        });
      }
    },
    {
      // Only monitor critical security issues
      severity: ['critical', 'high'],
      category: [
        'security_vulnerability',
        'phi_exposure_risk',
        'hipaa_violation',
        'authorization_breach'
      ]
    }
  );

  return null; // This is a monitoring component, no UI
}

// ============================================================================
// EXAMPLE 6: Developer Debug Panel
// ============================================================================

export function GuardianDebugPanel() {
  const { state, statistics, refresh } = useGuardianAgent();

  if (process.env.NODE_ENV !== 'development') {
    return null; // Only show in development
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 text-xs font-mono">
      <div className="flex justify-between items-center">
        <div className="flex space-x-6">
          <div>
            <span className="text-gray-400">Status:</span>{' '}
            <span className="text-green-400">{state?.mode}</span>
          </div>
          <div>
            <span className="text-gray-400">Active Issues:</span>{' '}
            <span className="text-yellow-400">{state?.activeIssues.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Success Rate:</span>{' '}
            <span className="text-blue-400">
              {statistics?.agentMetrics.successRate.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-gray-400">Healed:</span>{' '}
            <span className="text-green-400">
              {statistics?.agentMetrics.issuesHealed}
            </span>
          </div>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 7: Supabase Integration with Auto-Healing
// ============================================================================

import { createClient } from '@supabase/supabase-js';

export function useSupabaseWithGuardian() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
  );

  const guardianFetch = async <T,>(
    operation: () => Promise<{ data: T | null; error: any }>
  ): Promise<T> => {
    try {
      const { data, error } = await operation();

      if (error) {
        // Report error to Guardian Agent
        await getGuardianAgent().reportIssue(error, {
          component: 'SupabaseClient',
          databaseQuery: operation.toString(),
          environmentState: { error },
          recentActions: ['supabase_query']
        });

        throw error;
      }

      if (!data) {
        throw new Error('No data returned from Supabase');
      }

      return data;
    } catch (error) {
      // Guardian Agent has already been notified
      throw error;
    }
  };

  return { supabase, guardianFetch };
}

// Usage:
export function PatientListWithGuardian() {
  const { guardianFetch, supabase } = useSupabaseWithGuardian();
  const [patients, setPatients] = React.useState<any[]>([]);

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const data = await guardianFetch(() =>
          supabase.from('patients').select('*')
        );
        setPatients(data as any);
      } catch (error) {
        console.error('Failed to load patients:', error);
        // Guardian Agent is already healing this
      }
    };

    loadPatients();
  }, []);

  return <div>Patient List: {patients.length} patients</div>;
}

// ============================================================================
// EXAMPLE 8: React Query Integration
// ============================================================================

import { useQuery, UseQueryOptions } from '@tanstack/react-query';

export function useQueryWithGuardian<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: UseQueryOptions<T>
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await queryFn();
      } catch (error) {
        // Report to Guardian Agent
        await getGuardianAgent().reportIssue(error as Error, {
          component: 'ReactQuery',
          environmentState: { queryKey },
          recentActions: ['react_query_fetch']
        });

        throw error; // Re-throw for React Query
      }
    },
    ...options,
    retry: false // Let Guardian Agent handle retries
  });
}

// Usage:
export function PatientDataWithQuery({ patientId }: { patientId: string }) {
  const { data, isLoading, error } = useQueryWithGuardian(
    ['patient', patientId],
    () => fetch(`/api/patients/${patientId}`).then(r => r.json())
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading patient (Guardian Agent is healing)</div>;

  return <div>Patient: {data.name}</div>;
}

// ============================================================================
// EXAMPLE 9: Performance Monitoring Component
// ============================================================================

export function PerformanceMonitor() {
  useEffect(() => {
    // Monitor component render performance
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 1000) {
          // Report slow renders to Guardian Agent
          getGuardianAgent().reportIssue(
            new Error(`Slow component render: ${entry.name}`),
            {
              component: entry.name,
              environmentState: {
                duration: entry.duration,
                entryType: entry.entryType
              },
              recentActions: ['component_render']
            }
          );
        }
      }
    });

    observer.observe({ entryTypes: ['measure'] });

    return () => observer.disconnect();
  }, []);

  return null;
}

// ============================================================================
// EXAMPLE 10: Test Component for Simulating Errors
// ============================================================================

export function GuardianAgentTestPanel() {
  const agent = getGuardianAgent();

  const simulateTypeError = async () => {
    await agent.reportIssue(
      new Error('Cannot read property "data" of undefined'),
      {
        component: 'TestPanel',
        filePath: '/src/test.tsx',
        lineNumber: 42,
        environmentState: {},
        recentActions: ['simulate_error']
      }
    );
  };

  const simulateAPIError = async () => {
    await agent.reportIssue(
      new Error('401 Unauthorized'),
      {
        component: 'TestPanel',
        apiEndpoint: '/api/test',
        environmentState: { statusCode: 401 },
        recentActions: ['simulate_api_error']
      }
    );
  };

  const simulateSecurityIssue = async () => {
    await agent.reportIssue(
      new Error('PHI detected in console.log'),
      {
        component: 'TestPanel',
        environmentState: { phiDetected: true },
        recentActions: ['simulate_security_issue']
      }
    );
  };

  const simulateMemoryLeak = async () => {
    await agent.reportIssue(
      new Error('Memory usage exceeded threshold'),
      {
        component: 'TestPanel',
        environmentState: { memoryUsage: 95 },
        recentActions: ['simulate_memory_leak']
      }
    );
  };

  return (
    <div className="p-8 space-y-4">
      <h2 className="text-2xl font-bold">Guardian Agent Test Panel</h2>
      <p className="text-gray-600">
        Simulate different error types and watch the Guardian Agent heal them.
        Check the dashboard at <code>/admin/guardian</code> to see the results.
      </p>

      <div className="space-y-2">
        <button
          onClick={simulateTypeError}
          className="block w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Simulate Type Error
        </button>

        <button
          onClick={simulateAPIError}
          className="block w-full px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Simulate API Error
        </button>

        <button
          onClick={simulateSecurityIssue}
          className="block w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Simulate Security Issue
        </button>

        <button
          onClick={simulateMemoryLeak}
          className="block w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Simulate Memory Leak
        </button>
      </div>

      <div className="mt-4 p-4 bg-gray-100 rounded">
        <p className="text-sm text-gray-600">
          After clicking a button, check the browser console and navigate to{' '}
          <code>/admin/guardian</code> to see the Guardian Agent in action.
        </p>
      </div>
    </div>
  );
}

// Placeholder components for examples
function YourApp() {
  return <div>Your App</div>;
}
