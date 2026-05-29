/**
 * Tests for AddFamilyHistoryForm — ONC 170.315(a)(12) Family Health History capture.
 *
 * Each test is behavioral — would fail if the component rendered an empty
 * <div /> (per CLAUDE.md deletion test).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddFamilyHistoryForm } from '../AddFamilyHistoryForm';
import { FamilyMemberHistoryService } from '../../../../../services/fhir/FamilyMemberHistoryService';
import { FamilyMemberHistoryConditionService } from '../../../../../services/fhir/FamilyMemberHistoryConditionService';
import { useOrderingProvider } from '../../../../../hooks/useOrderingProvider';

vi.mock('../../../../../services/fhir/FamilyMemberHistoryService', () => ({
  FamilyMemberHistoryService: { create: vi.fn() },
}));
vi.mock('../../../../../services/fhir/FamilyMemberHistoryConditionService', () => ({
  FamilyMemberHistoryConditionService: { create: vi.fn() },
}));
vi.mock('../../../../../hooks/useOrderingProvider', () => ({
  useOrderingProvider: vi.fn(),
}));

const mockedMemberCreate = vi.mocked(FamilyMemberHistoryService.create);
const mockedCondCreate = vi.mocked(FamilyMemberHistoryConditionService.create);
const mockedProvider = vi.mocked(useOrderingProvider);

const TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';
const REQUESTER_USER_ID = '11111111-1111-1111-1111-111111111111';
const PATIENT_ID = '00000000-0000-0000-0000-000000000001';

function setProviderReady() {
  mockedProvider.mockReturnValue({
    loading: false,
    error: null,
    tenant_id: TENANT_ID,
    user_id: REQUESTER_USER_ID,
    display_name: 'Dr. Test Provider',
    practitioner_id: null,
  });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/relationship to patient/i), {
    target: { value: 'MTH' },
  });
  fireEvent.change(screen.getByLabelText(/condition \/ diagnosis/i), {
    target: { value: 'Type 2 diabetes mellitus' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedMemberCreate.mockReset();
  mockedCondCreate.mockReset();
  setProviderReady();
  mockedMemberCreate.mockResolvedValue({
    success: true,
    data: {
      id: 'fmh-123',
      patient_id: PATIENT_ID,
      status: 'completed',
      relationship_display: 'Mother',
    } as never,
  });
  mockedCondCreate.mockResolvedValue({
    success: true,
    data: {
      id: 'fmhc-456',
      patient_id: PATIENT_ID,
      family_member_history_id: 'fmh-123',
      condition_display: 'Type 2 diabetes mellitus',
    } as never,
  });
});

describe('AddFamilyHistoryForm — ONC (a)(12) capture behavior', () => {
  describe('field validation', () => {
    it('blocks submit when relationship is not selected', async () => {
      render(<AddFamilyHistoryForm patientId={PATIENT_ID} />);
      fireEvent.change(screen.getByLabelText(/condition \/ diagnosis/i), {
        target: { value: 'Type 2 diabetes mellitus' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save family history/i }));
      expect(await screen.findByText(/relationship is required/i)).toBeInTheDocument();
      expect(mockedMemberCreate).not.toHaveBeenCalled();
    });

    it('blocks submit when condition is empty', async () => {
      render(<AddFamilyHistoryForm patientId={PATIENT_ID} />);
      fireEvent.change(screen.getByLabelText(/relationship to patient/i), {
        target: { value: 'MTH' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save family history/i }));
      expect(await screen.findByText(/condition is required/i)).toBeInTheDocument();
      expect(mockedMemberCreate).not.toHaveBeenCalled();
    });
  });

  describe('submit — FHIR FamilyMemberHistory + condition shape', () => {
    it('persists a FamilyMemberHistory with tenant + relationship fields', async () => {
      render(<AddFamilyHistoryForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /save family history/i }));

      await waitFor(() => expect(mockedMemberCreate).toHaveBeenCalledTimes(1));
      const arg = mockedMemberCreate.mock.calls[0][0];
      expect(arg.patient_id).toBe(PATIENT_ID);
      expect(arg.status).toBe('completed');
      expect(arg.relationship_code).toBe('MTH');
      expect(arg.relationship_display).toBe('Mother');
      expect(arg.relationship_system).toMatch(/v3-RoleCode/);
      // Without tenant_id the INSERT RLS policy rejects.
      expect(arg.tenant_id).toBe(TENANT_ID);
      expect(arg.fhir_id).toMatch(/^fmh-/);
    });

    it('persists a condition linking to the new member, with age at onset and contributed-to-death', async () => {
      render(<AddFamilyHistoryForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText(/age at onset/i), {
        target: { value: '50 yr' },
      });
      fireEvent.click(screen.getByLabelText(/contributed to the member/i));
      fireEvent.click(screen.getByRole('button', { name: /save family history/i }));

      await waitFor(() => expect(mockedCondCreate).toHaveBeenCalledTimes(1));
      const arg = mockedCondCreate.mock.calls[0][0];
      expect(arg.patient_id).toBe(PATIENT_ID);
      expect(arg.family_member_history_id).toBe('fmh-123');
      expect(arg.condition_display).toBe('Type 2 diabetes mellitus');
      expect(arg.onset_age_string).toBe('50 yr');
      expect(arg.contributed_to_death).toBe(true);
      expect(arg.tenant_id).toBe(TENANT_ID);
      expect(arg.fhir_id).toMatch(/^fmhc-/);
    });

    it('invokes onSubmitted with the new member id when both records persist', async () => {
      const onSubmitted = vi.fn();
      render(<AddFamilyHistoryForm patientId={PATIENT_ID} onSubmitted={onSubmitted} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /save family history/i }));
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('fmh-123'));
    });

    it('surfaces a partial-success warning if the condition insert fails', async () => {
      mockedCondCreate.mockResolvedValueOnce({ success: false, error: 'condition RLS rejected' });
      const onSubmitted = vi.fn();
      render(<AddFamilyHistoryForm patientId={PATIENT_ID} onSubmitted={onSubmitted} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /save family history/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/condition rls rejected/i);
      expect(alert).toHaveTextContent(/family member record was saved/i);
      expect(onSubmitted).not.toHaveBeenCalled();
    });
  });

  describe('ordering-provider gating', () => {
    it('disables submit while provider is loading', () => {
      mockedProvider.mockReturnValue({
        loading: true,
        error: null,
        tenant_id: null,
        user_id: null,
        display_name: null,
        practitioner_id: null,
      });
      render(<AddFamilyHistoryForm patientId={PATIENT_ID} />);
      expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
    });

    it('blocks submit + surfaces the error when tenant resolution fails', () => {
      mockedProvider.mockReturnValue({
        loading: false,
        error: 'Your profile is not assigned to a tenant. Contact your administrator.',
        tenant_id: null,
        user_id: REQUESTER_USER_ID,
        display_name: null,
        practitioner_id: null,
      });
      render(<AddFamilyHistoryForm patientId={PATIENT_ID} />);
      expect(screen.getByText(/profile is not assigned to a tenant/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save family history/i })).toBeDisabled();
      expect(mockedMemberCreate).not.toHaveBeenCalled();
    });
  });

  describe('error surfacing', () => {
    it('shows a warning when the member create errors and does NOT create a condition', async () => {
      mockedMemberCreate.mockResolvedValueOnce({ success: false, error: 'Network failure' });
      render(<AddFamilyHistoryForm patientId={PATIENT_ID} />);
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: /save family history/i }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/network failure/i);
      expect(mockedCondCreate).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('calls onCancel when the cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<AddFamilyHistoryForm patientId={PATIENT_ID} onCancel={onCancel} />);
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      expect(onCancel).toHaveBeenCalled();
    });
  });
});
