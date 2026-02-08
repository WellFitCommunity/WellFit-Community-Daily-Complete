/**
 * PhysicianPanel Tests
 *
 * Purpose: Physician command center with patient selection, clinical tools, telehealth
 * Tests: Dashboard rendering, quick stats, clinical tools disabled state, patient selector, sections
 *
 * Deletion Test: Every test verifies specific content/behavior unique to PhysicianPanel.
 * An empty <div /> would fail all tests.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Track navigate calls
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/physician' }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

// Mock AuthContext
const mockFrom = vi.fn(() => ({
  select: vi.fn().mockReturnThis(),
  or: vi.fn().mockResolvedValue({ count: 42, error: null }),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: mockFrom,
  }),
}));

// Mock PatientContext
vi.mock('../../../contexts/PatientContext', () => ({
  usePatientContext: () => ({
    selectPatient: vi.fn(),
    selectedPatient: null,
    patientHistory: [],
    clearPatient: vi.fn(),
  }),
  SelectedPatient: {},
}));

// Mock FHIRService
vi.mock('../../../services/fhirResourceService', () => ({
  FHIRService: {
    Observation: {
      getVitalSigns: vi.fn().mockResolvedValue({ data: [], error: null }),
    },
    Condition: {
      getActive: vi.fn().mockResolvedValue({ data: [], error: null }),
    },
    MedicationRequest: {
      getActive: vi.fn().mockResolvedValue({ data: [], error: null }),
    },
  },
}));

// Mock SDOH Billing Service
vi.mock('../../../services/sdohBillingService', () => ({
  SDOHBillingService: {
    assessSDOHComplexity: vi.fn().mockResolvedValue(null),
  },
}));

// Mock AdminHeader
vi.mock('../../admin/AdminHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div data-testid="admin-header">{title}</div>,
}));

// Mock extracted sub-components
vi.mock('../components/CollapsibleSection', () => ({
  CollapsibleSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid={`collapsible-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('../components/PatientSelector', () => ({
  PatientSelector: () => <div data-testid="patient-selector">Patient Selector</div>,
}));

vi.mock('../components/PatientSummaryCard', () => ({
  PatientSummaryCard: ({ loading }: { loading: boolean }) => (
    <div data-testid="patient-summary-card">{loading ? 'Loading...' : 'Summary'}</div>
  ),
}));

// Mock AI Transparency components
vi.mock('../../ai-transparency', () => ({
  PersonalizedGreeting: () => <div data-testid="personalized-greeting">Hello Doctor</div>,
  DashboardPersonalizationIndicator: () => <div data-testid="dashboard-personalization" />,
  VoiceProfileMaturity: () => <div data-testid="voice-profile-maturity" />,
}));

// Mock Cognitive Load components
vi.mock('../CommandPalette', () => ({
  CommandPalette: () => <div data-testid="command-palette">Command Palette</div>,
}));

vi.mock('../WorkflowModeSwitcher', () => ({
  WorkflowModeSwitcher: () => <div data-testid="workflow-mode-switcher">Mode Switcher</div>,
}));

// Mock heavy child components
vi.mock('../../UserQuestions', () => ({
  __esModule: true,
  default: () => <div data-testid="user-questions">User Questions</div>,
}));

vi.mock('../../smart/RealTimeSmartScribe', () => ({
  __esModule: true,
  default: () => <div data-testid="smart-scribe">SmartScribe</div>,
}));

vi.mock('../../admin/RiskAssessmentManager', () => ({
  __esModule: true,
  default: () => <div data-testid="risk-assessment">Risk Assessment</div>,
}));

vi.mock('../../admin/ReportsSection', () => ({
  __esModule: true,
  default: () => <div data-testid="reports-section">Reports</div>,
}));

vi.mock('../../atlas/CCMTimeline', () => ({
  __esModule: true,
  default: () => <div data-testid="ccm-timeline">CCM Timeline</div>,
}));

vi.mock('../PhysicianWellnessHub', () => ({
  PhysicianWellnessHub: () => <div data-testid="wellness-hub">Wellness Hub</div>,
}));

vi.mock('../../telehealth/TelehealthConsultation', () => ({
  __esModule: true,
  default: () => <div data-testid="telehealth-consultation">Telehealth</div>,
}));

vi.mock('../../telehealth/TelehealthScheduler', () => ({
  __esModule: true,
  default: () => <div data-testid="telehealth-scheduler">Telehealth Scheduler</div>,
}));

vi.mock('../PhysicianClinicalResources', () => ({
  __esModule: true,
  default: () => <div data-testid="clinical-resources">Clinical Resources</div>,
}));

vi.mock('../../claude-care/ClaudeCareAssistantPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="claude-care-assistant">Claude Care</div>,
}));

vi.mock('../../chw/CHWAlertsWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="chw-alerts-widget">CHW Alerts</div>,
}));

// Mock lucide-react icons
vi.mock('lucide-react/dist/esm/icons/activity', () => ({ __esModule: true, default: () => <span data-testid="icon-activity" /> }));
vi.mock('lucide-react/dist/esm/icons/heart', () => ({ __esModule: true, default: () => <span data-testid="icon-heart" /> }));
vi.mock('lucide-react/dist/esm/icons/trending-up', () => ({ __esModule: true, default: () => <span data-testid="icon-trending" /> }));
vi.mock('lucide-react/dist/esm/icons/alert-triangle', () => ({ __esModule: true, default: () => <span data-testid="icon-alert" /> }));
vi.mock('lucide-react/dist/esm/icons/check-circle', () => ({ __esModule: true, default: () => <span data-testid="icon-check" /> }));
vi.mock('lucide-react/dist/esm/icons/users', () => ({ __esModule: true, default: () => <span data-testid="icon-users" /> }));
vi.mock('lucide-react/dist/esm/icons/file-text', () => ({ __esModule: true, default: () => <span data-testid="icon-file" /> }));
vi.mock('lucide-react/dist/esm/icons/stethoscope', () => ({ __esModule: true, default: () => <span data-testid="icon-stethoscope" /> }));
vi.mock('lucide-react/dist/esm/icons/pill', () => ({ __esModule: true, default: () => <span data-testid="icon-pill" /> }));
vi.mock('lucide-react/dist/esm/icons/clipboard-list', () => ({ __esModule: true, default: () => <span data-testid="icon-clipboard" /> }));
vi.mock('lucide-react/dist/esm/icons/brain', () => ({ __esModule: true, default: () => <span data-testid="icon-brain" /> }));
vi.mock('lucide-react/dist/esm/icons/award', () => ({ __esModule: true, default: () => <span data-testid="icon-award" /> }));
vi.mock('lucide-react/dist/esm/icons/video', () => ({ __esModule: true, default: () => <span data-testid="icon-video" /> }));

// Mock audit logger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    clinical: vi.fn(),
    auth: vi.fn(),
  },
}));

import PhysicianPanel from '../PhysicianPanel';

describe('PhysicianPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Physician Command Center title', async () => {
    render(<PhysicianPanel />);

    await waitFor(() => {
      expect(screen.getByText('Physician Command Center')).toBeInTheDocument();
    });
  });

  it('displays quick stats: Total Patients, CCM Eligible, Pending Reviews', async () => {
    render(<PhysicianPanel />);

    await waitFor(() => {
      expect(screen.getByText('Total Patients')).toBeInTheDocument();
    });
    expect(screen.getByText('CCM Eligible')).toBeInTheDocument();
    expect(screen.getByText('Pending Reviews')).toBeInTheDocument();
  });

  it('shows clinical tool buttons with correct labels', async () => {
    render(<PhysicianPanel />);

    await waitFor(() => {
      expect(screen.getByText('Clinical Tools & Medical Records')).toBeInTheDocument();
    });

    expect(screen.getByText('Patient Records')).toBeInTheDocument();
    expect(screen.getByText('Medications')).toBeInTheDocument();
    expect(screen.getByText('Care Plans')).toBeInTheDocument();
    expect(screen.getByText('Lab Results')).toBeInTheDocument();
    expect(screen.getByText('Immunizations')).toBeInTheDocument();
  });

  it('shows "Select a patient first" text on clinical tool buttons when no patient selected', async () => {
    render(<PhysicianPanel />);

    await waitFor(() => {
      expect(screen.getByText('Clinical Tools & Medical Records')).toBeInTheDocument();
    });

    const selectFirstMessages = screen.getAllByText('Select a patient first');
    // Multiple clinical tools show this message when no patient is selected
    expect(selectFirstMessages.length).toBeGreaterThanOrEqual(6);
  });

  it('renders the Patient Selection Required message for SmartScribe', async () => {
    render(<PhysicianPanel />);

    await waitFor(() => {
      expect(screen.getByText('Patient Selection Required')).toBeInTheDocument();
    });

    expect(screen.getByText(/select a patient from the list above/i)).toBeInTheDocument();
  });

  it('renders Safe Harbor footer text', async () => {
    render(<PhysicianPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Safe Harbor - Physician Panel/)).toBeInTheDocument();
    });

    expect(screen.getByText(/First, do no harm/)).toBeInTheDocument();
  });
});
