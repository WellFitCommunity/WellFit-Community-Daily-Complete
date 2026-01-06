/**
 * TaskTemplateSelector Tests
 *
 * Tests for task template selector component:
 * - Template grouping by task type
 * - Template selection
 * - Output format badges
 * - Empty state handling
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskTemplateSelector from '../TaskTemplateSelector';
import type { AdminTaskTemplate } from '../../../types/claudeCareAssistant';

describe('TaskTemplateSelector', () => {
  const mockTemplates: AdminTaskTemplate[] = [
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
      promptTemplate: 'Generate a progress note for {{patient_info}} with details: {{clinical_details}}',
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
      promptTemplate: 'Generate a referral letter for {{patient_info}} because: {{referral_reason}}',
    },
    {
      id: 'template-3',
      templateName: 'Discharge Summary',
      taskType: 'discharge',
      outputFormat: 'structured',
      requiredFields: { patient_info: 'string', diagnosis: 'string' },
      description: 'Generate discharge summary',
      estimatedTokens: 600,
      role: 'physician',
      promptTemplate: 'Generate a discharge summary for {{patient_info}} with diagnosis: {{diagnosis}}',
    },
  ];

  const mockOnSelect = vi.fn();

  // ═══════════════════════════════════════════════════════════════════════════
  // Basic Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<TaskTemplateSelector role="physician" templates={mockTemplates} onSelect={mockOnSelect} />);
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
    });

    it('should display all template names', () => {
      render(<TaskTemplateSelector role="physician" templates={mockTemplates} onSelect={mockOnSelect} />);
      expect(screen.getByText('Progress Note')).toBeInTheDocument();
      expect(screen.getByText('Referral Letter')).toBeInTheDocument();
      expect(screen.getByText('Discharge Summary')).toBeInTheDocument();
    });

    it('should display template descriptions', () => {
      render(<TaskTemplateSelector role="physician" templates={mockTemplates} onSelect={mockOnSelect} />);
      expect(screen.getByText('Generate a clinical progress note')).toBeInTheDocument();
      expect(screen.getByText('Generate a referral letter')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Template Grouping
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Template Grouping', () => {
    it('should group templates by task type', () => {
      render(<TaskTemplateSelector role="physician" templates={mockTemplates} onSelect={mockOnSelect} />);
      expect(screen.getByText('Documentation')).toBeInTheDocument();
      expect(screen.getByText('Discharge')).toBeInTheDocument();
    });

    it('should format task type headers correctly', () => {
      const templates: AdminTaskTemplate[] = [
        {
          id: 't1',
          templateName: 'Test',
          taskType: 'care_coordination',
          outputFormat: 'form',
          requiredFields: {},
          role: 'nurse',
          promptTemplate: 'Test template prompt',
        },
      ];
      render(<TaskTemplateSelector role="nurse" templates={templates} onSelect={mockOnSelect} />);
      expect(screen.getByText('Care Coordination')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Output Format Badges
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Output Format Badges', () => {
    it('should display narrative badge', () => {
      render(<TaskTemplateSelector role="physician" templates={mockTemplates} onSelect={mockOnSelect} />);
      expect(screen.getByText('narrative')).toBeInTheDocument();
    });

    it('should display letter badge', () => {
      render(<TaskTemplateSelector role="physician" templates={mockTemplates} onSelect={mockOnSelect} />);
      expect(screen.getByText('letter')).toBeInTheDocument();
    });

    it('should display structured badge', () => {
      render(<TaskTemplateSelector role="physician" templates={mockTemplates} onSelect={mockOnSelect} />);
      expect(screen.getByText('structured')).toBeInTheDocument();
    });

    it('should display form badge', () => {
      const templates: AdminTaskTemplate[] = [
        {
          id: 't1',
          templateName: 'Form Template',
          taskType: 'admin',
          outputFormat: 'form',
          requiredFields: {},
          role: 'admin',
          promptTemplate: 'Admin form template prompt',
        },
      ];
      render(<TaskTemplateSelector role="admin" templates={templates} onSelect={mockOnSelect} />);
      expect(screen.getByText('form')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Template Selection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Template Selection', () => {
    it('should call onSelect when template is clicked', () => {
      render(<TaskTemplateSelector role="physician" templates={mockTemplates} onSelect={mockOnSelect} />);

      fireEvent.click(screen.getByText('Progress Note'));

      expect(mockOnSelect).toHaveBeenCalledWith(mockTemplates[0]);
    });

    it('should call onSelect with correct template data', () => {
      render(<TaskTemplateSelector role="physician" templates={mockTemplates} onSelect={mockOnSelect} />);

      fireEvent.click(screen.getByText('Referral Letter'));

      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'template-2',
          templateName: 'Referral Letter',
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Template Info Display
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Template Info Display', () => {
    it('should display required fields count', () => {
      render(<TaskTemplateSelector role="physician" templates={mockTemplates} onSelect={mockOnSelect} />);
      // Multiple templates show "Required fields: X"
      const requiredFieldsTexts = screen.getAllByText(/Required fields:/);
      expect(requiredFieldsTexts.length).toBeGreaterThan(0);
    });

    it('should display estimated tokens', () => {
      render(<TaskTemplateSelector role="physician" templates={mockTemplates} onSelect={mockOnSelect} />);
      // Tokens display in format "~500 tokens"
      expect(screen.getByText(/~500 tokens/)).toBeInTheDocument();
      expect(screen.getByText(/~400 tokens/)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Empty State
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Empty State', () => {
    it('should display empty state when no templates', () => {
      render(<TaskTemplateSelector role="physician" templates={[]} onSelect={mockOnSelect} />);
      expect(screen.getByText('No templates available for role: physician')).toBeInTheDocument();
    });

    it('should display role name in empty state', () => {
      render(<TaskTemplateSelector role="case_manager" templates={[]} onSelect={mockOnSelect} />);
      expect(screen.getByText('No templates available for role: case_manager')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Accessibility
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Accessibility', () => {
    it('should have clickable template buttons', () => {
      render(<TaskTemplateSelector role="physician" templates={mockTemplates} onSelect={mockOnSelect} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
