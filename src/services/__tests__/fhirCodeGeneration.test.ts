import { WellFitCodeTemplate, FHIRCodeGenerator, wellFitCodeGenerator } from '../fhirCodeGeneration';
import { DataMapping } from '../fhirMappingService';

describe('WellFitCodeTemplate', () => {
  let template: WellFitCodeTemplate;
  let mockMapping: DataMapping;

  beforeEach(() => {
    template = new WellFitCodeTemplate();
    mockMapping = {
      id: 'test-mapping-123',
      sourceName: 'Test Patient Data',
      sourceType: 'JSON',
      fhirVersion: 'R4',
      mappingRules: [
        {
          sourceField: 'patient.id',
          sourceType: 'string',
          fhirResource: 'Patient',
          fhirPath: 'Patient.id',
          confidence: 95
        },
        {
          sourceField: 'patient.firstName',
          sourceType: 'string',
          fhirResource: 'Patient',
          fhirPath: 'Patient.name.given',
          transformation: 'Split full name',
          confidence: 90
        },
        {
          sourceField: 'vitals.bloodPressure',
          sourceType: 'string',
          fhirResource: 'Observation',
          fhirPath: 'Observation.valueString',
          validation: 'Format: XXX/XX',
          confidence: 85
        },
        {
          sourceField: 'vitals.heartRate',
          sourceType: 'numeric',
          fhirResource: 'Observation',
          fhirPath: 'Observation.valueQuantity',
          confidence: 95
        }
      ],
      validationResults: {
        totalFields: 4,
        mappedFields: 4,
        unmappedFields: [],
        errors: [],
        confidence: 91
      }
    };
  });

  describe('generateImports', () => {
    it('should generate correct imports', () => {
      const imports = template.generateImports();
      expect(imports).toContain("import { supabase } from '../lib/supabaseClient';");
    });
  });

  describe('generateInterfaces', () => {
    it('should generate FHIR interfaces', () => {
      const interfaces = template.generateInterfaces();
      expect(interfaces).toContain('export interface FHIRBundle');
      expect(interfaces).toContain('export interface FHIRPatient');
      expect(interfaces).toContain('export interface FHIRObservation');
      expect(interfaces).toContain("resourceType: 'Bundle'");
      expect(interfaces).toContain("resourceType: 'Patient'");
      expect(interfaces).toContain("resourceType: 'Observation'");
    });
  });

  describe('generateTransformerClass', () => {
    it('should generate transformer class with patient and observation transformations', () => {
      const transformerClass = template.generateTransformerClass(mockMapping);

      expect(transformerClass).toContain('export class WellFitDataTransformer');
      expect(transformerClass).toContain('async transformAndSync(sourceData: unknown): Promise<FHIRBundle>');
      expect(transformerClass).toContain('// Transform Patient data');
      expect(transformerClass).toContain('// Transform vitals.bloodPressure to Observation');
      expect(transformerClass).toContain('// Transform vitals.heartRate to Observation');
      expect(transformerClass).toContain('syncPatientToWellFit');
      expect(transformerClass).toContain('syncObservationToWellFit');
    });

    it('should include validation methods when validation rules exist', () => {
      const transformerClass = template.generateTransformerClass(mockMapping);

      expect(transformerClass).toContain('validateData(data: unknown): { isValid: boolean; errors: string[] }');
      expect(transformerClass).toContain('// Validate vitals.bloodPressure: Format: XXX/XX');
    });

    it('should handle mapping with no rules gracefully', () => {
      const emptyMapping: DataMapping = {
        ...mockMapping,
        mappingRules: []
      };

      const transformerClass = template.generateTransformerClass(emptyMapping);
      expect(transformerClass).toContain('export class WellFitDataTransformer');
      expect(transformerClass).toContain('return bundle;');
    });
  });

  describe('generateUsageExample', () => {
    it('should generate usage example', () => {
      const example = template.generateUsageExample();
      expect(example).toContain('// Usage example:');
      expect(example).toContain('const transformer = new WellFitDataTransformer();');
      expect(example).toContain('await transformer.transformAndSync(legacyData);');
    });
  });
});

