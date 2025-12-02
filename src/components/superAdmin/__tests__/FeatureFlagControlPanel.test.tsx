/**
 * Feature Flag Control Panel Tests
 *
 * Basic test coverage for the feature flag management panel
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */
/* eslint-disable testing-library/no-wait-for-multiple-assertions */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import FeatureFlagControlPanel from '../FeatureFlagControlPanel';
import { supabase } from '../../../lib/supabaseClient';

// Mock dependencies
jest.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn()
  }
}));
jest.mock('../../../services/auditLogger');

describe('FeatureFlagControlPanel', () => {
  const mockFeatureFlags = [
    {
      id: 'flag-1',
      feature_key: 'core_dashboard',
      feature_name: 'Dashboard',
      description: 'Main dashboard',
      is_enabled: true,
      force_disabled: false,
      category: 'core'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (supabase.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: mockFeatureFlags, error: null }),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null })
    }));
  });

  describe('Loading State', () => {
    test('should show loading state initially', () => {
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockImplementation(() => new Promise(() => {}))
      }));

      render(<FeatureFlagControlPanel />);

      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Panel Content', () => {
    test('should render feature flag panel content', async () => {
      render(<FeatureFlagControlPanel />);

      await waitFor(() => {
        const content = screen.queryByText(/Feature/i) ||
                       screen.queryByText(/Flag/i) ||
                       screen.queryByText(/Control/i);
        expect(content).toBeTruthy();
      }, { timeout: 5000 });
    });

    test('should query feature flags from database', async () => {
      render(<FeatureFlagControlPanel />);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('system_feature_flags');
      });
    });
  });

  describe('Error State', () => {
    test('should handle database errors gracefully', async () => {
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Error' } })
      }));

      render(<FeatureFlagControlPanel />);

      await waitFor(() => {
        const errorText = screen.queryByText(/error/i) ||
                         screen.queryByText(/failed/i);
        expect(errorText).toBeTruthy();
      });
    });
  });
});
