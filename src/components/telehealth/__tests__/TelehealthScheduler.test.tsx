// src/components/telehealth/__tests__/TelehealthScheduler.test.tsx
// Tests for the provider telehealth scheduling component

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TelehealthScheduler from '../TelehealthScheduler';
import { useSupabaseClient, useUser } from '../../../contexts/AuthContext';

// Mock the auth context
jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: jest.fn(),
  useUser: jest.fn(),
}));

describe.skip('TelehealthScheduler', () => {
  let mockSupabase: any;
  let mockUser: any;

  beforeEach(() => {
    // Reset mocks before each test
    mockUser = {
      id: 'provider-123',
      email: 'doctor@test.com',
    };

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      functions: {
        invoke: jest.fn().mockResolvedValue({ data: {}, error: null }),
      },
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
        unsubscribe: jest.fn(),
      }),
    };

    (useUser as jest.Mock).mockReturnValue(mockUser);
    (useSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders scheduling form', () => {
    render(<TelehealthScheduler />);

    expect(screen.getByText(/Schedule Video Appointment/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by name or phone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schedule Appointment/i })).toBeInTheDocument();
  });

  test('allows patient search by name', async () => {
    const mockPatients = [
      {
        user_id: 'patient-1',
        full_name: 'John Doe',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+15551234567',
        email: 'john@test.com',
        dob: '1950-01-01',
      },
    ];

    mockSupabase.select.mockResolvedValueOnce({
      data: mockPatients,
      error: null,
    });

    render(<TelehealthScheduler />);

    const searchInput = screen.getByPlaceholderText(/Search by name or phone/i);
    fireEvent.change(searchInput, { target: { value: 'John' } });

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    });
  });

  test('validates required fields before scheduling', async () => {
    render(<TelehealthScheduler />);

    const scheduleButton = screen.getByRole('button', { name: /Schedule Appointment/i });
    fireEvent.click(scheduleButton);

    await waitFor(() => {
      expect(screen.getByText(/Please select a patient/i)).toBeInTheDocument();
    });
  });

  test('schedules appointment successfully', async () => {
    const mockPatient = {
      user_id: 'patient-1',
      full_name: 'John Doe',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+15551234567',
      email: 'john@test.com',
      dob: '1950-01-01',
    };

    const mockAppointment = {
      id: 'appointment-1',
      patient_id: 'patient-1',
      provider_id: 'provider-123',
      appointment_time: '2025-10-22T14:00:00Z',
      duration_minutes: 30,
      encounter_type: 'outpatient',
      status: 'scheduled',
    };

    mockSupabase.select
      .mockResolvedValueOnce({ data: [mockPatient], error: null }) // Patient search
      .mockResolvedValueOnce({ data: mockAppointment, error: null }); // Insert appointment

    render(<TelehealthScheduler />);

    // Search and select patient
    const searchInput = screen.getByPlaceholderText(/Search by name or phone/i);
    fireEvent.change(searchInput, { target: { value: 'John' } });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('John Doe'));

    // Fill in appointment details
    const dateInput = screen.getByLabelText(/Date/i);
    const timeInput = screen.getByLabelText(/Time/i);

    fireEvent.change(dateInput, { target: { value: '2025-10-22' } });
    fireEvent.change(timeInput, { target: { value: '14:00' } });

    // Submit
    const scheduleButton = screen.getByRole('button', { name: /Schedule Appointment/i });
    fireEvent.click(scheduleButton);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('telehealth_appointments');
      expect(mockSupabase.insert).toHaveBeenCalled();
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'send-telehealth-appointment-notification',
        expect.any(Object)
      );
    });
  });

  test('displays upcoming appointments', async () => {
    const mockAppointments = [
      {
        id: 'apt-1',
        appointment_time: '2025-10-22T14:00:00Z',
        duration_minutes: 30,
        encounter_type: 'outpatient',
        status: 'scheduled',
        reason_for_visit: 'Follow-up',
        patient: {
          full_name: 'John Doe',
          first_name: 'John',
          last_name: 'Doe',
          phone: '+15551234567',
        },
      },
    ];

    mockSupabase.select.mockResolvedValueOnce({
      data: mockAppointments,
      error: null,
    });

    render(<TelehealthScheduler />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText(/Follow-up/i)).toBeInTheDocument();
    });
  });

  test('allows canceling appointments', async () => {
    const mockAppointments = [
      {
        id: 'apt-1',
        appointment_time: '2025-10-22T14:00:00Z',
        duration_minutes: 30,
        encounter_type: 'outpatient',
        status: 'scheduled',
        reason_for_visit: 'Follow-up',
        patient: {
          full_name: 'John Doe',
          first_name: 'John',
          last_name: 'Doe',
          phone: '+15551234567',
        },
      },
    ];

    mockSupabase.select.mockResolvedValueOnce({
      data: mockAppointments,
      error: null,
    });

    // Mock window.confirm
    global.confirm = jest.fn(() => true);

    render(<TelehealthScheduler />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(mockSupabase.update).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'apt-1');
    });
  });

  test('handles different encounter types', () => {
    render(<TelehealthScheduler />);

    const visitTypeSelect = screen.getByLabelText(/Visit Type/i);

    expect(visitTypeSelect).toBeInTheDocument();
    expect(screen.getByText('Regular Visit')).toBeInTheDocument();
    expect(screen.getByText('Urgent Care')).toBeInTheDocument();
    expect(screen.getByText('Emergency')).toBeInTheDocument();
  });

  test('handles errors gracefully', async () => {
    mockSupabase.select.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    render(<TelehealthScheduler />);

    // Should not crash, should handle error gracefully
    await waitFor(() => {
      expect(screen.getByText(/Schedule Video Appointment/i)).toBeInTheDocument();
    });
  });
});
