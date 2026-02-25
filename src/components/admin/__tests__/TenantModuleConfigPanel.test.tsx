/**
 * TenantModuleConfigPanel tests — validates loading state, error state, module grouping
 * by category, two-tier entitlement model (entitled + enabled), pending changes tracking,
 * save/cancel/reset flows, and category expand/collapse behavior.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockRefresh = vi.fn();
const mockUpdateConfig = vi.fn();

let mockHookReturn: {
  config: Record<string, unknown> | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

vi.mock('../../../hooks/useTenantModules', () => ({
  useTenantModules: () => mockHookReturn,
}));

vi.mock('../../../services/tenantModuleService', () => ({
  updateTenantModuleConfig: (...args: unknown[]) => mockUpdateConfig(...args),
}));

// Mock MODULE_METADATA with a small subset for testing — three categories
vi.mock('../../../types/tenantModules', () => ({
  MODULE_METADATA: {
    community_enabled: {
      name: 'Community Features',
      description: 'Social engagement, moments, trivia, peer support',
      category: 'core',
      requiredTier: 'basic',
    },
    dental_enabled: {
      name: 'Dental Health',
      description: 'Dental assessments, procedures, CDT codes, FHIR integration',
      category: 'clinical',
      requiredTier: 'premium',
    },
    telehealth_enabled: {
      name: 'Telehealth',
      description: 'Video consultations and virtual care',
      category: 'communication',
      requiredTier: 'standard',
    },
  },
  getEntitlementName: (name: string) => {
    if (name === 'hipaa_audit_logging') return 'hipaa_audit_logging_entitled';
    if (name === 'mfa_enforcement') return 'mfa_enforcement_entitled';
    return name.replace('_enabled', '_entitled');
  },
}));

// Mock lucide-react icons as simple spans with identifiable text
vi.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="loader-icon" className={className}>Loader</span>
  ),
  Save: () => <span data-testid="save-icon">Save</span>,
  RefreshCw: () => <span data-testid="refresh-icon">RefreshCw</span>,
  CheckCircle2: () => <span data-testid="check-icon">Check</span>,
  AlertTriangle: () => <span data-testid="alert-triangle-icon">AlertTriangle</span>,
  Lock: ({ className }: { className?: string }) => (
    <span data-testid="lock-icon" className={className}>Lock</span>
  ),
  Info: () => <span data-testid="info-icon">Info</span>,
  ChevronDown: () => <span data-testid="chevron-down">ChevronDown</span>,
  ChevronUp: () => <span data-testid="chevron-up">ChevronUp</span>,
  Settings: () => <span data-testid="settings-icon">Settings</span>,
}));

// Mock EA components as simple pass-through elements
vi.mock('../../envision-atlus', () => ({
  EACard: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card" className={className}>{children}</div>
  ),
  EACardHeader: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="ea-card-header">{children}</div>
  ),
  EACardContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-content" className={className}>{children}</div>
  ),
  EAButton: ({
    children,
    onClick,
    disabled,
    loading: isLoading,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: string;
    size?: string;
    icon?: React.ReactNode;
  }) => (
    <button onClick={onClick} disabled={disabled} data-loading={isLoading}>
      {children}
    </button>
  ),
  EABadge: ({ children }: { children?: React.ReactNode; variant?: string; className?: string }) => (
    <span data-testid="ea-badge">{children}</span>
  ),
  EAAlert: ({ children, variant }: { children?: React.ReactNode; variant?: string }) => (
    <div role="alert" data-variant={variant}>{children}</div>
  ),
  EASwitch: ({
    checked,
    onCheckedChange,
    disabled,
  }: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    disabled?: boolean;
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
    >
      {checked ? 'ON' : 'OFF'}
    </button>
  ),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const makeConfig = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'config-test-001',
  tenant_id: 'tenant-test-001',
  license_tier: 'standard',
  // Active state
  community_enabled: true,
  dental_enabled: false,
  telehealth_enabled: true,
  // Entitlements
  community_entitled: true,
  dental_entitled: false,
  telehealth_entitled: true,
  ...overrides,
});

// ============================================================================
// TESTS
// ============================================================================

describe('TenantModuleConfigPanel', () => {
  let TenantModuleConfigPanel: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRefresh.mockResolvedValue(undefined);
    mockUpdateConfig.mockResolvedValue(null);

    // Default: loaded state with config
    mockHookReturn = {
      config: makeConfig(),
      loading: false,
      error: null,
      refresh: mockRefresh,
    };

    // Dynamic import to ensure mocks are registered
    const mod = await import('../TenantModuleConfigPanel');
    TenantModuleConfigPanel = mod.TenantModuleConfigPanel;
  });

  // --------------------------------------------------------------------------
  // 1. Loading state
  // --------------------------------------------------------------------------

  it('shows spinner with animate-spin class during loading', () => {
    mockHookReturn = { config: null, loading: true, error: null, refresh: mockRefresh };
    render(<TenantModuleConfigPanel />);

    const loader = screen.getByTestId('loader-icon');
    expect(loader).toBeInTheDocument();
    expect(loader.className).toContain('animate-spin');
  });

  // --------------------------------------------------------------------------
  // 2-3. Error state
  // --------------------------------------------------------------------------

  it('shows critical alert when error is returned', () => {
    mockHookReturn = {
      config: null,
      loading: false,
      error: new Error('Network failure'),
      refresh: mockRefresh,
    };
    render(<TenantModuleConfigPanel />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('data-variant', 'critical');
    expect(alert).toHaveTextContent('Network failure');
  });

  it('shows default error message when config is null without explicit error', () => {
    mockHookReturn = { config: null, loading: false, error: null, refresh: mockRefresh };
    render(<TenantModuleConfigPanel />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Failed to load module configuration');
  });

  // --------------------------------------------------------------------------
  // 4. Header title
  // --------------------------------------------------------------------------

  it('displays "Module Configuration" header', () => {
    render(<TenantModuleConfigPanel />);

    expect(screen.getByText('Module Configuration')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 5. License tier badge
  // --------------------------------------------------------------------------

  it('displays the license tier badge', () => {
    render(<TenantModuleConfigPanel />);

    expect(screen.getByText(/License: standard/)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 6. Entitled count badge
  // --------------------------------------------------------------------------

  it('displays the entitled count badge', () => {
    // community_entitled=true, dental_entitled=false, telehealth_entitled=true => 2 entitled
    render(<TenantModuleConfigPanel />);

    expect(screen.getByText('2 entitled')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 7. Active count badge
  // --------------------------------------------------------------------------

  it('displays the active count badge for entitled+enabled modules', () => {
    // community: entitled+enabled=active, dental: not entitled, telehealth: entitled+enabled=active => 2 active
    render(<TenantModuleConfigPanel />);

    expect(screen.getByText('2 active')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 8. Module names displayed
  // --------------------------------------------------------------------------

  it('displays module names for expanded categories', () => {
    render(<TenantModuleConfigPanel />);

    // core and communication categories are expanded by default
    expect(screen.getByText('Community Features')).toBeInTheDocument();
    expect(screen.getByText('Telehealth')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 9. Module descriptions displayed
  // --------------------------------------------------------------------------

  it('displays module descriptions for expanded categories', () => {
    render(<TenantModuleConfigPanel />);

    expect(
      screen.getByText('Social engagement, moments, trivia, peer support')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Video consultations and virtual care')
    ).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 10. Required tier badge per module
  // --------------------------------------------------------------------------

  it('displays the required tier badge for each module', () => {
    render(<TenantModuleConfigPanel />);

    // Community requires basic, Telehealth requires standard
    // Both are in expanded categories — look for their tier badges
    const badges = screen.getAllByTestId('ea-badge');
    const badgeTexts = badges.map((b) => b.textContent);
    expect(badgeTexts).toContain('basic');
    expect(badgeTexts).toContain('standard');
  });

  // --------------------------------------------------------------------------
  // 11. Entitled module has toggle switch
  // --------------------------------------------------------------------------

  it('renders toggle switch for entitled modules', () => {
    render(<TenantModuleConfigPanel />);

    // community_enabled is entitled and in expanded core category
    const switches = screen.getAllByRole('switch');
    // community + telehealth are entitled and in expanded categories
    expect(switches.length).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------------------------
  // 12. Non-entitled module shows Lock icon and "Not in plan"
  // --------------------------------------------------------------------------

  it('shows Lock icon and "Not in plan" badge for non-entitled module', async () => {
    // dental is in 'clinical' category which is expanded by default
    // But dental_entitled=false, so it should show lock + "Not in plan"
    render(<TenantModuleConfigPanel />);

    // clinical category is expanded by default in the component (clinical: true)
    expect(screen.getByText('Dental Health')).toBeInTheDocument();
    expect(screen.getByText('Not in plan')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 13. Contact text for non-entitled module
  // --------------------------------------------------------------------------

  it('shows contact text for non-entitled module', () => {
    render(<TenantModuleConfigPanel />);

    expect(
      screen.getByText('Contact Envision Atlus to add this to your plan')
    ).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 14. Toggling entitled module tracks pending change
  // --------------------------------------------------------------------------

  it('tracks pending change when toggling an entitled module', async () => {
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    // Community Features is entitled+enabled. Its switch says "ON".
    // Find the ON switch for community (first switch in core section)
    const switches = screen.getAllByRole('switch');
    const communitySwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    expect(communitySwitch).toBeTruthy();

    await user.click(communitySwitch as HTMLElement);

    // After toggling, the unsaved changes bar should appear
    await waitFor(() => {
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 15. Save/Cancel buttons appear when pending changes exist
  // --------------------------------------------------------------------------

  it('shows Save and Cancel buttons when pending changes exist', async () => {
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    // Toggle a switch to create pending changes
    const switches = screen.getAllByRole('switch');
    const enabledSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    await user.click(enabledSwitch as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 16. Save calls updateTenantModuleConfig
  // --------------------------------------------------------------------------

  it('calls updateTenantModuleConfig with pending changes on save', async () => {
    mockUpdateConfig.mockResolvedValue(makeConfig({ community_enabled: false }));
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    // Toggle community off
    const switches = screen.getAllByRole('switch');
    const communitySwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    await user.click(communitySwitch as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ community_enabled: false })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 17. Successful save shows success message
  // --------------------------------------------------------------------------

  it('shows success message after successful save', async () => {
    mockUpdateConfig.mockResolvedValue(makeConfig({ community_enabled: false }));
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    const switches = screen.getAllByRole('switch');
    const enabledSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    await user.click(enabledSwitch as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText('Configuration saved successfully!')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 18. Failed save shows error message
  // --------------------------------------------------------------------------

  it('shows error message when save returns null (failure)', async () => {
    mockUpdateConfig.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    const switches = screen.getAllByRole('switch');
    const enabledSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    await user.click(enabledSwitch as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(
        screen.getByText('Failed to save configuration. Please try again.')
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 19. Cancel clears pending changes
  // --------------------------------------------------------------------------

  it('clears pending changes when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    const switches = screen.getAllByRole('switch');
    const enabledSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    await user.click(enabledSwitch as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 20. Refresh button calls refresh
  // --------------------------------------------------------------------------

  it('calls refresh when Refresh button is clicked', async () => {
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    const refreshButton = screen.getByText('Refresh');
    await user.click(refreshButton);

    expect(mockRefresh).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 21. Active badge for entitled+enabled module
  // --------------------------------------------------------------------------

  it('shows Active badge for entitled and enabled module', () => {
    render(<TenantModuleConfigPanel />);

    // community_enabled: entitled+enabled=true, telehealth_enabled: entitled+enabled=true
    // Both should show "Active" badge
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------------------------
  // 22. Category expand/collapse
  // --------------------------------------------------------------------------

  it('toggles category visibility when category header is clicked', async () => {
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    // Core Platform category is expanded by default — Community Features is visible
    expect(screen.getByText('Community Features')).toBeInTheDocument();

    // Click the Core Platform category header to collapse it
    const coreCategoryButton = screen.getByText('Core Platform').closest('button');
    expect(coreCategoryButton).toBeTruthy();
    await user.click(coreCategoryButton as HTMLElement);

    // Community Features should no longer be visible (collapsed)
    await waitFor(() => {
      expect(screen.queryByText('Social engagement, moments, trivia, peer support')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 23. Category header with label
  // --------------------------------------------------------------------------

  it('displays category labels for module groups', () => {
    render(<TenantModuleConfigPanel />);

    expect(screen.getByText('Core Platform')).toBeInTheDocument();
    expect(screen.getByText('Clinical Modules')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 24. Category counts (in plan / active)
  // --------------------------------------------------------------------------

  it('displays per-category entitled and active counts', () => {
    render(<TenantModuleConfigPanel />);

    // Core: community_entitled=true => 1/1 in plan
    // Communication: telehealth_entitled=true => 1/1 in plan
    // Both expanded categories show "1/1 in plan" — use getAllByText
    const inPlanBadges = screen.getAllByText('1/1 in plan');
    expect(inPlanBadges.length).toBe(2);
  });

  // --------------------------------------------------------------------------
  // 25. Pending changes count shown
  // --------------------------------------------------------------------------

  it('displays the pending changes count', async () => {
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    const switches = screen.getAllByRole('switch');
    const enabledSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    await user.click(enabledSwitch as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText(/unsaved changes to 1 module\b/)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 26. Saving state disables save button
  // --------------------------------------------------------------------------

  it('disables Save button while saving is in progress', async () => {
    // Make updateConfig hang (never resolve) to keep saving state
    mockUpdateConfig.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    const switches = screen.getAllByRole('switch');
    const enabledSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    await user.click(enabledSwitch as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save Changes'));

    // While saving, button text changes to "Saving..."
    await waitFor(() => {
      const savingButton = screen.getByText('Saving...');
      expect(savingButton.closest('button')).toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------
  // 27. Reset clears pending changes same as cancel
  // --------------------------------------------------------------------------

  it('clears pending changes and messages on reset (Cancel button is the reset)', async () => {
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    const switches = screen.getAllByRole('switch');
    const enabledSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    await user.click(enabledSwitch as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));

    // Verify the entire save actions bar is gone
    await waitFor(() => {
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
      expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 28. Module toggle disabled during save
  // --------------------------------------------------------------------------

  it('disables module toggles while save is in progress', async () => {
    // Make updateConfig hang to keep saving state
    mockUpdateConfig.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    const switches = screen.getAllByRole('switch');
    const enabledSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    await user.click(enabledSwitch as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save Changes'));

    // While saving, all switches should be disabled
    await waitFor(() => {
      const allSwitches = screen.getAllByRole('switch');
      allSwitches.forEach((sw) => {
        expect(sw).toBeDisabled();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Additional behavioral tests
  // --------------------------------------------------------------------------

  it('shows save error when updateTenantModuleConfig throws an exception', async () => {
    mockUpdateConfig.mockRejectedValue(new Error('Server timeout'));
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    const switches = screen.getAllByRole('switch');
    const enabledSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    await user.click(enabledSwitch as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText('Server timeout')).toBeInTheDocument();
    });
  });

  it('shows Enabled/Disabled text labels for entitled modules', () => {
    render(<TenantModuleConfigPanel />);

    // community_enabled=true => "Enabled", telehealth_enabled=true => "Enabled"
    const enabledLabels = screen.getAllByText('Enabled');
    expect(enabledLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('does not show toggle switch for non-entitled modules', () => {
    render(<TenantModuleConfigPanel />);

    // dental is not entitled, clinical category is expanded by default
    // It should show a Lock icon instead of a switch
    // Total switches = community (core, expanded) + telehealth (communication, expanded) = 2
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBe(2);
  });

  it('displays info banner about plan and locked modules', () => {
    render(<TenantModuleConfigPanel />);

    expect(screen.getByText(/You can enable or disable modules within your current plan/)).toBeInTheDocument();
  });

  it('displays clinical category as 0/1 in plan when dental is not entitled', () => {
    render(<TenantModuleConfigPanel />);

    // Clinical: dental_entitled=false => 0/1 in plan
    expect(screen.getByText('0/1 in plan')).toBeInTheDocument();
    // Clinical: dental not entitled, not enabled => 0 active
    expect(screen.getAllByText('0 active').length).toBeGreaterThanOrEqual(1);
  });

  it('updates pending changes count when toggling multiple modules', async () => {
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    const switches = screen.getAllByRole('switch');

    // Toggle first switch (community)
    await user.click(switches[0]);

    await waitFor(() => {
      expect(screen.getByText(/unsaved changes to 1 module\b/)).toBeInTheDocument();
    });

    // Toggle second switch (telehealth)
    await user.click(switches[1]);

    await waitFor(() => {
      expect(screen.getByText(/unsaved changes to 2 modules/)).toBeInTheDocument();
    });
  });

  it('successful save clears pending changes bar', async () => {
    mockUpdateConfig.mockResolvedValue(makeConfig({ community_enabled: false }));
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    const switches = screen.getAllByRole('switch');
    const enabledSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    await user.click(enabledSwitch as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      // Pending changes bar should be gone after successful save
      expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
    });
  });

  it('calls refresh after successful save to reload config', async () => {
    mockUpdateConfig.mockResolvedValue(makeConfig({ community_enabled: false }));
    const user = userEvent.setup();
    render(<TenantModuleConfigPanel />);

    const switches = screen.getAllByRole('switch');
    const enabledSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true');
    await user.click(enabledSwitch as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('shows subtitle text about enabling/disabling modules', () => {
    render(<TenantModuleConfigPanel />);

    expect(
      screen.getByText('Enable or disable platform modules for your organization')
    ).toBeInTheDocument();
  });
});
