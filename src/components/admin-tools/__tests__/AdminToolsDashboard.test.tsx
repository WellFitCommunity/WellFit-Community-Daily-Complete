/**
 * AdminToolsDashboard - Tab navigation tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../admin/PatientEngagementDashboard', () => ({
  default: () => <div data-testid="engagement">Patient Engagement Content</div>,
}));
vi.mock('../../admin/HospitalPatientEnrollment', () => ({
  default: () => <div data-testid="enrollment">Hospital Enrollment Content</div>,
}));
vi.mock('../../admin/ExportCheckIns', () => ({
  default: () => <div data-testid="export">Export Content</div>,
}));
vi.mock('../../admin/PaperFormScanner', () => ({
  default: () => <div data-testid="paper-forms">Paper Forms Content</div>,
}));
vi.mock('../../admin/ConsolidatedAlertPanel', () => ({
  default: () => <div data-testid="alerts">Consolidated Alerts Content</div>,
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

import { AdminToolsDashboard } from '../AdminToolsDashboard';

const renderDashboard = () =>
  render(<MemoryRouter><AdminToolsDashboard /></MemoryRouter>);

describe('AdminToolsDashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render the Admin Tools title', () => {
    renderDashboard();
    expect(screen.getByText('Admin Tools')).toBeInTheDocument();
  });

  it('should render all 5 main tabs', () => {
    renderDashboard();
    expect(screen.getByRole('tab', { name: /engagement/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /enrollment/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /export/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /paper forms/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /alerts/i })).toBeInTheDocument();
  });

  it('should default to Engagement tab', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('engagement')).toBeInTheDocument();
    });
  });

  it('should switch to Enrollment tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /enrollment/i }));
    await waitFor(() => {
      expect(screen.getByTestId('enrollment')).toBeInTheDocument();
    });
  });

  it('should switch to Export tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /export/i }));
    await waitFor(() => {
      expect(screen.getByTestId('export')).toBeInTheDocument();
    });
  });

  it('should switch to Paper Forms tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /paper forms/i }));
    await waitFor(() => {
      expect(screen.getByTestId('paper-forms')).toBeInTheDocument();
    });
  });

  it('should switch to Alerts tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }));
    await waitFor(() => {
      expect(screen.getByTestId('alerts')).toBeInTheDocument();
    });
  });

  it('should have proper tab ARIA roles', () => {
    renderDashboard();
    expect(screen.getAllByRole('tab').length).toBe(5);
  });
});
