/**
 * AdminSettingsPanel Tests
 *
 * Comprehensive behavioral tests for the admin settings panel.
 * Covers loading, theme selection, notifications, security, system settings,
 * save/reset flows, and database integration.
 *
 * Every test passes the Deletion Test: would fail if component renders empty <div />.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock control variables — declared before vi.mock so hoisting works correctly
// ---------------------------------------------------------------------------
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpsert = vi.fn();
const mockFrom = vi.fn((_table: string) => ({
  select: mockSelect,
  upsert: mockUpsert,
}));

let mockAdminRole = 'admin';

// ---------------------------------------------------------------------------
// Module mocks (hoisted by Vitest)
// ---------------------------------------------------------------------------
vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({ adminRole: mockAdminRole }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({ from: mockFrom }),
  useUser: () => ({ id: 'user-test-001' }),
}));

// ---------------------------------------------------------------------------
// Test fixtures — synthetic data only (CLAUDE.md: no realistic PHI)
// ---------------------------------------------------------------------------
const makeDbSettings = (overrides: Record<string, unknown> = {}) => ({
  user_id: 'user-test-001',
  theme: 'light',
  email_notifications: true,
  browser_notifications: true,
  emergency_alerts: true,
  session_timeout: 30,
  require_pin_for_sensitive: true,
  compact_mode: false,
  show_advanced_metrics: true,
  default_dashboard_view: 'overview',
  enable_beta_features: false,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the load-settings DB call with the given data. */
function resolveLoad(data: ReturnType<typeof makeDbSettings> | null = makeDbSettings()) {
  mockMaybeSingle.mockResolvedValueOnce({ data, error: null });
}

/** Resolve the load-settings DB call with an error. */
function resolveLoadError() {
  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });
}

async function renderAndWait() {
  const AdminSettingsPanel = (await import('../AdminSettingsPanel')).default;
  const result = render(<AdminSettingsPanel />);
  await waitFor(() => {
    expect(screen.queryByText('Loading settings...')).not.toBeInTheDocument();
  });
  return result;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  mockAdminRole = 'admin';

  // Spy on DOM/browser APIs the component uses
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
  vi.spyOn(document.documentElement.classList, 'add').mockImplementation(() => undefined);
  vi.spyOn(document.documentElement.classList, 'remove').mockImplementation(() => undefined);
  vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  vi.spyOn(window, 'confirm').mockReturnValue(false);

  // Reset module registry so each test gets a fresh component
  vi.resetModules();
});

// ===========================================================================
// 1. Loading State
// ===========================================================================
describe('AdminSettingsPanel — loading state', () => {
  it('shows "Loading settings..." while fetching from database', async () => {
    // Never resolve — keep the component in loading state
    mockMaybeSingle.mockReturnValue(new Promise(() => { /* intentionally pending */ }));

    const AdminSettingsPanel = (await import('../AdminSettingsPanel')).default;
    render(<AdminSettingsPanel />);

    expect(screen.getByText('Loading settings...')).toBeInTheDocument();
  });
});

