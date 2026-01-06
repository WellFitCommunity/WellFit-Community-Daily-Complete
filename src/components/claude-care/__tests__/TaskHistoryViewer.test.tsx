/**
 * TaskHistoryViewer Tests
 *
 * Tests for task history viewer component:
 * - History display
 * - Relative time formatting
 * - Star ratings
 * - Empty state handling
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaskHistoryViewer from '../TaskHistoryViewer';
import type { AdminTaskHistory } from '../../../types/claudeCareAssistant';

describe('TaskHistoryViewer', () => {
  const mockHistory: AdminTaskHistory[] = [
    {
      id: 'task-1',
      userId: 'user-123',
      taskType: 'progress_note',
      role: 'physician',
      createdAt: new Date().toISOString(),
      inputData: { patient: 'test-patient-1' },
      outputData: { note: 'Progress note content' },
      tokensUsed: 450,
      executionTimeMs: 2500,
      userSatisfaction: 5,
      userFeedback: 'Excellent quality!',
    },
    {
      id: 'task-2',
      userId: 'user-123',
      taskType: 'referral_letter',
      role: 'nurse',
      createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      inputData: { patient: 'test-patient-2' },
      outputData: { letter: 'Referral letter content' },
      tokensUsed: 380,
      executionTimeMs: 1800,
      userSatisfaction: 4,
    },
    {
      id: 'task-3',
      userId: 'user-123',
      taskType: 'discharge_summary',
      role: 'physician',
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      inputData: { patient: 'test-patient-3' },
      outputData: { summary: 'Discharge summary content' },
      tokensUsed: 600,
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Basic Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<TaskHistoryViewer userId="user-123" history={mockHistory} />);
      expect(screen.getByText('Recent Tasks')).toBeInTheDocument();
    });

    it('should display all history items with formatted task types', () => {
      render(<TaskHistoryViewer userId="user-123" history={mockHistory} />);
      // Task types are formatted with spaces and capitalized
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
      expect(screen.getByText('Referral Letter')).toBeInTheDocument();
      expect(screen.getByText('Discharge Summary')).toBeInTheDocument();
    });

    it('should display role badges with raw role values', () => {
      render(<TaskHistoryViewer userId="user-123" history={mockHistory} />);
      // Role badges show raw role values
      expect(screen.getAllByText('physician').length).toBe(2);
      expect(screen.getByText('nurse')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Task Type Formatting
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Task Type Formatting', () => {
    it('should format task types with underscores', () => {
      render(<TaskHistoryViewer userId="user-123" history={mockHistory} />);
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
      expect(screen.getByText('Referral Letter')).toBeInTheDocument();
      expect(screen.getByText('Discharge Summary')).toBeInTheDocument();
    });

    it('should capitalize each word', () => {
      const history: AdminTaskHistory[] = [
        {
          id: 't1',
          userId: 'user-123',
          taskType: 'care_coordination_note',
          role: 'case_manager',
          createdAt: new Date().toISOString(),
          inputData: {},
          outputData: {},
        },
      ];
      render(<TaskHistoryViewer userId="user-123" history={history} />);
      expect(screen.getByText('Care Coordination Note')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Star Ratings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Star Ratings', () => {
    it('should display star rating when provided', () => {
      render(<TaskHistoryViewer userId="user-123" history={mockHistory} />);
      // Ratings are displayed in format "(X/5)" with parentheses
      expect(screen.getByText(/\(5\/5\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(4\/5\)/)).toBeInTheDocument();
    });

    it('should show Not rated when no rating', () => {
      render(<TaskHistoryViewer userId="user-123" history={mockHistory} />);
      expect(screen.getByText('Not rated')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // User Feedback
  // ═══════════════════════════════════════════════════════════════════════════

  describe('User Feedback', () => {
    it('should display user feedback when provided', () => {
      render(<TaskHistoryViewer userId="user-123" history={mockHistory} />);
      expect(screen.getByText(/"Excellent quality!"/)).toBeInTheDocument();
    });

    it('should not show feedback section when not provided', () => {
      const history: AdminTaskHistory[] = [
        {
          id: 't1',
          userId: 'user-123',
          taskType: 'note',
          role: 'nurse',
          createdAt: new Date().toISOString(),
          inputData: {},
          outputData: {},
        },
      ];
      render(<TaskHistoryViewer userId="user-123" history={history} />);
      expect(screen.queryByText(/"/)).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Token and Time Display
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Token and Time Display', () => {
    it('should display tokens used', () => {
      render(<TaskHistoryViewer userId="user-123" history={mockHistory} />);
      // Tokens are displayed without "tokens" suffix in the component
      expect(screen.getByText(/450 tokens/)).toBeInTheDocument();
      expect(screen.getByText(/380 tokens/)).toBeInTheDocument();
    });

    it('should display execution time in seconds', () => {
      render(<TaskHistoryViewer userId="user-123" history={mockHistory} />);
      // Time is displayed in format "X.Xs"
      expect(screen.getByText(/2\.5s/)).toBeInTheDocument();
      expect(screen.getByText(/1\.8s/)).toBeInTheDocument();
    });

    it('should show 0 tokens when not provided', () => {
      const history: AdminTaskHistory[] = [
        {
          id: 't1',
          userId: 'user-123',
          taskType: 'note',
          role: 'nurse',
          createdAt: new Date().toISOString(),
          inputData: {},
          outputData: {},
        },
      ];
      render(<TaskHistoryViewer userId="user-123" history={history} />);
      expect(screen.getByText(/0 tokens/)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Limit Prop
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Limit Prop', () => {
    it('should limit displayed items', () => {
      const longHistory: AdminTaskHistory[] = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        userId: 'user-123',
        taskType: `task_type_${i}`,
        role: 'nurse',
        createdAt: new Date().toISOString(),
        inputData: {},
        outputData: {},
      }));

      render(<TaskHistoryViewer userId="user-123" history={longHistory} limit={3} />);

      // Only first 3 should be visible - formatTaskType capitalizes each word
      // task_type_0 becomes "Task Type 0"
      expect(screen.getByText(/Task Type 0/)).toBeInTheDocument();
      expect(screen.getByText(/Task Type 1/)).toBeInTheDocument();
      expect(screen.getByText(/Task Type 2/)).toBeInTheDocument();
      expect(screen.queryByText(/Task Type 3/)).not.toBeInTheDocument();
    });

    it('should default to 20 limit', () => {
      render(<TaskHistoryViewer userId="user-123" history={mockHistory} />);
      // All 3 items should be visible with default limit
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
      expect(screen.getByText('Referral Letter')).toBeInTheDocument();
      expect(screen.getByText('Discharge Summary')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Empty State
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Empty State', () => {
    it('should display empty state when no history', () => {
      render(<TaskHistoryViewer userId="user-123" history={[]} />);
      expect(screen.getByText('No task history yet')).toBeInTheDocument();
    });

    it('should show icon in empty state', () => {
      render(<TaskHistoryViewer userId="user-123" history={[]} />);
      // Check for SVG element
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });
});
