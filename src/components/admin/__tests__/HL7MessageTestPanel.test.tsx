/**
 * Tests for HL7MessageTestPanel
 *
 * Validates the HL7/X12 message lab UI: format toggle, template loading,
 * operation buttons, result display, and error handling.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HL7MessageTestPanel } from '../HL7MessageTestPanel';

// Mock the HL7/X12 hook
const mockParseHL7 = vi.fn();
const mockValidateHL7 = vi.fn();
const mockConvertHL7ToFHIR = vi.fn();
const mockParseX12 = vi.fn();
const mockValidateX12 = vi.fn();
const mockConvertX12ToFHIR = vi.fn();
const mockGetMessageTypes = vi.fn();
const mockReset = vi.fn();

vi.mock('../../../hooks/useHL7X12', () => ({
  useHL7X12: () => ({
    result: mockResult,
    operation: mockOperation,
    loading: false,
    error: mockError,
    parseHL7: mockParseHL7,
    validateHL7: mockValidateHL7,
    convertHL7ToFHIR: mockConvertHL7ToFHIR,
    generateACK: vi.fn(),
    generate837P: vi.fn(),
    parseX12: mockParseX12,
    validateX12: mockValidateX12,
    convertX12ToFHIR: mockConvertX12ToFHIR,
    getMessageTypes: mockGetMessageTypes,
    reset: mockReset,
  }),
}));

// Mock HL7 templates
vi.mock('../../../services/mcp/mcpHL7X12Client', () => ({
  HL7_TEMPLATES: {
    ADT_A01: vi.fn(() => 'MSH|^~\\&|ENVISION_ATLUS|WELLFIT_HOSPITAL||...ADT^A01'),
    ADT_A03: vi.fn(() => 'MSH|^~\\&|ENVISION_ATLUS|WELLFIT_HOSPITAL||...ADT^A03'),
    ORU_R01: vi.fn(() => 'MSH|^~\\&|ENVISION_ATLUS|WELLFIT_LAB||...ORU^R01'),
  },
}));

let mockResult: unknown = null;
let mockOperation: string | null = null;
let mockError: string | null = null;

describe('HL7MessageTestPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResult = null;
    mockOperation = null;
    mockError = null;
  });

  it('renders the header with title and description', () => {
    render(<HL7MessageTestPanel />);

    expect(screen.getByText('HL7 / X12 Message Lab')).toBeInTheDocument();
    expect(screen.getByText(/Parse, validate, and convert/)).toBeInTheDocument();
  });

  it('shows HL7 v2.x format selected by default', () => {
    render(<HL7MessageTestPanel />);

    const hl7Button = screen.getByText('HL7 v2.x');
    expect(hl7Button.className).toContain('bg-[#00857a]');
  });

  it('shows HL7 operation buttons: Parse, Validate, Convert', () => {
    render(<HL7MessageTestPanel />);

    expect(screen.getByText('Parse HL7')).toBeInTheDocument();
    expect(screen.getByText('Validate')).toBeInTheDocument();
    expect(screen.getByText('Convert to FHIR')).toBeInTheDocument();
  });

  it('shows X12 operation buttons when X12 format is selected', async () => {
    render(<HL7MessageTestPanel />);

    const x12Tab = screen.getByText('X12 837P');
    await userEvent.click(x12Tab);

    expect(screen.getByText('Parse X12')).toBeInTheDocument();
    expect(screen.getByText('Validate')).toBeInTheDocument();
    expect(screen.getByText('Convert to FHIR')).toBeInTheDocument();
  });

  it('shows HL7 template buttons for ADT A01, ADT A03, ORU R01', () => {
    render(<HL7MessageTestPanel />);

    expect(screen.getByText('ADT A01')).toBeInTheDocument();
    expect(screen.getByText('ADT A03')).toBeInTheDocument();
    expect(screen.getByText('ORU R01')).toBeInTheDocument();
  });

  it('loads ADT A01 template into textarea when clicked', async () => {
    render(<HL7MessageTestPanel />);

    const templateButton = screen.getByText('ADT A01');
    await userEvent.click(templateButton);

    const textarea = screen.getByPlaceholderText(/Paste HL7/) as HTMLTextAreaElement;
    expect(textarea.value).toContain('ADT^A01');
  });

  it('disables action buttons when textarea is empty', () => {
    render(<HL7MessageTestPanel />);

    const parseButton = screen.getByText('Parse HL7');
    expect(parseButton).toBeDisabled();
  });

  it('enables action buttons when textarea has content', async () => {
    render(<HL7MessageTestPanel />);

    const textarea = screen.getByPlaceholderText(/Paste HL7/);
    await userEvent.type(textarea, 'MSH|^~\\&|TEST');

    const parseButton = screen.getByText('Parse HL7');
    expect(parseButton).not.toBeDisabled();
  });

  it('calls parseHL7 when Parse HL7 button is clicked', async () => {
    render(<HL7MessageTestPanel />);

    const textarea = screen.getByPlaceholderText(/Paste HL7/);
    await userEvent.type(textarea, 'MSH|^~\\&|TEST');

    const parseButton = screen.getByText('Parse HL7');
    await userEvent.click(parseButton);

    expect(mockParseHL7).toHaveBeenCalledWith('MSH|^~\\&|TEST');
  });

  it('calls validateX12 when X12 Validate button is clicked', async () => {
    render(<HL7MessageTestPanel />);

    // Switch to X12 mode
    await userEvent.click(screen.getByText('X12 837P'));

    const textarea = screen.getByPlaceholderText(/Paste X12/);
    await userEvent.type(textarea, 'ISA*00*...');

    const validateButton = screen.getByText('Validate');
    await userEvent.click(validateButton);

    expect(mockValidateX12).toHaveBeenCalledWith('ISA*00*...');
  });

  it('clears textarea and resets state when Clear is clicked', async () => {
    render(<HL7MessageTestPanel />);

    const textarea = screen.getByPlaceholderText(/Paste HL7/);
    await userEvent.type(textarea, 'MSH|^~\\&|TEST');

    const clearButton = screen.getByText('Clear');
    await userEvent.click(clearButton);

    expect(textarea).toHaveValue('');
    expect(mockReset).toHaveBeenCalled();
  });

  it('calls reset when switching between HL7 and X12 formats', async () => {
    render(<HL7MessageTestPanel />);

    await userEvent.click(screen.getByText('X12 837P'));
    expect(mockReset).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByText('HL7 v2.x'));
    expect(mockReset).toHaveBeenCalledTimes(2);
  });

  it('has a View Message Types button', () => {
    render(<HL7MessageTestPanel />);

    expect(screen.getByText('View Message Types')).toBeInTheDocument();
  });
});
