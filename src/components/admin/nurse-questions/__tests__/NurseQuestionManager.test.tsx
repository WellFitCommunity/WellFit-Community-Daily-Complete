/**
 * NurseQuestionManager — Behavioral Tests
 *
 * Tests: orchestrator rendering, question list, response panel, AI suggestion,
 * escalation workflow, autosave, service integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockFetchOpenQueue = vi.fn();
const mockFetchMyQuestions = vi.fn();
const mockClaimQuestion = vi.fn();
const mockSubmitAnswer = vi.fn();
const mockAddNote = vi.fn();
const mockEscalateQuestion = vi.fn();

const mockNotifyPatientAnswered = vi.fn();
const mockSubscribeToNewQuestions = vi.fn();
const mockSubscribeToQuestionUpdates = vi.fn();
const mockFetchMetrics = vi.fn();

vi.mock('../../../../services/nurseQuestionService', () => ({
  NurseQuestionService: {
    fetchOpenQueue: (...args: unknown[]) => mockFetchOpenQueue(...args),
    fetchMyQuestions: (...args: unknown[]) => mockFetchMyQuestions(...args),
    claimQuestion: (...args: unknown[]) => mockClaimQuestion(...args),
    submitAnswer: (...args: unknown[]) => mockSubmitAnswer(...args),
    addNote: (...args: unknown[]) => mockAddNote(...args),
    escalateQuestion: (...args: unknown[]) => mockEscalateQuestion(...args),
    getQuestionNotes: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getQuestionAnswers: vi.fn().mockResolvedValue({ success: true, data: [] }),
    notifyPatientAnswered: (...args: unknown[]) => mockNotifyPatientAnswered(...args),
    subscribeToNewQuestions: (...args: unknown[]) => mockSubscribeToNewQuestions(...args),
    subscribeToQuestionUpdates: (...args: unknown[]) => mockSubscribeToQuestionUpdates(...args),
    fetchMetrics: (...args: unknown[]) => mockFetchMetrics(...args),
  },
}));

const mockComplete = vi.fn();
vi.mock('../../../../services/claudeEdgeService', () => ({
  claudeEdgeService: {
    complete: (...args: unknown[]) => mockComplete(...args),
  },
}));

vi.mock('../../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    clinical: vi.fn(),
  },
}));

vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'nurse-001' } } },
      }),
    },
  },
}));

vi.mock('../../../../constants/aiModels', () => ({
  HAIKU_MODEL: 'claude-haiku-4-5-20250929',
  SONNET_MODEL: 'claude-sonnet-4-5-20250929',
}));

// ============================================================================
// Test Data (synthetic, obviously fake — Rule 15)
// ============================================================================

const testQueueData = [
  {
    question_id: 'q-001',
    user_id: 'patient-alpha',
    question_text: 'Test question about blood pressure medication timing',
    category: 'medication',
    urgency: 'high',
    status: 'pending',
    created_at: '2026-01-15T08:30:00Z',
    patient_name: 'Test Patient Alpha',
    patient_phone: '555-0100',
  },
  {
    question_id: 'q-002',
    user_id: 'patient-bravo',
    question_text: 'Test question about dizziness symptoms',
    category: 'health',
    urgency: 'medium',
    status: 'pending',
    created_at: '2026-01-15T09:15:00Z',
    patient_name: 'Test Patient Bravo',
    patient_phone: '555-0200',
  },
  {
    question_id: 'q-003',
    user_id: 'patient-charlie',
    question_text: 'General question about appointment scheduling',
    category: 'general',
    urgency: 'low',
    status: 'pending',
    created_at: '2026-01-15T10:00:00Z',
    patient_name: 'Test Patient Charlie',
    patient_phone: '555-0300',
  },
];

const testMyQuestionsData = [
  {
    question_id: 'q-004',
    user_id: 'patient-delta',
    question_text: 'Question already claimed by this nurse',
    category: 'health',
    urgency: 'high',
    status: 'claimed',
    created_at: '2026-01-15T07:00:00Z',
    patient_name: 'Test Patient Delta',
    patient_phone: '555-0400',
    claimed_at: '2026-01-15T07:30:00Z',
    answer_count: 0,
  },
];

// ============================================================================
// Import after mocks
// ============================================================================

import NurseQuestionManager from '../../NurseQuestionManager';

// ============================================================================
// Tests
// ============================================================================

describe('NurseQuestionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetchOpenQueue.mockResolvedValue({
      success: true,
      data: testQueueData,
    });
    mockFetchMyQuestions.mockResolvedValue({
      success: true,
      data: testMyQuestionsData,
    });
    mockClaimQuestion.mockResolvedValue({ success: true });
    mockSubmitAnswer.mockResolvedValue({ success: true, data: 'answer-001' });
    mockAddNote.mockResolvedValue({ success: true, data: 'note-001' });
    mockEscalateQuestion.mockResolvedValue({ success: true });
    mockNotifyPatientAnswered.mockResolvedValue({ success: true });
    mockFetchMetrics.mockResolvedValue({
      success: true,
      data: {
        total_questions: 10,
        pending_count: 3,
        claimed_count: 2,
        answered_count: 4,
        escalated_count: 1,
        high_urgency_count: 2,
        medium_urgency_count: 5,
        low_urgency_count: 3,
        avg_response_hours: 1.5,
        median_response_hours: 1.2,
        ai_acceptance_rate: 65,
        ai_suggestions_accepted: 3,
        total_answered_with_records: 4,
        escalated_to_charge_nurse: 1,
        escalated_to_supervisor: 0,
        escalated_to_physician: 0,
        questions_last_24h: 3,
        questions_last_7d: 10,
      },
    });
    // Realtime subscriptions return cleanup functions
    mockSubscribeToNewQuestions.mockReturnValue(() => {});
    mockSubscribeToQuestionUpdates.mockReturnValue(() => {});
  });

  describe('Dashboard Rendering', () => {
    it('renders dashboard title and description', async () => {
      render(<NurseQuestionManager />);

      expect(screen.getByText('Patient Questions - Nurse Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Manage patient questions with AI-powered response assistance')).toBeInTheDocument();
    });

    it('loads queue on mount and displays patient questions', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(mockFetchOpenQueue).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
        expect(screen.getByText('Test Patient Bravo')).toBeInTheDocument();
      });
    });

    it('shows question count', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('3 questions')).toBeInTheDocument();
      });
    });

    it('displays empty state when no questions match filters', async () => {
      mockFetchOpenQueue.mockResolvedValue({ success: true, data: [] });
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('No questions match your filters')).toBeInTheDocument();
      });
    });
  });

  describe('Queue and My Questions Toggle', () => {
    it('loads open queue when Queue button is clicked', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      mockFetchOpenQueue.mockClear();
      fireEvent.click(screen.getByText('Queue'));

      await waitFor(() => {
        expect(mockFetchOpenQueue).toHaveBeenCalled();
      });
    });

    it('loads my questions when My Questions button is clicked', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('My Questions'));

      await waitFor(() => {
        expect(mockFetchMyQuestions).toHaveBeenCalled();
      });

      // My questions have status 'claimed' — change filter to 'all' to see them
      const statusSelect = screen.getByDisplayValue('Pending');
      fireEvent.change(statusSelect, { target: { value: 'all' } });

      await waitFor(() => {
        expect(screen.getByText('Test Patient Delta')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Search', () => {
    it('filters questions by urgency', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      const urgencySelect = screen.getByDisplayValue('All Priority');
      fireEvent.change(urgencySelect, { target: { value: 'high' } });

      expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Test Patient Bravo')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Patient Charlie')).not.toBeInTheDocument();
    });

    it('searches questions by text', async () => {
      const user = userEvent.setup();
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search questions or patient names...');
      await user.type(searchInput, 'dizziness');

      expect(screen.queryByText('Test Patient Alpha')).not.toBeInTheDocument();
      expect(screen.getByText('Test Patient Bravo')).toBeInTheDocument();
    });

    it('searches questions by patient name', async () => {
      const user = userEvent.setup();
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search questions or patient names...');
      await user.type(searchInput, 'Charlie');

      expect(screen.queryByText('Test Patient Alpha')).not.toBeInTheDocument();
      expect(screen.getByText('Test Patient Charlie')).toBeInTheDocument();
    });
  });

  describe('Question Selection and Claiming', () => {
    it('claims a pending question when selected', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(mockClaimQuestion).toHaveBeenCalledWith('q-001');
      });
    });

    it('shows response panel with patient details after selection', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText(/Responding to Test/)).toBeInTheDocument();
      });

      // Question text appears in both list and response panel — use getAllByText
      const questionTexts = screen.getAllByText('Test question about blood pressure medication timing');
      expect(questionTexts.length).toBeGreaterThanOrEqual(2);
    });

    it('shows empty state when no question is selected', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Select a question to respond')).toBeInTheDocument();
      });
    });
  });

  describe('Response Submission', () => {
    it('submits response through NurseQuestionService', async () => {
      const user = userEvent.setup();
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText(/Responding to Test/)).toBeInTheDocument();
      });

      const responseArea = screen.getByPlaceholderText(/Type your response to the patient/);
      await user.type(responseArea, 'Please take your medication as soon as possible.');

      fireEvent.click(screen.getByText('Send Response to Patient'));

      await waitFor(() => {
        expect(mockSubmitAnswer).toHaveBeenCalledWith(
          expect.objectContaining({
            questionId: 'q-001',
            answerText: 'Please take your medication as soon as possible.',
          })
        );
      });
    });

    it('submits nurse notes alongside response', async () => {
      const user = userEvent.setup();
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText(/Responding to Test/)).toBeInTheDocument();
      });

      const responseArea = screen.getByPlaceholderText(/Type your response to the patient/);
      await user.type(responseArea, 'Take medication now.');

      const notesArea = screen.getByPlaceholderText(/Add notes for other care team members/);
      await user.type(notesArea, 'Patient has history of missed doses.');

      fireEvent.click(screen.getByText('Send Response to Patient'));

      await waitFor(() => {
        expect(mockSubmitAnswer).toHaveBeenCalled();
        expect(mockAddNote).toHaveBeenCalledWith('q-001', 'Patient has history of missed doses.');
      });
    });

    it('disables submit button when response is empty', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText(/Responding to Test/)).toBeInTheDocument();
      });

      const submitButton = screen.getByText('Send Response to Patient').closest('button');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Escalation', () => {
    it('shows escalation options when Escalate button is clicked', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText('Escalate')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Escalate'));

      await waitFor(() => {
        expect(screen.getByText('Charge Nurse')).toBeInTheDocument();
      });
      expect(screen.getByText('Supervisor')).toBeInTheDocument();
      expect(screen.getByText('Physician')).toBeInTheDocument();
    });

    it('escalates to charge nurse through NurseQuestionService', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText('Escalate')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Escalate'));

      const chargeNurseBtn = await screen.findByText('Charge Nurse');
      fireEvent.click(chargeNurseBtn);

      await waitFor(() => {
        expect(mockEscalateQuestion).toHaveBeenCalledWith('q-001', 'charge_nurse', undefined);
      });
    });

    it('includes nurse notes as escalation context', async () => {
      const user = userEvent.setup();
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText('Escalate')).toBeInTheDocument();
      });

      const notesArea = screen.getByPlaceholderText(/Add notes for other care team members/);
      await user.type(notesArea, 'Needs physician review for medication concern.');

      fireEvent.click(screen.getByText('Escalate'));

      const physicianBtn = await screen.findByText('Physician');
      fireEvent.click(physicianBtn);

      await waitFor(() => {
        expect(mockEscalateQuestion).toHaveBeenCalledWith(
          'q-001',
          'physician',
          'Needs physician review for medication concern.'
        );
      });
    });
  });

  describe('AI Suggestion', () => {
    it('shows AI suggestion button in response panel', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText('Get AI Response Suggestions')).toBeInTheDocument();
      });
    });

    it('generates AI suggestion when toggled on', async () => {
      mockComplete.mockResolvedValue('AI generated response for medication timing.');
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText('Get AI Response Suggestions')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Get AI Response Suggestions'));

      await waitFor(() => {
        expect(mockComplete).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('AI generated response for medication timing.')).toBeInTheDocument();
      });
    });

    it('shows loading state while AI generates suggestion', async () => {
      let resolveAi: (value: string) => void;
      mockComplete.mockReturnValue(
        new Promise<string>((resolve) => {
          resolveAi = resolve;
        })
      );

      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText('Get AI Response Suggestions')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Get AI Response Suggestions'));

      await waitFor(() => {
        expect(screen.getByText('AI analyzing patient data and question...')).toBeInTheDocument();
      });

      // Resolve the AI call — resolveAi is assigned in mockReturnValue callback
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      resolveAi!('Completed AI response.');

      await waitFor(() => {
        expect(screen.getByText('Completed AI response.')).toBeInTheDocument();
      });
    });

    it('tracks AI suggestion usage in submit params', async () => {
      mockComplete.mockResolvedValue('AI suggested response text.');

      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText('Get AI Response Suggestions')).toBeInTheDocument();
      });

      // Generate AI suggestion
      fireEvent.click(screen.getByText('Get AI Response Suggestions'));

      await waitFor(() => {
        expect(screen.getByText('AI suggested response text.')).toBeInTheDocument();
      });

      // Use the AI suggestion
      fireEvent.click(screen.getByText('Use This Response'));

      // Submit
      fireEvent.click(screen.getByText('Send Response to Patient'));

      await waitFor(() => {
        expect(mockSubmitAnswer).toHaveBeenCalledWith(
          expect.objectContaining({
            questionId: 'q-001',
            answerText: 'AI suggested response text.',
            usedAiSuggestion: true,
            aiSuggestionText: 'AI suggested response text.',
          })
        );
      });
    });

    it('shows fallback message when AI fails', async () => {
      mockComplete.mockRejectedValue(new Error('Service unavailable'));

      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText('Get AI Response Suggestions')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Get AI Response Suggestions'));

      await waitFor(() => {
        expect(
          screen.getByText(/Unable to generate AI suggestion/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Service Error Handling', () => {
    it('handles queue load failure gracefully', async () => {
      mockFetchOpenQueue.mockResolvedValue({
        success: false,
        error: { message: 'Database connection failed' },
      });

      render(<NurseQuestionManager />);

      // Should not crash — no questions displayed
      await waitFor(() => {
        expect(screen.getByText('0 questions')).toBeInTheDocument();
      });
    });

    it('handles claim failure gracefully', async () => {
      mockClaimQuestion.mockResolvedValue({
        success: false,
        error: { message: 'Already claimed by another nurse' },
      });

      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      // Should not crash on claim failure
      fireEvent.click(screen.getByText('Test Patient Alpha'));

      // Response panel still opens (graceful degradation)
      await waitFor(() => {
        expect(screen.getByText(/Responding to Test/)).toBeInTheDocument();
      });
    });
  });

  describe('Question Category and Urgency Display', () => {
    it('displays question category label', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('medication')).toBeInTheDocument();
        expect(screen.getByText('health')).toBeInTheDocument();
        expect(screen.getByText('general')).toBeInTheDocument();
      });
    });

    it('displays urgency badges with correct status', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        // All three questions should show their status
        const statusBadges = screen.getAllByText('pending');
        expect(statusBadges.length).toBe(3);
      });
    });
  });

  describe('Realtime Subscriptions (Session 3)', () => {
    it('subscribes to new questions on mount', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(mockSubscribeToNewQuestions).toHaveBeenCalledTimes(1);
        expect(mockSubscribeToNewQuestions).toHaveBeenCalledWith(expect.any(Function));
      });
    });

    it('subscribes to question updates on mount', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(mockSubscribeToQuestionUpdates).toHaveBeenCalledTimes(1);
        expect(mockSubscribeToQuestionUpdates).toHaveBeenCalledWith(expect.any(Function));
      });
    });

    it('shows new question alert when realtime INSERT fires', async () => {
      // Capture the callback
      let insertCallback: (() => void) | null = null;
      mockSubscribeToNewQuestions.mockImplementation((cb: () => void) => {
        insertCallback = cb;
        return () => {};
      });

      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(insertCallback).not.toBeNull();
      });

      // Simulate a new question arriving
      insertCallback!(); // eslint-disable-line @typescript-eslint/no-non-null-assertion

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/New patient question received/)).toBeInTheDocument();
      });
    });

    it('refreshes queue when new question arrives via realtime', async () => {
      let insertCallback: (() => void) | null = null;
      mockSubscribeToNewQuestions.mockImplementation((cb: () => void) => {
        insertCallback = cb;
        return () => {};
      });

      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(mockFetchOpenQueue).toHaveBeenCalledTimes(1);
      });

      // Simulate realtime event
      insertCallback!(); // eslint-disable-line @typescript-eslint/no-non-null-assertion

      await waitFor(() => {
        // Queue should be reloaded
        expect(mockFetchOpenQueue).toHaveBeenCalledTimes(2);
      });
    });

    it('dismisses new question alert when Dismiss is clicked', async () => {
      let insertCallback: (() => void) | null = null;
      mockSubscribeToNewQuestions.mockImplementation((cb: () => void) => {
        insertCallback = cb;
        return () => {};
      });

      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(insertCallback).not.toBeNull();
      });

      insertCallback!(); // eslint-disable-line @typescript-eslint/no-non-null-assertion

      await waitFor(() => {
        expect(screen.getByText(/New patient question received/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Dismiss'));

      await waitFor(() => {
        expect(screen.queryByText(/New patient question received/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Patient Notification on Answer (Session 3)', () => {
    it('sends SMS notification to patient when question is answered', async () => {
      const user = userEvent.setup();
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText(/Responding to Test/)).toBeInTheDocument();
      });

      const responseArea = screen.getByPlaceholderText(/Type your response to the patient/);
      await user.type(responseArea, 'Your blood pressure reading is normal.');

      fireEvent.click(screen.getByText('Send Response to Patient'));

      await waitFor(() => {
        expect(mockSubmitAnswer).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockNotifyPatientAnswered).toHaveBeenCalledWith(
          'q-001',
          '555-0100',
          'Test'
        );
      });
    });

    it('does not send SMS notification when question is escalated', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Patient Alpha'));

      await waitFor(() => {
        expect(screen.getByText('Escalate')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Escalate'));

      const chargeNurseBtn = await screen.findByText('Charge Nurse');
      fireEvent.click(chargeNurseBtn);

      await waitFor(() => {
        expect(mockEscalateQuestion).toHaveBeenCalled();
      });

      // SMS should NOT be sent for escalations
      expect(mockNotifyPatientAnswered).not.toHaveBeenCalled();
    });
  });

  describe('Analytics Panel (Session 3)', () => {
    it('fetches metrics on mount', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(mockFetchMetrics).toHaveBeenCalledTimes(1);
      });
    });

    it('renders analytics panel with expand toggle', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Question Analytics')).toBeInTheDocument();
      });
    });

    it('shows metrics when analytics panel is expanded', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText('Question Analytics')).toBeInTheDocument();
      });

      // Expand the panel
      fireEvent.click(screen.getByText('Question Analytics'));

      await waitFor(() => {
        expect(screen.getByText('Avg Response')).toBeInTheDocument();
        expect(screen.getByText('AI Acceptance')).toBeInTheDocument();
        expect(screen.getByText('1.5h')).toBeInTheDocument();
        expect(screen.getByText('65%')).toBeInTheDocument();
      });
    });

    it('shows daily and weekly volume in analytics header', async () => {
      render(<NurseQuestionManager />);

      await waitFor(() => {
        expect(screen.getByText(/3 today, 10 this week/)).toBeInTheDocument();
      });
    });
  });
});
