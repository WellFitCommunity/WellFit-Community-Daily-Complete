// src/components/ui/__tests__/SkipLink.a11y.test.tsx
// Behavioral + axe-core accessibility test for the skip-navigation link (WCAG 2.4.1).
// SkipLink is wired into RootLayout as the first focusable element; this guards that
// it renders a real, named, in-page anchor and is itself free of WCAG violations.

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { SkipLink } from '../SkipLink';
import { expectNoA11yViolations } from '../../../test-utils/axeHelper';

describe('SkipLink', () => {
  it('renders a named in-page link to the skip target', () => {
    render(<SkipLink href="#main-content">Skip to main content</SkipLink>);

    // Accessible by its name — a screen-reader user can find and activate it.
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('starts visually hidden but is keyboard-focusable (reveals on focus)', () => {
    render(<SkipLink href="#main-content">Skip to main content</SkipLink>);

    const link = screen.getByRole('link', { name: 'Skip to main content' });
    // sr-only hides it visually; focus styles (focus:not-sr-only) reveal it.
    expect(link.className).toContain('sr-only');
    expect(link.className).toContain('focus:not-sr-only');

    // Anchors with href are in the tab order — keyboard users reach it first.
    link.focus();
    expect(link).toHaveFocus();
  });

  it('has no serious or critical WCAG 2.1 AA violations', async () => {
    const { container } = render(
      <SkipLink href="#main-content">Skip to main content</SkipLink>,
    );
    await expectNoA11yViolations(container);
  });
});
