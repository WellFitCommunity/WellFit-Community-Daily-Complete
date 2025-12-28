export interface MappingRule {
  sourceField: string;
  sourceType: string;
  fhirResource: string;
  fhirPath: string;
  transformation?: string;
  validation?: string;
  confidence: number;
}

export interface DataMapping {
  id: string;
  sourceName: string;
  sourceType: 'HL7v2' | 'CSV' | 'JSON' | 'XML' | 'Custom';
  fhirVersion: 'R4' | 'R5';
  mappingRules: MappingRule[];
  validationResults?: {
    totalFields: number;
    mappedFields: number;
    unmappedFields: string[];
    errors: string[];
    confidence: number;
  };
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  size: number;
  type: string;
}

export interface FHIRMappingServiceConfig {
  maxFileSize: number;
  allowedFileTypes: string[];
  apiEndpoint: string;
}

type UnknownRecord = Record<string, unknown>;

export class FHIRMappingService {
  private config: FHIRMappingServiceConfig;

  constructor(config: Partial<FHIRMappingServiceConfig> = {}) {
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFileTypes: ['.csv', '.json', '.xml', '.hl7', '.txt'],
      apiEndpoint: '/api/anthropic-chats',
      ...config
    };
  }

  validateFile(file: File): FileValidationResult {
    const errors: string[] = [];

    // Size validation
    if (file.size > this.config.maxFileSize) {
      errors.push(`File size exceeds maximum allowed size of ${this.config.maxFileSize / 1024 / 1024}MB`);
    }

    // Type validation
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!this.config.allowedFileTypes.includes(fileExtension)) {
      errors.push(`File type ${fileExtension} is not supported. Allowed types: ${this.config.allowedFileTypes.join(', ')}`);
    }

    // Name validation
    if (file.name.length > 255) {
      errors.push('File name is too long (max 255 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      size: file.size,
      type: fileExtension
    };
  }

  validateContent(content: string, sourceType: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!content.trim()) {
      errors.push('Content cannot be empty');
      return { isValid: false, errors };
    }

    if (content.length > 1024 * 1024) { // 1MB text limit
      errors.push('Content size exceeds 1MB limit');
    }

    // Format-specific validation
    switch (sourceType) {
      case 'JSON':
        try {
          JSON.parse(content);
        } catch (e) {
          errors.push('Invalid JSON format');
        }
        break;
      case 'CSV':
        if (!content.includes(',') && !content.includes('\t')) {
          errors.push('CSV content should contain delimiters (comma or tab)');
        }
        break;
      case 'XML':
        if (!content.trim().startsWith('<?xml') && !content.trim().startsWith('<')) {
          errors.push('XML content should start with XML declaration or root element');
        }
        break;
      case 'HL7v2':
        if (!content.includes('MSH|')) {
          errors.push('HL7v2 content should contain MSH segment');
        }
        break;
    }

    return { isValid: errors.length === 0, errors };
  }

  detectSourceType(filename: string, content: string): 'HL7v2' | 'CSV' | 'JSON' | 'XML' | 'Custom' {
    const extension = filename.split('.').pop()?.toLowerCase();

    // Try file extension first
    switch (extension) {
      case 'csv': return 'CSV';
      case 'json': return 'JSON';
      case 'xml': return 'XML';
      case 'hl7': return 'HL7v2';
    }

    // Fallback to content analysis
    const trimmedContent = content.trim();

    if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
      try {
        JSON.parse(trimmedContent);
        return 'JSON';
      } catch {
        // Continue to other checks
      }
    }

    if (trimmedContent.startsWith('<?xml') || trimmedContent.startsWith('<')) {
      return 'XML';
    }

    if (trimmedContent.includes('MSH|')) {
      return 'HL7v2';
    }

    if (trimmedContent.includes(',') || trimmedContent.includes('\t')) {
      const lines = trimmedContent.split('\n');
      if (lines.length > 1 && lines[0].split(',').length > 1) {
        return 'CSV';
      }
    }

    return 'Custom';
  }

  async generateMapping(sourceData: string, sourceType: string): Promise<DataMapping> {
    const contentValidation = this.validateContent(sourceData, sourceType);
    if (!contentValidation.isValid) {
      throw new Error(`Content validation failed: ${contentValidation.errors.join(', ')}`);
    }

    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: `Source Data Type: ${sourceType}

Source Data:
${sourceData}

Please analyze this data and generate comprehensive FHIR mapping rules.`
          }
        ],
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.content || !data.content[0]) {
      throw new Error('Invalid API response format');
    }

    const jsonText = data.content[0].text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      const mapping = JSON.parse(jsonText);
      this.validateMappingResult(mapping);
      return mapping;
    } catch (parseError) {
      throw new Error(`Failed to parse mapping analysis: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert FHIR data mapping specialist. Analyze legacy healthcare data and generate precise mapping rules to FHIR R4 resources.

INSTRUCTIONS:
- Analyze the source data structure and identify all healthcare-relevant fields
- Map each field to appropriate FHIR R4 resources and paths
- Suggest data transformations where needed (date formats, code mappings, etc.)
- Identify validation rules and potential data quality issues
- Assign confidence scores (0-100) for each mapping
- Prioritize Patient, Observation, Encounter, and other core resources

RESPONSE FORMAT - JSON ONLY:
{
  "id": "mapping-{timestamp}",
  "sourceName": "descriptive name",
  "sourceType": "detected type",
  "fhirVersion": "R4",
  "mappingRules": [
    {
      "sourceField": "field.path",
      "sourceType": "detected data type",
      "fhirResource": "Patient|Observation|etc",
      "fhirPath": "resource.element.path",
      "transformation": "transformation description if needed",
      "validation": "validation rule if applicable",
      "confidence": 85
    }
  ],
  "validationResults": {
    "totalFields": 10,
    "mappedFields": 8,
    "unmappedFields": ["field1", "field2"],
    "errors": ["potential issues"],
    "confidence": 80
  }
}

RESPOND WITH ONLY JSON - NO MARKDOWN:`;
  }

  private validateMappingResult(mapping: unknown): void {
    if (!mapping || typeof mapping !== 'object') {
      throw new Error('Mapping result must be an object');
    }

    const mappingObj = mapping as UnknownRecord;

    const requiredFields = ['id', 'sourceName', 'sourceType', 'fhirVersion', 'mappingRules'];
    for (const field of requiredFields) {
      if (!(field in mappingObj)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const mappingRules = mappingObj.mappingRules;
    if (!Array.isArray(mappingRules)) {
      throw new Error('mappingRules must be an array');
    }

    for (const rule of mappingRules) {
      if (!rule || typeof rule !== 'object') {
        throw new Error('Each mapping rule must be an object');
      }

      const ruleObj = rule as UnknownRecord;

      const requiredRuleFields = ['sourceField', 'sourceType', 'fhirResource', 'fhirPath', 'confidence'];
      for (const field of requiredRuleFields) {
        if (!(field in ruleObj)) {
          throw new Error(`Missing required rule field: ${field}`);
        }
      }
    }
  }

  downloadMapping(mapping: DataMapping, filename?: string): void {
    const mappingConfig = {
      ...mapping,
      generatedAt: new Date().toISOString(),
      version: '1.0'
    };

    const dataStr = JSON.stringify(mappingConfig, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', filename || `fhir-mapping-${mappingConfig.id}.json`);
    linkElement.click();
  }
}

export const fhirMappingService = new FHIRMappingService();
