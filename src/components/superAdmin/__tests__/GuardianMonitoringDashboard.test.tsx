/**
 * Guardian Monitoring Dashboard Tests
 *
 * Basic test coverage for the Guardian Agent monitoring dashboard
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */
/* eslint-disable testing-library/no-wait-for-multiple-assertions */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import GuardianMonitoringDashboard from '../GuardianMonitoringDashboard';
import { supabase } from '../../../lib/supabaseClient';

// Mock dependencies
jest.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn()
  }
}));
jest.mock('../../../services/auditLogger');
jest.mock('../../../services/guardianAgentClient');
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    profile: { first_name: 'Test', last_name: 'User' }
  })
}));

describe('GuardianMonitoringDashboard', () => {
  const mockAlerts = [
    {
      id: 'alert-1',
      created_at: '2025-12-02T10:00:00Z',
      severity: 'critical',
      category: 'security_vulnerability',
      title: 'SQL Injection Attempt Detected',
      description: 'Malicious SQL pattern detected',
      status: 'pending',
      affected_component: 'auth-service',
      affected_users: [],
      actions: [],
      metadata: {}
    }
  ];

  const mockCronLogs = [
    {
      id: 'log-1',
      job_name: 'guardian-automated-monitoring',
      executed_at: '2025-12-02T10:05:00Z',
      status: 'success',
      details: {}
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'guardian_alerts') {
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: mockAlerts, error: null })
        };
      }
      if (table === 'guardian_cron_log') {
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: mockCronLogs, error: null })
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      };
    });
  });

  describe('Loading State', () => {
    test('should show loading state initially', () => {
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockImplementation(() => new Promise(() => {}))
      }));

      render(<GuardianMonitoringDashboard />);

      // Component shows loading skeleton
      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Dashboard Content', () => {
    test('should render guardian dashboard content', async () => {
      render(<GuardianMonitoringDashboard />);

      await waitFor(() => {
        // Dashboard should show Guardian Agent Monitoring header
        expect(screen.getByText('Guardian Agent Monitoring')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    test('should query guardian alerts from database', async () => {
      render(<GuardianMonitoringDashboard />);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('guardian_alerts');
      });
    });

    test('should query guardian cron logs from database', async () => {
      render(<GuardianMonitoringDashboard />);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('guardian_cron_log');
      });
    });
  });

  describe('Error State', () => {
    test('should handle database errors gracefully', async () => {
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'Error' } })
      }));

      render(<GuardianMonitoringDashboard />);

      await waitFor(() => {
        // Should show error state or fallback content
        const errorText = screen.queryByText(/error/i) ||
                         screen.queryByText(/failed/i);
        expect(errorText).toBeTruthy();
      });
    });
  });
});
