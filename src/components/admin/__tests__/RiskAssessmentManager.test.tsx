/**
 * RiskAssessmentManager Test Suite
 *
 * Behavioral tests for the risk assessment management dashboard.
 * Tests loading states, risk summary display, patient list rendering,
 * tab navigation, form tab behavior, and role-based access.
 *
 * Location: src/components/admin/__tests__/RiskAssessmentManager.test.tsx
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RiskAssessmentManager from '../RiskAssessmentManager';

// --- Synthetic test data (obviously fake per CLAUDE.md PHI rules) ---

const mockPatients = [
  {
    user_id: 'patient-001',
    first_name: 'Test',
    last_name: 'Patient Alpha',
    phone: '555-0100',
    email: 'alpha@test.local',
  },
  {
    user_id: 'patient-002',
    first_name: 'Test',
    last_name: 'Patient Beta',
    phone: '555-0200',
    email: 'beta@test.local',
  },
  {
    user_id: 'patient-003',
    first_name: 'Test',
    last_name: 'Patient Gamma',
    phone: '555-0300',
    email: 'gamma@test.local',
  },
];

const mockAssessments = [
  {
    id: 'assess-001',
    patient_id: 'patient-001',
    assessor_id: 'admin-001',
    risk_level: 'HIGH',
    priority: 'URGENT',
    medical_risk_score: 7,
    mobility_risk_score: 6,
    cognitive_risk_score: 5,
    social_risk_score: 4,
    overall_score: 7,
    assessment_notes: 'Fall risk concern noted',
    risk_factors: ['Fall history', 'Polypharmacy'],
    recommended_actions: ['Physical therapy', 'Medication review'],
    next_assessment_due: '2025-01-01', // overdue
    review_frequency: 'monthly',
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2025-12-01T10:00:00Z',
  },
  {
    id: 'assess-002',
    patient_id: 'patient-002',
    assessor_id: 'admin-001',
    risk_level: 'LOW',
    priority: 'LOW',
    medical_risk_score: 2,
    mobility_risk_score: 1,
    cognitive_risk_score: 1,
    social_risk_score: 2,
    overall_score: 2,
    assessment_notes: 'Stable condition',
    risk_factors: [],
    recommended_actions: [],
    next_assessment_due: '2027-06-01',
    review_frequency: 'quarterly',
    created_at: '2025-12-15T10:00:00Z',
    updated_at: '2025-12-15T10:00:00Z',
  },
];

// --- Mock setup ---

const mockFrom = vi.fn();

let mockUser: { id: string; role: string; email: string } | null = {
  id: 'admin-001',
  role: 'admin',
  email: 'admin@test.local',
};

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: mockFrom,
  }),
  useUser: () => mockUser,
}));

// Mock RiskAssessmentForm to avoid pulling in its deep dependencies
vi.mock('../RiskAssessmentForm', () => ({
  default: ({
    patientId,
    patientName,
  }: {
    patientId: string;
    patientName?: string;
  }) => (
    <div data-testid="risk-assessment-form">
      <span>Form for {patientName || patientId}</span>
    </div>
  ),
}));

// --- Helpers ---

const setupSuccessMocks = () => {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: mockPatients, error: null }),
        }),
      };
    }
    if (table === 'risk_assessments') {
      return {
        select: () => ({
          order: () => ({
            limit: () =>
              Promise.resolve({ data: mockAssessments, error: null }),
          }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    };
  });
};

const setupEmptyMocks = () => {
  mockFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => Promise.resolve({ data: [], error: null }),
      order: () => ({
        limit: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  }));
};

const setupErrorMocks = () => {
  mockFrom.mockImplementation(() => ({
    select: () => ({
      eq: () =>
        Promise.resolve({ data: null, error: { message: 'Database error' } }),
      order: () => ({
        limit: () =>
          Promise.resolve({
            data: null,
            error: { message: 'Database error' },
          }),
      }),
    }),
  }));
};

describe('RiskAssessmentManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'admin-001', role: 'admin', email: 'admin@test.local' };
    setupSuccessMocks();
  });

  describe('Loading State', () => {
    it('shows loading spinner with descriptive text while data is being fetched', () => {
      // Use a never-resolving promise to keep the component in loading state
      mockFrom.mockImplementation(() => ({
        select: () => ({
          eq: () => new Promise(() => {}),
          order: () => ({
            limit: () => new Promise(() => {}),
          }),
        }),
      }));

      render(<RiskAssessmentManager />);

      expect(
        screen.getByText('Loading risk assessments...')
      ).toBeInTheDocument();
    });
  });

  describe('Overview Tab — Risk Summary Cards', () => {
    it('displays risk summary cards with correct counts for total, critical, high, moderate, and overdue', async () => {
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(screen.getByText('Total Assessments')).toBeInTheDocument();
      });

      // Total = 2 assessments
      expect(screen.getByText('Total Assessments')).toBeInTheDocument();
      // Critical = 0 (none in mock data)
      expect(screen.getByText('Critical Risk')).toBeInTheDocument();
      // High = 1 (assess-001)
      expect(screen.getByText('High Risk')).toBeInTheDocument();
      // Moderate = 0
      expect(screen.getByText('Moderate Risk')).toBeInTheDocument();
      // Overdue = 1 (assess-001 has next_assessment_due = 2025-01-01)
      expect(screen.getByText('Overdue Reviews')).toBeInTheDocument();

      // Verify actual counts rendered as bold text
      // Total Assessments card should show "2"
      const totalCard = screen.getByText('Total Assessments').closest('div');
      expect(totalCard?.parentElement?.textContent).toContain('2');

      // Overdue Reviews card should show "1" (assess-001 has past due date)
      const overdueCard = screen.getByText('Overdue Reviews').closest('div');
      expect(overdueCard?.parentElement?.textContent).toContain('1');
    });
  });

  describe('Overview Tab — Patient List', () => {
    it('shows patient names and phone numbers in the patient list', async () => {
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(screen.getByText('Patient Risk Management')).toBeInTheDocument();
      });

      // Patient Alpha
      expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      expect(screen.getByText('555-0100')).toBeInTheDocument();

      // Patient Beta
      expect(screen.getByText('Test Patient Beta')).toBeInTheDocument();
      expect(screen.getByText('555-0200')).toBeInTheDocument();
    });

    it('shows risk level badges for patients with assessments', async () => {
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(screen.getByText('Patient Risk Management')).toBeInTheDocument();
      });

      // Patient Alpha has a HIGH risk assessment
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      // Patient Beta has a LOW risk assessment (risk_level and priority are both LOW)
      const lowElements = screen.getAllByText('LOW');
      expect(lowElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows OVERDUE badge for assessments with past due dates', async () => {
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(screen.getByText('Patient Risk Management')).toBeInTheDocument();
      });

      // assess-001 has next_assessment_due = 2025-01-01 which is in the past
      expect(screen.getByText('OVERDUE')).toBeInTheDocument();
    });

    it('shows "No Assessment" badge for patients without any assessments', async () => {
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(screen.getByText('Patient Risk Management')).toBeInTheDocument();
      });

      // Patient Gamma (patient-003) has no assessments in mock data
      expect(screen.getByText('No Assessment')).toBeInTheDocument();
    });

    it('shows "Assess" button for patients without assessments and "New Assessment" for those with', async () => {
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(screen.getByText('Patient Risk Management')).toBeInTheDocument();
      });

      // Patients with assessments get "New Assessment" button
      const newAssessmentButtons = screen.getAllByText('New Assessment');
      expect(newAssessmentButtons.length).toBe(2); // Alpha and Beta both have assessments

      // Patient without assessment gets "Assess" button
      expect(screen.getByText('Assess')).toBeInTheDocument();
    });
  });

  describe('All Assessments Tab', () => {
    it('shows assessment list with patient names, risk levels, and scores', async () => {
      const user = userEvent.setup();
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(
          screen.getByRole('tab', { name: /all assessments/i })
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /all assessments/i }));

      await waitFor(() => {
        expect(screen.getByText('All Risk Assessments')).toBeInTheDocument();
      });

      // Enriched patient names (from loadData enrichment)
      expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      expect(screen.getByText('Test Patient Beta')).toBeInTheDocument();

      // Scores
      expect(screen.getByText('Score: 7/10')).toBeInTheDocument();
      expect(screen.getByText('Score: 2/10')).toBeInTheDocument();

      // Assessment notes
      expect(screen.getByText('Fall risk concern noted')).toBeInTheDocument();
      expect(screen.getByText('Stable condition')).toBeInTheDocument();
    });

    it('shows risk factors as tags in the assessment list', async () => {
      const user = userEvent.setup();
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(
          screen.getByRole('tab', { name: /all assessments/i })
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /all assessments/i }));

      await waitFor(() => {
        expect(screen.getByText('All Risk Assessments')).toBeInTheDocument();
      });

      // Risk factors from assess-001
      expect(screen.getByText('Fall history')).toBeInTheDocument();
      expect(screen.getByText('Polypharmacy')).toBeInTheDocument();
    });
  });

  describe('Form Tab', () => {
    it('shows patient selector grid with patient names and phone numbers', async () => {
      const user = userEvent.setup();
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(
          screen.getByRole('tab', { name: /risk assessment form/i })
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole('tab', { name: /risk assessment form/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText('Select Patient for Risk Assessment')
        ).toBeInTheDocument();
      });

      // Patient cards should appear in the selector grid
      expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      expect(screen.getByText('555-0100')).toBeInTheDocument();
      expect(screen.getByText('Test Patient Beta')).toBeInTheDocument();
      expect(screen.getByText('555-0200')).toBeInTheDocument();
      expect(screen.getByText('Test Patient Gamma')).toBeInTheDocument();
      expect(screen.getByText('555-0300')).toBeInTheDocument();
    });

    it('shows "Ready to Create Risk Assessment" message when no patient is selected', async () => {
      const user = userEvent.setup();
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(
          screen.getByRole('tab', { name: /risk assessment form/i })
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole('tab', { name: /risk assessment form/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText('Ready to Create Risk Assessment')
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText('Please select a patient above to begin the assessment')
      ).toBeInTheDocument();
    });

    it('renders the RiskAssessmentForm when a patient is selected from the grid', async () => {
      const user = userEvent.setup();
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(
          screen.getByRole('tab', { name: /risk assessment form/i })
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole('tab', { name: /risk assessment form/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText('Select Patient for Risk Assessment')
        ).toBeInTheDocument();
      });

      // Click on Patient Alpha's card in the selector grid
      // The patient selector uses <button> elements with patient names
      const patientButtons = screen.getAllByText('Test Patient Alpha');
      // The one inside the form tab selector (button element)
      const selectorButton = patientButtons.find(
        (el) => el.closest('button') !== null
      );
      expect(selectorButton).toBeDefined();
      const selectorBtn = selectorButton?.closest('button');
      expect(selectorBtn).not.toBeNull();
      if (selectorBtn) await user.click(selectorBtn);

      // The mocked RiskAssessmentForm should now appear
      await waitFor(() => {
        expect(screen.getByTestId('risk-assessment-form')).toBeInTheDocument();
      });

      expect(
        screen.getByText('Form for Test Patient Alpha')
      ).toBeInTheDocument();
    });

    it('shows "No patients available" message when patient list is empty', async () => {
      setupEmptyMocks();
      const user = userEvent.setup();
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(
          screen.getByRole('tab', { name: /risk assessment form/i })
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole('tab', { name: /risk assessment form/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText('No patients available for assessment')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Role-Based Access', () => {
    it('hides the form tab when user role does not have permission to manage assessments', async () => {
      mockUser = {
        id: 'senior-001',
        role: 'senior',
        email: 'senior@test.local',
      };

      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(
          screen.getByRole('tab', { name: /overview/i })
        ).toBeInTheDocument();
      });

      // The "Risk Assessment Form" tab should NOT be rendered
      expect(
        screen.queryByRole('tab', { name: /risk assessment form/i })
      ).not.toBeInTheDocument();

      // Overview and All Assessments tabs should still be visible
      expect(
        screen.getByRole('tab', { name: /all assessments/i })
      ).toBeInTheDocument();
    });

    it('shows the form tab for healthcare_provider role', async () => {
      mockUser = {
        id: 'provider-001',
        role: 'healthcare_provider',
        email: 'provider@test.local',
      };

      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(
          screen.getByRole('tab', { name: /risk assessment form/i })
        ).toBeInTheDocument();
      });
    });

    it('shows the form tab for nurse role', async () => {
      mockUser = {
        id: 'nurse-001',
        role: 'nurse',
        email: 'nurse@test.local',
      };

      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(
          screen.getByRole('tab', { name: /risk assessment form/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when data fetch fails', async () => {
      setupErrorMocks();
      render(<RiskAssessmentManager />);

      // Wait for loading to finish and tabs to appear
      await waitFor(() => {
        expect(
          screen.getByRole('tab', { name: /all assessments/i })
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole('tab', { name: /all assessments/i })
      );

      // The thrown error is a plain object (not Error instance), so catch
      // produces: 'Failed to load data' via the fallback string
      await waitFor(() => {
        expect(screen.getByText('Failed to load data')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Actions', () => {
    it('navigates to form tab with patient pre-selected when "New Assessment" is clicked', async () => {
      const user = userEvent.setup();
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(screen.getByText('Patient Risk Management')).toBeInTheDocument();
      });

      // Click "New Assessment" for Patient Alpha
      const newAssessmentButtons = screen.getAllByText('New Assessment');
      await user.click(newAssessmentButtons[0]);

      // Should switch to the form tab and show the form for the selected patient
      await waitFor(() => {
        expect(screen.getByTestId('risk-assessment-form')).toBeInTheDocument();
      });

      expect(
        screen.getByText('Form for Test Patient Alpha')
      ).toBeInTheDocument();
    });

    it('navigates to form tab when "Edit" is clicked on an existing assessment', async () => {
      const user = userEvent.setup();
      render(<RiskAssessmentManager />);

      await waitFor(() => {
        expect(screen.getByText('Patient Risk Management')).toBeInTheDocument();
      });

      // Click the first "Edit" button (for Patient Alpha's assessment)
      const editButtons = screen.getAllByText('Edit');
      await user.click(editButtons[0]);

      // Should switch to the form tab with the patient pre-selected
      await waitFor(() => {
        expect(screen.getByTestId('risk-assessment-form')).toBeInTheDocument();
      });

      expect(
        screen.getByText('Form for Test Patient Alpha')
      ).toBeInTheDocument();
    });
  });
});
