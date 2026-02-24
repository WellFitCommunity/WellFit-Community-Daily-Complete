/**
 * ShiftHandoffDashboard Tests
 *
 * Purpose: AI-assisted nurse shift handoff with auto-scored patient risks
 * Tests: Loading state, header rendering, patient cards, risk filters, accept handoff,
 *        unit filter, AI summary panel, decomposed component integration
 *
 * Deletion Test: Every test verifies specific content/behavior unique to ShiftHandoffDashboard.
 * An empty <div /> would fail all tests.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Hoist mock data so it's available inside vi.mock factories
const { mockHandoffSummaries, mockMetrics, mockAISummary } = vi.hoisted(() => ({
  mockHandoffSummaries: [
    {
      patient_id: 'patient-1',
      patient_name: 'Test Patient Alpha',
      room_number: '301',
      risk_score_id: 'score-1',
      auto_composite_score: 85,
      final_risk_level: 'CRITICAL' as const,
      auto_risk_level: 'CRITICAL' as const,
      nurse_reviewed: false,
      nurse_adjusted: false,
      handoff_priority: 1,
      risk_factors: ['fall_risk', 'medication_change'],
      clinical_snapshot: {
        diagnosis: 'CHF Exacerbation',
        bp_trend: '140/90',
        o2_sat: '92%',
        heart_rate: 102,
        prn_meds_today: 2,
      },
      recent_events: null,
    },
    {
      patient_id: 'patient-2',
      patient_name: 'Test Patient Beta',
      room_number: '205',
      risk_score_id: 'score-2',
      auto_composite_score: 45,
      final_risk_level: 'MEDIUM' as const,
      auto_risk_level: 'MEDIUM' as const,
      nurse_reviewed: true,
      nurse_adjusted: false,
      handoff_priority: 3,
      risk_factors: [],
      clinical_snapshot: {
        diagnosis: 'Post-op recovery',
        bp_trend: '120/80',
        o2_sat: '98%',
        heart_rate: 72,
        prn_meds_today: 0,
      },
      recent_events: null,
    },
  ],
  mockMetrics: {
    total_patients: 2,
    critical_patients: 1,
    high_risk_patients: 0,
    pending_nurse_review: 1,
    nurse_adjusted_count: 0,
    avg_auto_score: 65,
  },
  mockAISummary: {
    id: 'summary-1',
    shift_date: '2026-02-24',
    shift_type: 'night',
    unit_name: 'ICU',
    executive_summary: 'Two patients on unit. One critical CHF exacerbation requiring close monitoring.',
    critical_alerts: [
      { patientId: 'patient-1', alert: 'Oxygen saturation trending down', severity: 'high', timeframe: 'Last 2 hours' },
    ],
    high_risk_patients: [],
    medication_alerts: [
      { patientId: 'patient-1', alert: 'Furosemide dose increased', followUp: 'Monitor urine output q2h' },
    ],
    behavioral_concerns: [],
    pending_tasks: [
      { task: 'Follow-up chest X-ray', priority: 'high', deadline: '0600' },
    ],
    patient_count: 2,
    high_risk_patient_count: 1,
    acknowledged_by: null,
    acknowledged_at: null,
    generated_at: '2026-02-24T02:00:00Z',
  },
}));

// Mock user context
vi.mock('../../../contexts/AuthContext', () => ({
  useUser: () => ({
    id: 'nurse-user-id',
    email: 'nurse@test.com',
    user_metadata: { full_name: 'Test Nurse Alpha' },
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

// Mock keyboard shortcuts
vi.mock('../../envision-atlus/EAKeyboardShortcutsProvider', () => ({
  useKeyboardShortcutsContextSafe: () => null,
}));

// Mock ShiftHandoffService
vi.mock('../../../services/shiftHandoffService', () => ({
  ShiftHandoffService: {
    getCurrentShiftHandoff: vi.fn().mockResolvedValue(mockHandoffSummaries),
    getHandoffDashboardMetrics: vi.fn().mockResolvedValue(mockMetrics),
    getNurseBypassCount: vi.fn().mockResolvedValue(0),
    getAvailableUnits: vi.fn().mockResolvedValue(['ICU', 'Med-Surg', 'ED']),
    getAIShiftSummary: vi.fn().mockResolvedValue(mockAISummary),
    nurseReviewHandoffRisk: vi.fn().mockResolvedValue(undefined),
    bulkConfirmAutoScores: vi.fn().mockResolvedValue(undefined),
    refreshAllAutoScores: vi.fn().mockResolvedValue(undefined),
    recordHandoffTimeSavings: vi.fn().mockResolvedValue({
      time_saved_minutes: 20,
      efficiency_percent: 80,
    }),
    logEmergencyBypass: vi.fn().mockResolvedValue({
      bypass_number: 1,
      weekly_total: 1,
    }),
  },
}));

// Mock shiftHandoff types utilities
vi.mock('../../../types/shiftHandoff', async () => {
  const actual = await vi.importActual('../../../types/shiftHandoff');
  return { ...actual };
});

// Mock child components
vi.mock('../HandoffCelebration', () => ({
  __esModule: true,
  default: () => <div data-testid="handoff-celebration">Celebration</div>,
}));

vi.mock('../HandoffBypassModal', () => ({
  __esModule: true,
  default: () => <div data-testid="handoff-bypass-modal">Bypass Modal</div>,
  BypassFormData: {},
}));

vi.mock('../../shared/PersonalizedGreeting', () => ({
  __esModule: true,
  default: () => <div data-testid="personalized-greeting">Greeting</div>,
}));

vi.mock('../../../services/providerAffirmations', () => ({
  getProviderAffirmation: vi.fn().mockReturnValue('Great work!'),
  AffirmationCategory: {},
}));

vi.mock('../../envision-atlus/EAAffirmationToast', () => ({
  EAAffirmationToast: () => <div data-testid="affirmation-toast">Toast</div>,
}));

vi.mock('../../../hooks/usePresence', () => ({
  usePresence: () => ({
    otherUsers: [],
    currentUser: null,
  }),
}));

vi.mock('../../collaboration', () => ({
  PresenceAvatars: () => <div data-testid="presence-avatars" />,
  ActivityFeed: () => <div data-testid="activity-feed" />,
  useActivityBroadcast: () => ({ broadcast: vi.fn() }),
}));

vi.mock('../../patient-avatar', () => ({
  AvatarThumbnail: () => <div data-testid="avatar-thumbnail" />,
}));

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

describe('ShiftHandoffDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderDashboard() {
    const mod = await import('../ShiftHandoffDashboard');
    const Component = mod.ShiftHandoffDashboard || mod.default;
    return render(<Component />);
  }

  it('renders header with Smart Shift Handoff title and shift selectors', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Smart Shift Handoff')).toBeInTheDocument();
    });

    expect(screen.getByText('Day Shift')).toBeInTheDocument();
    expect(screen.getByText('Evening Shift')).toBeInTheDocument();
    expect(screen.getByText('Night Shift')).toBeInTheDocument();
  });

  it('displays patient cards with names and risk levels after loading', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Test Patient Alpha/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Test Patient Beta/)).toBeInTheDocument();
    expect(screen.getByText(/CRITICAL/)).toBeInTheDocument();
    expect(screen.getByText(/MEDIUM/)).toBeInTheDocument();
  });

  it('shows risk filter buttons (All, High+, Critical)', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('All (Shift+A)')).toBeInTheDocument();
    });

    expect(screen.getByText('High+ (Shift+H)')).toBeInTheDocument();
    expect(screen.getByText('Critical (Shift+C)')).toBeInTheDocument();
  });

  it('shows Accept Handoff button', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Accept Handoff')).toBeInTheDocument();
    });
  });

  it('displays dashboard metrics bar with patient counts', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Total Patients')).toBeInTheDocument();
    });

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
    expect(screen.getByText('Nurse Adjusted')).toBeInTheDocument();
  });

  it('renders unit filter dropdown with available units', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by hospital unit')).toBeInTheDocument();
    });

    const unitSelect = screen.getByLabelText('Filter by hospital unit') as HTMLSelectElement;
    expect(unitSelect.options.length).toBe(4); // All Units + ICU + Med-Surg + ED
    expect(unitSelect.options[0].textContent).toBe('All Units');
    expect(unitSelect.options[1].textContent).toBe('ICU');
  });

  it('renders AI Summary Panel with executive summary content', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('AI Shift Summary')).toBeInTheDocument();
    });

    expect(screen.getByText('2 patients analyzed')).toBeInTheDocument();
  });

  it('expands AI Summary Panel to show alerts and tasks', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('AI Shift Summary')).toBeInTheDocument();
    });

    // Click to expand
    fireEvent.click(screen.getByText('AI Shift Summary'));

    await waitFor(() => {
      expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    });

    expect(screen.getByText(/Two patients on unit/)).toBeInTheDocument();
    expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
    expect(screen.getByText('Oxygen saturation trending down')).toBeInTheDocument();
    expect(screen.getByText('Medication Alerts')).toBeInTheDocument();
    expect(screen.getByText('Furosemide dose increased')).toBeInTheDocument();
    expect(screen.getByText('Pending Tasks')).toBeInTheDocument();
    expect(screen.getByText('Follow-up chest X-ray')).toBeInTheDocument();
  });

  it('shows clinical data for critical patients (BP, O2, HR, PRN)', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('CHF Exacerbation')).toBeInTheDocument();
    });

    expect(screen.getByText('140/90')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('shows risk factors as badges on high-acuity patients', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('fall risk')).toBeInTheDocument();
    });

    expect(screen.getByText('medication change')).toBeInTheDocument();
  });

  it('shows NEEDS REVIEW badge for unreviewed patients', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('NEEDS REVIEW')).toBeInTheDocument();
    });
  });

  it('separates patients into High Acuity and Standard Acuity sections', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/HIGH ACUITY/)).toBeInTheDocument();
    });

    expect(screen.getByText('Standard Acuity')).toBeInTheDocument();
  });
});
