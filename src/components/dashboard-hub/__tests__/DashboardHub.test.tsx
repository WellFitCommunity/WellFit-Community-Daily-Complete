/**
 * DashboardHub - Navigation hub tests
 *
 * Tests: card rendering, role-based visibility, navigation on click,
 * category grouping, and accessibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../admin/AdminHeader', () => ({
  default: () => <div data-testid="admin-header">Header</div>,
}));

// Default: super_admin sees everything
let mockAdminRole = 'super_admin';
vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    adminUser: { id: 'test-admin', email: 'test@test.com' },
    adminRole: mockAdminRole,
    logoutAdmin: vi.fn(),
  }),
}));
vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({ branding: { orgName: 'Test Org', primaryColor: '#00857a' } }),
}));

import { DashboardHub } from '../DashboardHub';

const renderHub = () =>
  render(<MemoryRouter><DashboardHub /></MemoryRouter>);

describe('DashboardHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminRole = 'super_admin';
  });

  describe('Layout', () => {
    it('should render the Dashboard Hub title', () => {
      renderHub();
      expect(screen.getByText('Dashboard Hub')).toBeInTheDocument();
    });

    it('should render all three category headings', () => {
      renderHub();
      expect(screen.getByText('Dashboard Suites')).toBeInTheDocument();
      expect(screen.getByText('Clinical Dashboards')).toBeInTheDocument();
      expect(screen.getByText('Workflows & Monitoring')).toBeInTheDocument();
    });

    it('should render AdminHeader', () => {
      renderHub();
      expect(screen.getByTestId('admin-header')).toBeInTheDocument();
    });
  });

  describe('Suite Cards', () => {
    it('should render all 8 suite cards for super_admin', () => {
      renderHub();
      expect(screen.getByText('Billing Suite')).toBeInTheDocument();
      expect(screen.getByText('Security & Compliance')).toBeInTheDocument();
      expect(screen.getByText('Care Operations')).toBeInTheDocument();
      expect(screen.getByText('Interoperability')).toBeInTheDocument();
      expect(screen.getByText('MCP Management')).toBeInTheDocument();
      expect(screen.getByText('System Administration')).toBeInTheDocument();
      expect(screen.getByText('Clinical Quality')).toBeInTheDocument();
      expect(screen.getByText('Admin Tools')).toBeInTheDocument();
    });

    it('should show dashboard count badges on suite cards', () => {
      renderHub();
      expect(screen.getByText('15 dashboards')).toBeInTheDocument();
      expect(screen.getByText('12 dashboards')).toBeInTheDocument();
      expect(screen.getByText('7 dashboards')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to /billing-suite when Billing Suite is clicked', () => {
      renderHub();
      fireEvent.click(screen.getByText('Billing Suite'));
      expect(mockNavigate).toHaveBeenCalledWith('/billing-suite');
    });

    it('should navigate to /security-compliance when Security card is clicked', () => {
      renderHub();
      fireEvent.click(screen.getByText('Security & Compliance'));
      expect(mockNavigate).toHaveBeenCalledWith('/security-compliance');
    });

    it('should navigate to /bed-management when Bed Management is clicked', () => {
      renderHub();
      fireEvent.click(screen.getByText('Bed Management'));
      expect(mockNavigate).toHaveBeenCalledWith('/bed-management');
    });

    it('should navigate to /shift-handoff when Shift Handoff is clicked', () => {
      renderHub();
      fireEvent.click(screen.getByText('Shift Handoff'));
      expect(mockNavigate).toHaveBeenCalledWith('/shift-handoff');
    });
  });

  describe('Role-Based Visibility', () => {
    it('should hide MCP Management for non-super_admin', () => {
      mockAdminRole = 'admin';
      renderHub();
      expect(screen.queryByText('MCP Management')).not.toBeInTheDocument();
    });

    it('should hide Guardian Agent for non-super_admin', () => {
      mockAdminRole = 'admin';
      renderHub();
      expect(screen.queryByText('Guardian Agent')).not.toBeInTheDocument();
    });

    it('should show Billing Suite for all admin roles', () => {
      mockAdminRole = 'admin';
      renderHub();
      expect(screen.getByText('Billing Suite')).toBeInTheDocument();
    });

    it('should show Care Operations for nurse role', () => {
      mockAdminRole = 'nurse';
      renderHub();
      expect(screen.getByText('Care Operations')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should use button elements for all cards', () => {
      renderHub();
      const buttons = screen.getAllByRole('button');
      // All hub cards are buttons
      expect(buttons.length).toBeGreaterThan(10);
    });

    it('should have descriptions on all cards', () => {
      renderHub();
      expect(screen.getByText(/Revenue cycle/)).toBeInTheDocument();
      expect(screen.getByText(/HIPAA monitoring/)).toBeInTheDocument();
    });
  });
});
