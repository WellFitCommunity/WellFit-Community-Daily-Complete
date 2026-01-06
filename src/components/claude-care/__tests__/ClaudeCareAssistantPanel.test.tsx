/**
 * ClaudeCareAssistantPanel Tests
 *
 * Tests for main Claude Care assistant panel:
 * - Role configuration
 * - Tab navigation
 * - Module rendering
 * - Voice input integration
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClaudeCareAssistantPanel from '../ClaudeCareAssistantPanel';

// Mock child modules
vi.mock('../TranslationModule', () => ({
  default: ({ userRole }: { userRole: string }) => (
    <div data-testid="translation-module">Translation Module - {userRole}</div>
  ),
}));

vi.mock('../AdminTaskModule', () => ({
  default: ({
    userRole,
    userId,
  }: {
    userRole: string;
    userId?: string;
  }) => (
    <div data-testid="admin-task-module">
      Admin Task Module - {userRole} - {userId}
    </div>
  ),
}));

vi.mock('../VoiceInputModule', () => ({
  default: ({
    userRole,
    onPopulateTaskForm,
  }: {
    userRole: string;
    onPopulateTaskForm?: (templateId: string, transcription: string) => void;
  }) => (
    <div data-testid="voice-input-module">
      Voice Input Module - {userRole}
      <button
        onClick={() => onPopulateTaskForm?.('template-1', 'Test transcription')}
        data-testid="trigger-voice-populate"
      >
        Trigger Voice Populate
      </button>
    </div>
  ),
}));

vi.mock('../CrossRoleContextModule', () => ({
  default: ({
    userRole,
    patientId,
  }: {
    userRole: string;
    patientId: string;
  }) => (
    <div data-testid="cross-role-context-module">
      Cross Role Context - {userRole} - {patientId}
    </div>
  ),
}));

// Mock role configurations
vi.mock('../../../types/claudeCareAssistant', () => ({
  ROLE_MODULE_CONFIGS: {
    physician: {
      preferredModel: 'claude-3-sonnet-20240229',
      enabledFeatures: {
        adminTaskAutomation: true,
        translation: true,
        voiceInput: true,
        crossRoleContext: true,
      },
    },
    nurse: {
      preferredModel: 'claude-3-haiku-20240307',
      enabledFeatures: {
        adminTaskAutomation: true,
        translation: true,
        voiceInput: false,
        crossRoleContext: true,
      },
    },
    admin: {
      preferredModel: 'claude-3-haiku-20240307',
      enabledFeatures: {
        adminTaskAutomation: true,
        translation: false,
        voiceInput: false,
        crossRoleContext: false,
      },
    },
  },
}));

describe('ClaudeCareAssistantPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Basic Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);
      expect(screen.getByText('Claude Care Assistant')).toBeInTheDocument();
    });

    it('should display subtitle', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);
      expect(screen.getByText('AI-powered translation, task automation, and collaboration')).toBeInTheDocument();
    });

    it('should display role badge', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);
      expect(screen.getByText('Physician')).toBeInTheDocument();
    });

    it('should display Nurse role badge', () => {
      render(<ClaudeCareAssistantPanel userRole="nurse" />);
      expect(screen.getByText('Nurse')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Role Configuration
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Role Configuration', () => {
    it('should show unconfigured message for unknown role', () => {
      render(<ClaudeCareAssistantPanel userRole="unknown_role" />);
      expect(screen.getByText(/Claude Care Assistant is not configured for role: unknown_role/)).toBeInTheDocument();
    });

    it('should not show unconfigured message for configured role', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);
      expect(screen.queryByText(/is not configured for role/)).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab Navigation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Tab Navigation', () => {
    it('should display Admin Tasks tab when enabled', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);
      expect(screen.getByRole('button', { name: 'Admin Tasks' })).toBeInTheDocument();
    });

    it('should display Translation tab when enabled', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);
      expect(screen.getByRole('button', { name: 'Translation' })).toBeInTheDocument();
    });

    it('should display Voice Input tab when enabled', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);
      expect(screen.getByRole('button', { name: 'Voice Input' })).toBeInTheDocument();
    });

    it('should display Team Context tab when enabled and patientId provided', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" patientId="patient-123" />);
      expect(screen.getByRole('button', { name: 'Team Context' })).toBeInTheDocument();
    });

    it('should not display Team Context tab without patientId', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);
      expect(screen.queryByRole('button', { name: 'Team Context' })).not.toBeInTheDocument();
    });

    it('should not display Voice Input tab for nurse role', () => {
      render(<ClaudeCareAssistantPanel userRole="nurse" />);
      expect(screen.queryByRole('button', { name: 'Voice Input' })).not.toBeInTheDocument();
    });

    it('should not display Translation tab for admin role', () => {
      render(<ClaudeCareAssistantPanel userRole="admin" />);
      expect(screen.queryByRole('button', { name: 'Translation' })).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab Content Switching
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Tab Content Switching', () => {
    it('should show Admin Task module by default', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" userId="user-123" />);
      expect(screen.getByTestId('admin-task-module')).toBeInTheDocument();
    });

    it('should switch to Translation module when tab clicked', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);

      fireEvent.click(screen.getByRole('button', { name: 'Translation' }));

      expect(screen.getByTestId('translation-module')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-task-module')).not.toBeInTheDocument();
    });

    it('should switch to Voice Input module when tab clicked', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" userId="user-123" />);

      fireEvent.click(screen.getByRole('button', { name: 'Voice Input' }));

      expect(screen.getByTestId('voice-input-module')).toBeInTheDocument();
    });

    it('should switch to Team Context module when tab clicked', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" patientId="patient-123" />);

      fireEvent.click(screen.getByRole('button', { name: 'Team Context' }));

      expect(screen.getByTestId('cross-role-context-module')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Module Props
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Module Props', () => {
    it('should pass userRole to modules', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);
      expect(screen.getByTestId('admin-task-module')).toHaveTextContent('physician');
    });

    it('should pass userId to Admin Task module', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" userId="user-123" />);
      expect(screen.getByTestId('admin-task-module')).toHaveTextContent('user-123');
    });

    it('should pass patientId to Cross Role Context module', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" patientId="patient-456" />);

      fireEvent.click(screen.getByRole('button', { name: 'Team Context' }));

      expect(screen.getByTestId('cross-role-context-module')).toHaveTextContent('patient-456');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Voice Input Integration
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Voice Input Integration', () => {
    it('should switch to tasks tab when voice populate is triggered', async () => {
      render(<ClaudeCareAssistantPanel userRole="physician" userId="user-123" />);

      // Switch to voice tab first
      fireEvent.click(screen.getByRole('button', { name: 'Voice Input' }));
      expect(screen.getByTestId('voice-input-module')).toBeInTheDocument();

      // Trigger voice populate
      fireEvent.click(screen.getByTestId('trigger-voice-populate'));

      // Should switch back to tasks tab
      await waitFor(() => {
        expect(screen.getByTestId('admin-task-module')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Active Tab Styling
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Active Tab Styling', () => {
    it('should highlight active tab', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);

      const tasksTab = screen.getByRole('button', { name: 'Admin Tasks' });
      const translationTab = screen.getByRole('button', { name: 'Translation' });

      // Tasks tab should be active by default
      expect(tasksTab).toHaveClass('border-blue-500');
      expect(translationTab).not.toHaveClass('border-blue-500');
    });

    it('should update active tab styling on click', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);

      const tasksTab = screen.getByRole('button', { name: 'Admin Tasks' });
      const translationTab = screen.getByRole('button', { name: 'Translation' });

      fireEvent.click(translationTab);

      expect(translationTab).toHaveClass('border-blue-500');
      expect(tasksTab).not.toHaveClass('border-blue-500');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Role Display Names
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Role Display Names', () => {
    it('should display Physician for physician role', () => {
      render(<ClaudeCareAssistantPanel userRole="physician" />);
      expect(screen.getByText('Physician')).toBeInTheDocument();
    });

    it('should display Nurse for nurse role', () => {
      render(<ClaudeCareAssistantPanel userRole="nurse" />);
      expect(screen.getByText('Nurse')).toBeInTheDocument();
    });

    it('should display Administrator for admin role', () => {
      render(<ClaudeCareAssistantPanel userRole="admin" />);
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });
  });
});