describe('FHIRCodeGenerator', () => {
  let generator: FHIRCodeGenerator;
  let template: WellFitCodeTemplate;
  let mockMapping: DataMapping;

  beforeEach(() => {
    template = new WellFitCodeTemplate();
    generator = new FHIRCodeGenerator(template);
    mockMapping = {
      id: 'test-mapping-123',
      sourceName: 'Test Patient Data',
      sourceType: 'JSON',
      fhirVersion: 'R4',
      mappingRules: [
        {
          sourceField: 'patient.id',
          sourceType: 'string',
          fhirResource: 'Patient',
          fhirPath: 'Patient.id',
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
  });

  describe('generateFullCode', () => {
    it('should generate complete code with all sections', () => {
      const fullCode = generator.generateFullCode(mockMapping);

      expect(fullCode).toContain('// Generated FHIR Transformation Code for WellFit Integration');
      expect(fullCode).toContain("import { supabase } from '../lib/supabaseClient';");
      expect(fullCode).toContain('export interface FHIRBundle');
      expect(fullCode).toContain('export class WellFitDataTransformer');
      expect(fullCode).toContain('// Usage example:');
    });

    it('should generate code that includes all mapping rules', () => {
      const mappingWithMultipleRules: DataMapping = {
        ...mockMapping,
        mappingRules: [
          {
            sourceField: 'patient.id',
            sourceType: 'string',
            fhirResource: 'Patient',
            fhirPath: 'Patient.id',
            confidence: 95
          },
          {
            sourceField: 'patient.name',
            sourceType: 'string',
            fhirResource: 'Patient',
            fhirPath: 'Patient.name.family',
            confidence: 90
          },
          {
            sourceField: 'vitals.temperature',
            sourceType: 'numeric',
            fhirResource: 'Observation',
            fhirPath: 'Observation.valueQuantity',
            confidence: 88
          }
        ]
      };

      const fullCode = generator.generateFullCode(mappingWithMultipleRules);

      expect(fullCode).toContain('patient.id');
      expect(fullCode).toContain('patient.name');
      expect(fullCode).toContain('vitals.temperature');
    });
  });
});

describe('wellFitCodeGenerator', () => {
  it('should be an instance of FHIRCodeGenerator', () => {
    expect(wellFitCodeGenerator).toBeInstanceOf(FHIRCodeGenerator);
  });

  it('should generate code using WellFit template', () => {
    const mockMapping: DataMapping = {
      id: 'test-mapping-123',
      sourceName: 'Test Data',
      sourceType: 'JSON',
      fhirVersion: 'R4',
      mappingRules: [
        {
          sourceField: 'patient.id',
          sourceType: 'string',
          fhirResource: 'Patient',
          fhirPath: 'Patient.id',
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

    const code = wellFitCodeGenerator.generateFullCode(mockMapping);
    expect(code).toContain('WellFit Integration');
    expect(code).toContain('supabase');
    expect(code).toContain('profiles');
    expect(code).toContain('check_ins');
  });
});

describe('Code Generation Integration', () => {
  it('should generate valid TypeScript code structure', () => {
    const mockMapping: DataMapping = {
      id: 'test-mapping-123',
      sourceName: 'Patient Demographics',
      sourceType: 'JSON',
      fhirVersion: 'R4',
      mappingRules: [
        {
          sourceField: 'demographics.firstName',
          sourceType: 'string',
          fhirResource: 'Patient',
          fhirPath: 'Patient.name.given',
          confidence: 95
        },
        {
          sourceField: 'demographics.lastName',
          sourceType: 'string',
          fhirResource: 'Patient',
          fhirPath: 'Patient.name.family',
          confidence: 95
        },
        {
          sourceField: 'vitals.bloodPressure',
          sourceType: 'string',
          fhirResource: 'Observation',
          fhirPath: 'Observation.valueString',
          validation: 'required',
          confidence: 85
        }
      ],
      validationResults: {
        totalFields: 3,
        mappedFields: 3,
        unmappedFields: [],
        errors: [],
        confidence: 92
      }
    };

    const code = wellFitCodeGenerator.generateFullCode(mockMapping);

    // Check basic structure
    expect(code).toContain('import ');
    expect(code).toContain('export interface ');
    expect(code).toContain('export class ');
    expect(code).toContain('async ');
    expect(code).toContain('private ');

    // Check specific WellFit integration
    expect(code).toContain('supabase.from(\'profiles\')');
    expect(code).toContain('supabase.from(\'check_ins\')');
    expect(code).toContain('syncPatientToWellFit');
    expect(code).toContain('syncObservationToWellFit');

    // Check validation inclusion
    expect(code).toContain('validateData');
    expect(code).toContain('validateField');
    expect(code).toContain('vitals.bloodPressure: required');

    // Check helper methods
    expect(code).toContain('extractValue');
    expect(code).toContain('sanitizeValue');
    expect(code).toContain('parseNumericValue');

    // Verify no obvious syntax errors in generated code structure
    const lines = code.split('\n');
    const importLines = lines.filter(line => line.trim().startsWith('import'));
    const exportLines = lines.filter(line => line.trim().startsWith('export'));

    expect(importLines.length).toBeGreaterThan(0);
    expect(exportLines.length).toBeGreaterThan(0);
  });
});