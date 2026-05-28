/**
 * Tests for BasicDemographicsStep — focused on ONC 170.315(a)(5) race & ethnicity
 * capture. Behavior-first; would FAIL if the form rendered an empty <div />.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { BasicDemographicsStep } from '../BasicDemographicsStep';
import { INITIAL_FORM_DATA, type DemographicsData } from '../../types';

function renderStep(overrides: Partial<DemographicsData> = {}) {
  const onInputChange = vi.fn();
  const formData: DemographicsData = { ...INITIAL_FORM_DATA, ...overrides };
  render(<BasicDemographicsStep formData={formData} onInputChange={onInputChange} />);
  return { onInputChange };
}

describe('BasicDemographicsStep — ONC (a)(5) race & ethnicity capture', () => {
  describe('race (OMB multi-select)', () => {
    it('renders all 5 OMB minimum race categories as checkboxes', () => {
      renderStep();
      const race = screen.getByRole('group', { name: /what is your race/i });
      expect(within(race).getByLabelText(/American Indian or Alaska Native/i)).toBeInTheDocument();
      expect(within(race).getByLabelText(/^Asian$/i)).toBeInTheDocument();
      expect(within(race).getByLabelText(/Black or African American/i)).toBeInTheDocument();
      expect(within(race).getByLabelText(/Native Hawaiian or Other Pacific Islander/i)).toBeInTheDocument();
      expect(within(race).getByLabelText(/^White$/i)).toBeInTheDocument();
    });

    it('calls onInputChange with array containing the toggled OMB code when checking a race', () => {
      const { onInputChange } = renderStep();
      fireEvent.click(screen.getByLabelText(/^Asian$/i));
      expect(onInputChange).toHaveBeenCalledWith('race_omb', ['asian']);
    });

    it('supports multi-race selection — toggling a second race appends to the array', () => {
      const { onInputChange } = renderStep({ race_omb: ['asian'] });
      fireEvent.click(screen.getByLabelText(/^White$/i));
      expect(onInputChange).toHaveBeenCalledWith('race_omb', ['asian', 'white']);
    });

    it('unchecks a selected race when clicked again', () => {
      const { onInputChange } = renderStep({ race_omb: ['asian', 'white'] });
      fireEvent.click(screen.getByLabelText(/^Asian$/i));
      expect(onInputChange).toHaveBeenCalledWith('race_omb', ['white']);
    });

    it('"Prefer not to say" sets the OMB asked-declined nullFlavor', () => {
      const { onInputChange } = renderStep();
      fireEvent.click(screen.getByLabelText(/prefer not to say/i));
      expect(onInputChange).toHaveBeenCalledWith('race_omb', ['asked-declined']);
    });

    it('checking "Prefer not to say" while races are selected REPLACES the selection', () => {
      const { onInputChange } = renderStep({ race_omb: ['asian', 'white'] });
      fireEvent.click(screen.getByLabelText(/prefer not to say/i));
      expect(onInputChange).toHaveBeenCalledWith('race_omb', ['asked-declined']);
    });

    it('race checkboxes are DISABLED when "Prefer not to say" is selected', () => {
      renderStep({ race_omb: ['asked-declined'] });
      expect(screen.getByLabelText(/^Asian$/i)).toBeDisabled();
      expect(screen.getByLabelText(/^White$/i)).toBeDisabled();
    });

    it('does not render legacy non-OMB labels that used to confuse users', () => {
      // Historical bug: form labeled this field "ethnicity" and offered "Mixed
      // race" / "Native American" / "Hispanic" as race options, which produced
      // garbage data in production.
      renderStep();
      expect(screen.queryByText(/^Mixed race$/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Native American$/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Pacific Islander$/i)).not.toBeInTheDocument();
    });
  });

  describe('ethnicity (OMB single-select)', () => {
    it('renders an ethnicity dropdown with the OMB 1997 categories', () => {
      renderStep();
      const ethnicity = screen.getByLabelText(/are you hispanic or latino/i);
      expect(ethnicity).toBeInTheDocument();
      expect(within(ethnicity as HTMLSelectElement).getByRole('option', { name: 'Hispanic or Latino' })).toBeInTheDocument();
      expect(within(ethnicity as HTMLSelectElement).getByRole('option', { name: 'Not Hispanic or Latino' })).toBeInTheDocument();
    });

    it('asks ethnicity separately from race (CR-2 historical bug guard)', () => {
      renderStep();
      // The race fieldset must NOT contain the Hispanic/Latino option, and the
      // ethnicity field MUST NOT contain race categories. This is the
      // structural defense against the original "ethnicity = black" data bug.
      const raceGroup = screen.getByRole('group', { name: /what is your race/i });
      expect(within(raceGroup).queryByText(/hispanic/i)).not.toBeInTheDocument();
      const ethnicitySelect = screen.getByLabelText(/are you hispanic or latino/i) as HTMLSelectElement;
      expect(within(ethnicitySelect).queryByRole('option', { name: /^Asian$/i })).not.toBeInTheDocument();
      expect(within(ethnicitySelect).queryByRole('option', { name: /Black or African American/i })).not.toBeInTheDocument();
    });

    it('calls onInputChange with the OMB code when an ethnicity is selected', () => {
      const { onInputChange } = renderStep();
      fireEvent.change(screen.getByLabelText(/are you hispanic or latino/i), {
        target: { value: 'not-hispanic-or-latino' },
      });
      expect(onInputChange).toHaveBeenCalledWith('ethnicity_omb', 'not-hispanic-or-latino');
    });

    it('reflects the current ethnicity_omb value', () => {
      renderStep({ ethnicity_omb: 'hispanic-or-latino' });
      const select = screen.getByLabelText(/are you hispanic or latino/i) as HTMLSelectElement;
      expect(select.value).toBe('hispanic-or-latino');
    });
  });
});