// ===========================================================================
// 2–3. Header
// ===========================================================================
describe('AdminSettingsPanel — header', () => {
  it('renders "Admin Settings" title', async () => {
    resolveLoad();
    await renderAndWait();
    expect(screen.getByText('Admin Settings')).toBeInTheDocument();
  });

  it('renders the subtitle describing the panel purpose', async () => {
    resolveLoad();
    await renderAndWait();
    expect(
      screen.getByText('Customize your admin panel experience and system preferences')
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// 4–5. Theme buttons
// ===========================================================================
describe('AdminSettingsPanel — theme buttons', () => {
  it('renders light, dark, and auto theme buttons', async () => {
    resolveLoad();
    await renderAndWait();

    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auto/i })).toBeInTheDocument();
  });

  it('highlights the active theme button with blue styling', async () => {
    resolveLoad(makeDbSettings({ theme: 'dark' }));
    await renderAndWait();

    const darkBtn = screen.getByRole('button', { name: /dark/i });
    expect(darkBtn.className).toContain('border-[var(--ea-primary');
    expect(darkBtn.className).toContain('text-[var(--ea-primary');

    // Light should NOT have active styling
    const lightBtn = screen.getByRole('button', { name: /light/i });
    expect(lightBtn.className).not.toContain('border-[var(--ea-primary');
  });
});

// ===========================================================================
// 6–8. Display settings
// ===========================================================================
describe('AdminSettingsPanel — display settings', () => {
  it('renders Compact mode checkbox reflecting stored value', async () => {
    resolveLoad(makeDbSettings({ compact_mode: true }));
    await renderAndWait();

    const checkbox = screen.getByRole('checkbox', { name: /compact mode/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it('renders Show advanced metrics checkbox reflecting stored value', async () => {
    resolveLoad(makeDbSettings({ show_advanced_metrics: false }));
    await renderAndWait();

    const checkbox = screen.getByRole('checkbox', { name: /show advanced metrics/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('renders Default Dashboard View dropdown with Overview, Patients, Billing', async () => {
    resolveLoad();
    await renderAndWait();

    const selects = screen.getAllByRole('combobox');
    // The dashboard view select contains the Overview option
    const dashboardSelect = selects.find((s) => {
      const opts = within(s).getAllByRole('option');
      return opts.some((o) => o.textContent === 'Overview');
    });
    expect(dashboardSelect).toBeDefined();

    const options = within(dashboardSelect as HTMLElement).getAllByRole('option');
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).toContain('Overview');
    expect(optionTexts).toContain('Patients');
    expect(optionTexts).toContain('Billing');
  });
});

// ===========================================================================
// 9–11. Notifications
// ===========================================================================
describe('AdminSettingsPanel — notifications', () => {
  it('renders Email notifications checkbox', async () => {
    resolveLoad();
    await renderAndWait();

    expect(screen.getByText('Email notifications')).toBeInTheDocument();
    // The label text "Email notifications" wraps the checkbox
    const checkbox = screen.getByRole('checkbox', { name: /email notifications/i });
    expect(checkbox).toBeChecked();
  });

  it('renders Browser notifications checkbox', async () => {
    resolveLoad();
    await renderAndWait();

    expect(screen.getByText('Browser notifications')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', { name: /browser notifications/i });
    expect(checkbox).toBeChecked();
  });

  it('renders Emergency alerts checkbox as disabled (always enabled)', async () => {
    resolveLoad();
    await renderAndWait();

    expect(screen.getByText('Emergency alerts')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', { name: /emergency alerts/i });
    expect(checkbox).toBeDisabled();
    expect(checkbox).toBeChecked();
  });
});

// ===========================================================================
// 12–14. Security
// ===========================================================================
describe('AdminSettingsPanel — security', () => {
  it('renders Session timeout dropdown with 15, 30, 60, 120 options', async () => {
    resolveLoad();
    await renderAndWait();

    expect(screen.getByText('Session timeout (minutes)')).toBeInTheDocument();

    // Find all comboboxes; the session timeout is the second one (first is dashboard view)
    const selects = screen.getAllByRole('combobox');
    // Session timeout select has the 15/30/60/120 options
    const timeoutSelect = selects.find((s) => {
      const opts = within(s).getAllByRole('option');
      return opts.some((o) => o.textContent === '15 minutes');
    });
    expect(timeoutSelect).toBeDefined();

    const options = within(timeoutSelect as HTMLElement).getAllByRole('option');
    const values = options.map((o) => o.textContent);
    expect(values).toContain('15 minutes');
    expect(values).toContain('30 minutes');
    expect(values).toContain('1 hour');
    expect(values).toContain('2 hours');
  });

  it('renders Require PIN for sensitive actions checkbox', async () => {
    resolveLoad();
    await renderAndWait();

    expect(screen.getByText('Require PIN for sensitive actions')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', { name: /require pin for sensitive actions/i });
    expect(checkbox).toBeChecked();
  });

  it('shows Audit logging MANDATORY badge in a green section', async () => {
    resolveLoad();
    await renderAndWait();

    expect(screen.getByText('Audit logging')).toBeInTheDocument();
    expect(screen.getByText('MANDATORY')).toBeInTheDocument();
    expect(
      screen.getByText(/Always enabled per HIPAA/)
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// 15–19. System Settings (super_admin conditional)
// ===========================================================================
describe('AdminSettingsPanel — system settings (role-gated)', () => {
  it('shows System Settings section for super_admin', async () => {
    mockAdminRole = 'super_admin';
    resolveLoad();
    await renderAndWait();

    expect(screen.getByText('System Settings')).toBeInTheDocument();
  });

  it('hides System Settings section for regular admin', async () => {
    mockAdminRole = 'admin';
    resolveLoad();
    await renderAndWait();

    expect(screen.queryByText('System Settings')).not.toBeInTheDocument();
  });

  it('displays "Super Admin" badge in system settings header', async () => {
    mockAdminRole = 'super_admin';
    resolveLoad();
    await renderAndWait();

    expect(screen.getByText('Super Admin')).toBeInTheDocument();
  });

  it('shows Database backups MANAGED badge', async () => {
    mockAdminRole = 'super_admin';
    resolveLoad();
    await renderAndWait();

    expect(screen.getByText('Database backups')).toBeInTheDocument();
    expect(screen.getByText('MANAGED')).toBeInTheDocument();
  });

  it('renders Enable beta features checkbox for super_admin', async () => {
    mockAdminRole = 'super_admin';
    resolveLoad(makeDbSettings({ enable_beta_features: true }));
    await renderAndWait();

    const checkbox = screen.getByRole('checkbox', { name: /enable beta features/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });
});

// ===========================================================================
// 20–21. Action buttons
// ===========================================================================
describe('AdminSettingsPanel — action buttons', () => {
  it('renders Apply Settings button', async () => {
    resolveLoad();
    await renderAndWait();

    expect(screen.getByRole('button', { name: /apply settings/i })).toBeInTheDocument();
  });

  it('renders Reset to Defaults button', async () => {
    resolveLoad();
    await renderAndWait();

    expect(screen.getByRole('button', { name: /reset to defaults/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// 22. Settings load from database on mount
// ===========================================================================
describe('AdminSettingsPanel — database loading', () => {
  it('queries admin_settings table on mount with user id', async () => {
    resolveLoad();
    await renderAndWait();

    expect(mockFrom).toHaveBeenCalledWith('admin_settings');
    expect(mockSelect).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-test-001');
    expect(mockMaybeSingle).toHaveBeenCalled();
  });
});

// ===========================================================================
// 23. Save calls upsert with correct data
// ===========================================================================
describe('AdminSettingsPanel — save settings', () => {
  it('calls upsert with flattened settings data when Apply is clicked', async () => {
    resolveLoad();
    mockUpsert.mockResolvedValueOnce({ error: null });
    await renderAndWait();

    const applyBtn = screen.getByRole('button', { name: /apply settings/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });

    const upsertCall = mockUpsert.mock.calls[0];
    const savedData = upsertCall[0] as Record<string, unknown>;

    expect(savedData).toMatchObject({
      user_id: 'user-test-001',
      theme: 'light',
      email_notifications: true,
      browser_notifications: true,
      emergency_alerts: true,
      session_timeout: 30,
      require_pin_for_sensitive: true,
      enable_audit_logging: true,
      compact_mode: false,
      show_advanced_metrics: true,
      default_dashboard_view: 'overview',
      auto_backup: true,
      backup_frequency: 'daily',
      enable_beta_features: false,
    });

    // Verify onConflict option
    const upsertOptions = upsertCall[1] as Record<string, unknown>;
    expect(upsertOptions).toEqual({ onConflict: 'user_id' });
  });
});

// ===========================================================================
// 24. Error on save shows alert
// ===========================================================================
describe('AdminSettingsPanel — save error', () => {
  it('shows alert when upsert returns an error', async () => {
    resolveLoad();
    mockUpsert.mockResolvedValueOnce({ error: { message: 'write failed' } });
    await renderAndWait();

    const applyBtn = screen.getByRole('button', { name: /apply settings/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to save settings. Please try again.');
    });
  });

  it('shows alert when upsert throws an exception', async () => {
    resolveLoad();
    mockUpsert.mockRejectedValueOnce(new Error('network error'));
    await renderAndWait();

    const applyBtn = screen.getByRole('button', { name: /apply settings/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to save settings. Please try again.');
    });
  });
});

// ===========================================================================
// 25. Theme buttons change active state on click
// ===========================================================================
describe('AdminSettingsPanel — theme interaction', () => {
  it('clicking dark theme button changes its styling to active', async () => {
    resolveLoad();
    await renderAndWait();

    const darkBtn = screen.getByRole('button', { name: /dark/i });
    fireEvent.click(darkBtn);

    await waitFor(() => {
      expect(darkBtn.className).toContain('border-[var(--ea-primary');
    });

    const lightBtn = screen.getByRole('button', { name: /light/i });
    expect(lightBtn.className).not.toContain('border-[var(--ea-primary');
  });
});

// ===========================================================================
// 26. Dark theme applies 'dark' class to documentElement
// ===========================================================================
describe('AdminSettingsPanel — dark theme DOM effect', () => {
  it('adds "dark" class to document.documentElement when dark theme is selected', async () => {
    resolveLoad();
    await renderAndWait();

    const darkBtn = screen.getByRole('button', { name: /dark/i });
    fireEvent.click(darkBtn);

    await waitFor(() => {
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
    });
  });
});

// ===========================================================================
// 27. localStorage sync on theme change
// ===========================================================================
describe('AdminSettingsPanel — localStorage sync', () => {
  it('saves selected theme to localStorage', async () => {
    resolveLoad();
    await renderAndWait();

    const darkBtn = screen.getByRole('button', { name: /dark/i });
    fireEvent.click(darkBtn);

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('admin_theme', 'dark');
    });
  });
});

// ===========================================================================
// 28–30. Section headers with emoji prefixes
// ===========================================================================
describe('AdminSettingsPanel — section headers', () => {
  it('renders Appearance section header', async () => {
    resolveLoad();
    await renderAndWait();

    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('renders Notifications section header', async () => {
    resolveLoad();
    await renderAndWait();

    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('renders Security section header', async () => {
    resolveLoad();
    await renderAndWait();

    expect(screen.getByText('Security')).toBeInTheDocument();
  });
});

// ===========================================================================
// 31. "Applying..." button text during save
// ===========================================================================
describe('AdminSettingsPanel — save button state', () => {
  it('shows "Applying..." text while save is in progress', async () => {
    resolveLoad();
    // Create a promise we control to keep save in-flight
    let resolveUpsert: (value: { error: null }) => void = () => {};
    const upsertPromise = new Promise<{ error: null }>((resolve) => {
      resolveUpsert = resolve;
    });
    mockUpsert.mockReturnValueOnce(upsertPromise);
    await renderAndWait();

    const applyBtn = screen.getByRole('button', { name: /apply settings/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /applying/i })).toBeInTheDocument();
    });

    // The button should be disabled during save
    expect(screen.getByRole('button', { name: /applying/i })).toBeDisabled();

    // Resolve to clean up
    resolveUpsert({ error: null });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /apply settings/i })).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 32. "Last saved" timestamp after successful save
// ===========================================================================
describe('AdminSettingsPanel — last saved timestamp', () => {
  it('displays "Last saved" timestamp after successful save', async () => {
    resolveLoad();
    mockUpsert.mockResolvedValueOnce({ error: null });
    await renderAndWait();

    // Before save there should be no "Last saved" text
    expect(screen.queryByText(/last saved/i)).not.toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /apply settings/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/last saved/i)).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// Additional behavioral tests
// ===========================================================================
describe('AdminSettingsPanel — reset to defaults', () => {
  it('calls window.confirm when Reset to Defaults is clicked', async () => {
    resolveLoad(makeDbSettings({ theme: 'dark', compact_mode: true }));
    await renderAndWait();

    const resetBtn = screen.getByRole('button', { name: /reset to defaults/i });
    fireEvent.click(resetBtn);

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to reset all settings to defaults? This cannot be undone.'
    );
  });

  it('resets all settings to defaults when user confirms', async () => {
    resolveLoad(makeDbSettings({ theme: 'dark', compact_mode: true, show_advanced_metrics: false }));
    await renderAndWait();

    // Verify non-default state is loaded
    const compactCheckbox = screen.getByRole('checkbox', { name: /compact mode/i });
    expect(compactCheckbox).toBeChecked();

    // Confirm the reset
    vi.mocked(window.confirm).mockReturnValueOnce(true);

    const resetBtn = screen.getByRole('button', { name: /reset to defaults/i });
    fireEvent.click(resetBtn);

    // After reset, compact mode should be unchecked (default = false)
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /compact mode/i })).not.toBeChecked();
    });

    // Show advanced metrics should be checked (default = true)
    expect(screen.getByRole('checkbox', { name: /show advanced metrics/i })).toBeChecked();

    // Theme should revert to light (active styling)
    const lightBtn = screen.getByRole('button', { name: /light/i });
    expect(lightBtn.className).toContain('border-[var(--ea-primary');
  });

  it('does not reset settings when user cancels confirm dialog', async () => {
    resolveLoad(makeDbSettings({ compact_mode: true }));
    await renderAndWait();

    vi.mocked(window.confirm).mockReturnValueOnce(false);

    const resetBtn = screen.getByRole('button', { name: /reset to defaults/i });
    fireEvent.click(resetBtn);

    // Compact mode should remain checked (not reset)
    expect(screen.getByRole('checkbox', { name: /compact mode/i })).toBeChecked();
  });
});

describe('AdminSettingsPanel — loads with error gracefully', () => {
  it('renders with defaults when database load returns an error', async () => {
    resolveLoadError();
    await renderAndWait();

    // Should still render the panel with default values
    expect(screen.getByText('Admin Settings')).toBeInTheDocument();

    // Default theme is light — should be active
    const lightBtn = screen.getByRole('button', { name: /light/i });
    expect(lightBtn.className).toContain('border-[var(--ea-primary');
  });
});

describe('AdminSettingsPanel — checkbox toggles update state', () => {
  it('toggling email notifications unchecks the checkbox', async () => {
    resolveLoad();
    await renderAndWait();

    const emailCheckbox = screen.getByRole('checkbox', { name: /email notifications/i });
    expect(emailCheckbox).toBeChecked();

    fireEvent.click(emailCheckbox);
    expect(emailCheckbox).not.toBeChecked();
  });

  it('toggling browser notifications unchecks the checkbox', async () => {
    resolveLoad();
    await renderAndWait();

    const browserCheckbox = screen.getByRole('checkbox', { name: /browser notifications/i });
    expect(browserCheckbox).toBeChecked();

    fireEvent.click(browserCheckbox);
    expect(browserCheckbox).not.toBeChecked();
  });

  it('toggling require PIN unchecks the checkbox', async () => {
    resolveLoad();
    await renderAndWait();

    const pinCheckbox = screen.getByRole('checkbox', { name: /require pin for sensitive actions/i });
    expect(pinCheckbox).toBeChecked();

    fireEvent.click(pinCheckbox);
    expect(pinCheckbox).not.toBeChecked();
  });
});

describe('AdminSettingsPanel — dispatches StorageEvent on theme change', () => {
  it('dispatches a StorageEvent for admin_theme when theme changes', async () => {
    resolveLoad();
    await renderAndWait();

    const autoBtn = screen.getByRole('button', { name: /auto/i });
    fireEvent.click(autoBtn);

    await waitFor(() => {
      const dispatchCalls = vi.mocked(window.dispatchEvent).mock.calls;
      const storageEvents = dispatchCalls.filter(
        ([event]) => event instanceof StorageEvent && (event as StorageEvent).key === 'admin_theme'
      );
      expect(storageEvents.length).toBeGreaterThan(0);
    });
  });
});
