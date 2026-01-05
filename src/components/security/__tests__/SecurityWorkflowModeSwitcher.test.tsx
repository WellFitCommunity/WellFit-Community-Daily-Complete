/**
 * Tests for SecurityWorkflowModeSwitcher Component
 *
 * Purpose: Focus modes for security/compliance teams
 * Tests: Mode rendering, mode switching, active state, section filter hook
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import {
  SecurityWorkflowModeSwitcher,
  SECURITY_WORKFLOW_MODES,
  useSecuritySectionFilter,
  SecurityWorkflowMode,
} from '../SecurityWorkflowModeSwitcher';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, className, onClick, ...props }: React.HTMLAttributes<HTMLButtonElement>) => (
      <button className={className as string} onClick={onClick} {...props}>
        {children}
      </button>
    ),
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className as string} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock AuthContext
const mockUseAuth = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Supabase client
const mockUpsert = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: mockUpsert,
    })),
  },
}));

describe('SecurityWorkflowModeSwitcher', () => {
  const defaultProps = {
    currentMode: 'all' as SecurityWorkflowMode,
    onModeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id' },
    });

    mockUpsert.mockResolvedValue({ error: null });
  });

  describe('Component Rendering', () => {
    it('should render the component header', () => {
      render(<SecurityWorkflowModeSwitcher {...defaultProps} />);

      expect(screen.getByText('Security Workflow Mode')).toBeInTheDocument();
    });

    it('should render the description text', () => {
      render(<SecurityWorkflowModeSwitcher {...defaultProps} />);

      expect(screen.getByText('Focus on specific security tasks')).toBeInTheDocument();
    });

    it('should render all workflow mode buttons', () => {
      render(<SecurityWorkflowModeSwitcher {...defaultProps} />);

      expect(screen.getByText('All Sections')).toBeInTheDocument();
      expect(screen.getByText('HIPAA/SOC2 Compliance')).toBeInTheDocument();
      expect(screen.getByText('Security Monitoring')).toBeInTheDocument();
      expect(screen.getByText('Incident Response')).toBeInTheDocument();
      expect(screen.getByText('Audit Logs & Reports')).toBeInTheDocument();
    });

    it('should render mode descriptions', () => {
      render(<SecurityWorkflowModeSwitcher {...defaultProps} />);

      expect(screen.getByText('Show everything')).toBeInTheDocument();
      expect(screen.getByText('Compliance monitoring, policies, certifications')).toBeInTheDocument();
      expect(screen.getByText('Real-time alerts, PHI access, anomalies')).toBeInTheDocument();
      expect(screen.getByText('Security incidents, breaches, investigations')).toBeInTheDocument();
      expect(screen.getByText('Audit trails, access logs, compliance reports')).toBeInTheDocument();
    });
  });

  describe('Mode Selection', () => {
    it('should call onModeChange when mode is selected', async () => {
      const onModeChange = vi.fn();
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="all"
          onModeChange={onModeChange}
        />
      );

      await userEvent.click(screen.getByText('HIPAA/SOC2 Compliance'));

      expect(onModeChange).toHaveBeenCalledWith('compliance');
    });

    it('should call onModeChange for monitoring mode', async () => {
      const onModeChange = vi.fn();
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="all"
          onModeChange={onModeChange}
        />
      );

      await userEvent.click(screen.getByText('Security Monitoring'));

      expect(onModeChange).toHaveBeenCalledWith('monitoring');
    });

    it('should call onModeChange for incidents mode', async () => {
      const onModeChange = vi.fn();
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="all"
          onModeChange={onModeChange}
        />
      );

      await userEvent.click(screen.getByText('Incident Response'));

      expect(onModeChange).toHaveBeenCalledWith('incidents');
    });

    it('should call onModeChange for audits mode', async () => {
      const onModeChange = vi.fn();
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="all"
          onModeChange={onModeChange}
        />
      );

      await userEvent.click(screen.getByText('Audit Logs & Reports'));

      expect(onModeChange).toHaveBeenCalledWith('audits');
    });
  });

  describe('Active Mode Styling', () => {
    it('should show check icon for active mode', () => {
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="compliance"
          onModeChange={vi.fn()}
        />
      );

      // The compliance button should have active styling
      const complianceButton = screen.getByText('HIPAA/SOC2 Compliance').closest('button');
      expect(complianceButton?.className).toContain('text-white');
    });

    it('should apply gradient for active compliance mode', () => {
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="compliance"
          onModeChange={vi.fn()}
        />
      );

      const complianceButton = screen.getByText('HIPAA/SOC2 Compliance').closest('button');
      expect(complianceButton?.className).toContain('from-blue-400');
    });

    it('should apply gradient for active monitoring mode', () => {
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="monitoring"
          onModeChange={vi.fn()}
        />
      );

      const monitoringButton = screen.getByText('Security Monitoring').closest('button');
      expect(monitoringButton?.className).toContain('from-green-400');
    });

    it('should apply gradient for active incidents mode', () => {
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="incidents"
          onModeChange={vi.fn()}
        />
      );

      const incidentsButton = screen.getByText('Incident Response').closest('button');
      expect(incidentsButton?.className).toContain('from-red-400');
    });

    it('should apply gradient for active audits mode', () => {
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="audits"
          onModeChange={vi.fn()}
        />
      );

      const auditsButton = screen.getByText('Audit Logs & Reports').closest('button');
      expect(auditsButton?.className).toContain('from-purple-400');
    });

    it('should apply inactive styling for non-active modes', () => {
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="all"
          onModeChange={vi.fn()}
        />
      );

      const complianceButton = screen.getByText('HIPAA/SOC2 Compliance').closest('button');
      expect(complianceButton?.className).toContain('bg-gray-50');
    });
  });

  describe('Mode-Specific Tips', () => {
    it('should not show tips when all mode is active', () => {
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="all"
          onModeChange={vi.fn()}
        />
      );

      expect(screen.queryByText(/mode active:/i)).not.toBeInTheDocument();
    });

    it('should show tip when compliance mode is active', () => {
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="compliance"
          onModeChange={vi.fn()}
        />
      );

      expect(screen.getByText(/HIPAA\/SOC2 Compliance mode active:/i)).toBeInTheDocument();
    });

    it('should show section count in tip', () => {
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="compliance"
          onModeChange={vi.fn()}
        />
      );

      // Compliance mode has 7 sections
      expect(screen.getByText(/7 focused sections/i)).toBeInTheDocument();
    });

    it('should show keyboard shortcut in tip', () => {
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="monitoring"
          onModeChange={vi.fn()}
        />
      );

      expect(screen.getByText(/Cmd\+K/i)).toBeInTheDocument();
    });
  });

  describe('Preference Persistence', () => {
    it('should save preference when mode is changed', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
      });

      const onModeChange = vi.fn();
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="all"
          onModeChange={onModeChange}
        />
      );

      await userEvent.click(screen.getByText('HIPAA/SOC2 Compliance'));

      await waitFor(() => {
        expect(mockUpsert).toHaveBeenCalled();
      });
    });

    it('should not save preference for all mode', async () => {
      const onModeChange = vi.fn();
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="compliance"
          onModeChange={onModeChange}
        />
      );

      await userEvent.click(screen.getByText('All Sections'));

      // Should still call onModeChange
      expect(onModeChange).toHaveBeenCalledWith('all');

      // But should not save to database
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('should not save preference when no user', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
      });

      const onModeChange = vi.fn();
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="all"
          onModeChange={onModeChange}
        />
      );

      await userEvent.click(screen.getByText('HIPAA/SOC2 Compliance'));

      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('should handle save errors silently', async () => {
      mockUpsert.mockRejectedValue(new Error('Database error'));

      const onModeChange = vi.fn();
      render(
        <SecurityWorkflowModeSwitcher
          currentMode="all"
          onModeChange={onModeChange}
        />
      );

      // Should not throw
      await userEvent.click(screen.getByText('HIPAA/SOC2 Compliance'));

      expect(onModeChange).toHaveBeenCalledWith('compliance');
    });
  });

  describe('Grid Layout', () => {
    it('should use responsive grid layout', () => {
      render(<SecurityWorkflowModeSwitcher {...defaultProps} />);

      const grid = document.querySelector('.grid.grid-cols-2');
      expect(grid).toBeInTheDocument();
    });
  });
});

describe('SECURITY_WORKFLOW_MODES Configuration', () => {
  it('should have all mode with empty sections', () => {
    expect(SECURITY_WORKFLOW_MODES.all.sections).toEqual([]);
  });

  it('should have compliance mode with correct sections', () => {
    expect(SECURITY_WORKFLOW_MODES.compliance.sections).toContain('compliance-dashboard');
    expect(SECURITY_WORKFLOW_MODES.compliance.sections).toContain('hipaa-controls');
    expect(SECURITY_WORKFLOW_MODES.compliance.sections).toContain('soc2-controls');
  });

  it('should have monitoring mode with correct sections', () => {
    expect(SECURITY_WORKFLOW_MODES.monitoring.sections).toContain('security-alerts');
    expect(SECURITY_WORKFLOW_MODES.monitoring.sections).toContain('phi-access-logs');
    expect(SECURITY_WORKFLOW_MODES.monitoring.sections).toContain('anomaly-detection');
  });

  it('should have incidents mode with correct sections', () => {
    expect(SECURITY_WORKFLOW_MODES.incidents.sections).toContain('active-incidents');
    expect(SECURITY_WORKFLOW_MODES.incidents.sections).toContain('breach-notifications');
    expect(SECURITY_WORKFLOW_MODES.incidents.sections).toContain('forensics');
  });

  it('should have audits mode with correct sections', () => {
    expect(SECURITY_WORKFLOW_MODES.audits.sections).toContain('audit-logs');
    expect(SECURITY_WORKFLOW_MODES.audits.sections).toContain('access-control-logs');
    expect(SECURITY_WORKFLOW_MODES.audits.sections).toContain('export-logs');
  });
});

describe('useSecuritySectionFilter Hook', () => {
  describe('All Mode', () => {
    it('should return visible=true for all mode', () => {
      const { result } = renderHook(() =>
        useSecuritySectionFilter('all', 'any-section')
      );

      expect(result.current.visible).toBe(true);
    });

    it('should return prioritized=false for all mode', () => {
      const { result } = renderHook(() =>
        useSecuritySectionFilter('all', 'any-section')
      );

      expect(result.current.prioritized).toBe(false);
    });
  });

  describe('Compliance Mode', () => {
    it('should return visible=true for compliance section', () => {
      const { result } = renderHook(() =>
        useSecuritySectionFilter('compliance', 'compliance-dashboard')
      );

      expect(result.current.visible).toBe(true);
    });

    it('should return visible=false for non-compliance section', () => {
      const { result } = renderHook(() =>
        useSecuritySectionFilter('compliance', 'security-alerts')
      );

      expect(result.current.visible).toBe(false);
    });

    it('should return prioritized=true for visible sections', () => {
      const { result } = renderHook(() =>
        useSecuritySectionFilter('compliance', 'hipaa-controls')
      );

      expect(result.current.prioritized).toBe(true);
    });
  });

  describe('Monitoring Mode', () => {
    it('should return visible=true for monitoring section', () => {
      const { result } = renderHook(() =>
        useSecuritySectionFilter('monitoring', 'security-alerts')
      );

      expect(result.current.visible).toBe(true);
    });

    it('should return visible=false for non-monitoring section', () => {
      const { result } = renderHook(() =>
        useSecuritySectionFilter('monitoring', 'compliance-dashboard')
      );

      expect(result.current.visible).toBe(false);
    });
  });

  describe('Incidents Mode', () => {
    it('should return visible=true for incident section', () => {
      const { result } = renderHook(() =>
        useSecuritySectionFilter('incidents', 'active-incidents')
      );

      expect(result.current.visible).toBe(true);
    });

    it('should return visible=false for non-incident section', () => {
      const { result } = renderHook(() =>
        useSecuritySectionFilter('incidents', 'audit-logs')
      );

      expect(result.current.visible).toBe(false);
    });
  });

  describe('Audits Mode', () => {
    it('should return visible=true for audit section', () => {
      const { result } = renderHook(() =>
        useSecuritySectionFilter('audits', 'audit-logs')
      );

      expect(result.current.visible).toBe(true);
    });

    it('should return visible=false for non-audit section', () => {
      const { result } = renderHook(() =>
        useSecuritySectionFilter('audits', 'security-alerts')
      );

      expect(result.current.visible).toBe(false);
    });
  });
});
