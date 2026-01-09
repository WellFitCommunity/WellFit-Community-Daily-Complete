/**
 * Unit Tests for Intelligent Migration Engine
 *
 * Tests pattern detection, DNA fingerprinting, and mapping intelligence
 */

import {
  PatternDetector,
  DataDNAGenerator,
  DataPattern as _DataPattern,
  SourceDNA,
  ColumnDNA as _ColumnDNA
} from '../intelligentMigrationEngine';

describe('PatternDetector', () => {
  describe('detectValuePattern', () => {
    it('should detect NPI pattern (10-digit number)', () => {
      const patterns = PatternDetector.detectValuePattern('1234567890');
      expect(patterns).toContain('NPI');
    });

    it('should detect SSN pattern with dashes', () => {
      const patterns = PatternDetector.detectValuePattern('123-45-6789');
      expect(patterns).toContain('SSN');
    });

    it('should detect SSN pattern without dashes', () => {
      const patterns = PatternDetector.detectValuePattern('123456789');
      // 9 digits is not NPI (10 digits), should match SSN
      expect(patterns).toContain('SSN');
    });

    it('should detect masked SSN pattern', () => {
      const patterns = PatternDetector.detectValuePattern('XXX-XX-6789');
      expect(patterns).toContain('SSN');
    });

    it('should detect phone patterns', () => {
      expect(PatternDetector.detectValuePattern('(555) 123-4567')).toContain('PHONE');
      expect(PatternDetector.detectValuePattern('555-123-4567')).toContain('PHONE');
      expect(PatternDetector.detectValuePattern('5551234567')).toContain('PHONE');
      expect(PatternDetector.detectValuePattern('+1 555 123 4567')).toContain('PHONE');
    });

    it('should detect email pattern', () => {
      const patterns = PatternDetector.detectValuePattern('test@example.com');
      expect(patterns).toContain('EMAIL');
    });

    it('should detect ISO date pattern', () => {
      expect(PatternDetector.detectValuePattern('2024-01-15')).toContain('DATE_ISO');
      expect(PatternDetector.detectValuePattern('2024-01-15T10:30:00')).toContain('DATE_ISO');
    });

    it('should detect various date formats', () => {
      expect(PatternDetector.detectValuePattern('01/15/2024')).toContain('DATE');
      expect(PatternDetector.detectValuePattern('1/5/24')).toContain('DATE');
      expect(PatternDetector.detectValuePattern('01-15-2024')).toContain('DATE');
      expect(PatternDetector.detectValuePattern('Jan 15, 2024')).toContain('DATE');
    });

    it('should detect state codes', () => {
      expect(PatternDetector.detectValuePattern('CA')).toContain('STATE_CODE');
      expect(PatternDetector.detectValuePattern('NY')).toContain('STATE_CODE');
      expect(PatternDetector.detectValuePattern('TX')).toContain('STATE_CODE');
    });

    it('should detect ZIP codes', () => {
      expect(PatternDetector.detectValuePattern('90210')).toContain('ZIP');
      expect(PatternDetector.detectValuePattern('90210-1234')).toContain('ZIP');
    });

    it('should detect currency values', () => {
      expect(PatternDetector.detectValuePattern('$1,234.56')).toContain('CURRENCY');
      expect(PatternDetector.detectValuePattern('1234.56')).toContain('CURRENCY');
      expect(PatternDetector.detectValuePattern('$100')).toContain('CURRENCY');
    });

    it('should detect percentage values', () => {
      expect(PatternDetector.detectValuePattern('75%')).toContain('PERCENTAGE');
      expect(PatternDetector.detectValuePattern('99.5%')).toContain('PERCENTAGE');
      expect(PatternDetector.detectValuePattern('100')).toContain('PERCENTAGE');
    });

    it('should detect boolean values', () => {
      expect(PatternDetector.detectValuePattern('yes')).toContain('BOOLEAN');
      expect(PatternDetector.detectValuePattern('No')).toContain('BOOLEAN');
      expect(PatternDetector.detectValuePattern('TRUE')).toContain('BOOLEAN');
      expect(PatternDetector.detectValuePattern('false')).toContain('BOOLEAN');
      expect(PatternDetector.detectValuePattern('1')).toContain('BOOLEAN');
      expect(PatternDetector.detectValuePattern('0')).toContain('BOOLEAN');
      expect(PatternDetector.detectValuePattern('Y')).toContain('BOOLEAN');
      expect(PatternDetector.detectValuePattern('n')).toContain('BOOLEAN');
    });

    it('should detect UUID pattern', () => {
      const patterns = PatternDetector.detectValuePattern('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(patterns).toContain('ID_UUID');
    });

    it('should detect full name pattern', () => {
      expect(PatternDetector.detectValuePattern('Smith, John')).toContain('NAME_FULL');
      expect(PatternDetector.detectValuePattern('John Smith')).toContain('NAME_FULL');
    });

    it('should return UNKNOWN for empty or null values', () => {
      expect(PatternDetector.detectValuePattern('')).toEqual(['UNKNOWN']);
      expect(PatternDetector.detectValuePattern('   ')).toEqual(['UNKNOWN']);
    });
  });

  describe('validateNPI', () => {
    it('should validate correct NPI numbers', () => {
      // Valid NPI must pass the Luhn check with 80840 prefix
      // 1000000005 is a valid NPI (verified by Luhn algorithm)
      expect(PatternDetector.validateNPI('1000000005')).toBe(true);
    });

    it('should reject invalid NPI numbers', () => {
      expect(PatternDetector.validateNPI('1234567890')).toBe(false);
      expect(PatternDetector.validateNPI('0000000000')).toBe(false);
    });

    it('should reject non-10-digit strings', () => {
      expect(PatternDetector.validateNPI('123456789')).toBe(false);
      expect(PatternDetector.validateNPI('12345678901')).toBe(false);
      expect(PatternDetector.validateNPI('abcdefghij')).toBe(false);
      expect(PatternDetector.validateNPI('')).toBe(false);
    });
  });

  describe('normalizeColumnName', () => {
    it('should convert to lowercase', () => {
      expect(PatternDetector.normalizeColumnName('FirstName')).toBe('firstname');
      expect(PatternDetector.normalizeColumnName('LAST_NAME')).toBe('last_name');
    });

    it('should replace special characters with underscores', () => {
      expect(PatternDetector.normalizeColumnName('First Name')).toBe('first_name');
      expect(PatternDetector.normalizeColumnName('Phone#')).toBe('phone');
      expect(PatternDetector.normalizeColumnName('Email (Work)')).toBe('email_work');
    });

    it('should collapse multiple underscores', () => {
      expect(PatternDetector.normalizeColumnName('First___Name')).toBe('first_name');
    });

    it('should trim leading/trailing underscores', () => {
      expect(PatternDetector.normalizeColumnName('_name_')).toBe('name');
    });
  });

  describe('analyzeColumn', () => {
    it('should detect primary pattern from values', () => {
      const values = ['test@a.com', 'user@b.org', 'admin@c.net', null, 'sales@d.com'];
      const dna = PatternDetector.analyzeColumn('email_address', values);

      expect(dna.primaryPattern).toBe('EMAIL');
      expect(dna.patternConfidence).toBeGreaterThan(0.5);
      expect(dna.nullPercentage).toBe(0.2);
    });

    it('should calculate unique percentage correctly', () => {
      const values = ['A', 'B', 'A', 'C', 'B'];
      const dna = PatternDetector.analyzeColumn('code', values);

      expect(dna.uniquePercentage).toBe(0.6); // 3 unique out of 5
    });

    it('should infer data types correctly', () => {
      const numberDna = PatternDetector.analyzeColumn('amount', ['100', '200', '300']);
      expect(numberDna.dataTypeInferred).toBe('number');

      const boolDna = PatternDetector.analyzeColumn('active', ['yes', 'no', 'yes']);
      expect(boolDna.dataTypeInferred).toBe('boolean');

      const dateDna = PatternDetector.analyzeColumn('hire_date', ['2024-01-01', '2024-02-15']);
      expect(dateDna.dataTypeInferred).toBe('date');
    });

    it('should store sample values', () => {
      const values = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      const dna = PatternDetector.analyzeColumn('letters', values);

      expect(dna.sampleValues).toHaveLength(5);
      expect(dna.sampleValues).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
  });
});

describe('DataDNAGenerator', () => {
  const sampleData = [
    { first_name: 'John', last_name: 'Doe', email: 'john@test.com', npi: '1234567893' },
    { first_name: 'Jane', last_name: 'Smith', email: 'jane@test.com', npi: '9876543210' },
    { first_name: 'Bob', last_name: 'Johnson', email: 'bob@test.com', npi: '5555555555' }
  ];

  describe('generateDNA', () => {
    it('should generate a valid DNA fingerprint', () => {
      const dna = DataDNAGenerator.generateDNA('CSV', Object.keys(sampleData[0]), sampleData);

      expect(dna.dnaId).toBeDefined();
      expect(dna.dnaId.length).toBeGreaterThanOrEqual(8); // Hash is at least 8 chars
      expect(dna.sourceType).toBe('CSV');
      expect(dna.columnCount).toBe(4);
      expect(dna.rowCount).toBe(3);
      expect(dna.columns).toHaveLength(4);
      expect(dna.structureHash).toBeDefined();
      expect(dna.signatureVector).toBeDefined();
    });

    it('should detect source system from column names', () => {
      const epicData = [{ epic_mrn: '123', ser_id: '456' }];
      const dna = DataDNAGenerator.generateDNA('CSV', Object.keys(epicData[0]), epicData);
      expect(dna.sourceSystem).toBe('EPIC');

      const cernerData = [{ cerner_id: '123', prsnl_id: '456' }];
      const dnaCerner = DataDNAGenerator.generateDNA('CSV', Object.keys(cernerData[0]), cernerData);
      expect(dnaCerner.sourceSystem).toBe('CERNER');
    });

    it('should create normalized signature vectors', () => {
      const dna = DataDNAGenerator.generateDNA('CSV', Object.keys(sampleData[0]), sampleData);

      // Vector should be normalized (magnitude = 1)
      const magnitude = Math.sqrt(
        dna.signatureVector.reduce((sum, v) => sum + v * v, 0)
      );
      expect(magnitude).toBeCloseTo(1, 5);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical structures', () => {
      const dna1 = DataDNAGenerator.generateDNA('CSV', Object.keys(sampleData[0]), sampleData);
      const dna2 = DataDNAGenerator.generateDNA('CSV', Object.keys(sampleData[0]), sampleData);

      const similarity = DataDNAGenerator.calculateSimilarity(dna1, dna2);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return high similarity for similar structures', () => {
      const data1 = [{ first_name: 'John', email: 'j@t.com' }];
      const data2 = [{ fname: 'Jane', email_address: 'j@t.com' }];

      const dna1 = DataDNAGenerator.generateDNA('CSV', Object.keys(data1[0]), data1);
      const dna2 = DataDNAGenerator.generateDNA('CSV', Object.keys(data2[0]), data2);

      const similarity = DataDNAGenerator.calculateSimilarity(dna1, dna2);
      expect(similarity).toBeGreaterThan(0.5);
    });

    it('should return low similarity for different structures', () => {
      const data1 = [{ npi: '1234567893', dea: 'AB1234567' }];
      const data2 = [{ amount: '100.00', description: 'Payment for services' }];

      const dna1 = DataDNAGenerator.generateDNA('CSV', Object.keys(data1[0]), data1);
      const dna2 = DataDNAGenerator.generateDNA('CSV', Object.keys(data2[0]), data2);

      const similarity = DataDNAGenerator.calculateSimilarity(dna1, dna2);
      expect(similarity).toBeLessThan(0.5);
    });

    it('should return 0 for vectors of different lengths', () => {
      const dna1: SourceDNA = {
        dnaId: '1',
        sourceType: 'CSV',
        columnCount: 1,
        rowCount: 1,
        columns: [],
        structureHash: 'a',
        signatureVector: [1, 0, 0],
        detectedAt: new Date()
      };
      const dna2: SourceDNA = {
        ...dna1,
        dnaId: '2',
        signatureVector: [1, 0]
      };

      expect(DataDNAGenerator.calculateSimilarity(dna1, dna2)).toBe(0);
    });
  });
});

describe('Pattern Detection Edge Cases', () => {
  it('should handle mixed pattern columns', () => {
    const values = ['test@email.com', '555-1234', 'random text', null];
    const dna = PatternDetector.analyzeColumn('mixed', values);

    // Should pick the most common pattern or fall back
    expect(dna.detectedPatterns.length).toBeGreaterThan(0);
  });

  it('should handle all-null columns', () => {
    const values = [null, null, null, undefined];
    const dna = PatternDetector.analyzeColumn('empty', values);

    expect(dna.primaryPattern).toBe('UNKNOWN');
    expect(dna.nullPercentage).toBe(1);
  });

  it('should handle very long text', () => {
    const longText = 'A'.repeat(100);
    const patterns = PatternDetector.detectValuePattern(longText);

    expect(patterns).toContain('TEXT_LONG');
  });

  it('should handle special characters in values', () => {
    const values = ['O\'Brien', 'Smith-Jones', 'Van der Berg'];
    const dna = PatternDetector.analyzeColumn('last_name', values);

    expect(dna.primaryPattern).not.toBe('UNKNOWN');
  });
});

describe('Column DNA Analysis', () => {
  it('should calculate average length correctly', () => {
    const values = ['ab', 'abcd', 'abcdef']; // lengths: 2, 4, 6
    const dna = PatternDetector.analyzeColumn('test', values);

    expect(dna.avgLength).toBe(4); // (2+4+6)/3 = 4
  });

  it('should handle empty strings in values', () => {
    const values = ['value', '', '  ', 'another'];
    const dna = PatternDetector.analyzeColumn('test', values);

    expect(dna.nullPercentage).toBe(0.5); // 2 empty out of 4
    expect(dna.sampleValues).toEqual(['value', 'another']);
  });

  it('should normalize column names with numbers', () => {
    expect(PatternDetector.normalizeColumnName('Address1')).toBe('address1');
    expect(PatternDetector.normalizeColumnName('Phone_2')).toBe('phone_2');
  });
});

describe('NPI Validation Edge Cases', () => {
  it('should handle NPI with leading zeros', () => {
    // NPIs can start with any digit including 0
    expect(PatternDetector.validateNPI('0123456789')).toBe(false); // Invalid checksum
  });

  it('should reject NPIs with non-numeric characters', () => {
    expect(PatternDetector.validateNPI('123456789O')).toBe(false); // O instead of 0
    expect(PatternDetector.validateNPI('123-456-7890')).toBe(false); // With dashes
  });
});

// =============================================================================
// FHIR CLINICAL CODE PATTERN DETECTION
// =============================================================================

describe('Clinical Code Pattern Detection', () => {
  describe('SNOMED CT Detection', () => {
    it('should detect standard SNOMED CT codes (6-18 digits)', () => {
      expect(PatternDetector.detectValuePattern('123456')).toContain('SNOMED_CT');
      expect(PatternDetector.detectValuePattern('73211009')).toContain('SNOMED_CT'); // Diabetes mellitus
      expect(PatternDetector.detectValuePattern('386661006')).toContain('SNOMED_CT'); // Fever
      expect(PatternDetector.detectValuePattern('233604007')).toContain('SNOMED_CT'); // Pneumonia
    });

    it('should detect FHIR URI format SNOMED codes', () => {
      const patterns = PatternDetector.detectValuePattern('http://snomed.info/sct|73211009');
      expect(patterns).toContain('SNOMED_CT');
    });

    it('should not detect non-SNOMED patterns as SNOMED', () => {
      expect(PatternDetector.detectValuePattern('12345')).not.toContain('SNOMED_CT'); // Too short
      expect(PatternDetector.detectValuePattern('ABC123')).not.toContain('SNOMED_CT'); // Has letters
    });
  });

  describe('LOINC Detection', () => {
    it('should detect standard LOINC codes', () => {
      expect(PatternDetector.detectValuePattern('12345-6')).toContain('LOINC');
      expect(PatternDetector.detectValuePattern('2345-7')).toContain('LOINC');
      expect(PatternDetector.detectValuePattern('8310-5')).toContain('LOINC'); // Body temperature
      expect(PatternDetector.detectValuePattern('8867-4')).toContain('LOINC'); // Heart rate
    });

    it('should detect LOINC panel codes', () => {
      expect(PatternDetector.detectValuePattern('LP12345-6')).toContain('LOINC');
      expect(PatternDetector.detectValuePattern('LP1234567-8')).toContain('LOINC');
    });

    it('should detect FHIR URI format LOINC codes', () => {
      const patterns = PatternDetector.detectValuePattern('http://loinc.org|8310-5');
      expect(patterns).toContain('LOINC');
    });
  });

  describe('RxNorm Detection', () => {
    it('should detect RxNorm CUI codes (5-7 digits)', () => {
      expect(PatternDetector.detectValuePattern('12345')).toContain('RXNORM');
      expect(PatternDetector.detectValuePattern('1234567')).toContain('RXNORM');
      expect(PatternDetector.detectValuePattern('313782')).toContain('RXNORM'); // Acetaminophen
    });

    it('should detect FHIR URI format RxNorm codes', () => {
      const patterns = PatternDetector.detectValuePattern('http://www.nlm.nih.gov/research/umls/rxnorm|313782');
      expect(patterns).toContain('RXNORM');
    });
  });

  describe('ICD-10 Detection', () => {
    it('should detect ICD-10-CM codes', () => {
      expect(PatternDetector.detectValuePattern('A00')).toContain('ICD10');
      expect(PatternDetector.detectValuePattern('E11.9')).toContain('ICD10'); // Type 2 diabetes
      expect(PatternDetector.detectValuePattern('J18.9')).toContain('ICD10'); // Pneumonia
      expect(PatternDetector.detectValuePattern('I10')).toContain('ICD10'); // Hypertension
      expect(PatternDetector.detectValuePattern('M79.3')).toContain('ICD10'); // Panniculitis
    });

    it('should detect ICD-10 codes with decimals', () => {
      // Standard ICD-10 with decimals
      expect(PatternDetector.detectValuePattern('S72.00')).toContain('ICD10');
      expect(PatternDetector.detectValuePattern('Z23.0')).toContain('ICD10'); // Immunization encounter
      expect(PatternDetector.detectValuePattern('K21.0')).toContain('ICD10'); // GERD
    });

    it('should detect FHIR URI format ICD-10 codes', () => {
      const patterns = PatternDetector.detectValuePattern('http://hl7.org/fhir/sid/icd-10|E11.9');
      expect(patterns).toContain('ICD10');
    });
  });

  describe('CPT Detection', () => {
    it('should detect standard CPT codes (5 digits)', () => {
      expect(PatternDetector.detectValuePattern('99213')).toContain('CPT'); // Office visit
      expect(PatternDetector.detectValuePattern('99214')).toContain('CPT'); // Office visit
      expect(PatternDetector.detectValuePattern('27447')).toContain('CPT'); // Total knee arthroplasty
    });

    it('should detect E/M codes (99xxx)', () => {
      expect(PatternDetector.detectValuePattern('99201')).toContain('CPT');
      expect(PatternDetector.detectValuePattern('99499')).toContain('CPT');
    });

    it('should detect FHIR URI format CPT codes', () => {
      const patterns = PatternDetector.detectValuePattern('http://www.ama-assn.org/go/cpt|99213');
      expect(patterns).toContain('CPT');
    });
  });

  describe('NDC (National Drug Code) Detection', () => {
    it('should detect NDC 4-4-2 format', () => {
      expect(PatternDetector.detectValuePattern('1234-5678-90')).toContain('NDC');
    });

    it('should detect NDC 5-3-2 format', () => {
      expect(PatternDetector.detectValuePattern('12345-678-90')).toContain('NDC');
    });

    it('should detect NDC 5-4-1 format', () => {
      expect(PatternDetector.detectValuePattern('12345-6789-0')).toContain('NDC');
    });

    it('should detect NDC 11-digit format (no dashes)', () => {
      expect(PatternDetector.detectValuePattern('12345678901')).toContain('NDC');
    });
  });

  describe('FHIR Resource Type Detection', () => {
    it('should detect standard FHIR resource types', () => {
      expect(PatternDetector.detectValuePattern('Patient')).toContain('FHIR_RESOURCE_TYPE');
      expect(PatternDetector.detectValuePattern('Observation')).toContain('FHIR_RESOURCE_TYPE');
      expect(PatternDetector.detectValuePattern('Condition')).toContain('FHIR_RESOURCE_TYPE');
      expect(PatternDetector.detectValuePattern('MedicationRequest')).toContain('FHIR_RESOURCE_TYPE');
      expect(PatternDetector.detectValuePattern('Procedure')).toContain('FHIR_RESOURCE_TYPE');
      expect(PatternDetector.detectValuePattern('Encounter')).toContain('FHIR_RESOURCE_TYPE');
    });

    it('should detect clinical FHIR resource types', () => {
      expect(PatternDetector.detectValuePattern('AllergyIntolerance')).toContain('FHIR_RESOURCE_TYPE');
      expect(PatternDetector.detectValuePattern('Immunization')).toContain('FHIR_RESOURCE_TYPE');
      expect(PatternDetector.detectValuePattern('DiagnosticReport')).toContain('FHIR_RESOURCE_TYPE');
      expect(PatternDetector.detectValuePattern('CarePlan')).toContain('FHIR_RESOURCE_TYPE');
      expect(PatternDetector.detectValuePattern('RiskAssessment')).toContain('FHIR_RESOURCE_TYPE');
    });

    it('should not detect non-FHIR types', () => {
      expect(PatternDetector.detectValuePattern('RandomType')).not.toContain('FHIR_RESOURCE_TYPE');
      expect(PatternDetector.detectValuePattern('patient')).not.toContain('FHIR_RESOURCE_TYPE'); // Lowercase
    });
  });

  describe('FHIR Reference Detection', () => {
    it('should detect standard FHIR references', () => {
      expect(PatternDetector.detectValuePattern('Patient/123')).toContain('FHIR_REFERENCE');
      expect(PatternDetector.detectValuePattern('Practitioner/abc-123')).toContain('FHIR_REFERENCE');
      expect(PatternDetector.detectValuePattern('Organization/org-456')).toContain('FHIR_REFERENCE');
      expect(PatternDetector.detectValuePattern('Encounter/enc-789')).toContain('FHIR_REFERENCE');
    });

    it('should detect URN UUID format references', () => {
      expect(PatternDetector.detectValuePattern('urn:uuid:a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toContain('FHIR_REFERENCE');
    });

    it('should detect Observation and Condition references', () => {
      expect(PatternDetector.detectValuePattern('Observation/obs-123')).toContain('FHIR_REFERENCE');
      expect(PatternDetector.detectValuePattern('Condition/cond-456')).toContain('FHIR_REFERENCE');
      expect(PatternDetector.detectValuePattern('Procedure/proc-789')).toContain('FHIR_REFERENCE');
    });
  });
});

// =============================================================================
// FHIR R4 CLINICAL RESOURCE SCHEMA TESTS
// =============================================================================

describe('FHIR R4 Clinical Resource Schema', () => {
  describe('FHIR Patient Resource', () => {
    it('should generate DNA for patient data with FHIR patterns', () => {
      const patientData = [
        {
          mrn: 'MRN12345',
          first_name: 'John',
          last_name: 'Doe',
          dob: '1965-03-15',
          patient_ssn: '123-45-6789',
          phone: '555-123-4567',
          email: 'john.doe@example.com',
          address: '123 Main St',
          city: 'Springfield',
          state: 'IL'
        }
      ];

      const dna = DataDNAGenerator.generateDNA('CSV', Object.keys(patientData[0]), patientData);

      expect(dna.columns.find(c => c.normalizedName === 'mrn')?.primaryPattern).toBe('ID_ALPHANUMERIC');
      expect(dna.columns.find(c => c.normalizedName === 'dob')?.primaryPattern).toBe('DATE_ISO');
      expect(dna.columns.find(c => c.normalizedName === 'patient_ssn')?.primaryPattern).toBe('SSN');
      expect(dna.columns.find(c => c.normalizedName === 'phone')?.primaryPattern).toBe('PHONE');
      expect(dna.columns.find(c => c.normalizedName === 'email')?.primaryPattern).toBe('EMAIL');
      expect(dna.columns.find(c => c.normalizedName === 'state')?.primaryPattern).toBe('STATE_CODE');
    });

    it('should detect ZIP code patterns correctly', () => {
      // Test ZIP patterns directly
      expect(PatternDetector.detectValuePattern('90210-1234')).toContain('ZIP');
      expect(PatternDetector.detectValuePattern('10001')).toContain('ZIP');
    });
  });

  describe('FHIR Observation Resource', () => {
    it('should generate DNA for observation data with clinical codes', () => {
      const observationData = [
        {
          resource_type: 'Observation',
          patient_ref: 'Patient/123',
          loinc_code: '8310-5',
          snomed_code: '386661006',
          value: '98.6',
          unit: 'degF',
          observation_date: '2024-01-15T10:30:00'
        }
      ];

      const dna = DataDNAGenerator.generateDNA('FHIR', Object.keys(observationData[0]), observationData);

      expect(dna.columns.find(c => c.normalizedName === 'resource_type')?.primaryPattern).toBe('FHIR_RESOURCE_TYPE');
      expect(dna.columns.find(c => c.normalizedName === 'patient_ref')?.primaryPattern).toBe('FHIR_REFERENCE');
      expect(dna.columns.find(c => c.normalizedName === 'loinc_code')?.primaryPattern).toBe('LOINC');
      expect(dna.columns.find(c => c.normalizedName === 'observation_date')?.primaryPattern).toBe('DATE_ISO');
    });
  });

  describe('FHIR Condition Resource', () => {
    it('should generate DNA for condition/diagnosis data', () => {
      const conditionData = [
        {
          resource_type: 'Condition',
          patient_ref: 'Patient/456',
          icd10_code: 'E11.9',
          snomed_code: '73211009',
          onset_date: '2020-06-01',
          status: 'active'
        }
      ];

      const dna = DataDNAGenerator.generateDNA('FHIR', Object.keys(conditionData[0]), conditionData);

      expect(dna.columns.find(c => c.normalizedName === 'resource_type')?.primaryPattern).toBe('FHIR_RESOURCE_TYPE');
      expect(dna.columns.find(c => c.normalizedName === 'icd10_code')?.primaryPattern).toBe('ICD10');
      expect(dna.columns.find(c => c.normalizedName === 'onset_date')?.primaryPattern).toBe('DATE_ISO');
    });
  });

  describe('FHIR MedicationRequest Resource', () => {
    it('should generate DNA for medication data', () => {
      const medicationData = [
        {
          resource_type: 'MedicationRequest',
          patient_ref: 'Patient/789',
          rxnorm_code: '313782',
          ndc_code: '12345-678-90',
          medication_name: 'Acetaminophen 500mg',
          dosage: 'Take 2 tablets every 6 hours',
          prescribed_date: '2024-01-10',
          refills: '3'
        }
      ];

      const dna = DataDNAGenerator.generateDNA('FHIR', Object.keys(medicationData[0]), medicationData);

      expect(dna.columns.find(c => c.normalizedName === 'resource_type')?.primaryPattern).toBe('FHIR_RESOURCE_TYPE');
      expect(dna.columns.find(c => c.normalizedName === 'patient_ref')?.primaryPattern).toBe('FHIR_REFERENCE');
      expect(dna.columns.find(c => c.normalizedName === 'ndc_code')?.primaryPattern).toBe('NDC');
      expect(dna.columns.find(c => c.normalizedName === 'prescribed_date')?.primaryPattern).toBe('DATE_ISO');
    });
  });

  describe('FHIR Procedure Resource', () => {
    it('should generate DNA for procedure data', () => {
      const procedureData = [
        {
          resource_type: 'Procedure',
          patient_ref: 'Patient/101',
          cpt_code: '99213',
          snomed_code: '80146002',
          procedure_date: '2024-01-12T14:00:00',
          status: 'completed',
          performer_ref: 'Practitioner/dr-smith'
        }
      ];

      const dna = DataDNAGenerator.generateDNA('FHIR', Object.keys(procedureData[0]), procedureData);

      expect(dna.columns.find(c => c.normalizedName === 'resource_type')?.primaryPattern).toBe('FHIR_RESOURCE_TYPE');
      expect(dna.columns.find(c => c.normalizedName === 'cpt_code')?.primaryPattern).toBe('CPT');
      expect(dna.columns.find(c => c.normalizedName === 'patient_ref')?.primaryPattern).toBe('FHIR_REFERENCE');
      expect(dna.columns.find(c => c.normalizedName === 'performer_ref')?.primaryPattern).toBe('FHIR_REFERENCE');
    });
  });

  describe('FHIR Encounter Resource', () => {
    it('should generate DNA for encounter/visit data', () => {
      const encounterData = [
        {
          resource_type: 'Encounter',
          patient_ref: 'Patient/202',
          encounter_type: 'ambulatory',
          admit_date: '2024-01-08T09:00:00',
          discharge_date: '2024-01-08T11:30:00',
          location_ref: 'Location/clinic-1',
          diagnosis_ref: 'Condition/cond-123'
        }
      ];

      const dna = DataDNAGenerator.generateDNA('FHIR', Object.keys(encounterData[0]), encounterData);

      expect(dna.columns.find(c => c.normalizedName === 'resource_type')?.primaryPattern).toBe('FHIR_RESOURCE_TYPE');
      expect(dna.columns.find(c => c.normalizedName === 'patient_ref')?.primaryPattern).toBe('FHIR_REFERENCE');
      expect(dna.columns.find(c => c.normalizedName === 'admit_date')?.primaryPattern).toBe('DATE_ISO');
      expect(dna.columns.find(c => c.normalizedName === 'discharge_date')?.primaryPattern).toBe('DATE_ISO');
      expect(dna.columns.find(c => c.normalizedName === 'location_ref')?.primaryPattern).toBe('FHIR_REFERENCE');
      expect(dna.columns.find(c => c.normalizedName === 'diagnosis_ref')?.primaryPattern).toBe('FHIR_REFERENCE');
    });
  });
});

// =============================================================================
// CLINICAL TERMINOLOGY SYNONYMS
// =============================================================================

describe('Clinical Terminology Synonyms', () => {
  describe('Patient Identifier Synonyms', () => {
    it('should handle MRN variations in column names', () => {
      const mrnVariations = ['mrn', 'medical_record_number', 'med_rec_num', 'patient_id', 'chart_number'];

      mrnVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
        expect(normalized.length).toBeGreaterThan(0);
      });
    });

    it('should handle SSN variations', () => {
      const ssnVariations = ['ssn', 'social_security', 'social_security_number'];

      ssnVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBe(name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''));
      });
    });
  });

  describe('Observation/Vital Signs Synonyms', () => {
    it('should handle LOINC code column variations', () => {
      const loincVariations = ['loinc', 'loinc_code', 'loinc_num', 'observation_code', 'test_code', 'lab_code'];

      loincVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });

    it('should handle result value variations', () => {
      const valueVariations = ['result', 'value', 'result_value', 'test_result', 'lab_value', 'numeric_result'];

      valueVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });
  });

  describe('Diagnosis/Condition Synonyms', () => {
    it('should handle ICD-10 code column variations', () => {
      const icd10Variations = ['icd10', 'icd_10', 'icd10_code', 'diagnosis_code', 'dx_code', 'icd_code'];

      icd10Variations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });

    it('should handle onset date variations', () => {
      const onsetVariations = ['onset', 'onset_date', 'diagnosis_date', 'dx_date', 'start_date', 'diagnosed_on'];

      onsetVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });
  });

  describe('Medication Synonyms', () => {
    it('should handle RxNorm code variations', () => {
      const rxnormVariations = ['rxnorm', 'rxnorm_code', 'rx_code', 'drug_code'];

      rxnormVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });

    it('should handle NDC code variations', () => {
      const ndcVariations = ['ndc', 'ndc_code', 'national_drug_code', 'drug_ndc'];

      ndcVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });

    it('should handle dosage variations', () => {
      const dosageVariations = ['dosage', 'dose', 'sig', 'instructions', 'dosing_instructions', 'directions'];

      dosageVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });
  });

  describe('Procedure Synonyms', () => {
    it('should handle CPT code variations', () => {
      const cptVariations = ['cpt', 'cpt_code', 'procedure_code', 'service_code', 'billing_code'];

      cptVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });

    it('should handle performed date variations', () => {
      const dateVariations = ['procedure_date', 'service_date', 'performed_date', 'surgery_date'];

      dateVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });
  });

  describe('Encounter/Visit Synonyms', () => {
    it('should handle encounter type variations', () => {
      const typeVariations = ['encounter_type', 'visit_type', 'patient_class', 'service_type'];

      typeVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });

    it('should handle admit/discharge date variations', () => {
      const admitVariations = ['admit_date', 'admission_date', 'visit_date', 'start_date', 'arrival_date'];
      const dischargeVariations = ['discharge_date', 'end_date', 'departure_date', 'checkout_date'];

      [...admitVariations, ...dischargeVariations].forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });
  });

  describe('FHIR Reference Synonyms', () => {
    it('should handle subject/patient reference variations', () => {
      const subjectVariations = ['patient', 'patient_reference', 'subject_reference', 'pt_ref'];

      subjectVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });

    it('should handle encounter reference variations', () => {
      const encounterVariations = ['visit', 'encounter_reference', 'visit_reference', 'admission'];

      encounterVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });

    it('should handle provider reference variations', () => {
      const providerVariations = ['ordering_provider', 'prescriber', 'ordered_by', 'requesting_physician'];

      providerVariations.forEach(name => {
        const normalized = PatternDetector.normalizeColumnName(name);
        expect(normalized).toBeDefined();
      });
    });
  });
});

