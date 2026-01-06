/**
 * AdminTaskModule Tests
 *
 * Tests for admin task automation component:
 * - Template loading
 * - Template selection
 * - Form rendering
 * - Task generation
 * - Voice input integration
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminTaskModule from '../AdminTaskModule';
import { ClaudeModel } from '../../../types/claude';

// Mock ClaudeCareAssistant
vi.mock('../../../services/claudeCareAssistant', () => ({
  ClaudeCareAssistant: {
    getTemplatesForRole: vi.fn(),
    getUserTaskHistory: vi.fn(),
    executeAdminTask: vi.fn(),
  },
}));

import { ClaudeCareAssistant } from '../../../services/claudeCareAssistant';

const mockGetTemplates = ClaudeCareAssistant.getTemplatesForRole as ReturnType<typeof vi.fn>;
const mockGetHistory = ClaudeCareAssistant.getUserTaskHistory as ReturnType<typeof vi.fn>;
const mockExecuteTask = ClaudeCareAssistant.executeAdminTask as ReturnType<typeof vi.fn>;

describe('AdminTaskModule', () => {
  const mockTemplates = [
    {
      id: 'template-1',
      templateName: 'Progress Note',
      taskType: 'documentation',
      outputFormat: 'narrative',
      requiredFields: { patient_info: 'string', clinical_details: 'text' },
      optionalFields: { notes: 'text' },
      description: 'Generate a clinical progress note',
      estimatedTokens: 500,
      role: 'physician',
      promptTemplate: 'Generate a progress note for {{patient_info}}',
    },
    {
      id: 'template-2',
      templateName: 'Referral Letter',
      taskType: 'documentation',
      outputFormat: 'letter',
      requiredFields: { patient_info: 'string', referral_reason: 'text' },
      description: 'Generate a referral letter',
      estimatedTokens: 400,
      role: 'physician',
      promptTemplate: 'Generate a referral letter for {{patient_info}}',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTemplates.mockResolvedValue(mockTemplates);
    mockGetHistory.mockResolvedValue([]);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Basic Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );
      expect(screen.getByText('Select Task Template')).toBeInTheDocument();
    });

    it('should load templates on mount', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(mockGetTemplates).toHaveBeenCalledWith('physician');
      });
    });

    it('should load task history when userId provided', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledWith('user-123', 10);
      });
    });

    it('should not load history when no userId', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(mockGetTemplates).toHaveBeenCalled();
      });

      expect(mockGetHistory).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Template Display
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Template Display', () => {
    it('should display templates after loading', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
        expect(screen.getByText('Referral Letter')).toBeInTheDocument();
      });
    });

    it('should display empty state when no templates', async () => {
      mockGetTemplates.mockResolvedValueOnce([]);

      render(
        <AdminTaskModule
          userRole="admin"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No templates available for your role')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // History Toggle
  // ═══════════════════════════════════════════════════════════════════════════

  describe('History Toggle', () => {
    it('should show history toggle button when userId provided', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Show History')).toBeInTheDocument();
      });
    });

    it('should not show history toggle when no userId', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(mockGetTemplates).toHaveBeenCalled();
      });

      expect(screen.queryByText('Show History')).not.toBeInTheDocument();
    });

    it('should toggle history visibility', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Show History')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Show History'));
      expect(screen.getByText('Hide History')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Hide History'));
      expect(screen.getByText('Show History')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Template Selection Form
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Template Selection Form', () => {
    it('should show form when template is selected', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Progress Note'));

      expect(screen.getByText('Required Information')).toBeInTheDocument();
    });

    it('should display required field inputs', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Progress Note'));

      expect(screen.getByText('Patient Info')).toBeInTheDocument();
      expect(screen.getByText('Clinical Details')).toBeInTheDocument();
    });

    it('should display optional fields section', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Progress Note'));

      expect(screen.getByText('Optional Information')).toBeInTheDocument();
    });

    it('should display generate button', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Progress Note'));

      expect(screen.getByRole('button', { name: 'Generate Task' })).toBeInTheDocument();
    });

    it('should display estimated tokens', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Progress Note'));

      expect(screen.getByText(/Estimated tokens: ~500/)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Task Generation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Task Generation', () => {
    it('should show error when required fields missing', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Progress Note'));
      fireEvent.click(screen.getByRole('button', { name: 'Generate Task' }));

      await waitFor(() => {
        expect(screen.getByText(/Please fill in required fields/)).toBeInTheDocument();
      });
    });

    it('should call executeAdminTask with correct data', async () => {
      mockExecuteTask.mockResolvedValueOnce({
        generatedContent: 'Generated progress note content',
        taskId: 'task-123',
      });

      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Progress Note'));

      // Fill in required fields
      const patientInput = screen.getByPlaceholderText('Enter patient info');
      const detailsTextarea = screen.getByPlaceholderText('Enter clinical details');

      fireEvent.change(patientInput, { target: { value: 'John Doe, 65yo male' } });
      fireEvent.change(detailsTextarea, { target: { value: 'Patient presents with chest pain' } });

      fireEvent.click(screen.getByRole('button', { name: 'Generate Task' }));

      await waitFor(() => {
        expect(mockExecuteTask).toHaveBeenCalledWith({
          templateId: 'template-1',
          role: 'physician',
          taskType: 'documentation',
          inputData: {
            patient_info: 'John Doe, 65yo male',
            clinical_details: 'Patient presents with chest pain',
          },
          preferredModel: 'claude-3-haiku-20240307',
          userId: 'user-123',
        });
      });
    });

    it('should display generated content', async () => {
      mockExecuteTask.mockResolvedValueOnce({
        generatedContent: 'Generated progress note content here',
        taskId: 'task-123',
      });

      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Progress Note'));

      const patientInput = screen.getByPlaceholderText('Enter patient info');
      const detailsTextarea = screen.getByPlaceholderText('Enter clinical details');

      fireEvent.change(patientInput, { target: { value: 'Patient info' } });
      fireEvent.change(detailsTextarea, { target: { value: 'Details' } });

      fireEvent.click(screen.getByRole('button', { name: 'Generate Task' }));

      await waitFor(() => {
        expect(screen.getByText('Generated Content')).toBeInTheDocument();
        expect(screen.getByText('Generated progress note content here')).toBeInTheDocument();
      });
    });

    it('should show loading state during generation', async () => {
      let resolveTask: (value: unknown) => void;
      const taskPromise = new Promise((resolve) => {
        resolveTask = resolve;
      });
      mockExecuteTask.mockReturnValueOnce(taskPromise);

      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Progress Note'));

      const patientInput = screen.getByPlaceholderText('Enter patient info');
      const detailsTextarea = screen.getByPlaceholderText('Enter clinical details');

      fireEvent.change(patientInput, { target: { value: 'Patient' } });
      fireEvent.change(detailsTextarea, { target: { value: 'Details' } });

      fireEvent.click(screen.getByRole('button', { name: 'Generate Task' }));

      expect(screen.getByText('Generating...')).toBeInTheDocument();

      resolveTask!({ generatedContent: 'Content', taskId: 'task-1' });

      await waitFor(() => {
        expect(screen.queryByText('Generating...')).not.toBeInTheDocument();
      });
    });

    it('should show error on generation failure', async () => {
      mockExecuteTask.mockRejectedValueOnce(new Error('API Error'));

      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Progress Note'));

      const patientInput = screen.getByPlaceholderText('Enter patient info');
      const detailsTextarea = screen.getByPlaceholderText('Enter clinical details');

      fireEvent.change(patientInput, { target: { value: 'Patient' } });
      fireEvent.change(detailsTextarea, { target: { value: 'Details' } });

      fireEvent.click(screen.getByRole('button', { name: 'Generate Task' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to generate task. Please try again.')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Voice Input Integration
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Voice Input Integration', () => {
    it('should auto-populate form from voice input', async () => {
      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3_5}
          voiceTemplateId="template-1"
          voiceTranscription="Patient John Doe with chest pain"
        />
      );

      await waitFor(() => {
        // Should auto-select template and populate form
        expect(screen.getByText('Required Information')).toBeInTheDocument();
      });
    });

    it('should call onVoiceDataUsed callback', async () => {
      const mockCallback = vi.fn();

      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3_5}
          voiceTemplateId="template-1"
          voiceTranscription="Voice transcription text"
          onVoiceDataUsed={mockCallback}
        />
      );

      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalled();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Generated Content Actions
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Generated Content Actions', () => {
    it('should display copy to clipboard button', async () => {
      mockExecuteTask.mockResolvedValueOnce({
        generatedContent: 'Generated content',
        taskId: 'task-123',
      });

      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Progress Note'));

      const patientInput = screen.getByPlaceholderText('Enter patient info');
      const detailsTextarea = screen.getByPlaceholderText('Enter clinical details');

      fireEvent.change(patientInput, { target: { value: 'Patient' } });
      fireEvent.change(detailsTextarea, { target: { value: 'Details' } });

      fireEvent.click(screen.getByRole('button', { name: 'Generate Task' }));

      await waitFor(() => {
        expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
      });
    });

    it('should display Edit and Save buttons', async () => {
      mockExecuteTask.mockResolvedValueOnce({
        generatedContent: 'Generated content',
        taskId: 'task-123',
      });

      render(
        <AdminTaskModule
          userRole="physician"
          userId="user-123"
          preferredModel={ClaudeModel.HAIKU_3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Progress Note'));

      const patientInput = screen.getByPlaceholderText('Enter patient info');
      const detailsTextarea = screen.getByPlaceholderText('Enter clinical details');

      fireEvent.change(patientInput, { target: { value: 'Patient' } });
      fireEvent.change(detailsTextarea, { target: { value: 'Details' } });

      fireEvent.click(screen.getByRole('button', { name: 'Generate Task' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save to EHR' })).toBeInTheDocument();
      });
    });
  });
});
