/**
 * PriorAuthStatCards tests — null-metric rendering (fabricated-value class guard).
 *
 * With zero prior-auth data the stats RPC returns NULL rates; the cards must
 * render an em dash — never a fabricated 0% / 100% and never crash on
 * null.toFixed (the 2026-07-22 production crash Maria hit).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriorAuthStatCards } from '../PriorAuthStatCards';
import type { PriorAuthStatistics } from '../../../../services/fhir/prior-auth';

const baseStats: PriorAuthStatistics = {
  total_submitted: 12,
  total_approved: 9,
  total_denied: 2,
  total_pending: 1,
  approval_rate: 75,
  avg_response_hours: 18.5,
  sla_compliance_rate: 91.7,
  by_urgency: {},
};

describe('PriorAuthStatCards', () => {
  it('renders real metric values with units', () => {
    render(<PriorAuthStatCards stats={baseStats} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('18.5')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('renders em dashes for null rates instead of crashing or fabricating 0%/100%', () => {
    render(
      <PriorAuthStatCards
        stats={{
          ...baseStats,
          total_submitted: 0,
          total_approved: 0,
          total_denied: 0,
          total_pending: 0,
          approval_rate: null,
          avg_response_hours: null,
          sla_compliance_rate: null,
        }}
      />
    );
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
  });
});
