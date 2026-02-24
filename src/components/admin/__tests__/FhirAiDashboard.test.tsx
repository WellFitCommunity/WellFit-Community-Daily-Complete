/**
 * FhirAiDashboard tests -- validates loading/error states, population metrics,
 * risk matrix, predictive alerts, quick actions, patient list, quality metrics,
 * weekly reports, and refresh controls.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGeneratePopulationDashboard = vi.fn();
const mockAssessQualityMetrics = vi.fn();
const mockGenerateAutomatedReports = vi.fn();
const mockExportEnhancedPatientData = vi.fn();
const mockStartRealTimeMonitoring = vi.fn();
const mockValidateAndCleanData = vi.fn();

vi.mock('../EnhancedFhirService', () => {
  class MockEnhancedFhirService {
    generatePopulationDashboard = mockGeneratePopulationDashboard;
    assessQualityMetrics = mockAssessQualityMetrics;
    generateAutomatedReports = mockGenerateAutomatedReports;
    exportEnhancedPatientData = mockExportEnhancedPatientData;
    startRealTimeMonitoring = mockStartRealTimeMonitoring;
    validateAndCleanData = mockValidateAndCleanData;
  }
  return {
    __esModule: true,
    default: MockEnhancedFhirService,
    EnhancedFhirService: MockEnhancedFhirService,
  };
});

vi.mock('../RiskAssessmentManager', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-risk-assessment-manager">Risk Assessment Manager</div>,
}));

vi.mock('../../smart/SmartLauncher', () => ({
  __esModule: true,
  default: ({ onLaunch }: { onLaunch?: (ehr: string) => void }) => (
    <div data-testid="mock-smart-launcher" onClick={() => onLaunch?.('test-ehr')}>
      Smart Launcher
    </div>
  ),
}));

vi.mock('../../smart/SmartSessionStatus', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-smart-session-status">Smart Session Status</div>,
}));

// ============================================================================
// TEST DATA — Synthetic only (CLAUDE.md PHI hygiene)
// ============================================================================

const MOCK_POPULATION_DASHBOARD = {
  overview: {
    totalPatients: 200,
    activePatients: 150,
    highRiskPatients: 15,
    averageHealthScore: 72,
    trendingConcerns: ['Hypertension management', 'Medication adherence'],
  },
  riskMatrix: {
    quadrants: {
      highRiskLowAdherence: 10,
      highRiskHighAdherence: 5,
      lowRiskLowAdherence: 35,
      lowRiskHighAdherence: 150,
    },
  },
  predictiveAlerts: [] as unknown[],
  interventionQueue: [
    { patientId: 'patient-alpha-001', priority: 5 },
    { patientId: 'patient-beta-002', priority: 4 },
  ],
  resourceAllocation: [
    {
      recommendation: 'Add care coordinator for high-risk cohort',
      priority: 1,
      justification: 'Reduce readmission rates',
      estimatedCost: '$45,000/yr',
      expectedRoi: '3.2x',
    },
  ],
};

const MOCK_QUALITY_METRICS = {
  fhirCompliance: {
    score: 85,
    issues: [{ type: 'missing-field', description: 'Missing identifier' }],
  },
  dataQuality: {
    completeness: 91,
    accuracy: 88,
    consistency: 94,
    issues: [
      {
        type: 'Incomplete Records',
        description: 'Missing contact information',
        severity: 'MEDIUM' as const,
        count: 12,
      },
    ],
  },
  clinicalQuality: {
    adherenceToGuidelines: 78,
    outcomeMetrics: {
      readmissionRate: 8.5,
    },
  },
};

const MOCK_AUTOMATED_REPORTS = {
  weeklyReport: {
    summary: {
      totalPatients: 200,
      activePatients: 150,
      highRiskPatients: 15,
      newEmergencyAlerts: 3,
    },
    keyInsights: [
      'Medication adherence improved by 5%',
      'Three new high-risk patients identified',
    ],
  },
  emergencyReport: {
    alertCount: 3,
    escalationRequired: true,
  },
};

const MOCK_ENHANCED_PATIENT_ALPHA = {
  fhirBundle: {},
  aiInsights: {
    patientId: 'patient-alpha-001',
    patientName: 'Test Patient Alpha',
    overallHealthScore: 65,
    adherenceScore: 72,
    emergencyAlerts: [],
    riskAssessment: {
      riskLevel: 'HIGH' as const,
      priority: 5,
    },
  },
  emergencyAlerts: [],
  recommendedActions: [],
  nextReviewDate: '2026-03-01',
  clinicalSummary: 'Test summary',
  healthStatistics: {},
};

const MOCK_ENHANCED_PATIENT_BETA = {
  fhirBundle: {},
  aiInsights: {
    patientId: 'patient-beta-002',
    patientName: 'Test Patient Beta',
    overallHealthScore: 48,
    adherenceScore: 55,
    emergencyAlerts: [],
    riskAssessment: {
      riskLevel: 'MODERATE' as const,
      priority: 4,
    },
  },
  emergencyAlerts: [],
  recommendedActions: [],
  nextReviewDate: '2026-03-15',
  clinicalSummary: 'Test summary beta',
  healthStatistics: {},
};

// ============================================================================
// HELPERS
// ============================================================================

function setupSuccessfulMocks() {
  mockGeneratePopulationDashboard.mockResolvedValue(MOCK_POPULATION_DASHBOARD);
  mockAssessQualityMetrics.mockResolvedValue(MOCK_QUALITY_METRICS);
  mockGenerateAutomatedReports.mockResolvedValue(MOCK_AUTOMATED_REPORTS);
  mockExportEnhancedPatientData.mockImplementation((patientId: string) => {
    if (patientId === 'patient-alpha-001') return Promise.resolve(MOCK_ENHANCED_PATIENT_ALPHA);
    if (patientId === 'patient-beta-002') return Promise.resolve(MOCK_ENHANCED_PATIENT_BETA);
    return Promise.resolve(MOCK_ENHANCED_PATIENT_ALPHA);
  });
  mockStartRealTimeMonitoring.mockResolvedValue(undefined);
  mockValidateAndCleanData.mockResolvedValue(undefined);
}

async function renderDashboard() {
  const FhirAiDashboard = (await import('../FhirAiDashboard')).default;
  return render(
    <FhirAiDashboard
      supabaseUrl="https://test-project.supabase.co"
      supabaseKey="test-anon-key-000"
    />
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe('FhirAiDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuccessfulMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Loading state
  // --------------------------------------------------------------------------
  it('shows loading spinner when data is being fetched', async () => {
    // Make the dashboard call hang so loading state stays visible
    mockGeneratePopulationDashboard.mockReturnValue(new Promise(() => {}));

    await renderDashboard();

    expect(screen.getByText('Loading AI-enhanced FHIR dashboard...')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 2. Error state with retry
  // --------------------------------------------------------------------------
  it('displays error alert with retry button when data loading fails', async () => {
    mockGeneratePopulationDashboard.mockRejectedValue(
      new Error('Network connection failed')
    );

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Network connection failed/)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 3. Population metrics on overview tab
  // --------------------------------------------------------------------------
  it('shows population metrics with total, active, high risk, and health score', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Total Patients')).toBeInTheDocument();
    });

    // Verify the actual metric values render
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Active Patients')).toBeInTheDocument();
    // 150 appears in both active patients and low-risk-high-adherence quadrant
    const allOneHundredFifty = screen.getAllByText('150');
    expect(allOneHundredFifty.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('High Risk')).toBeInTheDocument();
    expect(screen.getByText('Health Score')).toBeInTheDocument();
    expect(screen.getByText('72/100')).toBeInTheDocument();
    // Engagement rate: 150/200 = 75%
    expect(screen.getByText('75% engagement')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 4. Risk matrix with 4 quadrants and percentages
  // --------------------------------------------------------------------------
  it('displays risk matrix with 4 quadrants and correct percentages', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Population Risk Matrix')).toBeInTheDocument();
    });

    // Total = 10 + 5 + 35 + 150 = 200
    expect(screen.getByText('High Risk, Low Adherence')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5% of patients')).toBeInTheDocument();

    expect(screen.getByText('High Risk, High Adherence')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    // 5/200 = 2.5 rounds to 3 (Math.round)
    expect(screen.getByText('3% of patients')).toBeInTheDocument();

    expect(screen.getByText('Low Risk, Low Adherence')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
    // 35/200 = 17.5 rounds to 18
    expect(screen.getByText('18% of patients')).toBeInTheDocument();

    expect(screen.getByText('Low Risk, High Adherence')).toBeInTheDocument();
    // 150 also appears in active patients; locate within the green quadrant text
    expect(screen.getByText('75% of patients')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 5. No predictive alerts message
  // --------------------------------------------------------------------------
  it('shows "No predictive alerts" when predictive alerts array is empty', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('No predictive alerts at this time')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 6. Quick action for high risk when > 10 patients
  // --------------------------------------------------------------------------
  it('generates quick action for high risk when more than 10 patients', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('High Risk Alert')).toBeInTheDocument();
    });

    expect(screen.getByText('15 patients need immediate attention')).toBeInTheDocument();
    expect(screen.getByText('Review High-Risk Patients')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 7. FHIR compliance quick action when score < 90
  // --------------------------------------------------------------------------
  it('generates FHIR compliance quick action when score is below 90', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('FHIR Compliance')).toBeInTheDocument();
    });

    expect(screen.getByText('Data quality issues detected')).toBeInTheDocument();
    expect(screen.getByText('Validate & Clean Data')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 8. Patient list on patients tab
  // --------------------------------------------------------------------------
  it('shows patient list with health scores and risk levels on patients tab', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('AI-Enhanced FHIR Dashboard')).toBeInTheDocument();
    });

    // Navigate to patients tab (exact match to avoid "Total Patients" collision)
    const tabList = screen.getByRole('tablist');
    const patientsTab = within(tabList).getByText('Patients');
    await user.click(patientsTab);

    await waitFor(() => {
      expect(screen.getByText('High-Priority Patients')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
    expect(screen.getByText('Test Patient Beta')).toBeInTheDocument();
    expect(screen.getByText(/Health Score: 65\/100/)).toBeInTheDocument();
    expect(screen.getByText(/Adherence: 72%/)).toBeInTheDocument();
    // "HIGH" appears in quick action card urgency AND patient risk badge
    const highBadges = screen.getAllByText('HIGH');
    expect(highBadges.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Priority: 5')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 9. Quality metrics on quality tab
  // --------------------------------------------------------------------------
  it('displays quality metrics with FHIR compliance, data quality, and clinical quality', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('AI-Enhanced FHIR Dashboard')).toBeInTheDocument();
    });

    // Navigate to quality tab
    const tabList = screen.getByRole('tablist');
    const qualityTab = within(tabList).getByText('Quality');
    await user.click(qualityTab);

    // Wait for quality content to appear (Data Quality is unique to the quality tab)
    await waitFor(() => {
      expect(screen.getByText('Data Quality')).toBeInTheDocument();
    });

    // FHIR compliance score: 85%
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('1 issues found')).toBeInTheDocument();

    // Data quality metrics
    expect(screen.getByText('Completeness:')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('Accuracy:')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('Consistency:')).toBeInTheDocument();
    expect(screen.getByText('94%')).toBeInTheDocument();

    // Clinical quality
    expect(screen.getByText('Clinical Quality')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('Guideline adherence')).toBeInTheDocument();
    expect(screen.getByText(/Readmission rate: 8.5%/)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 10. Weekly report on reports tab
  // --------------------------------------------------------------------------
  it('shows weekly report summary on reports tab', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('AI-Enhanced FHIR Dashboard')).toBeInTheDocument();
    });

    // Navigate to reports tab
    const tabList = screen.getByRole('tablist');
    const reportsTab = within(tabList).getByText('Reports');
    await user.click(reportsTab);

    await waitFor(() => {
      expect(screen.getByText('Weekly Report')).toBeInTheDocument();
    });

    // Weekly summary values
    expect(screen.getByText(/Total Patients: 200/)).toBeInTheDocument();
    expect(screen.getByText(/Active: 150/)).toBeInTheDocument();
    expect(screen.getByText(/High Risk: 15/)).toBeInTheDocument();
    expect(screen.getByText(/Alerts: 3/)).toBeInTheDocument();

    // Key insights
    expect(screen.getByText('Medication adherence improved by 5%')).toBeInTheDocument();
    expect(screen.getByText('Three new high-risk patients identified')).toBeInTheDocument();

    // Emergency report
    expect(screen.getByText('Emergency Report')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Critical alerts')).toBeInTheDocument();
    expect(
      screen.getByText('Immediate escalation required for critical alerts')
    ).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 11. Refresh Now button triggers reload
  // --------------------------------------------------------------------------
  it('Refresh Now button triggers data reload', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Refresh Now')).toBeInTheDocument();
    });

    // Initial load calls each service once
    expect(mockGeneratePopulationDashboard).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Refresh Now'));

    await waitFor(() => {
      expect(mockGeneratePopulationDashboard).toHaveBeenCalledTimes(2);
    });
    expect(mockAssessQualityMetrics).toHaveBeenCalledTimes(2);
    expect(mockGenerateAutomatedReports).toHaveBeenCalledTimes(2);
  });

  // --------------------------------------------------------------------------
  // 12. Retry button in error state reloads data
  // --------------------------------------------------------------------------
  it('retry button in error state triggers reload', async () => {
    const user = userEvent.setup();
    mockGeneratePopulationDashboard.mockRejectedValueOnce(
      new Error('Temporary failure')
    );

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Temporary failure/)).toBeInTheDocument();
    });

    // Fix the mock for retry
    mockGeneratePopulationDashboard.mockResolvedValueOnce(MOCK_POPULATION_DASHBOARD);

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText('AI-Enhanced FHIR Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Patients')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 13. Fast/Normal refresh toggle
  // --------------------------------------------------------------------------
  it('toggles between Fast Refresh and Normal Refresh', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await waitFor(() => {
      // Default is 5-minute interval, so button says "Fast Refresh"
      expect(screen.getByText('Fast Refresh')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Fast Refresh'));

    // After clicking, switches to 1-minute interval, button should say "Normal Refresh"
    expect(screen.getByText('Normal Refresh')).toBeInTheDocument();
  });
});
