/**
 * ConsultationPanel.test.tsx - Tests for ConsultationPanel component
 *
 * Purpose: Verify consultation mode UI — tabbed navigation, case presentation,
 *          Socratic reasoning display, cannot-miss warnings, and grounding report.
 * Sessions 7-8 of Compass Riley Clinical Reasoning Hardening
 * Session 8 adds: enhanced differentials (redFlags, keyTest, literatureNote),
 *                  structured cannot-miss, backwards-compat for string[] cannotMiss
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ConsultationPanel } from '../ConsultationPanel';
import type { ConsultationPanelProps } from '../ConsultationPanel';

vi.mock('../../envision-atlus/EACard', () => ({
  EACard: ({ children }: { children?: React.ReactNode }) => <div data-testid="ea-card">{children}</div>,
  EACardHeader: ({ children, icon }: { children?: React.ReactNode; icon?: React.ReactNode }) => <div data-testid="ea-card-header">{icon}{children}</div>,
  EACardContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

function buildMockResponse(overrides?: Partial<ConsultationPanelProps['response']>): ConsultationPanelProps['response'] {
  return {
    casePresentation: {
      oneLiner: '65-year-old male presenting with acute chest pain and diaphoresis',
      hpi: 'Patient reports sudden onset substernal chest pain radiating to left arm, with associated diaphoresis and nausea.',
      pastMedicalHistory: ['Hypertension', 'Type 2 DM', 'Hyperlipidemia'],
      medications: ['Lisinopril 20mg daily', 'Metformin 1000mg BID'],
      allergies: ['Penicillin — rash'],
      socialHistory: ['Former smoker, quit 5 years ago'],
      familyHistory: ['Father — MI at age 55'],
      ros: ['Positive for chest pain, diaphoresis, nausea'],
      physicalExam: { Cardiovascular: ['Tachycardic, regular rhythm', 'No murmurs'], Respiratory: ['Clear bilaterally'] },
      diagnostics: ['ECG: ST elevations in leads V1-V4', 'Troponin pending'],
      assessment: 'Acute STEMI, anterior wall. Emergent cath lab activation warranted.',
      differentials: [
        { diagnosis: 'STEMI', icd10: 'I21.0', probability: 'high', supporting: ['ST elevations V1-V4', 'Classic presentation'], against: [] },
        { diagnosis: 'Unstable Angina', probability: 'moderate', supporting: ['Chest pain pattern'], against: ['ST elevations present'] },
        { diagnosis: 'Aortic Dissection', icd10: 'I71.0', probability: 'low', supporting: ['Acute onset'], against: ['No tearing pain', 'No BP differential'] },
      ],
      plan: ['Activate cath lab', 'Aspirin 325mg chewed', 'Heparin bolus', 'Serial troponins'],
    },
    reasoningSteps: [
      {
        question: 'What is the most likely etiology given the ECG findings?',
        analysis: 'ST elevations in contiguous leads V1-V4 strongly suggest acute anterior STEMI.',
        considerations: ['Check for reciprocal changes in inferior leads', 'Consider Wellens syndrome if dynamic'],
        pivotPoints: ['If troponin negative at 3h, reconsider diagnosis'],
      },
      {
        question: 'Are there features suggesting an alternative diagnosis?',
        analysis: 'No tearing quality to pain, no pulse deficit — aortic dissection less likely.',
        considerations: ['D-dimer if PE considered'],
        pivotPoints: ['New murmur on repeat exam would raise concern for dissection'],
      },
    ],
    cannotMiss: ['Aortic dissection — must confirm before anticoagulation', 'Tension pneumothorax — if sudden deterioration'],
    suggestedWorkup: ['Troponin q3h', 'CXR portable', 'BMP', 'CBC', 'Coags'],
    guidelineNotes: ['ACC/AHA 2023: Door-to-balloon < 90 min for STEMI', 'Dual antiplatelet within 24h'],
    confidenceCalibration: {
      highConfidence: ['STEMI diagnosis based on ECG'],
      uncertain: ['Exact culprit vessel without cath'],
      insufficientData: ['Prior cardiac history details'],
    },
    groundingFlags: {
      statedCount: 12,
      inferredCount: 3,
      gapCount: 2,
      gaps: ['Complete ROS not documented', 'Medication timing not specified'],
    },
    ...overrides,
  };
}

describe('ConsultationPanel', () => {
  describe('Tab Navigation', () => {
    it('should render all five section tabs', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      expect(screen.getByText('Case')).toBeInTheDocument();
      expect(screen.getByText('Reasoning')).toBeInTheDocument();
      expect(screen.getByText('Safety')).toBeInTheDocument();
      expect(screen.getByText('Workup')).toBeInTheDocument();
      expect(screen.getByText('Confidence')).toBeInTheDocument();
    });

    it('should show Case section by default', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      expect(screen.getByText(/65-year-old male presenting/)).toBeInTheDocument();
    });

    it('should switch to Reasoning tab when clicked', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      fireEvent.click(screen.getByText('Reasoning'));

      expect(screen.getByText(/most likely etiology/)).toBeInTheDocument();
      // Case content should not be visible
      expect(screen.queryByText(/65-year-old male presenting/)).not.toBeInTheDocument();
    });

    it('should switch to Safety tab showing cannot-miss diagnoses', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      fireEvent.click(screen.getByText('Safety'));

      expect(screen.getByText(/Aortic dissection/)).toBeInTheDocument();
      expect(screen.getByText(/Tension pneumothorax/)).toBeInTheDocument();
    });

    it('should switch to Workup tab showing suggested tests', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      fireEvent.click(screen.getByText('Workup'));

      expect(screen.getByText('Troponin q3h')).toBeInTheDocument();
      expect(screen.getByText('CXR portable')).toBeInTheDocument();
    });

    it('should switch to Confidence tab showing calibration data', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      fireEvent.click(screen.getByText('Confidence'));

      expect(screen.getByText('STEMI diagnosis based on ECG')).toBeInTheDocument();
      expect(screen.getByText('Exact culprit vessel without cath')).toBeInTheDocument();
      expect(screen.getByText('Prior cardiac history details')).toBeInTheDocument();
    });
  });

  describe('Case Presentation', () => {
    it('should display the one-liner summary', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      expect(screen.getByText('65-year-old male presenting with acute chest pain and diaphoresis')).toBeInTheDocument();
    });

    it('should display HPI narrative', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      expect(screen.getByText(/sudden onset substernal chest pain/)).toBeInTheDocument();
    });

    it('should display past medical history items', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      expect(screen.getByText(/Hypertension/)).toBeInTheDocument();
      expect(screen.getByText(/Type 2 DM/)).toBeInTheDocument();
    });

    it('should render differential diagnoses with probability labels', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      const diff1 = screen.getByTestId('differential-1');
      expect(within(diff1).getByText('STEMI')).toBeInTheDocument();
      expect(within(diff1).getByText('high')).toBeInTheDocument();

      const diff3 = screen.getByTestId('differential-3');
      expect(within(diff3).getByText('Aortic Dissection')).toBeInTheDocument();
      expect(within(diff3).getByText('low')).toBeInTheDocument();
    });

    it('should display ICD-10 codes next to differentials when available', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      expect(screen.getByText('(I21.0)')).toBeInTheDocument();
      expect(screen.getByText('(I71.0)')).toBeInTheDocument();
    });

    it('should display supporting and against evidence for differentials', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      const diff1 = screen.getByTestId('differential-1');
      expect(within(diff1).getByText(/ST elevations V1-V4/)).toBeInTheDocument();

      const diff2 = screen.getByTestId('differential-2');
      expect(within(diff2).getByText(/ST elevations present/)).toBeInTheDocument();
    });

    it('should display plan items as numbered list', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      expect(screen.getByText('Activate cath lab')).toBeInTheDocument();
      expect(screen.getByText('Heparin bolus')).toBeInTheDocument();
    });

    it('should display physical exam findings grouped by system', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      expect(screen.getByText('Cardiovascular:')).toBeInTheDocument();
      expect(screen.getByText(/Tachycardic, regular rhythm/)).toBeInTheDocument();
    });

    it('should display assessment text', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      expect(screen.getByText(/Acute STEMI, anterior wall/)).toBeInTheDocument();
    });
  });

  describe('Socratic Reasoning', () => {
    it('should display reasoning step questions with indices', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Reasoning'));

      expect(screen.getByTestId('reasoning-step-1')).toBeInTheDocument();
      expect(screen.getByTestId('reasoning-step-2')).toBeInTheDocument();

      const step1 = screen.getByTestId('reasoning-step-1');
      expect(within(step1).getByText('Q1.')).toBeInTheDocument();
      expect(within(step1).getByText(/most likely etiology/)).toBeInTheDocument();
    });

    it('should display analysis for each reasoning step', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Reasoning'));

      const step1 = screen.getByTestId('reasoning-step-1');
      expect(within(step1).getByText(/strongly suggest acute anterior STEMI/)).toBeInTheDocument();
    });

    it('should display considerations for reasoning steps', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Reasoning'));

      expect(screen.getByText(/reciprocal changes in inferior leads/)).toBeInTheDocument();
    });

    it('should display pivot points for reasoning steps', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Reasoning'));

      expect(screen.getByText(/troponin negative at 3h/)).toBeInTheDocument();
    });

    it('should show empty state when no reasoning steps exist', () => {
      render(<ConsultationPanel response={buildMockResponse({ reasoningSteps: [] })} />);
      fireEvent.click(screen.getByText('Reasoning'));

      expect(screen.getByText(/No reasoning steps generated yet/)).toBeInTheDocument();
    });
  });

  describe('Safety Section', () => {
    it('should display cannot-miss diagnoses with warning indicators', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Safety'));

      const list = screen.getByRole('list', { name: /cannot-miss diagnoses/i });
      expect(list).toBeInTheDocument();
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    });

    it('should display guideline notes', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Safety'));

      expect(screen.getByText(/Door-to-balloon < 90 min/)).toBeInTheDocument();
      expect(screen.getByText(/Dual antiplatelet within 24h/)).toBeInTheDocument();
    });
  });

  describe('Workup Section', () => {
    it('should display all suggested workup items', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Workup'));

      expect(screen.getByText('Troponin q3h')).toBeInTheDocument();
      expect(screen.getByText('BMP')).toBeInTheDocument();
      expect(screen.getByText('CBC')).toBeInTheDocument();
      expect(screen.getByText('Coags')).toBeInTheDocument();
    });

    it('should show empty state when no workup suggested', () => {
      render(<ConsultationPanel response={buildMockResponse({ suggestedWorkup: [] })} />);
      fireEvent.click(screen.getByText('Workup'));

      expect(screen.getByText(/No additional workup suggested/)).toBeInTheDocument();
    });
  });

  describe('Confidence Calibration', () => {
    it('should display high confidence items with checkmark', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Confidence'));

      expect(screen.getByText('STEMI diagnosis based on ECG')).toBeInTheDocument();
    });

    it('should display uncertain items', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Confidence'));

      expect(screen.getByText('Exact culprit vessel without cath')).toBeInTheDocument();
    });

    it('should display insufficient data items', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Confidence'));

      expect(screen.getByText('Prior cardiac history details')).toBeInTheDocument();
    });
  });

  describe('Grounding Report', () => {
    it('should display grounding flag counts', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Confidence'));

      // Check counts are displayed
      expect(screen.getByText('12')).toBeInTheDocument(); // statedCount
      expect(screen.getByText('3')).toBeInTheDocument(); // inferredCount
      expect(screen.getByText('2')).toBeInTheDocument(); // gapCount
    });

    it('should display count labels', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Confidence'));

      expect(screen.getByText('Stated')).toBeInTheDocument();
      expect(screen.getByText('Inferred')).toBeInTheDocument();
      expect(screen.getByText('Gaps')).toBeInTheDocument();
    });

    it('should list documentation gaps when present', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Confidence'));

      expect(screen.getByText(/Complete ROS not documented/)).toBeInTheDocument();
      expect(screen.getByText(/Medication timing not specified/)).toBeInTheDocument();
    });

    it('should not show gaps section when no gaps exist', () => {
      render(<ConsultationPanel response={buildMockResponse({
        groundingFlags: { statedCount: 10, inferredCount: 1, gapCount: 0, gaps: [] },
      })} />);
      fireEvent.click(screen.getByText('Confidence'));

      expect(screen.queryByText('Documentation Gaps')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have consultation-panel test id', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      expect(screen.getByTestId('consultation-panel')).toBeInTheDocument();
    });

    it('should have aria-pressed on active tab', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      const caseTab = screen.getByText('Case').closest('button');
      expect(caseTab).toHaveAttribute('aria-pressed', 'true');

      const reasoningTab = screen.getByText('Reasoning').closest('button');
      expect(reasoningTab).toHaveAttribute('aria-pressed', 'false');
    });

    it('should update aria-pressed when tab changes', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      fireEvent.click(screen.getByText('Reasoning'));

      const caseTab = screen.getByText('Case').closest('button');
      expect(caseTab).toHaveAttribute('aria-pressed', 'false');

      const reasoningTab = screen.getByText('Reasoning').closest('button');
      expect(reasoningTab).toHaveAttribute('aria-pressed', 'true');
    });

    it('should have minimum touch target size on tabs', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      const caseTab = screen.getByText('Case').closest('button');
      expect(caseTab).toHaveClass('min-h-[44px]');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays gracefully', () => {
      const emptyResponse = buildMockResponse({
        casePresentation: {
          ...buildMockResponse().casePresentation,
          pastMedicalHistory: [],
          medications: [],
          allergies: [],
          socialHistory: [],
          familyHistory: [],
          ros: [],
          physicalExam: {},
          diagnostics: [],
          differentials: [],
          plan: [],
        },
      });

      render(<ConsultationPanel response={emptyResponse} />);

      // Should still render the one-liner and HPI without crashing
      expect(screen.getByText(/65-year-old male presenting/)).toBeInTheDocument();
    });

    it('should handle differential without ICD-10 code', () => {
      render(<ConsultationPanel response={buildMockResponse()} />);

      // Unstable Angina has no icd10 field
      const diff2 = screen.getByTestId('differential-2');
      expect(within(diff2).getByText('Unstable Angina')).toBeInTheDocument();
      // Should not crash looking for ICD-10
      expect(within(diff2).queryByText(/\(/)).not.toBeInTheDocument();
    });
  });

  describe('Session 8: Enhanced Differentials', () => {
    function buildEnhancedDifferentialResponse() {
      return buildMockResponse({
        casePresentation: {
          ...buildMockResponse().casePresentation,
          differentials: [
            {
              diagnosis: 'STEMI',
              icd10: 'I21.0',
              probability: 'high' as const,
              supporting: ['ST elevations V1-V4'],
              against: [],
              redFlags: ['Sudden hypotension', 'New murmur'],
              keyTest: '12-lead ECG with serial troponins',
              literatureNote: 'PMID:34567890 — Door-to-balloon time independently predicts mortality',
            },
            {
              diagnosis: 'Aortic Dissection',
              icd10: 'I71.0',
              probability: 'low' as const,
              supporting: ['Acute onset'],
              against: ['No tearing pain'],
              redFlags: ['BP differential >20mmHg between arms'],
              keyTest: 'CT angiography of chest/abdomen/pelvis',
            },
          ],
        },
      });
    }

    it('should display red flags for differentials', () => {
      render(<ConsultationPanel response={buildEnhancedDifferentialResponse()} />);

      const diff1 = screen.getByTestId('differential-1');
      expect(within(diff1).getByText(/Sudden hypotension/)).toBeInTheDocument();
      expect(within(diff1).getByText(/New murmur/)).toBeInTheDocument();
    });

    it('should display key test for differentials', () => {
      render(<ConsultationPanel response={buildEnhancedDifferentialResponse()} />);

      const diff1 = screen.getByTestId('differential-1');
      expect(within(diff1).getByText(/12-lead ECG with serial troponins/)).toBeInTheDocument();
    });

    it('should display literature note when available', () => {
      render(<ConsultationPanel response={buildEnhancedDifferentialResponse()} />);

      const diff1 = screen.getByTestId('differential-1');
      expect(within(diff1).getByText(/Door-to-balloon time independently predicts/)).toBeInTheDocument();
    });

    it('should not show literature note when absent', () => {
      render(<ConsultationPanel response={buildEnhancedDifferentialResponse()} />);

      const diff2 = screen.getByTestId('differential-2');
      // Second differential has no literatureNote
      expect(within(diff2).queryByText(/PMID/)).not.toBeInTheDocument();
    });

    it('should gracefully handle differentials without Session 8 fields', () => {
      // Original Session 7 style — no redFlags, keyTest, literatureNote
      render(<ConsultationPanel response={buildMockResponse()} />);

      const diff1 = screen.getByTestId('differential-1');
      expect(within(diff1).getByText('STEMI')).toBeInTheDocument();
      // Should not crash when optional fields are absent
      expect(within(diff1).queryByText(/Red flags/)).not.toBeInTheDocument();
    });
  });

  describe('Session 8: Structured Cannot-Miss', () => {
    function buildStructuredCannotMissResponse() {
      return buildMockResponse({
        cannotMiss: [
          {
            diagnosis: 'Aortic Dissection',
            severity: 'life-threatening' as const,
            whyDangerous: 'Anticoagulation for STEMI could be fatal if dissection present',
            distinguishingFeatures: ['Tearing quality pain', 'BP differential between arms', 'Mediastinal widening on CXR'],
            ruleOutTest: 'CT angiography or TEE',
            timeframe: 'Before anticoagulation',
          },
          {
            diagnosis: 'Tension Pneumothorax',
            severity: 'emergent' as const,
            whyDangerous: 'Rapidly fatal if untreated, can mimic cardiac pathology',
            distinguishingFeatures: ['Absent breath sounds unilaterally', 'Tracheal deviation', 'JVD'],
            ruleOutTest: 'Portable chest X-ray',
            timeframe: 'Within minutes if hemodynamically unstable',
          },
          {
            diagnosis: 'Pulmonary Embolism',
            severity: 'urgent' as const,
            whyDangerous: 'Can cause right heart failure if massive',
            distinguishingFeatures: ['Pleuritic chest pain', 'Tachycardia out of proportion'],
            ruleOutTest: 'CT pulmonary angiography',
            timeframe: 'Within 2 hours',
          },
        ],
      });
    }

    it('should render structured cannot-miss cards with severity badges', () => {
      render(<ConsultationPanel response={buildStructuredCannotMissResponse()} />);
      fireEvent.click(screen.getByText('Safety'));

      const items = screen.getAllByTestId('cannot-miss-item');
      expect(items).toHaveLength(3);
    });

    it('should show severity badge for each cannot-miss diagnosis', () => {
      render(<ConsultationPanel response={buildStructuredCannotMissResponse()} />);
      fireEvent.click(screen.getByText('Safety'));

      expect(screen.getByText('life-threatening')).toBeInTheDocument();
      expect(screen.getByText('emergent')).toBeInTheDocument();
      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('should display why-dangerous explanation', () => {
      render(<ConsultationPanel response={buildStructuredCannotMissResponse()} />);
      fireEvent.click(screen.getByText('Safety'));

      expect(screen.getByText(/Anticoagulation for STEMI could be fatal/)).toBeInTheDocument();
    });

    it('should display distinguishing features', () => {
      render(<ConsultationPanel response={buildStructuredCannotMissResponse()} />);
      fireEvent.click(screen.getByText('Safety'));

      expect(screen.getByText(/Tearing quality pain/)).toBeInTheDocument();
      expect(screen.getByText(/BP differential between arms/)).toBeInTheDocument();
    });

    it('should display rule-out test and timeframe', () => {
      render(<ConsultationPanel response={buildStructuredCannotMissResponse()} />);
      fireEvent.click(screen.getByText('Safety'));

      expect(screen.getByText(/CT angiography or TEE/)).toBeInTheDocument();
      expect(screen.getByText(/Before anticoagulation/)).toBeInTheDocument();
    });

    it('should fall back to string list for legacy cannotMiss format', () => {
      // Original string[] format from Session 7
      render(<ConsultationPanel response={buildMockResponse()} />);
      fireEvent.click(screen.getByText('Safety'));

      // Should render as simple list, not structured cards
      expect(screen.queryByTestId('cannot-miss-item')).not.toBeInTheDocument();
      expect(screen.getByText(/Aortic dissection — must confirm/)).toBeInTheDocument();
    });
  });
});
