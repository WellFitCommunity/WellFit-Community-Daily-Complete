/**
 * SystemAdminSuiteDashboard - Tab navigation tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../admin/UsersList', () => ({
  default: () => <div data-testid="users-list">Users List Content</div>,
}));
vi.mock('../../admin/UserRoleManagementPanel', () => ({
  default: () => <div data-testid="role-mgmt">Role Management Content</div>,
}));
vi.mock('../../admin/UserProvisioningPanel', () => ({
  default: () => <div data-testid="provisioning">Provisioning Content</div>,
}));
vi.mock('../../admin/FacilityManagementPanel', () => ({
  default: () => <div data-testid="facility-mgmt">Facility Management Content</div>,
}));
vi.mock('../../admin/TenantModuleConfigPanel', () => ({
  TenantModuleConfigPanel: () => <div data-testid="module-config">Module Config Content</div>,
}));
vi.mock('../../admin/ClearinghouseConfigPanel', () => ({
  ClearinghouseConfigPanel: () => <div data-testid="clearinghouse">Clearinghouse Content</div>,
}));
vi.mock('../../admin/AdminHeader', () => ({
  default: () => <div data-testid="admin-header">Header</div>,
}));
vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({ adminUser: { id: 'test' }, adminRole: 'super_admin' }),
}));
vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({ orgName: 'Test', primaryColor: '#00857a' }),
}));

import { SystemAdminSuiteDashboard } from '../SystemAdminSuiteDashboard';

const renderDashboard = () =>
  render(<MemoryRouter><SystemAdminSuiteDashboard /></MemoryRouter>);

describe('SystemAdminSuiteDashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render the System Administration title', () => {
    renderDashboard();
    expect(screen.getByText('System Administration')).toBeInTheDocument();
  });

  it('should render all 5 main tabs', () => {
    renderDashboard();
    expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /roles/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /facilities/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /modules/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /clearinghouse/i })).toBeInTheDocument();
  });

  it('should default to Users tab with user list', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('users-list')).toBeInTheDocument();
    });
  });

  it('should switch to Roles tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /roles/i }));
    await waitFor(() => {
      expect(screen.getByTestId('role-mgmt')).toBeInTheDocument();
    });
  });

  it('should switch to Facilities tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /facilities/i }));
    await waitFor(() => {
      expect(screen.getByTestId('facility-mgmt')).toBeInTheDocument();
    });
  });

  it('should switch to Modules tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /modules/i }));
    await waitFor(() => {
      expect(screen.getByTestId('module-config')).toBeInTheDocument();
    });
  });

  it('should switch to Clearinghouse tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /clearinghouse/i }));
    await waitFor(() => {
      expect(screen.getByTestId('clearinghouse')).toBeInTheDocument();
    });
  });

  it('should show Create User sub-tab in Users', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Create User'));
    await waitFor(() => {
      expect(screen.getByTestId('provisioning')).toBeInTheDocument();
    });
  });

  it('should have proper tab ARIA roles', () => {
    renderDashboard();
    expect(screen.getAllByRole('tab').length).toBe(5);
  });
});
