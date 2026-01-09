/**
 * Tests for PresenceIndicator Component
 *
 * Purpose: Shows online SOC operators in the dashboard header
 * Tests: Rendering, avatar display, dropdown behavior, status colors
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresenceIndicator } from '../PresenceIndicator';
import { SOCPresence } from '../../../types/socDashboard';

// Mock operators data
const mockOperators: SOCPresence[] = [
  {
    id: 'presence-1',
    user_id: 'user-1',
    user_name: 'Alice Smith',
    user_email: 'alice@example.com',
    status: 'online',
    last_seen_at: new Date().toISOString(),
    session_started_at: new Date().toISOString(),
    current_alert_id: null,
    user_agent: 'Mozilla/5.0',
  },
  {
    id: 'presence-2',
    user_id: 'user-2',
    user_name: 'Bob Jones',
    user_email: 'bob@example.com',
    status: 'busy',
    last_seen_at: new Date().toISOString(),
    session_started_at: new Date().toISOString(),
    current_alert_id: 'alert-123',
    user_agent: 'Mozilla/5.0',
  },
  {
    id: 'presence-3',
    user_id: 'user-3',
    user_name: 'Charlie Brown',
    user_email: 'charlie@example.com',
    status: 'away',
    last_seen_at: new Date().toISOString(),
    session_started_at: new Date().toISOString(),
    current_alert_id: null,
    user_agent: 'Mozilla/5.0',
  },
  {
    id: 'presence-4',
    user_id: 'user-4',
    user_name: 'Diana Prince',
    user_email: 'diana@example.com',
    status: 'online',
    last_seen_at: new Date().toISOString(),
    session_started_at: new Date().toISOString(),
    current_alert_id: null,
    user_agent: 'Mozilla/5.0',
  },
];

describe('PresenceIndicator', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<PresenceIndicator operators={[]} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render online count correctly', () => {
      render(<PresenceIndicator operators={mockOperators} />);
      // 2 online operators (Alice and Diana)
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('online')).toBeInTheDocument();
    });

    it('should render busy count when operators are busy', () => {
      render(<PresenceIndicator operators={mockOperators} />);
      // 1 busy operator (Bob)
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should not show busy count when no operators are busy', () => {
      const onlineOnly = mockOperators.filter((op) => op.status === 'online');
      render(<PresenceIndicator operators={onlineOnly} />);
      // Should only show online count, no slash for busy
      expect(screen.queryByText('/')).not.toBeInTheDocument();
    });
  });

  describe('Avatar Stack', () => {
    it('should show first 3 operator avatars', () => {
      render(<PresenceIndicator operators={mockOperators} />);
      // Should show initials for first 3 operators
      expect(screen.getByTitle('Alice Smith')).toBeInTheDocument();
      expect(screen.getByTitle('Bob Jones')).toBeInTheDocument();
      expect(screen.getByTitle('Charlie Brown')).toBeInTheDocument();
    });

    it('should show +N indicator when more than 3 operators', () => {
      render(<PresenceIndicator operators={mockOperators} />);
      // 4 operators - 3 shown = +1
      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('should not show +N when 3 or fewer operators', () => {
      const threeOperators = mockOperators.slice(0, 3);
      render(<PresenceIndicator operators={threeOperators} />);
      expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it('should display operator initials in avatars', () => {
      render(<PresenceIndicator operators={mockOperators} />);
      // First letter of each operator's name
      expect(screen.getByText('A')).toBeInTheDocument(); // Alice
      expect(screen.getByText('B')).toBeInTheDocument(); // Bob
      expect(screen.getByText('C')).toBeInTheDocument(); // Charlie
    });
  });

  describe('Dropdown Behavior', () => {
    it('should not show dropdown by default', () => {
      render(<PresenceIndicator operators={mockOperators} />);
      expect(screen.queryByText('SOC Team')).not.toBeInTheDocument();
    });

    it('should show dropdown when button is clicked', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('SOC Team')).toBeInTheDocument();
    });

    it('should close dropdown when backdrop is clicked', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      // Open dropdown
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('SOC Team')).toBeInTheDocument();

      // Click backdrop (fixed inset-0 element)
      const backdrop = document.querySelector('.fixed.inset-0');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(screen.queryByText('SOC Team')).not.toBeInTheDocument();
    });

    it('should show all operators in dropdown', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
      expect(screen.getByText('Diana Prince')).toBeInTheDocument();
    });

    it('should show "No operators online" when empty', () => {
      render(<PresenceIndicator operators={[]} />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('No operators online')).toBeInTheDocument();
    });

    it('should show summary in dropdown header', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('2 online, 1 working on alerts')).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    it('should show "Online" status label for online operators', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getAllByText('Online').length).toBeGreaterThan(0);
    });

    it('should show "Working on alert" status for busy operators', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('Working on alert')).toBeInTheDocument();
    });

    it('should show "Away" status for away operators', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('Away')).toBeInTheDocument();
    });

    it('should show "On Alert" badge for operators with current_alert_id', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('On Alert')).toBeInTheDocument();
    });
  });

  describe('Status Colors', () => {
    it('should apply green status indicator for online operators', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      fireEvent.click(screen.getByRole('button'));

      const statusDots = document.querySelectorAll('.bg-green-500');
      expect(statusDots.length).toBeGreaterThan(0);
    });

    it('should apply yellow status indicator for busy operators', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      fireEvent.click(screen.getByRole('button'));

      const statusDots = document.querySelectorAll('.bg-yellow-500');
      expect(statusDots.length).toBeGreaterThan(0);
    });

    it('should apply gray status indicator for away operators', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      fireEvent.click(screen.getByRole('button'));

      const statusDots = document.querySelectorAll('.bg-gray-400');
      expect(statusDots.length).toBeGreaterThan(0);
    });
  });

  describe('Arrow Animation', () => {
    it('should rotate arrow when dropdown is open', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      // Initially not rotated
      const svg = document.querySelector('svg');
      expect(svg).not.toHaveClass('rotate-180');

      // Click to open
      fireEvent.click(screen.getByRole('button'));

      // Arrow should be rotated
      const rotatedSvg = document.querySelector('svg.rotate-180');
      expect(rotatedSvg).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle operators with short names', () => {
      const shortNameOperators: SOCPresence[] = [
        {
          id: 'presence-short',
          user_id: 'user-1',
          user_name: 'Zara',
          user_email: 'zara@example.com',
          status: 'online',
          last_seen_at: new Date().toISOString(),
          session_started_at: new Date().toISOString(),
          current_alert_id: null,
          user_agent: 'Mozilla/5.0',
        },
      ];

      render(<PresenceIndicator operators={shortNameOperators} />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('Zara')).toBeInTheDocument();
    });

    it('should handle all offline status', () => {
      const offlineOperators: SOCPresence[] = [
        {
          id: 'presence-offline',
          user_id: 'user-1',
          user_name: 'Offline User',
          user_email: 'offline@example.com',
          status: 'offline',
          last_seen_at: new Date().toISOString(),
          session_started_at: new Date().toISOString(),
          current_alert_id: null,
          user_agent: 'Mozilla/5.0',
        },
      ];

      render(<PresenceIndicator operators={offlineOperators} />);

      // Online count should be 0
      expect(screen.getByText('0')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('should show last updated time in dropdown footer', () => {
      render(<PresenceIndicator operators={mockOperators} />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });
});
