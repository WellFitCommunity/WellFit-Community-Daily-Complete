import { FHIRMappingService } from '../fhirMappingService';

describe('FHIRMappingService', () => {
  let service: FHIRMappingService;

  beforeEach(() => {
    service = new FHIRMappingService();
  });

  describe('validateFile', () => {
    it('should accept valid files', () => {
      const mockFile = new File(['test content'], 'test.json', { type: 'application/json' });
      const result = service.validateFile(mockFile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files that are too large', () => {
      const service = new FHIRMappingService({ maxFileSize: 100 });
      const largeContent = 'x'.repeat(200);
      const mockFile = new File([largeContent], 'large.json', { type: 'application/json' });

      const result = service.validateFile(mockFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size exceeds maximum allowed size of 0.0001MB');
    });

    it('should reject unsupported file types', () => {
      const mockFile = new File(['test'], 'test.exe', { type: 'application/octet-stream' });
      const result = service.validateFile(mockFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File type .exe is not supported. Allowed types: .csv, .json, .xml, .hl7, .txt');
    });

    it('should reject files with long names', () => {
      const longName = 'x'.repeat(256) + '.json';
      const mockFile = new File(['test'], longName, { type: 'application/json' });
      const result = service.validateFile(mockFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File name is too long (max 255 characters)');
    });
  });

  describe('validateContent', () => {
    it('should accept valid JSON content', () => {
      const content = '{"patient": {"name": "John Doe"}}';
      const result = service.validateContent(content, 'JSON');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid JSON content', () => {
      const content = '{"patient": {"name": "John Doe"';
      const result = service.validateContent(content, 'JSON');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid JSON format');
    });

    it('should reject empty content', () => {
      const result = service.validateContent('', 'JSON');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Content cannot be empty');
    });

    it('should reject content that is too large', () => {
      const largeContent = 'x'.repeat(1024 * 1024 + 1);
      const result = service.validateContent(largeContent, 'JSON');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Content size exceeds 1MB limit');
    });

    it('should validate CSV content', () => {
      const csvContent = 'name,age,city\nJohn,30,NYC';
      const result = service.validateContent(csvContent, 'CSV');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid CSV content', () => {
      const csvContent = 'just some text without delimiters';
      const result = service.validateContent(csvContent, 'CSV');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('CSV content should contain delimiters (comma or tab)');
    });

    it('should validate XML content', () => {
      const xmlContent = '<?xml version="1.0"?><root><patient>John</patient></root>';
      const result = service.validateContent(xmlContent, 'XML');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid XML content', () => {
      const xmlContent = 'not xml content';
      const result = service.validateContent(xmlContent, 'XML');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('XML content should start with XML declaration or root element');
    });

    it('should validate HL7v2 content', () => {
      const hl7Content = 'MSH|^~\\&|EPIC|EPICADT|SMS|SMSADT|199912271408||ADT^A04|1817457|D|2.5';
      const result = service.validateContent(hl7Content, 'HL7v2');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid HL7v2 content', () => {
      const hl7Content = 'not hl7 content';
      const result = service.validateContent(hl7Content, 'HL7v2');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('HL7v2 content should contain MSH segment');
    });
  });

  describe('detectSourceType', () => {
    it('should detect JSON from file extension', () => {
      const result = service.detectSourceType('data.json', '{"test": "data"}');
      expect(result).toBe('JSON');
    });

    it('should detect CSV from file extension', () => {
      const result = service.detectSourceType('data.csv', 'name,age\nJohn,30');
      expect(result).toBe('CSV');
    });

    it('should detect XML from file extension', () => {
      const result = service.detectSourceType('data.xml', '<root><test>data</test></root>');
      expect(result).toBe('XML');
    });

    it('should detect HL7 from file extension', () => {
      const result = service.detectSourceType('data.hl7', 'MSH|test');
      expect(result).toBe('HL7v2');
    });

    it('should detect JSON from content when extension is unknown', () => {
      const result = service.detectSourceType('data.unknown', '{"test": "data"}');
      expect(result).toBe('JSON');
    });

    it('should detect XML from content when extension is unknown', () => {
      const result = service.detectSourceType('data.unknown', '<?xml version="1.0"?><root></root>');
      expect(result).toBe('XML');
    });

    it('should detect HL7v2 from content when extension is unknown', () => {
      const result = service.detectSourceType('data.unknown', 'MSH|^~\\&|test');
      expect(result).toBe('HL7v2');
    });

    it('should detect CSV from content when extension is unknown', () => {
      const result = service.detectSourceType('data.unknown', 'name,age\nJohn,30');
      expect(result).toBe('CSV');
    });

    it('should return Custom for undetectable content', () => {
      const result = service.detectSourceType('data.unknown', 'some random text');
      expect(result).toBe('Custom');
    });
  });

  describe('generateMapping', () => {
    beforeEach(() => {
      // Mock fetch for API calls
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should throw error for invalid content', async () => {
      await expect(service.generateMapping('', 'JSON')).rejects.toThrow('Content validation failed');
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(service.generateMapping('{"test": "data"}', 'JSON'))
        .rejects.toThrow('API request failed: 500 Internal Server Error');
    });

    it('should handle invalid API response format', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: null })
      });

      await expect(service.generateMapping('{"test": "data"}', 'JSON'))
        .rejects.toThrow('Invalid API response format');
    });

    it('should handle invalid JSON response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'invalid json response' }]
        })
      });

      await expect(service.generateMapping('{"test": "data"}', 'JSON'))
        .rejects.toThrow('Failed to parse mapping analysis');
    });

    it('should successfully generate mapping from valid response', async () => {
      const mockMapping = {
        id: 'test-mapping',
        sourceName: 'Test Data',
        sourceType: 'JSON',
        fhirVersion: 'R4',
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

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify(mockMapping) }]
        })
      });

      const result = await service.generateMapping('{"patient": {"name": "John"}}', 'JSON');
      expect(result).toEqual(mockMapping);
    });
  });

  describe('downloadMapping', () => {
    it('should create download link and trigger click', () => {
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

      // Mock DOM methods
      const mockLink = {
        setAttribute: jest.fn(),
        click: jest.fn()
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);

      service.downloadMapping(mockMapping);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('href', expect.stringContaining('data:application/json'));
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'fhir-mapping-test-mapping.json');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });
});