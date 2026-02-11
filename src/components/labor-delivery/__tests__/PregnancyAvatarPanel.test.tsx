/**
 * PregnancyAvatarPanel Component Tests
 *
 * Tests GA display, risk-level border colors, quick-info rendering,
 * view toggle, compact mode behavior, and badge/risk factor display.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PregnancyAvatarPanel } from '../PregnancyAvatarPanel';
import type { LDPregnancy } from '../../../types/laborDelivery';

// Build a test pregnancy with EDD ~10 weeks from now (~30 weeks GA)
function makePregnancy(overrides: Partial<LDPregnancy> = {}): LDPregnancy {
  const edd = new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString(); // ~10 weeks out = ~30w GA
  return {
    id: 'preg-test',
    patient_id: 'p-test',
    tenant_id: 't-test',
    gravida: 3,
    para: 1,
    ab: 1,
    living: 1,
    edd,
    lmp: null,
    blood_type: 'A+',
    rh_factor: 'positive',
    gbs_status: 'negative',
    risk_level: 'moderate',
    risk_factors: ['Advanced maternal age', 'Previous preterm birth'],
    status: 'active',
    primary_provider_id: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('PregnancyAvatarPanel', () => {
  it('displays gestational age in weeks and days', () => {
    const pregnancy = makePregnancy();
    render(<PregnancyAvatarPanel pregnancy={pregnancy} />);

    // Should show "XXw Xd" format (exact number depends on test run date, so check pattern)
    const gaText = screen.getByText(/\d+w \d+d/);
    expect(gaText).toBeInTheDocument();
  });

  it('displays risk level badge', () => {
    const pregnancy = makePregnancy({ risk_level: 'high' });
    render(<PregnancyAvatarPanel pregnancy={pregnancy} />);
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('shows correct risk border color for each level', () => {
    const { container, rerender } = render(
      <PregnancyAvatarPanel pregnancy={makePregnancy({ risk_level: 'low' })} />
    );
    const panel = container.firstChild as HTMLElement;
    expect(panel.className).toContain('border-green-400');

    rerender(
      <PregnancyAvatarPanel pregnancy={makePregnancy({ risk_level: 'moderate' })} />
    );
    expect(panel.className).toContain('border-yellow-400');

    rerender(
      <PregnancyAvatarPanel pregnancy={makePregnancy({ risk_level: 'high' })} />
    );
    expect(panel.className).toContain('border-orange-400');

    rerender(
      <PregnancyAvatarPanel pregnancy={makePregnancy({ risk_level: 'critical' })} />
    );
    expect(panel.className).toContain('border-red-400');
  });

  it('displays G/P info from pregnancy data', () => {
    const pregnancy = makePregnancy({ gravida: 4, para: 2 });
    render(<PregnancyAvatarPanel pregnancy={pregnancy} />);
    expect(screen.getByText('G4P2')).toBeInTheDocument();
  });

  it('displays EDD as formatted date', () => {
    const pregnancy = makePregnancy();
    render(<PregnancyAvatarPanel pregnancy={pregnancy} />);
    // EDD should be displayed as a locale date string
    const eddDate = new Date(pregnancy.edd).toLocaleDateString();
    expect(screen.getByText(eddDate)).toBeInTheDocument();
  });

  it('displays blood type and Rh factor', () => {
    const pregnancy = makePregnancy({ blood_type: 'O-', rh_factor: 'negative' });
    render(<PregnancyAvatarPanel pregnancy={pregnancy} />);
    expect(screen.getByText('O- negative')).toBeInTheDocument();
  });

  it('displays GBS status and highlights positive', () => {
    const { rerender } = render(
      <PregnancyAvatarPanel pregnancy={makePregnancy({ gbs_status: 'negative' })} />
    );
    const negEl = screen.getByText('negative');
    expect(negEl).toBeInTheDocument();
    // Negative GBS should NOT have red text
    expect(negEl.className).not.toContain('text-red-600');

    rerender(
      <PregnancyAvatarPanel pregnancy={makePregnancy({ gbs_status: 'positive' })} />
    );
    const posEl = screen.getByText('positive');
    expect(posEl).toBeInTheDocument();
    expect(posEl.className).toContain('text-red-600');
  });

  it('toggles between front and back view', async () => {
    const user = userEvent.setup();
    render(<PregnancyAvatarPanel pregnancy={makePregnancy()} />);

    const frontBtn = screen.getByRole('button', { name: /front/i });
    const backBtn = screen.getByRole('button', { name: /back/i });

    // Initially front is selected (active color)
    expect(frontBtn.className).toContain('bg-pink-500');
    expect(backBtn.className).not.toContain('bg-pink-500');

    // Click back
    await user.click(backBtn);
    expect(backBtn.className).toContain('bg-pink-500');
    expect(frontBtn.className).not.toContain('bg-pink-500');
  });

  it('shows patient name when provided', () => {
    render(
      <PregnancyAvatarPanel
        pregnancy={makePregnancy()}
        patientName="Jane Smith"
      />
    );
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('shows risk factors in non-compact mode', () => {
    render(
      <PregnancyAvatarPanel pregnancy={makePregnancy()} />
    );
    expect(screen.getByText('Advanced maternal age')).toBeInTheDocument();
    expect(screen.getByText('Previous preterm birth')).toBeInTheDocument();
  });

  it('hides risk factors and OB badges in compact mode', () => {
    render(
      <PregnancyAvatarPanel pregnancy={makePregnancy()} compact />
    );
    // Risk factors should not be visible in compact
    expect(screen.queryByText('Risk Factors')).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced maternal age')).not.toBeInTheDocument();
  });

  it('shows OB Risk badge for non-low risk in non-compact mode', () => {
    render(
      <PregnancyAvatarPanel pregnancy={makePregnancy({ risk_level: 'high' })} />
    );
    expect(screen.getByText(/OB Risk: high/i)).toBeInTheDocument();
  });

  it('shows GBS+ badge when GBS is positive in non-compact mode', () => {
    render(
      <PregnancyAvatarPanel pregnancy={makePregnancy({ gbs_status: 'positive' })} />
    );
    expect(screen.getByText('GBS+')).toBeInTheDocument();
  });

  it('does not show OB Risk badge for low risk', () => {
    render(
      <PregnancyAvatarPanel pregnancy={makePregnancy({ risk_level: 'low' })} />
    );
    expect(screen.queryByText(/OB Risk/i)).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PregnancyAvatarPanel pregnancy={makePregnancy()} className="my-custom" />
    );
    expect((container.firstChild as HTMLElement).className).toContain('my-custom');
  });
});