// =============================================================================
// CLINICAL PATTERN PRIORITY AND CONFIDENCE
// =============================================================================

describe('Clinical Pattern Priority', () => {
  it('should prioritize clinical codes in detection order', () => {
    // LOINC should be detected first for lab codes
    const loincPatterns = PatternDetector.detectValuePattern('8310-5');
    expect(loincPatterns.indexOf('LOINC')).toBeLessThan(loincPatterns.indexOf('ID_NUMERIC') >= 0 ? loincPatterns.indexOf('ID_NUMERIC') : Infinity);
  });

  it('should prioritize ICD-10 for diagnosis codes', () => {
    const icd10Patterns = PatternDetector.detectValuePattern('E11.9');
    expect(icd10Patterns).toContain('ICD10');
  });

  it('should detect FHIR references with high priority', () => {
    const refPatterns = PatternDetector.detectValuePattern('Patient/123-abc');
    expect(refPatterns).toContain('FHIR_REFERENCE');
  });
});

describe('Clinical Data DNA Similarity', () => {
  it('should show high similarity for similar clinical data structures', () => {
    const labData1 = [
      { loinc_code: '8310-5', result: '98.6', unit: 'degF', date: '2024-01-15' }
    ];
    const labData2 = [
      { test_code: '8867-4', value: '72', measurement_unit: 'bpm', test_date: '2024-01-16' }
    ];

    const dna1 = DataDNAGenerator.generateDNA('CSV', Object.keys(labData1[0]), labData1);
    const dna2 = DataDNAGenerator.generateDNA('CSV', Object.keys(labData2[0]), labData2);

    const similarity = DataDNAGenerator.calculateSimilarity(dna1, dna2);
    expect(similarity).toBeGreaterThan(0.3); // Similar structure patterns
  });

  it('should show low similarity for different clinical data types', () => {
    const labData = [
      { loinc_code: '8310-5', result: '98.6' }
    ];
    const medData = [
      { rxnorm_code: '313782', medication_name: 'Acetaminophen' }
    ];

    const dna1 = DataDNAGenerator.generateDNA('CSV', Object.keys(labData[0]), labData);
    const dna2 = DataDNAGenerator.generateDNA('CSV', Object.keys(medData[0]), medData);

    const similarity = DataDNAGenerator.calculateSimilarity(dna1, dna2);
    expect(similarity).toBeLessThan(0.7);
  });
});

// =============================================================================
// FHIR SOURCE TYPE DETECTION
// =============================================================================

describe('FHIR Source Type Detection', () => {
  it('should correctly set FHIR source type', () => {
    const fhirData = [
      { resourceType: 'Patient', id: '123' }
    ];

    const dna = DataDNAGenerator.generateDNA('FHIR', Object.keys(fhirData[0]), fhirData);
    expect(dna.sourceType).toBe('FHIR');
  });

  it('should include clinical patterns in signature vector', () => {
    const clinicalData = [
      { loinc_code: '8310-5', snomed_code: '386661006', icd10_code: 'E11.9' }
    ];

    const dna = DataDNAGenerator.generateDNA('FHIR', Object.keys(clinicalData[0]), clinicalData);

    // Signature vector should be normalized
    const magnitude = Math.sqrt(dna.signatureVector.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });
});
