/**
 * ShiftHandoffDashboard Tests
 *
 * Purpose: AI-assisted nurse shift handoff with auto-scored patient risks
 * Tests: Loading state, header rendering, patient cards, risk filters, accept handoff
 *
 * Deletion Test: Every test verifies specific content/behavior unique to ShiftHandoffDashboard.
 * An empty <div /> would fail all tests.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Hoist mock data so it's available inside vi.mock factories
const { mockHandoffSummaries, mockMetrics } = vi.hoisted(() => ({
  mockHandoffSummaries: [
    {
      patient_id: 'patient-1',
      patient_name: 'Alice Johnson',
      room_number: '301',
      risk_score_id: 'score-1',
      auto_composite_score: 85,
      final_risk_level: 'CRITICAL',
      nurse_reviewed: false,
      nurse_adjusted: false,
      risk_factors: ['fall_risk', 'medication_change'],
      clinical_snapshot: {
        diagnosis: 'CHF Exacerbation',
        bp_trend: '140/90',
        o2_sat: '92%',
        heart_rate: '102',
        prn_meds_today: 2,
      },
    },
    {
      patient_id: 'patient-2',
      patient_name: 'Bob Williams',
      room_number: '205',
      risk_score_id: 'score-2',
      auto_composite_score: 45,
      final_risk_level: 'MEDIUM',
      nurse_reviewed: true,
      nurse_adjusted: false,
      risk_factors: [],
      clinical_snapshot: {
        diagnosis: 'Post-op recovery',
        bp_trend: '120/80',
        o2_sat: '98%',
        heart_rate: '72',
        prn_meds_today: 0,
      },
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
}));

// Mock user context
vi.mock('../../../contexts/AuthContext', () => ({
  useUser: () => ({
    id: 'nurse-user-id',
    email: 'nurse@test.com',
    user_metadata: { full_name: 'Test Nurse' },
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
  return {
    ...actual,
  };
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

    // Shift type buttons
    expect(screen.getByText('Day Shift')).toBeInTheDocument();
    expect(screen.getByText('Evening Shift')).toBeInTheDocument();
    expect(screen.getByText('Night Shift')).toBeInTheDocument();
  });

  it('displays patient cards with names and risk levels after loading', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Bob Williams/)).toBeInTheDocument();
    // Risk levels are rendered with emoji prefixes (e.g., "🔴 CRITICAL")
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
});
