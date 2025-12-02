/**
 * Super Admin Dashboard Tests
 *
 * Basic test coverage for the main Envision Super Admin Dashboard
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */
/* eslint-disable testing-library/no-wait-for-multiple-assertions */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SuperAdminDashboard from '../SuperAdminDashboard';
import { SuperAdminService } from '../../../services/superAdminService';

// Mock dependencies
jest.mock('../../../services/superAdminService');
jest.mock('../../../services/auditLogger');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    profile: { first_name: 'Test', last_name: 'User' }
  })
}));

// Mock framer-motion to avoid jsdom issues
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    svg: ({ children, ...props }: any) => <svg {...props}>{children}</svg>,
    path: (props: any) => <path {...props} />,
    circle: (props: any) => <circle {...props} />,
    g: ({ children, ...props }: any) => <g {...props}>{children}</g>,
    rect: (props: any) => <rect {...props} />
  },
  AnimatePresence: ({ children }: any) => children,
  useAnimation: () => ({ start: jest.fn() }),
  useMotionValue: () => ({ get: jest.fn(), set: jest.fn() }),
  useTransform: () => ({ get: jest.fn() })
}));

// Mock child components that may have complex dependencies
jest.mock('../../ai-transparency', () => ({
  PersonalizedGreeting: () => <div data-testid="personalized-greeting">Welcome!</div>
}));
jest.mock('../VaultAnimation', () => () => null);
jest.mock('../TenantManagementPanel', () => () => <div data-testid="tenant-panel">Tenant Panel</div>);
jest.mock('../FeatureFlagControlPanel', () => () => <div data-testid="feature-flags">Feature Flags</div>);
jest.mock('../SystemHealthPanel', () => () => <div data-testid="health-panel">Health Panel</div>);
jest.mock('../AuditLogViewer', () => () => <div data-testid="audit-viewer">Audit Viewer</div>);
jest.mock('../TenantDataViewer', () => () => <div data-testid="tenant-data">Tenant Data</div>);
jest.mock('../PlatformSOC2Dashboard', () => () => <div data-testid="soc2-dashboard">SOC2</div>);
jest.mock('../PlatformAICostDashboard', () => () => <div data-testid="ai-cost">AI Cost</div>);
jest.mock('../GuardianMonitoringDashboard', () => () => <div data-testid="guardian">Guardian</div>);
jest.mock('../AISkillsControlPanel', () => () => <div data-testid="ai-skills">AI Skills</div>);

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('SuperAdminDashboard', () => {
  const mockOverview = {
    totalTenants: 5,
    activeTenants: 4,
    suspendedTenants: 1,
    totalUsers: 500,
    totalPatients: 1200,
    featuresForceDisabled: 2,
    criticalHealthIssues: 0,
    criticalAuditEvents24h: 3
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    (SuperAdminService.isSuperAdmin as jest.Mock).mockResolvedValue(true);
    (SuperAdminService.getSystemOverview as jest.Mock).mockResolvedValue(mockOverview);
  });

  describe('Authentication', () => {
    test('should check super admin access on mount', async () => {
      renderWithRouter(<SuperAdminDashboard />);

      await waitFor(() => {
        expect(SuperAdminService.isSuperAdmin).toHaveBeenCalled();
      });
    });
  });

  describe('Loading State', () => {
    test('should show loading indicator initially', () => {
      (SuperAdminService.isSuperAdmin as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithRouter(<SuperAdminDashboard />);

      // Component shows loading state while checking auth
      const loadingElement = document.querySelector('.animate-spin') ||
                            document.querySelector('.animate-pulse') ||
                            screen.queryByText(/loading/i);
      expect(loadingElement).toBeTruthy();
    });
  });

  describe('Dashboard Content', () => {
    test('should render dashboard after loading', async () => {
      renderWithRouter(<SuperAdminDashboard />);

      await waitFor(() => {
        // Look for key dashboard elements - the greeting or any dashboard content
        const content = screen.queryByTestId('personalized-greeting') ||
                       screen.queryByText(/Total Tenants/i) ||
                       screen.queryByText(/System/i);
        expect(content).toBeTruthy();
      }, { timeout: 5000 });
    });

    test('should call getSystemOverview after auth check', async () => {
      renderWithRouter(<SuperAdminDashboard />);

      await waitFor(() => {
        expect(SuperAdminService.getSystemOverview).toHaveBeenCalled();
      });
    });
  });
});
