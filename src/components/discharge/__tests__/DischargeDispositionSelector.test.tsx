/**
 * Tests for DischargeDispositionSelector Component
 *
 * Purpose: Reusable selector for discharge disposition values
 * Tests: Dropdown variant, Cards variant, Radio variant, selection behavior, error display
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DischargeDispositionSelector,
  DISPOSITION_OPTIONS,
  getDispositionLabel,
  getDispositionDescription,
} from '../DischargeDispositionSelector';
import type { DischargeDisposition } from '../../../types/dischargePlanning';

describe('DischargeDispositionSelector', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dropdown Variant (default)', () => {
    it('should render dropdown variant by default', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Discharge Disposition')).toBeInTheDocument();
    });

    it('should show placeholder text when no value selected', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('combobox')).toHaveValue('');
    });

    it('should show selected value in dropdown', () => {
      render(
        <DischargeDispositionSelector
          value="home"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('combobox')).toHaveValue('home');
    });

    it('should call onChange when selection changes', async () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'skilled_nursing');

      expect(mockOnChange).toHaveBeenCalledWith('skilled_nursing');
    });

    it('should group options by category', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
        />
      );

      // Check for optgroup labels
      const homeGroup = document.querySelector('optgroup[label="Home Discharge"]');
      const facilityGroup = document.querySelector('optgroup[label="Facility Transfer"]');
      const otherGroup = document.querySelector('optgroup[label="Other"]');

      expect(homeGroup).toBeInTheDocument();
      expect(facilityGroup).toBeInTheDocument();
      expect(otherGroup).toBeInTheDocument();
    });

    it('should show required indicator when required prop is true', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          required
        />
      );

      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should show error message when error prop is provided', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          error="Please select a disposition"
        />
      );

      expect(screen.getByText('Please select a disposition')).toBeInTheDocument();
    });

    it('should apply error styling when error is present', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          error="Error message"
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('border-red-300');
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          disabled
        />
      );

      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('should show description when showDescriptions and value are set', () => {
      render(
        <DischargeDispositionSelector
          value="home"
          onChange={mockOnChange}
          showDescriptions
        />
      );

      expect(screen.getByText('Patient discharged to home without additional services')).toBeInTheDocument();
    });

    it('should not show description when value is null', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          showDescriptions
        />
      );

      expect(screen.queryByText(/Patient discharged/)).not.toBeInTheDocument();
    });
  });

  describe('Cards Variant', () => {
    it('should render cards variant with category sections', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="cards"
        />
      );

      expect(screen.getByText('Home Discharge')).toBeInTheDocument();
      expect(screen.getByText('Facility Transfer')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
    });

    it('should render all disposition options as buttons', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="cards"
        />
      );

      const buttons = screen.getAllByRole('button');
      // 9 disposition options
      expect(buttons.length).toBe(9);
    });

    it('should call onChange when a card is clicked', async () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="cards"
        />
      );

      await userEvent.click(screen.getByText('Home'));

      expect(mockOnChange).toHaveBeenCalledWith('home');
    });

    it('should highlight selected card', () => {
      render(
        <DischargeDispositionSelector
          value="skilled_nursing"
          onChange={mockOnChange}
          variant="cards"
        />
      );

      const selectedCard = screen.getByText('Skilled Nursing Facility').closest('button');
      expect(selectedCard).toHaveClass('border-blue-500');
      expect(selectedCard).toHaveClass('bg-blue-50');
    });

    it('should show descriptions when showDescriptions is true', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="cards"
          showDescriptions
        />
      );

      expect(screen.getByText('Patient discharged to home without additional services')).toBeInTheDocument();
    });

    it('should apply red styling for AMA and Expired options when selected', () => {
      const { rerender } = render(
        <DischargeDispositionSelector
          value="left_ama"
          onChange={mockOnChange}
          variant="cards"
        />
      );

      const amaCard = screen.getByText('Left Against Medical Advice').closest('button');
      expect(amaCard).toHaveClass('border-red-500');

      rerender(
        <DischargeDispositionSelector
          value="expired"
          onChange={mockOnChange}
          variant="cards"
        />
      );

      const expiredCard = screen.getByText('Expired').closest('button');
      expect(expiredCard).toHaveClass('border-red-500');
    });

    it('should disable all cards when disabled prop is true', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="cards"
          disabled
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it('should not call onChange when disabled', async () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="cards"
          disabled
        />
      );

      await userEvent.click(screen.getByText('Home'));

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should show error message in cards variant', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="cards"
          error="Selection required"
        />
      );

      expect(screen.getByText('Selection required')).toBeInTheDocument();
    });
  });

  describe('Radio Variant', () => {
    it('should render radio variant with all options', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="radio"
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios.length).toBe(9);
    });

    it('should have correct radio checked state', () => {
      render(
        <DischargeDispositionSelector
          value="hospice"
          onChange={mockOnChange}
          variant="radio"
        />
      );

      const hospiceRadio = screen.getByRole('radio', { name: /Hospice/i });
      expect(hospiceRadio).toBeChecked();
    });

    it('should call onChange when radio is selected', async () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="radio"
        />
      );

      const homeHealthRadio = screen.getByRole('radio', { name: /Home with Home Health/i });
      await userEvent.click(homeHealthRadio);

      expect(mockOnChange).toHaveBeenCalledWith('home_with_home_health');
    });

    it('should show descriptions when showDescriptions is true', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="radio"
          showDescriptions
        />
      );

      expect(screen.getByText('Patient discharged to home without additional services')).toBeInTheDocument();
      expect(screen.getByText('Transfer to SNF for continued skilled nursing care')).toBeInTheDocument();
    });

    it('should disable all radios when disabled prop is true', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="radio"
          disabled
        />
      );

      const radios = screen.getAllByRole('radio');
      radios.forEach((radio) => {
        expect(radio).toBeDisabled();
      });
    });

    it('should apply selected styling to checked option', () => {
      render(
        <DischargeDispositionSelector
          value="inpatient_rehab"
          onChange={mockOnChange}
          variant="radio"
        />
      );

      const selectedLabel = screen.getByRole('radio', { name: /Inpatient Rehabilitation/i })
        .closest('label');
      expect(selectedLabel).toHaveClass('border-blue-500');
      expect(selectedLabel).toHaveClass('bg-blue-50');
    });

    it('should show error message in radio variant', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="radio"
          error="Must select disposition"
        />
      );

      expect(screen.getByText('Must select disposition')).toBeInTheDocument();
    });
  });

  describe('DISPOSITION_OPTIONS Export', () => {
    it('should export all disposition options', () => {
      expect(DISPOSITION_OPTIONS).toHaveLength(9);
    });

    it('should include home category options', () => {
      const homeOptions = DISPOSITION_OPTIONS.filter((opt) => opt.category === 'home');
      expect(homeOptions).toHaveLength(2);
    });

    it('should include facility category options', () => {
      const facilityOptions = DISPOSITION_OPTIONS.filter((opt) => opt.category === 'facility');
      expect(facilityOptions).toHaveLength(4);
    });

    it('should include other category options', () => {
      const otherOptions = DISPOSITION_OPTIONS.filter((opt) => opt.category === 'other');
      expect(otherOptions).toHaveLength(3);
    });

    it('should have proper structure for each option', () => {
      DISPOSITION_OPTIONS.forEach((opt) => {
        expect(opt).toHaveProperty('value');
        expect(opt).toHaveProperty('label');
        expect(opt).toHaveProperty('description');
        expect(opt).toHaveProperty('icon');
        expect(opt).toHaveProperty('category');
      });
    });
  });

  describe('Utility Functions', () => {
    describe('getDispositionLabel', () => {
      it('should return correct label for valid disposition', () => {
        expect(getDispositionLabel('home')).toBe('Home');
        expect(getDispositionLabel('skilled_nursing')).toBe('Skilled Nursing Facility');
        expect(getDispositionLabel('left_ama')).toBe('Left Against Medical Advice');
      });

      it('should return value string for unknown disposition', () => {
        expect(getDispositionLabel('unknown_value' as DischargeDisposition)).toBe('unknown_value');
      });
    });

    describe('getDispositionDescription', () => {
      it('should return correct description for valid disposition', () => {
        expect(getDispositionDescription('home')).toBe('Patient discharged to home without additional services');
        expect(getDispositionDescription('hospice')).toBe('Transfer to hospice care for end-of-life comfort care');
      });

      it('should return empty string for unknown disposition', () => {
        expect(getDispositionDescription('unknown_value' as DischargeDisposition)).toBe('');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label in dropdown variant', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="dropdown"
        />
      );

      // Label exists and select is accessible via its visible label text
      expect(screen.getByText('Discharge Disposition')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should have proper radio group name', () => {
      render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          variant="radio"
        />
      );

      const radios = screen.getAllByRole('radio');
      radios.forEach((radio) => {
        expect(radio).toHaveAttribute('name', 'discharge-disposition');
      });
    });
  });

  describe('Custom className', () => {
    it('should apply custom className to container', () => {
      const { container } = render(
        <DischargeDispositionSelector
          value={null}
          onChange={mockOnChange}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
