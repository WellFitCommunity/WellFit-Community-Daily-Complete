/**
 * System Health Panel Tests
 *
 * Basic test coverage for the system health monitoring panel
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */
/* eslint-disable testing-library/no-wait-for-multiple-assertions */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SystemHealthPanel from '../SystemHealthPanel';
import { SuperAdminService } from '../../../services/superAdminService';
import { auditLogger } from '../../../services/auditLogger';

// Mock dependencies
jest.mock('../../../services/superAdminService');
jest.mock('../../../services/auditLogger');

// Mock timers
jest.useFakeTimers();

describe('SystemHealthPanel', () => {
  const mockHealthChecks = [
    {
      id: 'check-1',
      checkType: 'connectivity',
      checkName: 'Database Connection',
      componentName: 'PostgreSQL',
      status: 'healthy',
      responseTimeMs: 45,
      message: 'Connection successful',
      checkedAt: '2025-12-02T10:00:00Z',
      metrics: { connections: 10, maxConnections: 100 }
    },
    {
      id: 'check-2',
      checkType: 'connectivity',
      checkName: 'API Gateway',
      componentName: 'API Server',
      status: 'healthy',
      responseTimeMs: 120,
      message: 'All endpoints responsive',
      checkedAt: '2025-12-02T10:00:00Z',
      metrics: { requestsPerSecond: 250 }
    },
    {
      id: 'check-3',
      checkType: 'performance',
      checkName: 'Edge Functions',
      componentName: 'Deno Runtime',
      status: 'degraded',
      responseTimeMs: 450,
      message: 'Response time above threshold',
      checkedAt: '2025-12-02T10:00:00Z',
      metrics: { avgResponseTime: 450, threshold: 200 }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (SuperAdminService.getRecentHealthChecks as jest.Mock).mockResolvedValue(mockHealthChecks);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Loading State', () => {
    test('should show loading state initially', () => {
      (SuperAdminService.getRecentHealthChecks as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<SystemHealthPanel />);

      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    test('should display error message on failure', async () => {
      (SuperAdminService.getRecentHealthChecks as jest.Mock).mockRejectedValue(
        new Error('Failed to fetch')
      );

      render(<SystemHealthPanel />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load system health data/i)).toBeInTheDocument();
      });
    });

    test('should log error to audit logger', async () => {
      const error = new Error('Network error');
      (SuperAdminService.getRecentHealthChecks as jest.Mock).mockRejectedValue(error);

      render(<SystemHealthPanel />);

      await waitFor(() => {
        expect(auditLogger.error).toHaveBeenCalledWith(
          'SUPER_ADMIN_HEALTH_CHECK_LOAD_FAILED',
          expect.anything(),
          expect.objectContaining({ category: 'SYSTEM_EVENT' })
        );
      });
    });
  });

  describe('Panel Content', () => {
    test('should render panel header', async () => {
      render(<SystemHealthPanel />);

      await waitFor(() => {
        expect(screen.getByText('System Health Monitor')).toBeInTheDocument();
      });
    });

    test('should display component names', async () => {
      render(<SystemHealthPanel />);

      await waitFor(() => {
        expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
        expect(screen.getByText('API Server')).toBeInTheDocument();
        expect(screen.getByText('Deno Runtime')).toBeInTheDocument();
      });
    });

    test('should display component messages', async () => {
      render(<SystemHealthPanel />);

      await waitFor(() => {
        expect(screen.getByText('Connection successful')).toBeInTheDocument();
        expect(screen.getByText('All endpoints responsive')).toBeInTheDocument();
      });
    });

    test('should call SuperAdminService on mount', async () => {
      render(<SystemHealthPanel />);

      await waitFor(() => {
        expect(SuperAdminService.getRecentHealthChecks).toHaveBeenCalled();
      });
    });
  });

  describe('Refresh Functionality', () => {
    test('should display refresh button', async () => {
      render(<SystemHealthPanel />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });

    test('should reload data when refresh clicked', async () => {
      render(<SystemHealthPanel />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(SuperAdminService.getRecentHealthChecks).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Auto-Refresh', () => {
    test('should refresh data every 30 seconds', async () => {
      render(<SystemHealthPanel />);

      await waitFor(() => {
        expect(SuperAdminService.getRecentHealthChecks).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(SuperAdminService.getRecentHealthChecks).toHaveBeenCalledTimes(2);
      });
    });

    test('should clear interval on unmount', () => {
      const { unmount } = render(<SystemHealthPanel />);

      unmount();

      // Advance time and verify no additional calls
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      // Only the initial call should have been made
      expect(SuperAdminService.getRecentHealthChecks).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    test('should show empty state when no health checks', async () => {
      (SuperAdminService.getRecentHealthChecks as jest.Mock).mockResolvedValue([]);

      render(<SystemHealthPanel />);

      await waitFor(() => {
        expect(screen.getByText(/No health check data available/i)).toBeInTheDocument();
      });
    });
  });
});
