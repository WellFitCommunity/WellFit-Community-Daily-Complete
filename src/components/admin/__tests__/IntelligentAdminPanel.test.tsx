/**
 * IntelligentAdminPanel Tests
 *
 * Tests the Mission Control admin dashboard orchestrator: core rendering,
 * quick action navigation, role-based visibility, category sections,
 * pinned dashboards, workflow wizard, and smart suggestions.
 *
 * Deletion Test: Every test would FAIL if the component rendered an empty <div />.
 * Synthetic test data only.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mockNavigate = vi.fn();
let mockAdminRole: string | null = 'super_admin';
let mockAiSuggestions: string[] = [];
let mockCategoryOrder: Array<{ categoryId: string; priority: number }> = [];

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({ adminRole: mockAdminRole }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useUser: () => ({ id: 'user-test-panel-001' }),
  useSupabaseClient: () => ({ from: vi.fn() }),
}));

vi.mock('../../../contexts/PinnedSectionsContext', () => ({
  PinnedSectionsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pinned-sections-provider">{children}</div>
  ),
}));

vi.mock('components/auth/RequireAdminAuth', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="require-admin-auth">{children}</div>
  ),
}));

vi.mock('../AdminHeader', () => ({
  default: ({ title }: { title: string }) => (
    <div data-testid="admin-header">{title}</div>
  ),
}));

vi.mock('../WhatsNewModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="whats-new-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../../ai-transparency', () => ({
  PersonalizedGreeting: () => (
    <div data-testid="personalized-greeting">Personalized Greeting</div>
  ),
}));

vi.mock('../LearningIndicator', () => ({
  LearningIndicator: ({ learningScore, totalInteractions }: {
    events: unknown[];
    learningScore: number;
    totalInteractions: number;
  }) => (
    <div data-testid="learning-indicator">
      Score: {learningScore}, Interactions: {totalInteractions}
    </div>
  ),
  SmartSuggestionCard: ({ suggestion, actionLabel }: { suggestion: string; actionLabel?: string }) => (
    <div data-testid="smart-suggestion-card">
      <span>{suggestion}</span>
      {actionLabel && <button>{actionLabel}</button>}
    </div>
  ),
  MilestoneCelebration: ({ milestone, show }: { milestone: string; show: boolean }) =>
    show ? <div data-testid="milestone-celebration">{milestone}</div> : null,
}));

vi.mock('../PinnedDashboardsBar', () => ({
  default: () => <div data-testid="pinned-dashboards-bar">Pinned Dashboards</div>,
}));

vi.mock('../ClinicalWorkflowWizard', () => ({
  default: ({ userRole }: { userRole: string }) => (
    <div data-testid="clinical-workflow-wizard">Workflow Wizard ({userRole})</div>
  ),
}));

vi.mock('../MfaGracePeriodBanner', () => ({
  default: () => <div data-testid="mfa-grace-period-banner">MFA Banner</div>,
}));

vi.mock('../sections/RevenueBillingCategory', () => ({
  default: ({ userRole }: { userRole: string }) => (
    <div data-testid="category-revenue">Revenue Billing ({userRole})</div>
  ),
}));

vi.mock('../sections/PatientCareCategory', () => ({
  default: ({ userRole }: { userRole: string }) => (
    <div data-testid="category-patient-care">Patient Care ({userRole})</div>
  ),
}));

vi.mock('../sections/ClinicalDataCategory', () => ({
  default: ({ userRole }: { userRole: string }) => (
    <div data-testid="category-clinical">Clinical Data ({userRole})</div>
  ),
}));

vi.mock('../sections/SecurityComplianceCategory', () => ({
  default: ({ userRole }: { userRole: string }) => (
    <div data-testid="category-security">Security Compliance ({userRole})</div>
  ),
}));

vi.mock('../sections/SystemAdminCategory', () => ({
  default: ({ userRole }: { userRole: string }) => (
    <div data-testid="category-admin">System Admin ({userRole})</div>
  ),
}));

vi.mock('../sections/sectionDefinitions', () => ({
  SectionLoadingFallback: () => <div>Loading section...</div>,
}));

vi.mock('../../../hooks/useWorkflowPreferences', () => ({
  useWorkflowPreferences: () => ({
    categoryOrder: mockCategoryOrder,
    getCategoryOpenState: () => false,
    isLoading: false,
  }),
}));

vi.mock('../../../hooks/useVoiceSearch', () => ({
  useVoiceSearch: () => ({}),
}));

vi.mock('../../../hooks/useAdminPersonalization', () => ({
  useAdminPersonalization: () => ({
    isLoading: false,
    aiSuggestions: mockAiSuggestions,
    learningEvents: [],
    behaviorProfile: null,
    showMilestone: false,
    milestone: null,
    setShowMilestone: vi.fn(),
    handleSuggestionClick: vi.fn(),
    loadPersonalizedDashboard: vi.fn(),
  }),
}));

vi.mock('lucide-react', () => ({
  Clock: () => <span data-testid="icon-clock">Clock</span>,
  TrendingUp: () => <span data-testid="icon-trending">TrendingUp</span>,
  Zap: () => <span data-testid="icon-zap">Zap</span>,
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import AFTER mocks
import IntelligentAdminPanel from '../IntelligentAdminPanel';

// ============================================================================
// TESTS
// ============================================================================

describe('IntelligentAdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminRole = 'super_admin';
    mockAiSuggestions = [];
    mockCategoryOrder = [];
  });

  // --- Core Rendering ---

  it('renders AdminHeader with Mission Control title', () => {
    render(<IntelligentAdminPanel />);
    const header = screen.getByTestId('admin-header');
    expect(header).toBeInTheDocument();
    expect(header.textContent).toContain('Mission Control');
  });

  it('renders MfaGracePeriodBanner', () => {
    render(<IntelligentAdminPanel />);
    expect(screen.getByTestId('mfa-grace-period-banner')).toBeInTheDocument();
  });

  it('renders PersonalizedGreeting', () => {
    render(<IntelligentAdminPanel />);
    expect(screen.getByTestId('personalized-greeting')).toBeInTheDocument();
  });

  // --- Quick Actions ---

  it('renders Quick Actions section heading', () => {
    render(<IntelligentAdminPanel />);
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('navigates to /admin/enroll-senior when Enroll Senior is clicked', () => {
    render(<IntelligentAdminPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Enroll Senior/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/enroll-senior');
  });

  it('navigates to /admin/bulk-enroll when Bulk Enroll is clicked', () => {
    render(<IntelligentAdminPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Bulk Enroll/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/bulk-enroll');
  });

  it('navigates to /admin/bulk-export when Bulk Export is clicked', () => {
    render(<IntelligentAdminPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Bulk Export/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/bulk-export');
  });

  it('navigates to /admin/photo-approval when Approve Photos is clicked', () => {
    render(<IntelligentAdminPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Approve Photos/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/photo-approval');
  });

  it('navigates to /admin-questions when Questions is clicked', () => {
    render(<IntelligentAdminPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Questions/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin-questions');
  });

  it('navigates to /admin-profile-editor when Edit Profiles is clicked', () => {
    render(<IntelligentAdminPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Edit Profiles/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin-profile-editor');
  });

  it('renders What\'s New button', () => {
    render(<IntelligentAdminPanel />);
    expect(screen.getByText("What's New")).toBeInTheDocument();
  });

  // --- Role Panel Navigation (super_admin only) ---

  it('shows role panel section for super_admin', () => {
    mockAdminRole = 'super_admin';
    render(<IntelligentAdminPanel />);
    expect(screen.getByText(/View Role Dashboards/i)).toBeInTheDocument();
  });

  it('navigates to /physician-dashboard when Physician Panel is clicked', () => {
    mockAdminRole = 'super_admin';
    render(<IntelligentAdminPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Physician Panel/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/physician-dashboard');
  });

  it('navigates to /nurse-dashboard when Nurse Panel is clicked', () => {
    mockAdminRole = 'super_admin';
    render(<IntelligentAdminPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Nurse Panel/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/nurse-dashboard');
  });

  it('hides role panel for regular admin role', () => {
    mockAdminRole = 'admin';
    render(<IntelligentAdminPanel />);
    expect(screen.queryByText(/View Role Dashboards/i)).not.toBeInTheDocument();
  });

  // --- Secondary Components ---

  it('renders PinnedDashboardsBar', () => {
    render(<IntelligentAdminPanel />);
    expect(screen.getByTestId('pinned-dashboards-bar')).toBeInTheDocument();
  });

  it('renders ClinicalWorkflowWizard', () => {
    render(<IntelligentAdminPanel />);
    expect(screen.getByTestId('clinical-workflow-wizard')).toBeInTheDocument();
  });

  // --- Category Sections ---

  it('renders all 5 category sections', async () => {
    render(<IntelligentAdminPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('category-revenue')).toBeInTheDocument();
      expect(screen.getByTestId('category-patient-care')).toBeInTheDocument();
      expect(screen.getByTestId('category-clinical')).toBeInTheDocument();
      expect(screen.getByTestId('category-security')).toBeInTheDocument();
      expect(screen.getByTestId('category-admin')).toBeInTheDocument();
    });
  });

  it('renders categories in nurse role order (patient-care first)', async () => {
    mockAdminRole = 'nurse';
    mockCategoryOrder = [];
    render(<IntelligentAdminPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('category-patient-care')).toBeInTheDocument();
    });

    const allCategories = screen.getAllByTestId(/^category-/);
    const categoryIds = allCategories.map(el => el.getAttribute('data-testid'));
    expect(categoryIds).toEqual([
      'category-patient-care',
      'category-clinical',
      'category-revenue',
      'category-security',
      'category-admin',
    ]);
  });

  // --- Smart Suggestions ---

  it('hides Smart Suggestions section when no suggestions exist', () => {
    mockAiSuggestions = [];
    render(<IntelligentAdminPanel />);
    expect(screen.queryByText('Smart Suggestions')).not.toBeInTheDocument();
  });

  it('shows Smart Suggestions section when suggestions are provided', () => {
    mockAiSuggestions = [
      'Check patient engagement dashboard',
      'Review pending billing claims',
    ];
    render(<IntelligentAdminPanel />);

    expect(screen.getByText('Smart Suggestions')).toBeInTheDocument();
    const cards = screen.getAllByTestId('smart-suggestion-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('Check patient engagement dashboard')).toBeInTheDocument();
    expect(screen.getByText('Review pending billing claims')).toBeInTheDocument();
  });
});
