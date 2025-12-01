// src/components/__tests__/CaregiverAccessHistory.test.tsx
// Tests for the "Who viewed my data" component in senior settings

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CaregiverAccessHistory from '../CaregiverAccessHistory';
import { useSupabaseClient } from '../../contexts/AuthContext';

// Mock AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: jest.fn(),
}));

// Mock auditLogger
jest.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('CaregiverAccessHistory', () => {
  const mockRpc = jest.fn();
  const mockSupabase = {
    rpc: mockRpc,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  describe('Rendering', () => {
    it('should render the component', async () => {
      render(<CaregiverAccessHistory userId="user-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Who Viewed My Data/i)).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      const { container } = render(<CaregiverAccessHistory userId="user-123" />);

      // Component shows loading skeleton with animation
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('should show empty state when no access logs', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      render(<CaregiverAccessHistory userId="user-123" />);

      await waitFor(() => {
        expect(screen.getByText(/No one has accessed your data recently/i)).toBeInTheDocument();
      });
    });
  });

  describe('Access Log Display', () => {
    const mockAccessLogs = [
      {
        id: 1,
        caregiver_name: 'Jane Doe',
        caregiver_phone: '+15559876543',
        access_time: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
        session_ended_at: new Date().toISOString(),
        pages_viewed: ['senior_dashboard', 'senior_reports'],
        client_ip: '192.168.1.1',
      },
      {
        id: 2,
        caregiver_name: 'John Smith',
        caregiver_phone: '+15551234567',
        access_time: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        session_ended_at: null,
        pages_viewed: ['senior_dashboard'],
        client_ip: '10.0.0.1',
      },
    ];

    it('should display access count', async () => {
      mockRpc.mockResolvedValue({ data: mockAccessLogs, error: null });

      render(<CaregiverAccessHistory userId="user-123" />);

      await waitFor(() => {
        expect(screen.getByText(/2 recent accesses/i)).toBeInTheDocument();
      });
    });

    it('should expand to show access details when clicked', async () => {
      mockRpc.mockResolvedValue({ data: mockAccessLogs, error: null });

      render(<CaregiverAccessHistory userId="user-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Who Viewed My Data/i)).toBeInTheDocument();
      });

      // eslint-disable-next-line testing-library/no-node-access
      const expandButton = screen.getByText(/Who Viewed My Data/i).closest('div');
      if (expandButton) {
        fireEvent.click(expandButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      });
      expect(screen.getByText('John Smith')).toBeInTheDocument();
    });

    it('should mask phone numbers for privacy', async () => {
      mockRpc.mockResolvedValue({ data: mockAccessLogs, error: null });

      render(<CaregiverAccessHistory userId="user-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Who Viewed My Data/i)).toBeInTheDocument();
      });

      // eslint-disable-next-line testing-library/no-node-access
      const expandButton = screen.getByText(/Who Viewed My Data/i).closest('div');
      if (expandButton) {
        fireEvent.click(expandButton);
      }

      await waitFor(() => {
        // Should show masked phone: ***-***-6543
        expect(screen.getByText(/\*\*\*-\*\*\*-6543/i)).toBeInTheDocument();
      });
    });

    it('should show pages viewed', async () => {
      mockRpc.mockResolvedValue({ data: mockAccessLogs, error: null });

      render(<CaregiverAccessHistory userId="user-123" />);

      // First wait for component to load, then click to expand
      await waitFor(() => {
        expect(screen.getByText(/Who Viewed My Data/i)).toBeInTheDocument();
      });

      // Click to expand and see details
      // eslint-disable-next-line testing-library/no-node-access
      const expandButton = screen.getByText(/Who Viewed My Data/i).closest('div')?.parentElement;
      if (expandButton) {
        fireEvent.click(expandButton);
      }

      await waitFor(() => {
        // pages_viewed is ['senior_dashboard', 'senior_reports'] - component replaces _ with space
        // There may be multiple matches (one per log entry), so use getAllByText
        expect(screen.getAllByText(/senior dashboard/i).length).toBeGreaterThan(0);
      });
    });

    it('should show security tip', async () => {
      mockRpc.mockResolvedValue({ data: mockAccessLogs, error: null });

      render(<CaregiverAccessHistory userId="user-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Who Viewed My Data/i)).toBeInTheDocument();
      });

      // eslint-disable-next-line testing-library/no-node-access
      const expandButton = screen.getByText(/Who Viewed My Data/i).closest('div');
      if (expandButton) {
        fireEvent.click(expandButton);
      }

      await waitFor(() => {
        expect(screen.getByText(/Security Tip/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/change your caregiver PIN/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show encouraging message when no access logs', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      render(<CaregiverAccessHistory userId="user-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Who Viewed My Data/i)).toBeInTheDocument();
      });

      // eslint-disable-next-line testing-library/no-node-access
      const expandButton = screen.getByText(/Who Viewed My Data/i).closest('div');
      if (expandButton) {
        fireEvent.click(expandButton);
      }

      await waitFor(() => {
        expect(screen.getByText(/No caregivers have accessed your data yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle RPC errors gracefully', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Database error' } });

      render(<CaregiverAccessHistory userId="user-123" />);

      await waitFor(() => {
        // Should still render, just with empty state
        expect(screen.getByText(/Who Viewed My Data/i)).toBeInTheDocument();
      });
    });

    it('should handle missing userId', async () => {
      render(<CaregiverAccessHistory userId="" />);

      await waitFor(() => {
        expect(screen.getByText(/Who Viewed My Data/i)).toBeInTheDocument();
      });
    });
  });

  describe('API Calls', () => {
    it('should call get_my_access_history RPC', async () => {
      render(<CaregiverAccessHistory userId="user-123" />);

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('get_my_access_history', {
          p_limit: 20,
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('should be expandable/collapsible', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      render(<CaregiverAccessHistory userId="user-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Who Viewed My Data/i)).toBeInTheDocument();
      });

      // The clickable element has cursor-pointer class
      // Structure: div.cursor-pointer > div.flex.items-center > ... > div (contains "Who Viewed My Data")
      const titleElement = screen.getByText(/Who Viewed My Data/i);
      // eslint-disable-next-line testing-library/no-node-access
      const clickableArea = titleElement.closest('.cursor-pointer');
      expect(clickableArea).toBeInTheDocument();
    });

    it('should show expand/collapse indicator', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      render(<CaregiverAccessHistory userId="user-123" />);

      await waitFor(() => {
        // Should show down arrow initially (collapsed)
        expect(screen.getByText('▼')).toBeInTheDocument();
      });
    });
  });
});
