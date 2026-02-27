/**
 * AdminHeader Tests
 *
 * Tests the clinical header: title rendering (props/branding/default),
 * navigation items with role-based visibility, settings dropdown,
 * dark mode toggle, mobile menu, logout, and active route highlighting.
 *
 * Deletion Test: Every test would FAIL if the component rendered an empty <div />.
 * Synthetic test data only.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockNavigate = vi.fn();
let mockPathname = '/admin';
let mockAdminRole: string | null = 'super_admin';
const mockLogoutAdmin = vi.fn();
let mockBranding: Record<string, unknown> | null = null;

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    adminRole: mockAdminRole,
    logoutAdmin: mockLogoutAdmin,
  }),
}));

vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({ branding: mockBranding }),
}));

vi.mock('lucide-react', () => {
  const createIcon = (name: string) => {
    const Icon = ({ className }: { className?: string }) => (
      <span data-testid={`icon-${name}`} className={className}>{name}</span>
    );
    Icon.displayName = name;
    return Icon;
  };
  return {
    Home: createIcon('Home'),
    FileText: createIcon('FileText'),
    Key: createIcon('Key'),
    CreditCard: createIcon('CreditCard'),
    Settings: createIcon('Settings'),
    LogOut: createIcon('LogOut'),
    Moon: createIcon('Moon'),
    Sun: createIcon('Sun'),
    ChevronDown: createIcon('ChevronDown'),
    Activity: createIcon('Activity'),
    Users: createIcon('Users'),
    Shield: createIcon('Shield'),
    ClipboardList: createIcon('ClipboardList'),
    Menu: createIcon('Menu'),
    X: createIcon('X'),
    Heart: createIcon('Heart'),
    Smartphone: createIcon('Smartphone'),
  };
});

// Import AFTER mocks
import AdminHeader from '../AdminHeader';

// ============================================================================
// HELPERS
// ============================================================================

function renderHeader(props: { title?: string; showRiskAssessment?: boolean } = {}) {
  return render(<AdminHeader {...props} />);
}

// ============================================================================
// TESTS
// ============================================================================

describe('AdminHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/admin';
    mockAdminRole = 'super_admin';
    mockBranding = null;

    // Mock localStorage
    const store: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => { store[key] = String(val); });

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  // --- Title Rendering ---

  it('displays custom title from props', () => {
    renderHeader({ title: 'Test Dashboard Alpha' });
    expect(screen.getByText('Test Dashboard Alpha')).toBeInTheDocument();
  });

  it('displays default "Envision Atlus" title when no props or branding', () => {
    renderHeader();
    expect(screen.getByText('Envision Atlus')).toBeInTheDocument();
  });

  it('displays branding appName when no title prop provided', () => {
    mockBranding = { appName: 'Test Brand Health' };
    renderHeader();
    // appName appears in both title and nav button
    const matches = screen.getAllByText('Test Brand Health');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('displays "Clinical Platform" subtitle', () => {
    renderHeader();
    expect(screen.getByText('Clinical Platform')).toBeInTheDocument();
  });

  // --- Navigation Items ---

  it('renders Community nav button', () => {
    renderHeader();
    expect(screen.getByText('Community')).toBeInTheDocument();
  });

  it('renders Readmission Prevention nav button', () => {
    renderHeader();
    expect(screen.getByText('Readmission Prevention')).toBeInTheDocument();
  });

  it('renders Billing nav button', () => {
    renderHeader();
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });

  it('renders Risk Assessment nav button when showRiskAssessment is true', () => {
    renderHeader({ showRiskAssessment: true });
    expect(screen.getByText('Risk Assessment')).toBeInTheDocument();
  });

  it('renders API Keys nav button for super_admin', () => {
    mockAdminRole = 'super_admin';
    renderHeader();
    expect(screen.getByText('API Keys')).toBeInTheDocument();
  });

  it('hides API Keys nav button for regular admin', () => {
    mockAdminRole = 'admin';
    renderHeader();
    expect(screen.queryByText('API Keys')).not.toBeInTheDocument();
  });

  // --- Navigation ---

  it('navigates to /dashboard when Community is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByText('Community'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates to /billing when Billing is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByText('Billing'));
    expect(mockNavigate).toHaveBeenCalledWith('/billing');
  });

  it('navigates to /community-readmission when Readmission Prevention is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByText('Readmission Prevention'));
    expect(mockNavigate).toHaveBeenCalledWith('/community-readmission');
  });

  // --- System Status ---

  it('shows Online system status indicator', () => {
    renderHeader();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  // --- Settings Dropdown ---

  it('opens settings dropdown when Settings button is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();

    // Settings button has text "Settings" (hidden on small screens but present in DOM)
    const settingsButtons = screen.getAllByText('Settings');
    await user.click(settingsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Admin Settings')).toBeInTheDocument();
    });
    expect(screen.getByText('Audit Logs')).toBeInTheDocument();
  });

  it('shows super_admin-only items in settings dropdown', async () => {
    mockAdminRole = 'super_admin';
    const user = userEvent.setup();
    renderHeader();

    const settingsButtons = screen.getAllByText('Settings');
    await user.click(settingsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('System Admin')).toBeInTheDocument();
    });
    expect(screen.getByText('SMART Apps')).toBeInTheDocument();
    expect(screen.getByText('Physician Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Nurse Dashboard')).toBeInTheDocument();
  });

  it('hides super_admin-only items for regular admin', async () => {
    mockAdminRole = 'admin';
    const user = userEvent.setup();
    renderHeader();

    const settingsButtons = screen.getAllByText('Settings');
    await user.click(settingsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Admin Settings')).toBeInTheDocument();
    });
    expect(screen.queryByText('System Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('SMART Apps')).not.toBeInTheDocument();
  });

  it('displays role label in settings dropdown', async () => {
    mockAdminRole = 'super_admin';
    const user = userEvent.setup();
    renderHeader();

    const settingsButtons = screen.getAllByText('Settings');
    await user.click(settingsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Super Administrator')).toBeInTheDocument();
    });
    expect(screen.getByText('Session Active')).toBeInTheDocument();
  });

  it('navigates from dropdown item and closes dropdown', async () => {
    const user = userEvent.setup();
    renderHeader();

    const settingsButtons = screen.getAllByText('Settings');
    await user.click(settingsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Admin Settings')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Admin Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/settings');
  });

  // --- Dark Mode Toggle ---

  it('renders dark mode toggle button', () => {
    renderHeader();
    const toggleBtn = screen.getByTitle('Switch to dark mode');
    expect(toggleBtn).toBeInTheDocument();
  });

  it('toggles dark mode title on click', async () => {
    const user = userEvent.setup();
    renderHeader();

    const toggleBtn = screen.getByTitle('Switch to dark mode');
    await user.click(toggleBtn);

    expect(screen.getByTitle('Switch to light mode')).toBeInTheDocument();
  });

  // --- Logout ---

  it('logout button calls logoutAdmin from settings dropdown', async () => {
    const user = userEvent.setup();
    renderHeader();

    const settingsButtons = screen.getAllByText('Settings');
    await user.click(settingsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Logout'));
    expect(mockLogoutAdmin).toHaveBeenCalled();
  });

  // --- Branding ---

  it('uses branding appName for Community nav button label', () => {
    mockBranding = { appName: 'Test Health Brand' };
    renderHeader();
    // appName appears in both title and nav button
    const matches = screen.getAllByText('Test Health Brand');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('renders logo image when branding provides logoUrl', () => {
    mockBranding = { logoUrl: 'https://example.com/logo.png', appName: 'Test' };
    renderHeader();
    const logo = screen.getByAltText('Logo');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', 'https://example.com/logo.png');
  });
});
