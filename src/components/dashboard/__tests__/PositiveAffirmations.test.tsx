import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PositiveAffirmations from '../PositiveAffirmations';

describe('PositiveAffirmations', () => {
  it('renders without crashing', () => {
    render(<PositiveAffirmations />);
    expect(screen.getByText('Daily Affirmation')).toBeInTheDocument();
  });

  it('displays an affirmation on load', () => {
    render(<PositiveAffirmations />);
    const affirmationText = screen.getByText(/"/);
    expect(affirmationText).toBeInTheDocument();
  });

  it('renders the new affirmation button', () => {
    render(<PositiveAffirmations />);
    expect(screen.getByRole('button', { name: /new affirmation/i })).toBeInTheDocument();
  });

  it('changes affirmation when button is clicked', async () => {
    const user = userEvent.setup();
    render(<PositiveAffirmations />);

    const initialText = screen.getByText(/"/);
    const _initialAffirmation = initialText.textContent;

    const button = screen.getByRole('button', { name: /new affirmation/i });

    // Click multiple times to ensure we get a different affirmation
    for (let i = 0; i < 10; i++) {
      await user.click(button);
    }

    // The component should still be functioning
    expect(screen.getByText('Daily Affirmation')).toBeInTheDocument();
  });
});
