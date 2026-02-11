/**
 * PregnancyAvatarBody Component Tests
 *
 * Tests trimester-specific SVG rendering, skin tone application,
 * view toggling, fundal height reference line, and marker compatibility.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PregnancyAvatarBody } from '../PregnancyAvatarBody';

describe('PregnancyAvatarBody', () => {
  it('renders SVG with correct aria-label for each trimester', () => {
    const { rerender } = render(
      <PregnancyAvatarBody skinTone="medium" trimester={1} view="front" />
    );
    expect(screen.getByRole('img', { name: /trimester 1.*front/i })).toBeInTheDocument();

    rerender(
      <PregnancyAvatarBody skinTone="medium" trimester={2} view="front" />
    );
    expect(screen.getByRole('img', { name: /trimester 2.*front/i })).toBeInTheDocument();

    rerender(
      <PregnancyAvatarBody skinTone="medium" trimester={3} view="front" />
    );
    expect(screen.getByRole('img', { name: /trimester 3.*front/i })).toBeInTheDocument();
  });

  it('renders different body paths per trimester (SVG path d attributes differ)', () => {
    const { rerender, container } = render(
      <PregnancyAvatarBody skinTone="medium" trimester={1} view="front" />
    );
    const pathT1 = container.querySelector('path')?.getAttribute('d') ?? '';

    rerender(
      <PregnancyAvatarBody skinTone="medium" trimester={2} view="front" />
    );
    const pathT2 = container.querySelector('path')?.getAttribute('d') ?? '';

    rerender(
      <PregnancyAvatarBody skinTone="medium" trimester={3} view="front" />
    );
    const pathT3 = container.querySelector('path')?.getAttribute('d') ?? '';

    // Each trimester should have a distinct body shape
    expect(pathT1).not.toBe(pathT2);
    expect(pathT2).not.toBe(pathT3);
    expect(pathT1).not.toBe(pathT3);
  });

  it('renders front and back views with correct label', () => {
    const { rerender } = render(
      <PregnancyAvatarBody skinTone="medium" trimester={2} view="front" />
    );
    expect(screen.getByText(/FRONT \| T2/)).toBeInTheDocument();

    rerender(
      <PregnancyAvatarBody skinTone="medium" trimester={2} view="back" />
    );
    expect(screen.getByText(/BACK \| T2/)).toBeInTheDocument();
  });

  it('applies skin tone fill color to body path', () => {
    const { container, rerender } = render(
      <PregnancyAvatarBody skinTone="light" trimester={2} view="front" />
    );
    const lightFill = container.querySelector('path')?.getAttribute('fill');

    rerender(
      <PregnancyAvatarBody skinTone="dark" trimester={2} view="front" />
    );
    const darkFill = container.querySelector('path')?.getAttribute('fill');

    expect(lightFill).toBeDefined();
    expect(darkFill).toBeDefined();
    expect(lightFill).not.toBe(darkFill);
  });

  it('shows fundal height reference line for T2 and T3 front view only', () => {
    const { container, rerender } = render(
      <PregnancyAvatarBody skinTone="medium" trimester={1} view="front" />
    );
    // T1 front: no fundal line
    expect(container.querySelector('line')).not.toBeInTheDocument();

    // T2 front: fundal line present
    rerender(
      <PregnancyAvatarBody skinTone="medium" trimester={2} view="front" />
    );
    const lineT2 = container.querySelector('line');
    expect(lineT2).toBeInTheDocument();
    expect(lineT2?.getAttribute('stroke')).toBe('#ec4899');
    // Capture T2 Y before rerender invalidates the DOM reference
    const t2Y = Number(lineT2?.getAttribute('y1'));

    // T3 front: fundal line present at different height
    rerender(
      <PregnancyAvatarBody skinTone="medium" trimester={3} view="front" />
    );
    const lineT3 = container.querySelector('line');
    expect(lineT3).toBeInTheDocument();
    // T3 fundal line should be higher (lower y value) than T2
    const t3Y = Number(lineT3?.getAttribute('y1'));
    expect(t3Y).toBeLessThan(t2Y);

    // T3 back view: no fundal line
    rerender(
      <PregnancyAvatarBody skinTone="medium" trimester={3} view="back" />
    );
    expect(container.querySelector('line')).not.toBeInTheDocument();
  });

  it('renders children (markers) inside SVG', () => {
    render(
      <PregnancyAvatarBody skinTone="medium" trimester={2} view="front">
        <circle data-testid="test-marker" cx="50" cy="50" r="3" />
      </PregnancyAvatarBody>
    );
    expect(screen.getByTestId('test-marker')).toBeInTheDocument();
  });

  it('calls onClick when SVG is clicked', () => {
    const handleClick = vi.fn();
    render(
      <PregnancyAvatarBody
        skinTone="medium"
        trimester={2}
        view="front"
        onClick={handleClick}
      />
    );

    const svg = screen.getByRole('img');
    fireEvent.click(svg);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders thumbnail size with correct CSS classes', () => {
    const { container } = render(
      <PregnancyAvatarBody skinTone="medium" trimester={2} view="front" size="thumbnail" />
    );
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('w-[100px]')).toBe(true);
    expect(svg?.classList.contains('h-[160px]')).toBe(true);
  });

  it('renders different back paths for T3 versus T1-T2 (lumbar lordosis)', () => {
    const { container, rerender } = render(
      <PregnancyAvatarBody skinTone="medium" trimester={1} view="back" />
    );
    const pathT1Back = container.querySelector('path')?.getAttribute('d') ?? '';

    rerender(
      <PregnancyAvatarBody skinTone="medium" trimester={3} view="back" />
    );
    const pathT3Back = container.querySelector('path')?.getAttribute('d') ?? '';

    // T3 back should differ from T1 back (lordosis)
    expect(pathT1Back).not.toBe(pathT3Back);
  });
});
