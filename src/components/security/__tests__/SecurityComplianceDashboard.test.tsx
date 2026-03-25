/**
 * SecurityComplianceDashboard - Tab navigation and lazy loading tests
 *
 * Tests behavioral outcomes: tab switching renders correct content,
 * sub-tab navigation works, and all 5 main tabs are accessible.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock all lazy-loaded security components
vi.mock('../../admin/TenantSecurityDashboard', () => ({
  default: () => <div data-testid="facility-security">Facility Security Content</div>,
}));
vi.mock('../../admin/MfaComplianceDashboard', () => ({
  default: () => <div data-testid="mfa-compliance">MFA Compliance Content</div>,
}));
vi.mock('../../admin/EncounterAuditTimeline', () => ({
  default: () => <div data-testid="encounter-audit">Encounter Audit Content</div>,
}));
vi.mock('../../admin/TenantComplianceReport', () => ({
  default: () => <div data-testid="compliance-report">Compliance Report Content</div>,
}));
vi.mock('../../admin/TrainingComplianceDashboard', () => ({
  default: () => <div data-testid="training">Training Content</div>,
}));
vi.mock('../../admin/BAATrackingDashboard', () => ({
  default: () => <div data-testid="baa-tracking">BAA Tracking Content</div>,
}));
vi.mock('../../admin/BreachNotificationDashboard', () => ({
  default: () => <div data-testid="breach">Breach Notification Content</div>,
}));
vi.mock('../../admin/EscalationOverrideDashboard', () => ({
  default: () => <div data-testid="overrides">Escalation Overrides Content</div>,
}));
vi.mock('../../admin/TenantAuditLogs', () => ({
  default: () => <div data-testid="audit-logs">Audit Logs Content</div>,
}));
vi.mock('../../admin/TenantConfigHistory', () => ({
  default: () => <div data-testid="config-history">Config History Content</div>,
}));
vi.mock('../../admin/PatientAmendmentReviewQueue', () => ({
  default: () => <div data-testid="amendments">Patient Amendments Content</div>,
}));
vi.mock('../../admin/AIModelCardsDashboard', () => ({
  default: () => <div data-testid="model-cards">AI Model Cards Content</div>,
}));

// Mock AdminHeader
vi.mock('../../admin/AdminHeader', () => ({
  default: () => <div data-testid="admin-header">Header</div>,
}));

// Mock contexts
vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    adminUser: { id: 'test-admin', email: 'test@test.com' },
    adminRole: 'super_admin',
  }),
}));
vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({ orgName: 'Test Org', primaryColor: '#00857a' }),
}));

import { SecurityComplianceDashboard } from '../SecurityComplianceDashboard';

const renderDashboard = () => {
  return render(
    <MemoryRouter>
      <SecurityComplianceDashboard />
    </MemoryRouter>
  );
};

describe('SecurityComplianceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header and Layout', () => {
    it('should render the Security & Compliance title', () => {
      renderDashboard();
      expect(screen.getByText('Security & Compliance')).toBeInTheDocument();
    });

    it('should render the HIPAA description', () => {
      renderDashboard();
      expect(screen.getByText(/HIPAA compliance/i)).toBeInTheDocument();
    });

    it('should render the AdminHeader', () => {
      renderDashboard();
      expect(screen.getByTestId('admin-header')).toBeInTheDocument();
    });
  });

  describe('Main Tab Navigation', () => {
    it('should render all 5 main tabs', () => {
      renderDashboard();
      expect(screen.getByRole('tab', { name: /monitoring/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /compliance/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /incidents/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /audit/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /ai transparency/i })).toBeInTheDocument();
    });

    it('should default to Monitoring tab as active', () => {
      renderDashboard();
      const monitoringTab = screen.getByRole('tab', { name: /monitoring/i });
      expect(monitoringTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should show facility security content on Monitoring tab', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('facility-security')).toBeInTheDocument();
      });
    });

    it('should switch to Compliance tab and show compliance report', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /compliance/i }));
      await waitFor(() => {
        expect(screen.getByTestId('compliance-report')).toBeInTheDocument();
      });
    });

    it('should switch to Incidents tab and show breach notification', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /incidents/i }));
      await waitFor(() => {
        expect(screen.getByTestId('breach')).toBeInTheDocument();
      });
    });

    it('should switch to Audit tab and show audit logs', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /audit/i }));
      await waitFor(() => {
        expect(screen.getByTestId('audit-logs')).toBeInTheDocument();
      });
    });

    it('should switch to AI Transparency tab and show model cards', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /ai transparency/i }));
      await waitFor(() => {
        expect(screen.getByTestId('model-cards')).toBeInTheDocument();
      });
    });
  });

  describe('Sub-Tab Navigation', () => {
    it('should show MFA Compliance sub-tab when clicked in Monitoring', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('MFA Compliance')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('MFA Compliance'));
      await waitFor(() => {
        expect(screen.getByTestId('mfa-compliance')).toBeInTheDocument();
      });
    });

    it('should show Workforce Training sub-tab when clicked in Compliance', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /compliance/i }));
      await waitFor(() => {
        expect(screen.getByText('Workforce Training')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Workforce Training'));
      await waitFor(() => {
        expect(screen.getByTestId('training')).toBeInTheDocument();
      });
    });

    it('should show BAA Tracking sub-tab when clicked in Compliance', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /compliance/i }));
      await waitFor(() => {
        expect(screen.getByText('BAA Tracking')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('BAA Tracking'));
      await waitFor(() => {
        expect(screen.getByTestId('baa-tracking')).toBeInTheDocument();
      });
    });

    it('should show Escalation Overrides sub-tab in Incidents', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /incidents/i }));
      await waitFor(() => {
        expect(screen.getByText('Escalation Overrides')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Escalation Overrides'));
      await waitFor(() => {
        expect(screen.getByTestId('overrides')).toBeInTheDocument();
      });
    });

    it('should show Config Changes sub-tab in Audit', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /audit/i }));
      await waitFor(() => {
        expect(screen.getByText('Config Changes')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Config Changes'));
      await waitFor(() => {
        expect(screen.getByTestId('config-history')).toBeInTheDocument();
      });
    });

    it('should show Patient Amendments sub-tab in Audit', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /audit/i }));
      await waitFor(() => {
        expect(screen.getByText('Patient Amendments')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Patient Amendments'));
      await waitFor(() => {
        expect(screen.getByTestId('amendments')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper tab ARIA roles', () => {
      renderDashboard();
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(5);
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-selected');
      });
    });

    it('should have tabpanel role for active content', () => {
      renderDashboard();
      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel).toBeInTheDocument();
    });
  });
});
