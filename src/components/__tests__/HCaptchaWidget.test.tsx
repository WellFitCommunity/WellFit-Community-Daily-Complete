/**
 * HCaptchaWidget — reset() resilience
 *
 * Regression guard for the "full error screen on failed login retry" crash.
 * When the underlying hCaptcha library throws while being reset (it can throw
 * if reset twice in quick succession — exactly what happens on a second failed
 * login attempt), our reset() must swallow + log, never propagate. A thrown
 * error here escapes the login handler's catch block and crashes the whole app
 * into the root error boundary.
 */
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HCaptchaRef } from '../HCaptchaWidget';

// Mock the third-party hCaptcha library: its imperative handle's resetCaptcha
// throws, simulating the double-reset failure. (The real widget cannot render
// in jsdom — it requires a live sitekey and hCaptcha's remote script.)
vi.mock('@hcaptcha/react-hcaptcha', async () => {
  const react = await vi.importActual<typeof import('react')>('react');
  // React 19 ref-as-prop: read ref directly off props.
  return {
    default: (props: { ref?: React.Ref<unknown> }) => {
      react.useImperativeHandle(props.ref, () => ({
        resetCaptcha: () => {
          throw new Error('hCaptcha: reset called before render completed');
        },
        execute: () => undefined,
      }));
      return react.createElement('div', { 'data-testid': 'mock-hcaptcha' });
    },
  };
});

vi.mock('../../services/auditLogger', () => ({
  auditLogger: { warn: vi.fn() },
}));

async function renderWidget() {
  vi.stubEnv('VITE_HCAPTCHA_SITE_KEY', 'test-sitekey');
  vi.resetModules();
  const { default: HCaptchaWidget } = await import('../HCaptchaWidget');
  const ref = createRef<HCaptchaRef>();
  render(<HCaptchaWidget ref={ref} size="invisible" />);
  return ref;
}

describe('HCaptchaWidget.reset() resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not throw when the underlying hCaptcha reset throws', async () => {
    const ref = await renderWidget();
    expect(ref.current).not.toBeNull();
    // This is the crash that produced the "full error screen". It must be swallowed.
    expect(() => ref.current?.reset()).not.toThrow();
  });

  it('logs HCAPTCHA_RESET_FAILED when it swallows the reset error', async () => {
    const ref = await renderWidget();
    const { auditLogger } = await import('../../services/auditLogger');

    ref.current?.reset();

    expect(auditLogger.warn).toHaveBeenCalledWith(
      'HCAPTCHA_RESET_FAILED',
      expect.objectContaining({
        error: expect.stringContaining('reset called before render completed'),
      }),
    );
  });
});
