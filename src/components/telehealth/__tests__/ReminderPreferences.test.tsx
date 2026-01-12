/**
 * ReminderPreferences Component Tests
 *
 * Tests for the appointment reminder preferences UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReminderPreferences from '../ReminderPreferences';

// Mock the reminder service
vi.mock('../../../services/appointmentReminderService', () => ({
  AppointmentReminderService: {
    getReminderPreferences: vi.fn(() =>
      Promise.resolve({
        success: true,
        data: {
          userId: 'test-user',
          reminder24hEnabled: true,
          reminder1hEnabled: true,
          reminder15mEnabled: false,
          smsEnabled: true,
          pushEnabled: true,
          emailEnabled: false,
          dndStartTime: null,
          dndEndTime: null,
          timezone: 'America/Chicago',
        },
      })
    ),
    updateReminderPreferences: vi.fn(() =>
      Promise.resolve({ success: true, data: { updated: true } })
    ),
  },
}));

// Mock audit logger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ReminderPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Structure', () => {
    it('should render the component title', async () => {
      render(<ReminderPreferences />);

      // Wait for loading to complete
      const title = await screen.findByText('Appointment Reminders');
      expect(title).toBeInTheDocument();
    });

    it('should display timing section', async () => {
      render(<ReminderPreferences />);

      const section = await screen.findByText('When to Remind Me');
      expect(section).toBeInTheDocument();
    });

    it('should display channel section', async () => {
      render(<ReminderPreferences />);

      const section = await screen.findByText('How to Notify Me');
      expect(section).toBeInTheDocument();
    });

    it('should display DND section', async () => {
      render(<ReminderPreferences />);

      const section = await screen.findByText('Do Not Disturb');
      expect(section).toBeInTheDocument();
    });

    it('should display timezone section', async () => {
      render(<ReminderPreferences />);

      const section = await screen.findByText('Timezone');
      expect(section).toBeInTheDocument();
    });
  });

  describe('Timing Options', () => {
    it('should show 24 hour reminder option', async () => {
      render(<ReminderPreferences />);

      const option = await screen.findByText('24 hours before appointment');
      expect(option).toBeInTheDocument();
    });

    it('should show 1 hour reminder option', async () => {
      render(<ReminderPreferences />);

      const option = await screen.findByText('1 hour before appointment');
      expect(option).toBeInTheDocument();
    });

    it('should show 15 minute reminder option', async () => {
      render(<ReminderPreferences />);

      const option = await screen.findByText('15 minutes before appointment');
      expect(option).toBeInTheDocument();
    });
  });

  describe('Channel Options', () => {
    it('should show SMS option', async () => {
      render(<ReminderPreferences />);

      const option = await screen.findByText('Text message (SMS)');
      expect(option).toBeInTheDocument();
    });

    it('should show push notification option', async () => {
      render(<ReminderPreferences />);

      const option = await screen.findByText('Push notification');
      expect(option).toBeInTheDocument();
    });

    it('should show email option', async () => {
      render(<ReminderPreferences />);

      const option = await screen.findByText('Email');
      expect(option).toBeInTheDocument();
    });
  });

  describe('DND Options', () => {
    it('should have From time input', async () => {
      render(<ReminderPreferences />);

      const label = await screen.findByText('From');
      expect(label).toBeInTheDocument();
    });

    it('should have To time input', async () => {
      render(<ReminderPreferences />);

      const label = await screen.findByText('To');
      expect(label).toBeInTheDocument();
    });
  });

  describe('Timezone Options', () => {
    it('should have timezone selector', async () => {
      render(<ReminderPreferences />);

      // Wait for preferences to load
      await screen.findByText('Timezone');

      // Look for a common timezone option
      const easternOption = screen.getByText('Central Time');
      expect(easternOption).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator initially', () => {
      render(<ReminderPreferences />);

      // Loading state should be visible initially
      const loadingText = screen.getByText('Loading preferences...');
      expect(loadingText).toBeInTheDocument();
    });
  });
});
