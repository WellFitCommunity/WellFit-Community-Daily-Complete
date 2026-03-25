/**
 * CareOperationsDashboard - Tab navigation tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../admin/ProviderAssignmentDashboard', () => ({
  default: () => <div data-testid="provider-assignment">Provider Assignment Content</div>,
}));
vi.mock('../../admin/ProviderCoverageDashboard', () => ({
  default: () => <div data-testid="provider-coverage">Provider Coverage Content</div>,
}));
vi.mock('../../admin/ProviderTaskQueueDashboard', () => ({
  default: () => <div data-testid="task-queue">Task Queue Content</div>,
}));
vi.mock('../../admin/UnacknowledgedResultsDashboard', () => ({
  default: () => <div data-testid="unack-results">Unacknowledged Results Content</div>,
}));
vi.mock('../../admin/ResultEscalationDashboard', () => ({
  default: () => <div data-testid="escalation">Result Escalation Content</div>,
}));
vi.mock('../../admin/ReferralAgingDashboard', () => ({
  default: () => <div data-testid="referral-aging">Referral Aging Content</div>,
}));
vi.mock('../../admin/ReferralCompletionDashboard', () => ({
  default: () => <div data-testid="referral-completion">Referral Completion Content</div>,
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

import { CareOperationsDashboard } from '../CareOperationsDashboard';

const renderDashboard = () =>
  render(<MemoryRouter><CareOperationsDashboard /></MemoryRouter>);

describe('CareOperationsDashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render the Care Operations title', () => {
    renderDashboard();
    expect(screen.getByText('Care Operations')).toBeInTheDocument();
  });

  it('should render all 4 main tabs', () => {
    renderDashboard();
    expect(screen.getByRole('tab', { name: /providers/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /results/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /referrals/i })).toBeInTheDocument();
  });

  it('should default to Providers tab with assignment content', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('provider-assignment')).toBeInTheDocument();
    });
  });

  it('should switch to Tasks tab and show task queue', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /tasks/i }));
    await waitFor(() => {
      expect(screen.getByTestId('task-queue')).toBeInTheDocument();
    });
  });

  it('should switch to Results tab and show unacknowledged results', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /results/i }));
    await waitFor(() => {
      expect(screen.getByTestId('unack-results')).toBeInTheDocument();
    });
  });

  it('should switch to Referrals tab and show referral aging', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /referrals/i }));
    await waitFor(() => {
      expect(screen.getByTestId('referral-aging')).toBeInTheDocument();
    });
  });

  it('should show On-Call Coverage sub-tab in Providers', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('On-Call Coverage')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('On-Call Coverage'));
    await waitFor(() => {
      expect(screen.getByTestId('provider-coverage')).toBeInTheDocument();
    });
  });

  it('should show Result Escalation sub-tab in Results', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /results/i }));
    await waitFor(() => {
      expect(screen.getByText('Result Escalation')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Result Escalation'));
    await waitFor(() => {
      expect(screen.getByTestId('escalation')).toBeInTheDocument();
    });
  });

  it('should show Referral Completion sub-tab in Referrals', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /referrals/i }));
    await waitFor(() => {
      expect(screen.getByText('Referral Completion')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Referral Completion'));
    await waitFor(() => {
      expect(screen.getByTestId('referral-completion')).toBeInTheDocument();
    });
  });

  it('should have proper tab ARIA roles', () => {
    renderDashboard();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(4);
  });
});
