/**
 * Platform SOC2 Dashboard Tests
 *
 * Basic test coverage for the SOC2 compliance dashboard
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */
/* eslint-disable testing-library/no-wait-for-multiple-assertions */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PlatformSOC2Dashboard from '../PlatformSOC2Dashboard';
import { supabase } from '../../../lib/supabaseClient';

// Mock dependencies
jest.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn()
  }
}));
jest.mock('../../../services/auditLogger');

describe('PlatformSOC2Dashboard', () => {
  const mockTenants = [
    { id: 'tenant-1', name: 'Methodist Hospital', tenant_code: 'MH-0001' }
  ];

  const mockModuleConfig = [
    {
      tenant_id: 'tenant-1',
      hipaa_audit_logging: true,
      mfa_enforcement: true,
      license_tier: 'enterprise'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'tenants') {
        return {
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockTenants, error: null })
        };
      }
      if (table === 'tenant_module_config') {
        return {
          select: jest.fn().mockResolvedValue({ data: mockModuleConfig, error: null })
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      };
    });
  });

  describe('Loading State', () => {
    test('should show loading state initially', () => {
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockImplementation(() => new Promise(() => {}))
      }));

      render(<PlatformSOC2Dashboard />);

      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Dashboard Content', () => {
    test('should render SOC2 dashboard content', async () => {
      render(<PlatformSOC2Dashboard />);

      await waitFor(() => {
        const content = screen.queryByText(/SOC2/i) ||
                       screen.queryByText(/Compliance/i) ||
                       screen.queryByText(/Security/i);
        expect(content).toBeTruthy();
      }, { timeout: 5000 });
    });

    test('should query tenants from database', async () => {
      render(<PlatformSOC2Dashboard />);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('tenants');
      });
    });
  });

  describe('Error State', () => {
    test('should handle database errors gracefully', async () => {
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Error' } })
      }));

      render(<PlatformSOC2Dashboard />);

      await waitFor(() => {
        const errorText = screen.queryByText(/error/i) ||
                         screen.queryByText(/failed/i);
        expect(errorText).toBeTruthy();
      });
    });
  });
});
