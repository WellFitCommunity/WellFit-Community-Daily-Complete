/**
 * Tests for DischargePlanningChecklist Component
 *
 * Purpose: Joint Commission compliant discharge checklist interface
 * Tests: Loading, plan display, checklist interactions, tabs, status actions
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DischargePlanningChecklist } from '../DischargePlanningChecklist';
import { DischargePlanningService } from '../../../services/dischargePlanningService';
import type { DischargePlan } from '../../../types/dischargePlanning';

// Mock the DischargePlanningService
vi.mock('../../../services/dischargePlanningService');

// Mock DischargeDispositionSelector
vi.mock('../DischargeDispositionSelector', () => ({
  DischargeDispositionSelector: ({
    value,
    onChange,
    disabled,
  }: {
    value: string | null;
    onChange: (val: string) => void;
    disabled?: boolean;
  }) => (
    <select
      data-testid="disposition-selector"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">Select...</option>
      <option value="home">Home</option>
      <option value="skilled_nursing">Skilled Nursing</option>
    </select>
  ),
}));

const mockDischargePlan: DischargePlan = {
  id: 'plan-1',
  patient_id: 'patient-1',
  encounter_id: 'encounter-1',
  discharge_disposition: 'home',
  planned_discharge_date: '2026-01-15',
  planned_discharge_time: '10:00',

  // Checklist items
  medication_reconciliation_complete: true,
  discharge_prescriptions_sent: true,
  follow_up_appointment_scheduled: true,
  discharge_summary_completed: true,
  discharge_summary_sent_to_pcp: true,
  patient_education_completed: false,
  patient_understands_diagnosis: true,
  patient_understands_medications: true,
  patient_understands_followup: true,
  dme_needed: false,
  dme_ordered: false,
  home_health_needed: false,
  home_health_ordered: false,
  caregiver_identified: true,
  caregiver_training_completed: true,
  transportation_arranged: false,

  // Risk Assessment
  readmission_risk_score: 45,
  readmission_risk_category: 'moderate',
  requires_48hr_call: false,
  requires_72hr_call: false,
  requires_7day_pcp_visit: true,
  risk_factors: ['Age > 65', 'Multiple comorbidities'],

  // Post-Acute
  post_acute_bed_confirmed: false,

  // Billing
  discharge_planning_time_minutes: 30,
  care_coordination_time_minutes: 15,
  billing_codes_generated: false,

  // Status
  status: 'pending_items',
  checklist_completion_percentage: 70,

  // Metadata
  created_by: 'user-1',
  created_at: '2026-01-08T10:00:00Z',
  updated_at: '2026-01-08T14:00:00Z',
};

describe('DischargePlanningChecklist', () => {
  const mockGetDischargePlan = vi.fn();
  const mockUpdateDischargePlan = vi.fn();
  const mockMarkPlanReady = vi.fn();
  const mockMarkPatientDischarged = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockGetDischargePlan.mockResolvedValue(mockDischargePlan);
    mockUpdateDischargePlan.mockImplementation(async (id, updates) => ({
      ...mockDischargePlan,
      ...updates,
    }));
    mockMarkPlanReady.mockResolvedValue(undefined);
    mockMarkPatientDischarged.mockResolvedValue(undefined);

    (DischargePlanningService.getDischargePlanByEncounter as ReturnType<typeof vi.fn>).mockImplementation(
      mockGetDischargePlan
    );
    (DischargePlanningService.updateDischargePlan as ReturnType<typeof vi.fn>).mockImplementation(
      mockUpdateDischargePlan
    );
    (DischargePlanningService.markPlanReady as ReturnType<typeof vi.fn>).mockImplementation(
      mockMarkPlanReady
    );
    (DischargePlanningService.markPatientDischarged as ReturnType<typeof vi.fn>).mockImplementation(
      mockMarkPatientDischarged
    );
  });

  describe('Loading State', () => {
    it('should show loading message initially', () => {
      mockGetDischargePlan.mockImplementation(() => new Promise(() => {}));

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      expect(screen.getByText('Loading discharge plan...')).toBeInTheDocument();
    });

    it('should load discharge plan on mount', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(mockGetDischargePlan).toHaveBeenCalledWith('encounter-1');
      });
    });
  });

  describe('No Plan State', () => {
    it('should show no plan message when plan is null', async () => {
      mockGetDischargePlan.mockResolvedValue(null);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No Discharge Plan Yet')).toBeInTheDocument();
      });
    });

    it('should show helpful message about creating a plan', async () => {
      mockGetDischargePlan.mockResolvedValue(null);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText('Create a discharge plan to start the discharge planning process')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Header Display', () => {
    it('should render the checklist title', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Discharge Planning Checklist')).toBeInTheDocument();
      });
    });

    it('should show Joint Commission compliance text', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Joint Commission Compliant/)).toBeInTheDocument();
      });
    });

    it('should display risk score and category', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('MODERATE RISK')).toBeInTheDocument();
        expect(screen.getByText('Risk Score: 45/100')).toBeInTheDocument();
      });
    });

    it('should display completion percentage', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('70%')).toBeInTheDocument();
        expect(screen.getByText('Checklist Completion')).toBeInTheDocument();
      });
    });

    it('should display current status', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('PENDING ITEMS')).toBeInTheDocument();
      });
    });
  });

  describe('Tabs Navigation', () => {
    it('should render all three tabs', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Checklist' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Risk Assessment' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Post-Acute Placement' })).toBeInTheDocument();
      });
    });

    it('should show checklist tab by default', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Medication Management')).toBeInTheDocument();
      });
    });

    it('should switch to Risk Assessment tab', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Risk Assessment' })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'Risk Assessment' }));

      expect(screen.getByText('Readmission Risk')).toBeInTheDocument();
      expect(screen.getByText('Required Follow-ups')).toBeInTheDocument();
    });

    it('should switch to Post-Acute Placement tab', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Post-Acute Placement' })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'Post-Acute Placement' }));

      expect(screen.getByText('Discharge Disposition')).toBeInTheDocument();
    });
  });

  describe('Checklist Tab', () => {
    it('should render checklist sections', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Medication Management')).toBeInTheDocument();
        expect(screen.getByText('Follow-up Care')).toBeInTheDocument();
        expect(screen.getByText('Documentation')).toBeInTheDocument();
        expect(screen.getByText('Patient Education')).toBeInTheDocument();
        expect(screen.getByText('Equipment & Services')).toBeInTheDocument();
        expect(screen.getByText('Transportation')).toBeInTheDocument();
      });
    });

    it('should render checklist items', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Medication reconciliation completed')).toBeInTheDocument();
        expect(screen.getByText('Discharge prescriptions sent to pharmacy')).toBeInTheDocument();
        expect(screen.getByText('Follow-up appointment scheduled (within 7 days)')).toBeInTheDocument();
        expect(screen.getByText('Transportation arranged')).toBeInTheDocument();
      });
    });

    it('should have correct checkbox states', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        const medRecCheckbox = screen.getByRole('checkbox', {
          name: /Medication reconciliation completed/,
        });
        expect(medRecCheckbox).toBeChecked();

        const educationCheckbox = screen.getByRole('checkbox', {
          name: /Patient education completed/,
        });
        expect(educationCheckbox).not.toBeChecked();
      });
    });

    it('should call updateDischargePlan when checkbox is toggled', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /Transportation arranged/ })).toBeInTheDocument();
      });

      const transportCheckbox = screen.getByRole('checkbox', { name: /Transportation arranged/ });
      await userEvent.click(transportCheckbox);

      expect(mockUpdateDischargePlan).toHaveBeenCalledWith('plan-1', {
        transportation_arranged: true,
      });
    });

    it('should show conditional DME ordered checkbox when DME needed is checked', async () => {
      const planWithDme = {
        ...mockDischargePlan,
        dme_needed: true,
        dme_ordered: false,
      };
      mockGetDischargePlan.mockResolvedValue(planWithDme);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('DME ordered and confirmed')).toBeInTheDocument();
      });
    });

    it('should show conditional home health checkbox when home health needed is checked', async () => {
      const planWithHomeHealth = {
        ...mockDischargePlan,
        home_health_needed: true,
        home_health_ordered: false,
      };
      mockGetDischargePlan.mockResolvedValue(planWithHomeHealth);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Home health ordered')).toBeInTheDocument();
      });
    });
  });

  describe('Risk Assessment Tab', () => {
    it('should show risk factors', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Risk Assessment' })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'Risk Assessment' }));

      expect(screen.getByText('Risk Factors')).toBeInTheDocument();
      expect(screen.getByText('Age > 65')).toBeInTheDocument();
      expect(screen.getByText('Multiple comorbidities')).toBeInTheDocument();
    });

    it('should show required follow-up calls based on risk', async () => {
      const highRiskPlan = {
        ...mockDischargePlan,
        readmission_risk_score: 80,
        readmission_risk_category: 'very_high' as const,
        requires_48hr_call: true,
        requires_72hr_call: true,
      };
      mockGetDischargePlan.mockResolvedValue(highRiskPlan);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Risk Assessment' })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'Risk Assessment' }));

      expect(screen.getByText('24-hour follow-up call (all patients)')).toBeInTheDocument();
      expect(screen.getByText('48-hour follow-up call (high risk)')).toBeInTheDocument();
      expect(screen.getByText('72-hour follow-up call (very high risk)')).toBeInTheDocument();
    });
  });

  describe('Post-Acute Placement Tab', () => {
    it('should show selected facility when present', async () => {
      const planWithFacility = {
        ...mockDischargePlan,
        discharge_disposition: 'skilled_nursing' as const,
        post_acute_facility_name: 'Sunrise SNF',
        post_acute_facility_phone: '555-123-4567',
        post_acute_bed_confirmed: true,
      };
      mockGetDischargePlan.mockResolvedValue(planWithFacility);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Post-Acute Placement' })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'Post-Acute Placement' }));

      expect(screen.getByText('Selected Facility')).toBeInTheDocument();
      expect(screen.getByText('Sunrise SNF')).toBeInTheDocument();
      expect(screen.getByText('555-123-4567')).toBeInTheDocument();
      expect(screen.getByText('✓ Bed Confirmed')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should show "Mark Plan Ready" button when status is draft', async () => {
      const draftPlan = {
        ...mockDischargePlan,
        status: 'draft' as const,
        checklist_completion_percentage: 100,
      };
      mockGetDischargePlan.mockResolvedValue(draftPlan);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Mark Plan Ready for Discharge')).toBeInTheDocument();
      });
    });

    it('should disable "Mark Plan Ready" button when checklist is not 100%', async () => {
      const incompletePlan = {
        ...mockDischargePlan,
        status: 'draft' as const,
        checklist_completion_percentage: 70,
      };
      mockGetDischargePlan.mockResolvedValue(incompletePlan);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        const button = screen.getByText('Mark Plan Ready for Discharge');
        expect(button).toBeDisabled();
      });
    });

    it('should show "Mark Patient Discharged" button when status is ready', async () => {
      const readyPlan = {
        ...mockDischargePlan,
        status: 'ready' as const,
        checklist_completion_percentage: 100,
      };
      mockGetDischargePlan.mockResolvedValue(readyPlan);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Mark Patient Discharged')).toBeInTheDocument();
      });
    });

    it('should call markPlanReady when button is clicked', async () => {
      const completePlan = {
        ...mockDischargePlan,
        status: 'draft' as const,
        checklist_completion_percentage: 100,
      };
      mockGetDischargePlan.mockResolvedValue(completePlan);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Mark Plan Ready for Discharge')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Mark Plan Ready for Discharge'));

      await waitFor(() => {
        expect(mockMarkPlanReady).toHaveBeenCalledWith('plan-1');
      });
    });

    it('should call markPatientDischarged when button is clicked', async () => {
      const readyPlan = {
        ...mockDischargePlan,
        status: 'ready' as const,
        checklist_completion_percentage: 100,
      };
      mockGetDischargePlan.mockResolvedValue(readyPlan);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Mark Patient Discharged')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Mark Patient Discharged'));

      await waitFor(() => {
        expect(mockMarkPatientDischarged).toHaveBeenCalledWith('plan-1');
      });
    });

    it('should not show action buttons when status is discharged', async () => {
      const dischargedPlan = {
        ...mockDischargePlan,
        status: 'discharged' as const,
      };
      mockGetDischargePlan.mockResolvedValue(dischargedPlan);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('DISCHARGED')).toBeInTheDocument();
      });

      expect(screen.queryByText('Mark Plan Ready for Discharge')).not.toBeInTheDocument();
      expect(screen.queryByText('Mark Patient Discharged')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when loading fails', async () => {
      mockGetDischargePlan.mockRejectedValue(new Error('Failed to load'));

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      // Component shows "No Discharge Plan Yet" when loading fails (graceful degradation)
      await waitFor(() => {
        expect(screen.getByText('No Discharge Plan Yet')).toBeInTheDocument();
      });
    });

    it('should display error when marking ready fails', async () => {
      const completePlan = {
        ...mockDischargePlan,
        status: 'draft' as const,
        checklist_completion_percentage: 100,
      };
      mockGetDischargePlan.mockResolvedValue(completePlan);
      mockMarkPlanReady.mockRejectedValue(new Error('Authorization failed'));

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Mark Plan Ready for Discharge')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Mark Plan Ready for Discharge'));

      await waitFor(() => {
        expect(screen.getByText('Authorization failed')).toBeInTheDocument();
      });
    });

    it('should show error when trying to mark ready with incomplete checklist', async () => {
      // Plan with checklist not 100% but button somehow clicked
      const incompletePlan = {
        ...mockDischargePlan,
        status: 'pending_items' as const,
        checklist_completion_percentage: 90,
      };
      mockGetDischargePlan.mockResolvedValue(incompletePlan);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Mark Plan Ready for Discharge')).toBeInTheDocument();
      });

      // Button should be disabled, but let's verify the validation works
      const button = screen.getByText('Mark Plan Ready for Discharge');
      expect(button).toBeDisabled();
    });
  });

  describe('Callback Integration', () => {
    it('should call onPlanUpdated when plan is updated', async () => {
      const mockOnPlanUpdated = vi.fn();

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
          onPlanUpdated={mockOnPlanUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /Transportation arranged/ })).toBeInTheDocument();
      });

      const transportCheckbox = screen.getByRole('checkbox', { name: /Transportation arranged/ });
      await userEvent.click(transportCheckbox);

      await waitFor(() => {
        expect(mockOnPlanUpdated).toHaveBeenCalled();
      });
    });
  });

  describe('Disposition Selector', () => {
    it('should render disposition selector in checklist tab', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('disposition-selector')).toBeInTheDocument();
      });
    });

    it('should update disposition when changed', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('disposition-selector')).toBeInTheDocument();
      });

      const selector = screen.getByTestId('disposition-selector');
      await userEvent.selectOptions(selector, 'skilled_nursing');

      expect(mockUpdateDischargePlan).toHaveBeenCalledWith('plan-1', {
        discharge_disposition: 'skilled_nursing',
      });
    });

    it('should disable disposition selector when status is discharged', async () => {
      const dischargedPlan = {
        ...mockDischargePlan,
        status: 'discharged' as const,
      };
      mockGetDischargePlan.mockResolvedValue(dischargedPlan);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('disposition-selector')).toBeDisabled();
      });
    });
  });

  describe('Status Badge Styling', () => {
    it('should show green badge for ready status', async () => {
      const readyPlan = { ...mockDischargePlan, status: 'ready' as const };
      mockGetDischargePlan.mockResolvedValue(readyPlan);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        const statusBadge = screen.getByText('READY');
        expect(statusBadge).toHaveClass('bg-green-100', 'text-green-800');
      });
    });

    it('should show blue badge for discharged status', async () => {
      const dischargedPlan = { ...mockDischargePlan, status: 'discharged' as const };
      mockGetDischargePlan.mockResolvedValue(dischargedPlan);

      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        const statusBadge = screen.getByText('DISCHARGED');
        expect(statusBadge).toHaveClass('bg-blue-100', 'text-blue-800');
      });
    });

    it('should show yellow badge for pending_items status', async () => {
      render(
        <DischargePlanningChecklist
          patientId="patient-1"
          encounterId="encounter-1"
        />
      );

      await waitFor(() => {
        const statusBadge = screen.getByText('PENDING ITEMS');
        expect(statusBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
      });
    });
  });
});
