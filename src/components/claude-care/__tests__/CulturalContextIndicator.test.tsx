/**
 * CulturalContextIndicator Tests
 *
 * Tests for cultural context display component:
 * - Language display
 * - Communication style indicators
 * - Health literacy levels
 * - Religious/cultural considerations
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CulturalContextIndicator from '../CulturalContextIndicator';
import type { PatientCulturalContext } from '../../../types/claudeCareAssistant';

describe('CulturalContextIndicator', () => {
  const baseCulturalContext: PatientCulturalContext = {
    primaryLanguage: 'en',
    preferredCommunicationStyle: 'direct',
    healthLiteracyLevel: 'high',
    culturalBackground: 'Western',
    religiousCulturalConsiderations: [],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Basic Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<CulturalContextIndicator culturalContext={baseCulturalContext} />);
      expect(screen.getByText('Cultural Context')).toBeInTheDocument();
    });

    it('should display globe emoji header', () => {
      render(<CulturalContextIndicator culturalContext={baseCulturalContext} />);
      expect(screen.getByText('🌍')).toBeInTheDocument();
    });

    it('should show info note about cultural competence', () => {
      render(<CulturalContextIndicator culturalContext={baseCulturalContext} />);
      expect(screen.getByText(/culturally competent care/)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Language Display
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Language Display', () => {
    it('should display English language', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, primaryLanguage: 'en' }} />);
      expect(screen.getByText('English')).toBeInTheDocument();
    });

    it('should display Spanish language', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, primaryLanguage: 'es' }} />);
      expect(screen.getByText('Spanish (Español)')).toBeInTheDocument();
    });

    it('should display language section label', () => {
      render(<CulturalContextIndicator culturalContext={baseCulturalContext} />);
      expect(screen.getByText('Language')).toBeInTheDocument();
    });

    it('should show speech emoji for language', () => {
      render(<CulturalContextIndicator culturalContext={baseCulturalContext} />);
      expect(screen.getByText('🗣️')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Communication Style
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Communication Style', () => {
    it('should display direct communication style', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, preferredCommunicationStyle: 'direct' }} />);
      expect(screen.getByText('direct')).toBeInTheDocument();
    });

    it('should display indirect communication style', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, preferredCommunicationStyle: 'indirect' }} />);
      expect(screen.getByText('indirect')).toBeInTheDocument();
    });

    it('should display formal communication style', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, preferredCommunicationStyle: 'formal' }} />);
      expect(screen.getByText('formal')).toBeInTheDocument();
    });

    it('should display casual communication style', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, preferredCommunicationStyle: 'casual' }} />);
      expect(screen.getByText('casual')).toBeInTheDocument();
    });

    it('should not show communication when undefined', () => {
      const context = { ...baseCulturalContext, preferredCommunicationStyle: undefined };
      render(<CulturalContextIndicator culturalContext={context as PatientCulturalContext} />);
      expect(screen.queryByText('Communication')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Health Literacy Level
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Health Literacy Level', () => {
    it('should display high health literacy', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, healthLiteracyLevel: 'high' }} />);
      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('should display medium health literacy', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, healthLiteracyLevel: 'medium' }} />);
      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    });

    it('should display low health literacy', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, healthLiteracyLevel: 'low' }} />);
      expect(screen.getByText('LOW')).toBeInTheDocument();
    });

    it('should show book emoji for health literacy', () => {
      render(<CulturalContextIndicator culturalContext={baseCulturalContext} />);
      expect(screen.getByText('📚')).toBeInTheDocument();
    });

    it('should not show health literacy when undefined', () => {
      const context = { ...baseCulturalContext, healthLiteracyLevel: undefined };
      render(<CulturalContextIndicator culturalContext={context as PatientCulturalContext} />);
      expect(screen.queryByText('Health Literacy')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cultural Background
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cultural Background', () => {
    it('should display cultural background', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, culturalBackground: 'East Asian' }} />);
      expect(screen.getByText('East Asian')).toBeInTheDocument();
    });

    it('should show mask emoji for background', () => {
      render(<CulturalContextIndicator culturalContext={baseCulturalContext} />);
      expect(screen.getByText('🎭')).toBeInTheDocument();
    });

    it('should not show background when undefined', () => {
      const context = { ...baseCulturalContext, culturalBackground: undefined };
      render(<CulturalContextIndicator culturalContext={context as PatientCulturalContext} />);
      expect(screen.queryByText('Background')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Religious/Cultural Considerations
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Religious/Cultural Considerations', () => {
    it('should display religious considerations', () => {
      const context: PatientCulturalContext = {
        ...baseCulturalContext,
        religiousCulturalConsiderations: ['Halal diet', 'Prayer times'],
      };
      render(<CulturalContextIndicator culturalContext={context} />);
      expect(screen.getByText('Halal diet')).toBeInTheDocument();
      expect(screen.getByText('Prayer times')).toBeInTheDocument();
    });

    it('should show prayer emoji for considerations', () => {
      const context: PatientCulturalContext = {
        ...baseCulturalContext,
        religiousCulturalConsiderations: ['Fasting'],
      };
      render(<CulturalContextIndicator culturalContext={context} />);
      expect(screen.getByText('🙏')).toBeInTheDocument();
    });

    it('should display Important Considerations label', () => {
      const context: PatientCulturalContext = {
        ...baseCulturalContext,
        religiousCulturalConsiderations: ['Kosher diet'],
      };
      render(<CulturalContextIndicator culturalContext={context} />);
      expect(screen.getByText('Important Considerations')).toBeInTheDocument();
    });

    it('should not show considerations section when empty array', () => {
      const context: PatientCulturalContext = {
        ...baseCulturalContext,
        religiousCulturalConsiderations: [],
      };
      render(<CulturalContextIndicator culturalContext={context} />);
      expect(screen.queryByText('Important Considerations')).not.toBeInTheDocument();
    });

    it('should not show considerations section when undefined', () => {
      const context = { ...baseCulturalContext, religiousCulturalConsiderations: undefined };
      render(<CulturalContextIndicator culturalContext={context as PatientCulturalContext} />);
      expect(screen.queryByText('Important Considerations')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Communication Style Icons
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Communication Style Icons', () => {
    it('should show chat icon for direct style', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, preferredCommunicationStyle: 'direct' }} />);
      expect(screen.getByText('💬')).toBeInTheDocument();
    });

    it('should show handshake icon for indirect style', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, preferredCommunicationStyle: 'indirect' }} />);
      expect(screen.getByText('🤝')).toBeInTheDocument();
    });

    it('should show tie icon for formal style', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, preferredCommunicationStyle: 'formal' }} />);
      expect(screen.getByText('👔')).toBeInTheDocument();
    });

    it('should show smile icon for casual style', () => {
      render(<CulturalContextIndicator culturalContext={{ ...baseCulturalContext, preferredCommunicationStyle: 'casual' }} />);
      expect(screen.getByText('😊')).toBeInTheDocument();
    });
  });
});
