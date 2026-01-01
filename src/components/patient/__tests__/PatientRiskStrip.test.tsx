/**
 * Tests for PatientRiskStrip Component
 *
 * Covers risk display including plain-language explanations
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientRiskStrip, PatientRiskData } from '../PatientRiskStrip';

// Mock Supabase client
const mockFrom = vi.fn();
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock audit logger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// ============================================================================
// TEST DATA
// ============================================================================

const mockReadmissionData = {
  readmission_risk_score: 0.65,
  risk_category: 'high',
  predicted_readmission_window_days: 7,
  primary_risk_factors: [{ factor: 'Prior admission', weight: 0.25 }],
  plain_language_explanation: 'Your risk of going back to the hospital is HIGH. This is because you were in the hospital 2 times recently. Good news: You have a doctor visit coming up soon. Please call your doctor to set up a visit in the next 7 days.',
};

const mockDeteriorationData = {
  auto_composite_score: 45,
  final_risk_level: 'MODERATE',
  auto_early_warning_score: 3,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function setupMocks(options?: {
  readmissionData?: typeof mockReadmissionData | null;
  deteriorationData?: typeof mockDeteriorationData | null;
}) {
  const readmission = options?.readmissionData !== undefined ? options.readmissionData : mockReadmissionData;
  const deterioration = options?.deteriorationData !== undefined ? options.deteriorationData : mockDeteriorationData;

  mockFrom.mockImplementation((table: string) => {
    if (table === 'readmission_risk_predictions') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: readmission, error: null }),
      };
    }
    if (table === 'shift_handoff_risk_scores') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: deterioration, error: null }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('PatientRiskStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      setupMocks();
      render(<PatientRiskStrip patientId="test-patient-id" />);
      expect(screen.getByText(/Loading risk assessment/i)).toBeInTheDocument();
    });

    it('should render risk data after loading', async () => {
      setupMocks();
      render(<PatientRiskStrip patientId="test-patient-id" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading risk assessment/i)).not.toBeInTheDocument();
      });

      // Should show readmission risk
      expect(screen.getByText(/Readmit/i)).toBeInTheDocument();
    });

    it('should show no active risk alerts when no data', async () => {
      setupMocks({ readmissionData: null, deteriorationData: null });
      render(<PatientRiskStrip patientId="test-patient-id" />);

      await waitFor(() => {
        expect(screen.getByText(/No active risk alerts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Plain Language Explanation', () => {
    it('should include plain language explanation in risk data interface', () => {
      const riskData: PatientRiskData = {
        readmission: {
          score: 65,
          level: 'high',
          topFactor: 'Prior admission',
          plainLanguageExplanation: 'Your risk is HIGH because you were in the hospital recently.',
        },
        deterioration: null,
        noShow: null,
      };

      expect(riskData.readmission?.plainLanguageExplanation).toBe(
        'Your risk is HIGH because you were in the hospital recently.'
      );
    });

    it('should display plain language explanation in expanded variant', async () => {
      setupMocks();
      render(<PatientRiskStrip patientId="test-patient-id" variant="expanded" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading risk assessment/i)).not.toBeInTheDocument();
      });

      // Should show the "In Simple Terms" section
      expect(screen.getByText(/In Simple Terms/i)).toBeInTheDocument();

      // Should show the plain language explanation
      expect(screen.getByText(/Your risk of going back to the hospital is HIGH/i)).toBeInTheDocument();
    });

    it('should not show plain language section when explanation is missing', async () => {
      setupMocks({
        readmissionData: {
          ...mockReadmissionData,
          plain_language_explanation: null,
        } as any,
      });
      render(<PatientRiskStrip patientId="test-patient-id" variant="expanded" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading risk assessment/i)).not.toBeInTheDocument();
      });

      // Should NOT show the "In Simple Terms" section
      expect(screen.queryByText(/In Simple Terms/i)).not.toBeInTheDocument();
    });
  });

  describe('Compact Variant', () => {
    it('should render compact variant by default', async () => {
      setupMocks();
      render(<PatientRiskStrip patientId="test-patient-id" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading risk assessment/i)).not.toBeInTheDocument();
      });

      // Compact variant shows labels
      expect(screen.getByText(/Readmit/i)).toBeInTheDocument();
      expect(screen.getByText(/Acuity/i)).toBeInTheDocument();
    });

    it('should have expand/collapse button', async () => {
      setupMocks();
      render(<PatientRiskStrip patientId="test-patient-id" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading risk assessment/i)).not.toBeInTheDocument();
      });

      // Should have expand button
      const expandButton = screen.getByTitle(/Expand details/i);
      expect(expandButton).toBeInTheDocument();
    });
  });

  describe('Expanded Variant', () => {
    it('should show risk assessment header', async () => {
      setupMocks();
      render(<PatientRiskStrip patientId="test-patient-id" variant="expanded" />);

      await waitFor(() => {
        expect(screen.getByText(/Risk Assessment/i)).toBeInTheDocument();
      });
    });

    it('should show 30-Day Readmission card', async () => {
      setupMocks();
      render(<PatientRiskStrip patientId="test-patient-id" variant="expanded" />);

      await waitFor(() => {
        expect(screen.getByText(/30-Day Readmission/i)).toBeInTheDocument();
      });

      // Should show the score
      expect(screen.getByText('65%')).toBeInTheDocument();
    });

    it('should show Clinical Acuity card', async () => {
      setupMocks();
      render(<PatientRiskStrip patientId="test-patient-id" variant="expanded" />);

      await waitFor(() => {
        expect(screen.getByText(/Clinical Acuity/i)).toBeInTheDocument();
      });
    });

    it('should show top risk factor', async () => {
      setupMocks();
      render(<PatientRiskStrip patientId="test-patient-id" variant="expanded" />);

      await waitFor(() => {
        expect(screen.getByText(/Top factor: Prior admission/i)).toBeInTheDocument();
      });
    });
  });

  describe('Interactions', () => {
    it('should call onRiskClick when risk is clicked', async () => {
      const onRiskClick = vi.fn();
      setupMocks();
      render(
        <PatientRiskStrip patientId="test-patient-id" onRiskClick={onRiskClick} />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Loading risk assessment/i)).not.toBeInTheDocument();
      });

      // Click on readmission risk
      const readmitButton = screen.getByTitle(/Readmission Risk/i);
      await userEvent.click(readmitButton);

      expect(onRiskClick).toHaveBeenCalledWith('readmission');
    });

    it('should refresh data when refresh button is clicked', async () => {
      setupMocks();
      render(<PatientRiskStrip patientId="test-patient-id" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading risk assessment/i)).not.toBeInTheDocument();
      });

      const initialCalls = mockFrom.mock.calls.length;

      // Click refresh
      const refreshButton = screen.getByTitle(/Refresh risk data/i);
      await userEvent.click(refreshButton);

      // Should have made additional fetch calls
      await waitFor(() => {
        expect(mockFrom.mock.calls.length).toBeGreaterThan(initialCalls);
      });
    });
  });

  describe('Data Quality', () => {
    it('should show complete data quality when both risks available', async () => {
      setupMocks();
      render(<PatientRiskStrip patientId="test-patient-id" variant="expanded" />);

      await waitFor(() => {
        expect(screen.getByText('complete')).toBeInTheDocument();
      });
    });

    it('should show partial data quality when only one risk available', async () => {
      setupMocks({ deteriorationData: null });
      render(<PatientRiskStrip patientId="test-patient-id" variant="expanded" />);

      await waitFor(() => {
        expect(screen.getByText('partial')).toBeInTheDocument();
      });
    });
  });
});
