/**
 * RescheduleAppointmentModal Tests
 *
 * Tests for the appointment rescheduling modal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RescheduleAppointmentModal, {
  type AppointmentToReschedule,
} from '../RescheduleAppointmentModal';

// Mock services
vi.mock('../../../services/appointmentService', () => ({
  AppointmentService: {
    checkAppointmentAvailability: vi.fn(),
    rescheduleAppointment: vi.fn(),
  },
}));

vi.mock('../../../services/availabilityService', () => ({
  AvailabilityService: {
    getAvailableSlots: vi.fn(),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RescheduleAppointmentModal', () => {
  const mockAppointment: AppointmentToReschedule = {
    id: 'apt-123',
    patientName: 'John Doe',
    providerId: 'provider-456',
    currentTime: new Date('2026-01-15T10:00:00Z'),
    durationMinutes: 30,
    encounterType: 'outpatient',
    reasonForVisit: 'Follow-up consultation',
  };

  const mockOnClose = vi.fn();
  const mockOnRescheduled = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Structure', () => {
    it('should render when isOpen is true', () => {
      render(
        <RescheduleAppointmentModal
          appointment={mockAppointment}
          isOpen={true}
          onClose={mockOnClose}
          onRescheduled={mockOnRescheduled}
        />
      );

      expect(screen.getByText('Reschedule Appointment')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(
        <RescheduleAppointmentModal
          appointment={mockAppointment}
          isOpen={false}
          onClose={mockOnClose}
          onRescheduled={mockOnRescheduled}
        />
      );

      expect(screen.queryByText('Reschedule Appointment')).not.toBeInTheDocument();
    });

    it('should display current appointment information', () => {
      render(
        <RescheduleAppointmentModal
          appointment={mockAppointment}
          isOpen={true}
          onClose={mockOnClose}
          onRescheduled={mockOnRescheduled}
        />
      );

      expect(screen.getByText('Current Appointment')).toBeInTheDocument();
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      // Duration appears multiple times (info section + dropdown), use getAllByText
      expect(screen.getAllByText(/30 minutes/).length).toBeGreaterThan(0);
      expect(screen.getByText(/outpatient/)).toBeInTheDocument();
    });

    it('should have a date input field', () => {
      render(
        <RescheduleAppointmentModal
          appointment={mockAppointment}
          isOpen={true}
          onClose={mockOnClose}
          onRescheduled={mockOnRescheduled}
        />
      );

      expect(screen.getByLabelText('New Date')).toBeInTheDocument();
    });

    it('should have a duration select field', () => {
      render(
        <RescheduleAppointmentModal
          appointment={mockAppointment}
          isOpen={true}
          onClose={mockOnClose}
          onRescheduled={mockOnRescheduled}
        />
      );

      expect(screen.getByLabelText('Duration (minutes)')).toBeInTheDocument();
    });

    it('should have a reason select field', () => {
      render(
        <RescheduleAppointmentModal
          appointment={mockAppointment}
          isOpen={true}
          onClose={mockOnClose}
          onRescheduled={mockOnRescheduled}
        />
      );

      expect(screen.getByLabelText('Reason for Rescheduling')).toBeInTheDocument();
    });

    it('should have cancel and confirm buttons', () => {
      render(
        <RescheduleAppointmentModal
          appointment={mockAppointment}
          isOpen={true}
          onClose={mockOnClose}
          onRescheduled={mockOnRescheduled}
        />
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Confirm Reschedule')).toBeInTheDocument();
    });
  });

  describe('AppointmentToReschedule Type', () => {
    it('should accept all required fields', () => {
      const appointment: AppointmentToReschedule = {
        id: 'apt-789',
        patientName: 'Jane Smith',
        providerId: 'provider-123',
        currentTime: new Date('2026-01-20T14:00:00Z'),
        durationMinutes: 45,
        encounterType: 'urgent-care',
      };

      expect(appointment.id).toBe('apt-789');
      expect(appointment.patientName).toBe('Jane Smith');
      expect(appointment.providerId).toBe('provider-123');
      expect(appointment.durationMinutes).toBe(45);
      expect(appointment.encounterType).toBe('urgent-care');
    });

    it('should accept optional reasonForVisit', () => {
      const appointment: AppointmentToReschedule = {
        id: 'apt-abc',
        patientName: 'Bob Wilson',
        providerId: 'provider-xyz',
        currentTime: new Date(),
        durationMinutes: 30,
        encounterType: 'er',
        reasonForVisit: 'Emergency follow-up',
      };

      expect(appointment.reasonForVisit).toBe('Emergency follow-up');
    });

    it('should work without reasonForVisit', () => {
      const appointment: AppointmentToReschedule = {
        id: 'apt-def',
        patientName: 'Alice Brown',
        providerId: 'provider-uvw',
        currentTime: new Date(),
        durationMinutes: 60,
        encounterType: 'outpatient',
      };

      expect(appointment.reasonForVisit).toBeUndefined();
    });
  });

  describe('Duration Options', () => {
    it('should display all standard duration options', () => {
      render(
        <RescheduleAppointmentModal
          appointment={mockAppointment}
          isOpen={true}
          onClose={mockOnClose}
          onRescheduled={mockOnRescheduled}
        />
      );

      const durationSelect = screen.getByLabelText('Duration (minutes)') as HTMLSelectElement;
      const options = Array.from(durationSelect.options).map(opt => opt.text);

      expect(options).toContain('15 minutes');
      expect(options).toContain('30 minutes');
      expect(options).toContain('45 minutes');
      expect(options).toContain('60 minutes');
      expect(options).toContain('90 minutes');
    });
  });

  describe('Reschedule Reasons', () => {
    it('should display all standard reschedule reasons', () => {
      render(
        <RescheduleAppointmentModal
          appointment={mockAppointment}
          isOpen={true}
          onClose={mockOnClose}
          onRescheduled={mockOnRescheduled}
        />
      );

      const reasonSelect = screen.getByLabelText('Reason for Rescheduling') as HTMLSelectElement;
      const options = Array.from(reasonSelect.options).map(opt => opt.text);

      expect(options).toContain('Patient requested');
      expect(options).toContain('Provider unavailable');
      expect(options).toContain('Scheduling conflict');
      expect(options).toContain('Emergency');
      expect(options).toContain('Weather/external factors');
      expect(options).toContain('Other');
    });
  });

  describe('Modal Behavior', () => {
    it('should have a background overlay', () => {
      render(
        <RescheduleAppointmentModal
          appointment={mockAppointment}
          isOpen={true}
          onClose={mockOnClose}
          onRescheduled={mockOnRescheduled}
        />
      );

      // Modal should have overlay with specific class
      const overlay = document.querySelector('.bg-gray-500.bg-opacity-75');
      expect(overlay).toBeInTheDocument();
    });

    it('should be a form element', () => {
      render(
        <RescheduleAppointmentModal
          appointment={mockAppointment}
          isOpen={true}
          onClose={mockOnClose}
          onRescheduled={mockOnRescheduled}
        />
      );

      expect(document.querySelector('form')).toBeInTheDocument();
    });
  });

  describe('Props Validation', () => {
    it('should pass appointment to display', () => {
      const customAppointment: AppointmentToReschedule = {
        id: 'custom-id',
        patientName: 'Custom Patient',
        providerId: 'custom-provider',
        currentTime: new Date('2026-02-01T09:00:00Z'),
        durationMinutes: 15,
        encounterType: 'outpatient',
      };

      render(
        <RescheduleAppointmentModal
          appointment={customAppointment}
          isOpen={true}
          onClose={mockOnClose}
          onRescheduled={mockOnRescheduled}
        />
      );

      expect(screen.getByText(/Custom Patient/)).toBeInTheDocument();
      // Check that duration appears (multiple matches are fine with getAllByText)
      expect(screen.getAllByText(/15 minutes/).length).toBeGreaterThan(0);
    });
  });
});
