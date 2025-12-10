/**
 * Unit Tests for Intelligent Migration Engine
 *
 * Tests pattern detection, DNA fingerprinting, and mapping intelligence
 */

import {
  PatternDetector,
  DataDNAGenerator,
  DataPattern,
  SourceDNA,
  ColumnDNA
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
