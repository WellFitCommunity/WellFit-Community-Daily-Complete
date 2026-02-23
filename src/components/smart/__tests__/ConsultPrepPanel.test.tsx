/**
 * ConsultPrepPanel.test.tsx - Tests for ConsultPrepPanel component
 *
 * Purpose: Verify peer consult prep UI — specialty selection, SBAR display,
 *          urgency badges, loading/disabled states, and critical data.
 * Session 8 of Compass Riley Clinical Reasoning Hardening
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsultPrepPanel, CONSULT_SPECIALTIES } from '../ConsultPrepPanel';
import type { ConsultPrepSummaryData } from '../ConsultPrepPanel';

vi.mock('../../envision-atlus/EACard', () => ({
  EACard: ({ children }: { children?: React.ReactNode }) => <div data-testid="ea-card">{children}</div>,
  EACardHeader: ({ children, icon }: { children?: React.ReactNode; icon?: React.ReactNode }) => <div data-testid="ea-card-header">{icon}{children}</div>,
  EACardContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

function buildMockSummary(overrides?: Partial<ConsultPrepSummaryData>): ConsultPrepSummaryData {
  return {
    targetSpecialty: 'Cardiology',
    situation: '65-year-old male with acute anterior STEMI, cath lab activated.',
    background: 'PMH: HTN, DM2, HLD. Current meds: Lisinopril 20mg, Metformin 1000mg BID. Allergic to Penicillin. ECG shows ST elevations V1-V4.',
    assessment: 'High probability acute anterior STEMI. Troponin pending. Hemodynamically stable currently.',
    recommendation: 'Requesting emergent cardiac catheterization. Patient consented. On heparin drip.',
    criticalData: [
      'ECG: ST elevations V1-V4',
      'BP 145/90, HR 105, SpO2 97%',
      'Aspirin 325mg given, heparin bolus administered',
      'Troponin I pending (drawn 5 min ago)',
    ],
    consultQuestion: 'Does this patient need emergent PCI vs. medical management given the ECG findings and clinical picture?',
    urgency: 'stat',
    ...overrides,
  };
}

describe('ConsultPrepPanel', () => {
  describe('Specialty Selector', () => {
    it('should render all supported specialties as selectable buttons', () => {
      render(
        <ConsultPrepPanel
          summary={null}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      for (const spec of CONSULT_SPECIALTIES) {
        expect(screen.getByText(spec)).toBeInTheDocument();
      }
    });

    it('should highlight the selected specialty', () => {
      render(
        <ConsultPrepPanel
          summary={null}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      fireEvent.click(screen.getByText('Cardiology'));

      const btn = screen.getByText('Cardiology');
      expect(btn).toHaveAttribute('aria-pressed', 'true');
      expect(btn).toHaveClass('bg-blue-600');
    });

    it('should call onRequestConsultPrep with selected specialty when button clicked', () => {
      const onRequest = vi.fn();
      render(
        <ConsultPrepPanel
          summary={null}
          loading={false}
          onRequestConsultPrep={onRequest}
          hasConsultationResponse={true}
        />
      );

      fireEvent.click(screen.getByText('Neurology'));
      fireEvent.click(screen.getByTestId('request-consult-prep-btn'));

      expect(onRequest).toHaveBeenCalledWith('Neurology');
    });

    it('should disable button when no specialty is selected', () => {
      render(
        <ConsultPrepPanel
          summary={null}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      const btn = screen.getByTestId('request-consult-prep-btn');
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent('Select a specialty');
    });

    it('should disable button when loading', () => {
      render(
        <ConsultPrepPanel
          summary={null}
          loading={true}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      const btn = screen.getByTestId('request-consult-prep-btn');
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent('Generating consult summary');
    });

    it('should disable and explain when no consultation response exists', () => {
      render(
        <ConsultPrepPanel
          summary={null}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={false}
        />
      );

      const btn = screen.getByTestId('request-consult-prep-btn');
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent('Run consultation analysis first');
      expect(screen.getByText(/Record an encounter in consultation mode first/)).toBeInTheDocument();
    });
  });

  describe('SBAR Summary Display', () => {
    it('should display specialty and urgency in header', () => {
      render(
        <ConsultPrepPanel
          summary={buildMockSummary()}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      expect(screen.getByText('Cardiology Consult Summary')).toBeInTheDocument();
      expect(screen.getByTestId('urgency-badge')).toHaveTextContent('stat');
    });

    it('should display all four SBAR sections', () => {
      render(
        <ConsultPrepPanel
          summary={buildMockSummary()}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      // SBAR labels
      expect(screen.getByText('Situation')).toBeInTheDocument();
      expect(screen.getByText('Background')).toBeInTheDocument();
      expect(screen.getByText('Assessment')).toBeInTheDocument();
      expect(screen.getByText('Recommendation')).toBeInTheDocument();
    });

    it('should display SBAR content from summary', () => {
      render(
        <ConsultPrepPanel
          summary={buildMockSummary()}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      expect(screen.getByText(/acute anterior STEMI, cath lab activated/)).toBeInTheDocument();
      expect(screen.getByText(/Requesting emergent cardiac catheterization/)).toBeInTheDocument();
    });

    it('should display the consult question prominently', () => {
      render(
        <ConsultPrepPanel
          summary={buildMockSummary()}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      const question = screen.getByTestId('consult-question');
      expect(question).toHaveTextContent(/emergent PCI vs. medical management/);
    });

    it('should display critical data points', () => {
      render(
        <ConsultPrepPanel
          summary={buildMockSummary()}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      expect(screen.getByText(/ECG: ST elevations V1-V4/)).toBeInTheDocument();
      expect(screen.getByText(/Troponin I pending/)).toBeInTheDocument();
      expect(screen.getByText(/Aspirin 325mg given/)).toBeInTheDocument();
    });
  });

  describe('Urgency Badges', () => {
    it('should show stat urgency in red', () => {
      render(
        <ConsultPrepPanel
          summary={buildMockSummary({ urgency: 'stat' })}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      const badge = screen.getByTestId('urgency-badge');
      expect(badge).toHaveTextContent('stat');
      expect(badge).toHaveClass('bg-red-600');
    });

    it('should show urgent urgency in orange', () => {
      render(
        <ConsultPrepPanel
          summary={buildMockSummary({ urgency: 'urgent' })}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      const badge = screen.getByTestId('urgency-badge');
      expect(badge).toHaveTextContent('urgent');
      expect(badge).toHaveClass('bg-orange-600');
    });

    it('should show routine urgency in slate', () => {
      render(
        <ConsultPrepPanel
          summary={buildMockSummary({ urgency: 'routine' })}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      const badge = screen.getByTestId('urgency-badge');
      expect(badge).toHaveTextContent('routine');
      expect(badge).toHaveClass('bg-slate-600');
    });
  });

  describe('Accessibility & Layout', () => {
    it('should have consult-prep-panel test id', () => {
      render(
        <ConsultPrepPanel
          summary={null}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      expect(screen.getByTestId('consult-prep-panel')).toBeInTheDocument();
    });

    it('should have minimum touch target on request button', () => {
      render(
        <ConsultPrepPanel
          summary={null}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      const btn = screen.getByTestId('request-consult-prep-btn');
      expect(btn).toHaveClass('min-h-[44px]');
    });

    it('should not show SBAR summary when summary is null', () => {
      render(
        <ConsultPrepPanel
          summary={null}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      expect(screen.queryByText('Cardiology Consult Summary')).not.toBeInTheDocument();
      expect(screen.queryByText('Situation')).not.toBeInTheDocument();
    });

    it('should show both selector and SBAR when summary exists', () => {
      render(
        <ConsultPrepPanel
          summary={buildMockSummary()}
          loading={false}
          onRequestConsultPrep={vi.fn()}
          hasConsultationResponse={true}
        />
      );

      // Selector still visible
      expect(screen.getByText('Peer Consult Prep')).toBeInTheDocument();
      // SBAR also visible
      expect(screen.getByText('Cardiology Consult Summary')).toBeInTheDocument();
    });
  });
});
