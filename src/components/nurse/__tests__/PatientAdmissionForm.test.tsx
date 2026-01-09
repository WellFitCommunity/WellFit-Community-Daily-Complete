/**
 * Tests for PatientAdmissionForm Component
 *
 * Purpose: Modal form for admitting patients to the hospital
 * Tests: Form rendering, validation, submission, patient loading, care protocol badges
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientAdmissionForm } from '../PatientAdmissionForm';

// Mock Supabase - must match the actual query chain in the component
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => {
          // patient_admissions query: .eq('is_active', true)
          if (table === 'patient_admissions') {
            return Promise.resolve({
              data: [{ patient_id: 'patient-3' }], // patient-3 is already admitted
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        }),
        in: vi.fn(() => {
          // profiles query: .in('role_id', [4, 19]) with care protocol fields
          if (table === 'profiles') {
            return Promise.resolve({
              data: [
                {
                  user_id: 'patient-1',
                  first_name: 'Gloria',
                  last_name: 'Simmons',
                  care_protocol_geriatric: true,
                  care_protocol_disability: false,
                  care_protocol_mental_health: true,
                  care_level: 'intensive',
                },
                {
                  user_id: 'patient-2',
                  first_name: 'Harold',
                  last_name: 'Washington',
                  care_protocol_geriatric: true,
                  care_protocol_disability: true,
                  care_protocol_mental_health: false,
                  care_level: 'elevated',
                },
                {
                  user_id: 'patient-3',
                  first_name: 'Bob',
                  last_name: 'Wilson',
                  care_protocol_geriatric: false,
                  care_protocol_disability: false,
                  care_protocol_mental_health: false,
                  care_level: 'standard',
                }, // Already admitted
                {
                  user_id: 'patient-4',
                  first_name: 'Maria',
                  last_name: 'Santos',
                  care_protocol_geriatric: false,
                  care_protocol_disability: false,
                  care_protocol_mental_health: false,
                  care_level: 'standard',
                },
              ],
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        }),
      })),
    })),
  },
}));

// Mock auditLogger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock patientAdmissionService
vi.mock('../../../services/patientAdmissionService', () => ({
  admitPatient: vi.fn(() => Promise.resolve('admission-123')),
}));

import { admitPatient } from '../../../services/patientAdmissionService';

describe('PatientAdmissionForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the admission form modal', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      // Check for the heading "Admit Patient" (appears in both heading and button)
      expect(screen.getByRole('heading', { name: /Admit Patient/i })).toBeInTheDocument();
    });

    it('should render patient dropdown', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render room number input', () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      expect(screen.getByPlaceholderText('e.g., 301A')).toBeInTheDocument();
    });

    it('should render facility unit input', () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      expect(screen.getByPlaceholderText('e.g., ICU, Med-Surg, Cardiology')).toBeInTheDocument();
    });

    it('should render admission diagnosis textarea', () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      expect(screen.getByPlaceholderText('Primary reason for admission...')).toBeInTheDocument();
    });

    it('should render Cancel and Admit Patient buttons', () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Admit Patient/i })).toBeInTheDocument();
    });

    it('should have required indicators on required fields', () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      // Two required fields: Patient and Room Number
      const requiredIndicators = screen.getAllByText('*');
      expect(requiredIndicators.length).toBe(2);
    });

    it('should render care protocol legend', () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      expect(screen.getByText('Care Protocol Badges:')).toBeInTheDocument();
      expect(screen.getByText('Geriatric')).toBeInTheDocument();
      expect(screen.getByText('Disability')).toBeInTheDocument();
      expect(screen.getByText('Mental Health')).toBeInTheDocument();
    });
  });

  describe('Patient Loading', () => {
    it('should render patient options after loading', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      // Wait for patients to load - they appear as options in select
      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });
    });

    it('should have placeholder option selected initially', () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('');
    });

    it('should display care protocol badges in patient options', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });

      // Check that badges appear in option text
      const select = screen.getByRole('combobox');
      const options = select.querySelectorAll('option');

      // Gloria should have GER, MH, HIGH badges
      const gloriaOption = Array.from(options).find(opt => opt.textContent?.includes('Gloria'));
      expect(gloriaOption?.textContent).toContain('[GER]');
      expect(gloriaOption?.textContent).toContain('[MH]');
      expect(gloriaOption?.textContent).toContain('[HIGH]');
    });

    it('should sort patients by care level (intensive first)', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });

      const select = screen.getByRole('combobox');
      const options = Array.from(select.querySelectorAll('option')).slice(1); // Skip placeholder

      // First option should be Gloria (intensive care level)
      expect(options[0].textContent).toContain('Gloria');
    });
  });

  describe('Form Input', () => {
    it('should update patient selection', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'patient-1' } });

      expect(select).toHaveValue('patient-1');
    });

    it('should show selected patient badges below dropdown', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'patient-1' } });

      // Should show "Selected:" with patient name and badges
      await waitFor(() => {
        expect(screen.getByText('Selected:')).toBeInTheDocument();
        expect(screen.getByText('Gloria Simmons')).toBeInTheDocument();
      });
    });

    it('should update room number input', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      const roomInput = screen.getByPlaceholderText('e.g., 301A');
      await userEvent.type(roomInput, '401B');

      expect(roomInput).toHaveValue('401B');
    });

    it('should update facility unit input', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      const unitInput = screen.getByPlaceholderText('e.g., ICU, Med-Surg, Cardiology');
      await userEvent.type(unitInput, 'Cardiology');

      expect(unitInput).toHaveValue('Cardiology');
    });

    it('should update admission diagnosis textarea', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      const diagnosisInput = screen.getByPlaceholderText('Primary reason for admission...');
      await userEvent.type(diagnosisInput, 'Chest pain, rule out MI');

      expect(diagnosisInput).toHaveValue('Chest pain, rule out MI');
    });
  });

  describe('Validation', () => {
    it('should show error when both patient and room are empty on submit', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      // Get form and submit it directly to bypass HTML5 validation
      const form = document.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Patient and room number are required')).toBeInTheDocument();
      });
    });

    it('should show error when room number is empty', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });

      // Select a patient but leave room empty
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'patient-1' } });

      // Submit form directly to bypass HTML5 validation
      const form = document.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Patient and room number are required')).toBeInTheDocument();
      });
    });

    it('should show error when patient is not selected', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      // Type room number but don't select patient
      const roomInput = screen.getByPlaceholderText('e.g., 301A');
      await userEvent.type(roomInput, '401B');

      // Submit form directly to bypass HTML5 validation
      const form = document.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Patient and room number are required')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call admitPatient service on valid submission', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });

      // Select patient
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'patient-1' } });

      // Type room number
      const roomInput = screen.getByPlaceholderText('e.g., 301A');
      await userEvent.type(roomInput, '401B');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Admit Patient/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(admitPatient).toHaveBeenCalledWith(
          expect.objectContaining({
            patient_id: 'patient-1',
            room_number: '401B',
          })
        );
      });
    });

    it('should call onSuccess after successful submission', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });

      // Fill form
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'patient-1' } });

      const roomInput = screen.getByPlaceholderText('e.g., 301A');
      await userEvent.type(roomInput, '401B');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Admit Patient/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should show loading state during submission', async () => {
      vi.mocked(admitPatient).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('admission-123'), 100))
      );

      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });

      // Fill form
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'patient-1' } });

      const roomInput = screen.getByPlaceholderText('e.g., 301A');
      await userEvent.type(roomInput, '401B');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Admit Patient/i });
      await userEvent.click(submitButton);

      // Should show loading text
      expect(screen.getByText('Admitting...')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when submission fails', async () => {
      vi.mocked(admitPatient).mockRejectedValue(new Error('Admission failed'));

      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });

      // Fill form
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'patient-1' } });

      const roomInput = screen.getByPlaceholderText('e.g., 301A');
      await userEvent.type(roomInput, '401B');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Admit Patient/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Admission failed')).toBeInTheDocument();
      });
    });

    it('should not call onSuccess when submission fails', async () => {
      vi.mocked(admitPatient).mockRejectedValue(new Error('Admission failed'));

      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });

      // Fill form
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'patient-1' } });

      const roomInput = screen.getByPlaceholderText('e.g., 301A');
      await userEvent.type(roomInput, '401B');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Admit Patient/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Admission failed')).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Cancel Action', () => {
    it('should call onCancel when Cancel button is clicked', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await userEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Modal Styling', () => {
    it('should render with modal backdrop', () => {
      const { container } = render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      const backdrop = container.firstChild;
      expect(backdrop).toHaveClass('fixed', 'inset-0', 'bg-black', 'bg-opacity-50');
    });

    it('should render form with proper styling', () => {
      const { container } = render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      const formContainer = container.querySelector('.bg-white.rounded-lg');
      expect(formContainer).toBeInTheDocument();
    });
  });

  describe('Care Protocol Filtering', () => {
    it('should exclude already admitted patients from list', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });

      const select = screen.getByRole('combobox');
      const options = select.querySelectorAll('option');

      // patient-3 (Bob Wilson) is admitted and should not appear
      const bobOption = Array.from(options).find(opt => opt.textContent?.includes('Bob'));
      expect(bobOption).toBeUndefined();
    });

    it('should show patients without protocols with no badges', async () => {
      render(
        <PatientAdmissionForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
      });

      const select = screen.getByRole('combobox');
      const options = select.querySelectorAll('option');

      // Maria should have no badges (standard care, no protocols)
      const mariaOption = Array.from(options).find(opt => opt.textContent?.includes('Maria'));
      expect(mariaOption?.textContent).not.toContain('[');
    });
  });
});
