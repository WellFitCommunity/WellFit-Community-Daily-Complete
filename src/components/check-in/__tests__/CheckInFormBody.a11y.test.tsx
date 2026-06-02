// src/components/check-in/__tests__/CheckInFormBody.a11y.test.tsx
// Behavioral + axe-core accessibility test for the daily vitals check-in form.
// This is the primary patient-facing data-entry form (seniors entering vitals), so
// label association (WCAG 1.3.1) is both a certification and a patient-safety concern.
//
// Deletion test: each getByLabelText below fails if the corresponding label/input
// htmlFor+id pairing is removed — i.e. it asserts the actual accessibility wiring,
// not just that the component renders.

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CheckInFormBody } from '../CheckInFormBody';
import type { CheckInFormBodyProps } from '../CheckIn.types';
import { expectNoA11yViolations } from '../../../test-utils/axeHelper';

function buildProps(overrides: Partial<CheckInFormBodyProps> = {}): CheckInFormBodyProps {
  return {
    mood: '', // keep empty so the WellnessSuggestions subtree does not render
    heartRate: '',
    pulseOximeter: '',
    bpSystolic: '',
    bpDiastolic: '',
    glucose: '',
    weight: '',
    physicalActivity: '',
    socialEngagement: '',
    symptoms: '',
    activityNotes: '',
    isSubmitting: false,
    isListening: false,
    currentField: null,
    infoMessage: null,
    feedbackRef: React.createRef<HTMLDivElement>(),
    branding: {},
    onSetMood: vi.fn(),
    onSetHeartRate: vi.fn(),
    onSetPulseOximeter: vi.fn(),
    onSetBpSystolic: vi.fn(),
    onSetBpDiastolic: vi.fn(),
    onSetGlucose: vi.fn(),
    onSetWeight: vi.fn(),
    onSetPhysicalActivity: vi.fn(),
    onSetSocialEngagement: vi.fn(),
    onSetSymptoms: vi.fn(),
    onSetActivityNotes: vi.fn(),
    onStartVoice: vi.fn(),
    onStopVoice: vi.fn(),
    onShowPulseOximeter: vi.fn(),
    onCheckIn: vi.fn(),
    ...overrides,
  };
}

describe('CheckInFormBody accessibility', () => {
  it('associates a programmatic label with every vitals control', () => {
    render(<CheckInFormBody {...buildProps()} />);

    // Each control is reachable by its accessible name — this is exactly what a
    // screen reader announces and what getByLabelText resolves via htmlFor/id or
    // aria-labelledby.
    expect(screen.getByLabelText(/Select your mood today/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Heart Rate/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Blood Oxygen/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Blood Sugar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Weight/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Physical Activity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Social Connection/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/symptoms/i)).toBeInTheDocument();

    // Blood-pressure inputs combine the group label with the per-field descriptor.
    expect(screen.getByLabelText(/Systolic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Diastolic/i)).toBeInTheDocument();
  });

  it('has no serious or critical WCAG 2.1 AA violations', async () => {
    const { container } = render(<CheckInFormBody {...buildProps()} />);
    await expectNoA11yViolations(container);
  });
});
