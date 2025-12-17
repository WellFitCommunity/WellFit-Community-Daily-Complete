import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFHIRMapping } from '../useFHIRMapping';
import { fhirMappingService } from '../../services/fhirMappingService';

// Mock the service
vi.mock('../../services/fhirMappingService');

describe('useFHIRMapping', () => {
  const mockService = vi.mocked(fhirMappingService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useFHIRMapping());
    const [state] = result.current;

    expect(state).toEqual({
      sourceData: '',
      sourceType: 'JSON',
      generatedMapping: null,
      isAnalyzing: false,
      errors: [],
      warnings: [],
      fileValidation: null,
    });
  });

  it('should update source data', () => {
    const { result } = renderHook(() => useFHIRMapping());
    const [, actions] = result.current;

    act(() => {
      actions.setSourceData('test data');
    });

    const [state] = result.current;
    expect(state.sourceData).toBe('test data');
    expect(state.errors).toHaveLength(0);
    expect(state.warnings).toHaveLength(0);
  });

  it('should update source type', () => {
    const { result } = renderHook(() => useFHIRMapping());
    const [, actions] = result.current;

    act(() => {
      actions.setSourceType('CSV');
    });

    const [state] = result.current;
    expect(state.sourceType).toBe('CSV');
  });

  it('should validate file successfully', () => {
    const mockFile = new File(['test content'], 'test.json', { type: 'application/json' });
    const mockValidation = {
      isValid: true,
      errors: [],
      size: 1024,
      type: '.json'
    };

    mockService.validateFile.mockReturnValue(mockValidation);

    const { result } = renderHook(() => useFHIRMapping());
    const [, actions] = result.current;

    let validationResult;
    act(() => {
      validationResult = actions.validateFile(mockFile);
    });

    expect(validationResult).toEqual(mockValidation);
    expect(mockService.validateFile).toHaveBeenCalledWith(mockFile);

    const [state] = result.current;
    expect(state.fileValidation).toEqual(mockValidation);
  });

  it('should handle file validation errors', () => {
    const mockFile = new File(['test content'], 'test.exe', { type: 'application/octet-stream' });
    const mockValidation = {
      isValid: false,
      errors: ['Invalid file type'],
      size: 1024,
      type: '.exe'
    };

    mockService.validateFile.mockReturnValue(mockValidation);

    const { result } = renderHook(() => useFHIRMapping());
    const [, actions] = result.current;

    act(() => {
      actions.validateFile(mockFile);
    });

    const [state] = result.current;
    expect(state.fileValidation).toEqual(mockValidation);
    expect(state.errors).toEqual(['Invalid file type']);
  });

  it('should load from file successfully', async () => {
    const mockFile = new File(['{"test": "data"}'], 'test.json', { type: 'application/json' });
    const mockValidation = {
      isValid: true,
      errors: [],
      size: 1024,
      type: '.json'
    };

    mockService.validateFile.mockReturnValue(mockValidation);
    mockService.detectSourceType.mockReturnValue('JSON');

    const mockResult = '{"test": "data"}';

    // Mock FileReader using class syntax
    class MockFileReader {
      result: string | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

      readAsText() {
        this.result = mockResult;
        // Trigger onload synchronously
        if (this.onload) {
          this.onload({ target: { result: mockResult } } as unknown as ProgressEvent<FileReader>);
        }
      }
    }

    const originalFileReader = global.FileReader;
    global.FileReader = MockFileReader as unknown as typeof FileReader;

    const { result } = renderHook(() => useFHIRMapping());
    const [, actions] = result.current;

    await act(async () => {
      await actions.loadFromFile(mockFile);
    });

    // Restore original FileReader
    global.FileReader = originalFileReader;

    const [state] = result.current;
    expect(state.sourceData).toBe('{"test": "data"}');
    expect(state.sourceType).toBe('JSON');
    expect(mockService.detectSourceType).toHaveBeenCalledWith('test.json', '{"test": "data"}');
  });

  it('should handle file loading errors', async () => {
    const mockFile = new File(['test content'], 'test.exe', { type: 'application/octet-stream' });
    const mockValidation = {
      isValid: false,
      errors: ['Invalid file type'],
      size: 1024,
      type: '.exe'
    };

    mockService.validateFile.mockReturnValue(mockValidation);

    const { result } = renderHook(() => useFHIRMapping());
    const [, actions] = result.current;

    await act(async () => {
      await actions.loadFromFile(mockFile);
    });

    const [state] = result.current;
    expect(state.errors).toContain('File validation failed: Invalid file type');
  });

  it('should generate mapping successfully', async () => {
    const mockMapping = {
      id: 'test-mapping',
      sourceName: 'Test Data',
      sourceType: 'JSON' as const,
      fhirVersion: 'R4' as const,
      mappingRules: [
        {
          sourceField: 'patient.name',
          sourceType: 'string',
          fhirResource: 'Patient',
          fhirPath: 'Patient.name.given',
          confidence: 95
        }
      ],
      validationResults: {
        totalFields: 1,
        mappedFields: 1,
        unmappedFields: [],
        errors: [],
        confidence: 95
      }
    };

    mockService.generateMapping.mockResolvedValue(mockMapping);

    const { result } = renderHook(() => useFHIRMapping());

    // Set up initial data
    act(() => {
      result.current[1].setSourceData('{"patient": {"name": "John"}}');
      result.current[1].setSourceType('JSON');
    });

    await act(async () => {
      await result.current[1].generateMapping();
    });

    const [state] = result.current;
    expect(state.generatedMapping).toEqual(mockMapping);
    expect(state.isAnalyzing).toBe(false);
    expect(mockService.generateMapping).toHaveBeenCalledWith('{"patient": {"name": "John"}}', 'JSON');
  });

  it('should handle mapping generation errors', async () => {
    mockService.generateMapping.mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => useFHIRMapping());

    act(() => {
      result.current[1].setSourceData('{"test": "data"}');
    });

    await act(async () => {
      await result.current[1].generateMapping();
    });

    const [state] = result.current;
    expect(state.isAnalyzing).toBe(false);
    expect(state.errors).toContain('API error');
  });

  it('should add warnings for low confidence mappings', async () => {
    const mockMapping = {
      id: 'test-mapping',
      sourceName: 'Test Data',
      sourceType: 'JSON' as const,
      fhirVersion: 'R4' as const,
      mappingRules: [
        {
          sourceField: 'patient.name',
          sourceType: 'string',
          fhirResource: 'Patient',
          fhirPath: 'Patient.name.given',
          confidence: 50 // Low confidence
        }
      ],
      validationResults: {
        totalFields: 1,
        mappedFields: 1,
        unmappedFields: [],
        errors: [],
        confidence: 50
      }
    };

    mockService.generateMapping.mockResolvedValue(mockMapping);

    const { result } = renderHook(() => useFHIRMapping());

    act(() => {
      result.current[1].setSourceData('{"patient": {"name": "John"}}');
    });

    await act(async () => {
      await result.current[1].generateMapping();
    });

    const [state] = result.current;
    expect(state.warnings).toContain('1 mapping rules have low confidence scores. Please review these carefully.');
  });

  it('should add warnings for unmapped fields', async () => {
    const mockMapping = {
      id: 'test-mapping',
      sourceName: 'Test Data',
      sourceType: 'JSON' as const,
      fhirVersion: 'R4' as const,
      mappingRules: [],
      validationResults: {
        totalFields: 2,
        mappedFields: 1,
        unmappedFields: ['patient.age'],
        errors: [],
        confidence: 50
      }
    };

    mockService.generateMapping.mockResolvedValue(mockMapping);

    const { result } = renderHook(() => useFHIRMapping());

    act(() => {
      result.current[1].setSourceData('{"patient": {"name": "John", "age": 30}}');
    });

    await act(async () => {
      await result.current[1].generateMapping();
    });

    const [state] = result.current;
    expect(state.warnings).toContain('1 fields could not be mapped to FHIR resources.');
  });

  it('should download mapping', async () => {
    const mockMapping = {
      id: 'test-mapping',
      sourceName: 'Test Data',
      sourceType: 'JSON' as const,
      fhirVersion: 'R4' as const,
      mappingRules: [],
      validationResults: {
        totalFields: 0,
        mappedFields: 0,
        unmappedFields: [],
        errors: [],
        confidence: 0
      }
    };

    mockService.generateMapping.mockResolvedValue(mockMapping);

    const { result } = renderHook(() => useFHIRMapping());

    // Set up mapping by actually generating it
    act(() => {
      result.current[1].setSourceData('{"test": "data"}');
      result.current[1].setSourceType('JSON');
    });

    await act(async () => {
      await result.current[1].generateMapping();
    });

    act(() => {
      result.current[1].downloadMapping();
    });

    expect(mockService.downloadMapping).toHaveBeenCalledWith(mockMapping);
  });

  it('should handle download error when no mapping exists', () => {
    const { result } = renderHook(() => useFHIRMapping());
    const [, actions] = result.current;

    act(() => {
      actions.downloadMapping();
    });

    const [state] = result.current;
    expect(state.errors).toContain('No mapping available to download');
  });

  it('should clear errors', () => {
    const { result } = renderHook(() => useFHIRMapping());
    const [, actions] = result.current;

    // Add an error first
    act(() => {
      actions.setSourceData('');
    });

    act(() => {
      actions.generateMapping();
    });

    act(() => {
      actions.clearErrors();
    });

    const [state] = result.current;
    expect(state.errors).toHaveLength(0);
  });

  it('should clear warnings', async () => {
    // Create a mapping with low confidence to trigger warnings
    const mockMapping = {
      id: 'test-mapping',
      sourceName: 'Test Data',
      sourceType: 'JSON' as const,
      fhirVersion: 'R4' as const,
      mappingRules: [
        {
          sourceField: 'patient.name',
          sourceType: 'string',
          fhirResource: 'Patient',
          fhirPath: 'Patient.name.given',
          confidence: 50 // Low confidence to trigger warning
        }
      ],
      validationResults: {
        totalFields: 1,
        mappedFields: 1,
        unmappedFields: [],
        errors: [],
        confidence: 50
      }
    };

    mockService.generateMapping.mockResolvedValue(mockMapping);

    const { result } = renderHook(() => useFHIRMapping());

    // Generate mapping to add warnings
    act(() => {
      result.current[1].setSourceData('{"patient": {"name": "John"}}');
    });

    await act(async () => {
      await result.current[1].generateMapping();
    });

    // Verify warnings were added
    expect(result.current[0].warnings.length).toBeGreaterThan(0);

    act(() => {
      result.current[1].clearWarnings();
    });

    const [state] = result.current;
    expect(state.warnings).toHaveLength(0);
  });

  it('should reset to initial state', async () => {
    const mockMapping = {
      id: 'test-mapping',
      sourceName: 'Test Data',
      sourceType: 'CSV' as const,
      fhirVersion: 'R4' as const,
      mappingRules: [],
      validationResults: {
        totalFields: 0,
        mappedFields: 0,
        unmappedFields: [],
        errors: [],
        confidence: 0
      }
    };

    mockService.generateMapping.mockResolvedValue(mockMapping);

    const { result } = renderHook(() => useFHIRMapping());

    // Modify state significantly
    act(() => {
      result.current[1].setSourceData('test data');
      result.current[1].setSourceType('CSV');
    });

    await act(async () => {
      await result.current[1].generateMapping();
    });

    // Verify state was modified
    expect(result.current[0].generatedMapping).not.toBeNull();

    // Reset
    act(() => {
      result.current[1].reset();
    });

    const [state] = result.current;
    expect(state).toEqual({
      sourceData: '',
      sourceType: 'JSON',
      generatedMapping: null,
      isAnalyzing: false,
      errors: [],
      warnings: [],
      fileValidation: null,
    });
  });
});