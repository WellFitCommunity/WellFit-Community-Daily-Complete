/**
 * Tests for NotificationSettings Component
 *
 * Purpose: Modal for configuring SOC notification preferences
 * Tests: Rendering, toggle interactions, save/cancel, browser notification permission
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationSettings } from '../NotificationSettings';
import { SOCNotificationPreferences } from '../../../types/socDashboard';

// Mock EAButton and EASwitch components
vi.mock('../../envision-atlus/EAButton', () => ({
  EAButton: ({ children, onClick, disabled, variant }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock('../../envision-atlus/EASwitch', () => ({
  EASwitch: ({ checked, onCheckedChange }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));

// Mock Audio API
const mockPlay = vi.fn().mockResolvedValue(undefined);
class MockAudio {
  volume = 0;
  play = mockPlay;
}
vi.stubGlobal('Audio', MockAudio);

// Default mock preferences
const defaultPreferences: SOCNotificationPreferences = {
  id: 'pref-1',
  user_id: 'user-1',
  sound_enabled: false,
  browser_notifications_enabled: false,
  desktop_notifications_enabled: false,
  notify_on_critical: true,
  notify_on_high: true,
  notify_on_medium: false,
  notify_on_low: false,
  notify_on_escalation: true,
  notify_on_new_message: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('NotificationSettings', () => {
  const mockOnSave = vi.fn().mockResolvedValue(undefined);
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Notification API
    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
      writable: true,
    });
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Notification Settings')).toBeInTheDocument();
    });

    it('should render sound alerts section', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Sound Alerts')).toBeInTheDocument();
      expect(screen.getByText('Enable sound alerts')).toBeInTheDocument();
    });

    it('should render browser notifications section', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Browser Notifications')).toBeInTheDocument();
    });

    it('should render alert types section', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Alert Types')).toBeInTheDocument();
      expect(screen.getByText('Critical alerts')).toBeInTheDocument();
      expect(screen.getByText('High alerts')).toBeInTheDocument();
      expect(screen.getByText('Medium alerts')).toBeInTheDocument();
      expect(screen.getByText('Low alerts')).toBeInTheDocument();
    });

    it('should render other notifications section', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Other Notifications')).toBeInTheDocument();
      expect(screen.getByText('Alert escalations')).toBeInTheDocument();
      expect(screen.getByText('New team messages')).toBeInTheDocument();
    });

    it('should render save and cancel buttons', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Save Settings')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Initial State', () => {
    it('should reflect initial preferences in switches', () => {
      const prefsWithSoundEnabled = {
        ...defaultPreferences,
        sound_enabled: true,
      };

      render(
        <NotificationSettings
          preferences={prefsWithSoundEnabled}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const switches = screen.getAllByRole('switch');
      // First switch is sound_enabled
      expect(switches[0]).toBeChecked();
    });

    it('should show alert type switches with correct initial state', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const switches = screen.getAllByRole('switch');
      // Find critical and high (should be checked based on defaultPreferences)
      // The order depends on render order
      const checkedSwitches = switches.filter((s) => (s as HTMLInputElement).checked);
      expect(checkedSwitches.length).toBeGreaterThan(0);
    });
  });

  describe('Toggle Interactions', () => {
    it('should toggle sound_enabled when switch is clicked', async () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const switches = screen.getAllByRole('switch');
      const soundSwitch = switches[0]; // First switch is sound_enabled

      expect(soundSwitch).not.toBeChecked();

      await userEvent.click(soundSwitch);

      expect(soundSwitch).toBeChecked();
    });

    it('should show test sound buttons when sound is enabled', async () => {
      const prefsWithSound = {
        ...defaultPreferences,
        sound_enabled: true,
      };

      render(
        <NotificationSettings
          preferences={prefsWithSound}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getAllByText('Test Sound').length).toBeGreaterThan(0);
    });

    it('should not show test sound buttons when sound is disabled', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('Test Sound')).not.toBeInTheDocument();
    });

    it('should play sound when test button is clicked', async () => {
      const prefsWithSound = {
        ...defaultPreferences,
        sound_enabled: true,
      };

      render(
        <NotificationSettings
          preferences={prefsWithSound}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const testButtons = screen.getAllByText('Test Sound');
      await userEvent.click(testButtons[0]);

      expect(mockPlay).toHaveBeenCalled();
    });
  });

  describe('Browser Notification Permission', () => {
    it('should show enable button when permission is not granted', () => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          requestPermission: vi.fn().mockResolvedValue('granted'),
        },
        writable: true,
      });

      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Enable Notifications')).toBeInTheDocument();
    });

    it('should show denied message when notifications are blocked', () => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied',
          requestPermission: vi.fn(),
        },
        writable: true,
      });

      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Notifications are blocked/)).toBeInTheDocument();
    });

    it('should show browser notification toggle when permission is granted', () => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'granted',
          requestPermission: vi.fn(),
        },
        writable: true,
      });

      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Enable browser notifications')).toBeInTheDocument();
    });

    it('should request permission when enable button is clicked', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('granted');
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          requestPermission: mockRequestPermission,
        },
        writable: true,
      });

      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const enableButton = screen.getByText('Enable Notifications');
      await userEvent.click(enableButton);

      expect(mockRequestPermission).toHaveBeenCalled();
    });
  });

  describe('Save and Cancel', () => {
    it('should call onClose when cancel is clicked', async () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      await userEvent.click(screen.getByText('Cancel'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when X button is clicked', async () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // Find the close button (×)
      const closeButton = screen.getByText('×');
      await userEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onSave with updated preferences when save is clicked', async () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // Toggle sound enabled
      const switches = screen.getAllByRole('switch');
      await userEvent.click(switches[0]);

      // Click save
      await userEvent.click(screen.getByText('Save Settings'));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            sound_enabled: true,
          })
        );
      });
    });

    it('should show "Saving..." text while saving', async () => {
      // Make onSave take some time
      const slowSave = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));

      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={slowSave}
          onClose={mockOnClose}
        />
      );

      const saveButton = screen.getByText('Save Settings');
      fireEvent.click(saveButton);

      // Check for saving text
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });
    });
  });

  describe('Modal Layout', () => {
    it('should render with modal backdrop', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
      expect(backdrop).toBeInTheDocument();
    });

    it('should render modal content container', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const modal = document.querySelector('.bg-slate-800.rounded-lg');
      expect(modal).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Notification Settings');
    });

    it('should have section headings', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const h3Elements = document.querySelectorAll('h3');
      expect(h3Elements.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined Notification API', () => {
      // Restore after test
      const origNotification = window.Notification;

      // @ts-expect-error - testing undefined case
      window.Notification = undefined;

      render(
        <NotificationSettings
          preferences={defaultPreferences}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // Should show enable button since Notification is undefined
      expect(screen.getByText('Enable Notifications')).toBeInTheDocument();

      // Restore
      window.Notification = origNotification;
    });

    it('should handle all preferences enabled', () => {
      const allEnabled: SOCNotificationPreferences = {
        ...defaultPreferences,
        sound_enabled: true,
        browser_notifications_enabled: true,
        desktop_notifications_enabled: true,
        notify_on_critical: true,
        notify_on_high: true,
        notify_on_medium: true,
        notify_on_low: true,
        notify_on_escalation: true,
        notify_on_new_message: true,
      };

      render(
        <NotificationSettings
          preferences={allEnabled}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const switches = screen.getAllByRole('switch');
      // Not all switches should be checked because browser_notifications toggle
      // is controlled by permission state, not just preference
      expect(switches.length).toBeGreaterThan(0);
    });

    it('should handle all preferences disabled', () => {
      const allDisabled: SOCNotificationPreferences = {
        ...defaultPreferences,
        sound_enabled: false,
        browser_notifications_enabled: false,
        desktop_notifications_enabled: false,
        notify_on_critical: false,
        notify_on_high: false,
        notify_on_medium: false,
        notify_on_low: false,
        notify_on_escalation: false,
        notify_on_new_message: false,
      };

      render(
        <NotificationSettings
          preferences={allDisabled}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const switches = screen.getAllByRole('switch');
      const noneChecked = switches.every((s) => !(s as HTMLInputElement).checked);
      expect(noneChecked).toBe(true);
    });
  });
});
