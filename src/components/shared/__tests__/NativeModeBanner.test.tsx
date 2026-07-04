/**
 * NativeModeBanner Tests
 * Tier 1-2: banner appears only when the Claude circuit breaker is OPEN (AI degraded),
 * carries the Maria-approved positive-framing copy, and can be forced for manual/testing use.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NativeModeBanner, NATIVE_MODE_MESSAGE } from '../NativeModeBanner';

const mockGetServiceStatus = vi.fn();

vi.mock('../../../services/claudeService', () => ({
  claudeService: {
    getServiceStatus: () => mockGetServiceStatus(),
  },
}));

function setCircuitState(state: 'CLOSED' | 'OPEN' | 'HALF_OPEN') {
  mockGetServiceStatus.mockReturnValue({ circuitBreakerState: state });
}

describe('NativeModeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCircuitState('CLOSED');
  });

  it('renders nothing when the AI circuit breaker is CLOSED (AI healthy)', () => {
    setCircuitState('CLOSED');
    const { container } = render(<NativeModeBanner />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(NATIVE_MODE_MESSAGE)).not.toBeInTheDocument();
  });

  it('shows the native-mode notice when the circuit breaker is OPEN (AI degraded)', () => {
    setCircuitState('OPEN');
    render(<NativeModeBanner />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(NATIVE_MODE_MESSAGE);
  });

  it('uses positive framing and never says the AI is down', () => {
    setCircuitState('OPEN');
    render(<NativeModeBanner />);
    expect(screen.getByText(NATIVE_MODE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/AI is down/i)).not.toBeInTheDocument();
  });

  it('renders when forceVisible is set regardless of AI state', () => {
    setCircuitState('CLOSED');
    render(<NativeModeBanner forceVisible />);
    expect(screen.getByRole('status')).toHaveTextContent(NATIVE_MODE_MESSAGE);
  });
});
