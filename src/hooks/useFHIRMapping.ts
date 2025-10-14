import { useState, useCallback } from 'react';
import { fhirMappingService, DataMapping, FileValidationResult } from '../services/fhirMappingService';

export interface FHIRMappingState {
  sourceData: string;
  sourceType: 'HL7v2' | 'CSV' | 'JSON' | 'XML' | 'Custom';
  generatedMapping: DataMapping | null;
  isAnalyzing: boolean;
  errors: string[];
  warnings: string[];
  fileValidation: FileValidationResult | null;
}

export interface FHIRMappingActions {
  setSourceData: (data: string) => void;
  setSourceType: (type: 'HL7v2' | 'CSV' | 'JSON' | 'XML' | 'Custom') => void;
  validateFile: (file: File) => FileValidationResult;
  loadFromFile: (file: File) => Promise<void>;
  generateMapping: () => Promise<void>;
  downloadMapping: () => void;
  clearErrors: () => void;
  clearWarnings: () => void;
  reset: () => void;
}

const initialState: FHIRMappingState = {
  sourceData: '',
  sourceType: 'JSON',
  generatedMapping: null,
  isAnalyzing: false,
  errors: [],
  warnings: [],
  fileValidation: null,
};

export const useFHIRMapping = (): [FHIRMappingState, FHIRMappingActions] => {
  const [state, setState] = useState<FHIRMappingState>(initialState);

  const updateState = useCallback((updates: Partial<FHIRMappingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const addError = useCallback((error: string) => {
    setState(prev => ({ ...prev, errors: [...prev.errors, error] }));
  }, []);

  const setSourceData = useCallback((data: string) => {
    updateState({ sourceData: data, errors: [], warnings: [] });
  }, [updateState]);

  const setSourceType = useCallback((type: 'HL7v2' | 'CSV' | 'JSON' | 'XML' | 'Custom') => {
    updateState({ sourceType: type });
  }, [updateState]);

  const validateFile = useCallback((file: File): FileValidationResult => {
    const validation = fhirMappingService.validateFile(file);
    updateState({ fileValidation: validation });

    if (!validation.isValid) {
      updateState({ errors: validation.errors });
    }

    return validation;
  }, [updateState]);

  const loadFromFile = useCallback(async (file: File): Promise<void> => {
    try {
      const validation = validateFile(file);
      if (!validation.isValid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });

      const detectedType = fhirMappingService.detectSourceType(file.name, content);

      updateState({
        sourceData: content,
        sourceType: detectedType,
        errors: [],
        warnings: detectedType === 'Custom' ? ['File type could not be auto-detected. Please verify the source type is correct.'] : []
      });

    } catch (error) {
      addError(error instanceof Error ? error.message : 'Failed to load file');
    }
  }, [validateFile, updateState, addError]);

  const generateMapping = useCallback(async (): Promise<void> => {
    if (!state.sourceData.trim()) {
      addError('Source data is required');
      return;
    }

    updateState({ isAnalyzing: true, errors: [], warnings: [] });

    try {
      const mapping = await fhirMappingService.generateMapping(state.sourceData, state.sourceType);

      const newWarnings: string[] = [];

      // Add warnings for low confidence mappings
      const lowConfidenceRules = mapping.mappingRules.filter(rule => rule.confidence < 60);
      if (lowConfidenceRules.length > 0) {
        newWarnings.push(`${lowConfidenceRules.length} mapping rules have low confidence scores. Please review these carefully.`);
      }

      // Add warnings for unmapped fields
      if (mapping.validationResults?.unmappedFields && mapping.validationResults.unmappedFields.length > 0) {
        newWarnings.push(`${mapping.validationResults.unmappedFields.length} fields could not be mapped to FHIR resources.`);
      }

      updateState({
        generatedMapping: mapping,
        isAnalyzing: false,
        warnings: newWarnings
      });

    } catch (error) {
      updateState({ isAnalyzing: false });
      addError(error instanceof Error ? error.message : 'Failed to generate mapping');
    }
  }, [state.sourceData, state.sourceType, updateState, addError]);

  const downloadMapping = useCallback(() => {
    if (!state.generatedMapping) {
      addError('No mapping available to download');
      return;
    }

    try {
      fhirMappingService.downloadMapping(state.generatedMapping);
    } catch (error) {
      addError(error instanceof Error ? error.message : 'Failed to download mapping');
    }
  }, [state.generatedMapping, addError]);

  const clearErrors = useCallback(() => {
    updateState({ errors: [] });
  }, [updateState]);

  const clearWarnings = useCallback(() => {
    updateState({ warnings: [] });
  }, [updateState]);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const actions: FHIRMappingActions = {
    setSourceData,
    setSourceType,
    validateFile,
    loadFromFile,
    generateMapping,
    downloadMapping,
    clearErrors,
    clearWarnings,
    reset,
  };

  return [state, actions];
};