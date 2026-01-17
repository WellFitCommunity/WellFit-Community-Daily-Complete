/**
 * PatternDetector Tests
 *
 * Comprehensive tests for the pattern detection system
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PatternDetector } from '../PatternDetector';
import type { DataPattern as _DataPattern } from '../types';

describe('PatternDetector', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector();
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = detector.getConfig();
      expect(config.sampleSize).toBe(100);
      expect(config.storedSampleCount).toBe(5);
      expect(config.textLengthThreshold).toBe(50);
    });

    it('should allow custom configuration', () => {
      const customDetector = new PatternDetector({
        sampleSize: 50,
        textLengthThreshold: 100,
      });
      const config = customDetector.getConfig();
      expect(config.sampleSize).toBe(50);
      expect(config.textLengthThreshold).toBe(100);
    });

    it('should update configuration', () => {
      detector.setConfig({ sampleSize: 200 });
      expect(detector.getConfig().sampleSize).toBe(200);
    });
  });

  describe('detectValuePattern', () => {
    describe('NPI detection', () => {
      it('should detect valid NPI format', () => {
        const patterns = detector.detectValuePattern('1234567890');
        expect(patterns).toContain('NPI');
      });

      it('should not detect invalid length NPI', () => {
        const patterns = detector.detectValuePattern('123456789');
        expect(patterns).not.toContain('NPI');
      });
    });

    describe('SSN detection', () => {
      it('should detect SSN with dashes', () => {
        const patterns = detector.detectValuePattern('123-45-6789');
        expect(patterns).toContain('SSN');
      });

      it('should detect SSN without dashes', () => {
        const patterns = detector.detectValuePattern('123456789');
        expect(patterns).toContain('SSN');
      });

      it('should detect masked SSN', () => {
        const patterns = detector.detectValuePattern('XXX-XX-6789');
        expect(patterns).toContain('SSN');
      });
    });

    describe('phone number detection', () => {
      it('should detect phone with parentheses', () => {
        const patterns = detector.detectValuePattern('(555) 123-4567');
        expect(patterns).toContain('PHONE');
      });

      it('should detect phone with dashes', () => {
        const patterns = detector.detectValuePattern('555-123-4567');
        expect(patterns).toContain('PHONE');
      });

      it('should detect phone with dots', () => {
        const patterns = detector.detectValuePattern('555.123.4567');
        expect(patterns).toContain('PHONE');
      });

      it('should detect phone with country code', () => {
        const patterns = detector.detectValuePattern('+1 555-123-4567');
        expect(patterns).toContain('PHONE');
      });
    });

    describe('email detection', () => {
      it('should detect standard email', () => {
        const patterns = detector.detectValuePattern('test@example.com');
        expect(patterns).toContain('EMAIL');
      });

      it('should detect email with subdomain', () => {
        const patterns = detector.detectValuePattern('user@mail.example.org');
        expect(patterns).toContain('EMAIL');
      });

      it('should not detect invalid email', () => {
        const patterns = detector.detectValuePattern('not-an-email');
        expect(patterns).not.toContain('EMAIL');
      });
    });

    describe('date detection', () => {
      it('should detect ISO date', () => {
        const patterns = detector.detectValuePattern('2026-01-17');
        expect(patterns).toContain('DATE_ISO');
      });

      it('should detect ISO datetime', () => {
        const patterns = detector.detectValuePattern('2026-01-17T14:30:00');
        expect(patterns).toContain('DATE_ISO');
      });

      it('should detect MM/DD/YYYY date', () => {
        const patterns = detector.detectValuePattern('01/17/2026');
        expect(patterns).toContain('DATE');
      });

      it('should detect MM-DD-YYYY date', () => {
        const patterns = detector.detectValuePattern('01-17-2026');
        expect(patterns).toContain('DATE');
      });

      it('should detect written date', () => {
        const patterns = detector.detectValuePattern('Jan 17, 2026');
        expect(patterns).toContain('DATE');
      });
    });

    describe('name detection', () => {
      it('should detect full name (Last, First)', () => {
        const patterns = detector.detectValuePattern('Smith, John');
        expect(patterns).toContain('NAME_FULL');
      });

      it('should detect full name (First Last)', () => {
        const patterns = detector.detectValuePattern('John Smith');
        expect(patterns).toContain('NAME_FULL');
      });

      it('should detect first name', () => {
        const patterns = detector.detectValuePattern('John');
        expect(patterns).toContain('NAME_FIRST');
      });

      it('should detect last name with hyphen', () => {
        const patterns = detector.detectValuePattern("O'Connor");
        expect(patterns).toContain('NAME_LAST');
      });
    });

    describe('address component detection', () => {
      it('should detect state code', () => {
        const patterns = detector.detectValuePattern('TX');
        expect(patterns).toContain('STATE_CODE');
      });

      it('should detect ZIP code', () => {
        const patterns = detector.detectValuePattern('12345');
        expect(patterns).toContain('ZIP');
      });

      it('should detect ZIP+4 code', () => {
        const patterns = detector.detectValuePattern('12345-6789');
        expect(patterns).toContain('ZIP');
      });
    });

    describe('clinical code detection', () => {
      it('should detect LOINC code', () => {
        const patterns = detector.detectValuePattern('12345-6');
        expect(patterns).toContain('LOINC');
      });

      it('should detect ICD-10 code', () => {
        const patterns = detector.detectValuePattern('A00.1');
        expect(patterns).toContain('ICD10');
      });

      it('should detect CPT code', () => {
        const patterns = detector.detectValuePattern('99213');
        expect(patterns).toContain('CPT');
      });

      it('should detect NDC code (4-4-2)', () => {
        const patterns = detector.detectValuePattern('1234-5678-90');
        expect(patterns).toContain('NDC');
      });

      it('should detect NDC code (5-3-2)', () => {
        const patterns = detector.detectValuePattern('12345-678-90');
        expect(patterns).toContain('NDC');
      });

      it('should detect FHIR reference', () => {
        const patterns = detector.detectValuePattern('Patient/12345');
        expect(patterns).toContain('FHIR_REFERENCE');
      });

      it('should detect FHIR resource type', () => {
        const patterns = detector.detectValuePattern('Patient');
        expect(patterns).toContain('FHIR_RESOURCE_TYPE');
      });
    });

    describe('other pattern detection', () => {
      it('should detect UUID', () => {
        const patterns = detector.detectValuePattern(
          '550e8400-e29b-41d4-a716-446655440000'
        );
        expect(patterns).toContain('ID_UUID');
      });

      it('should detect currency', () => {
        const patterns = detector.detectValuePattern('$1,234.56');
        expect(patterns).toContain('CURRENCY');
      });

      it('should detect percentage', () => {
        const patterns = detector.detectValuePattern('75%');
        expect(patterns).toContain('PERCENTAGE');
      });

      it('should detect boolean values', () => {
        expect(detector.detectValuePattern('yes')).toContain('BOOLEAN');
        expect(detector.detectValuePattern('no')).toContain('BOOLEAN');
        expect(detector.detectValuePattern('true')).toContain('BOOLEAN');
        expect(detector.detectValuePattern('false')).toContain('BOOLEAN');
        expect(detector.detectValuePattern('1')).toContain('BOOLEAN');
        expect(detector.detectValuePattern('0')).toContain('BOOLEAN');
      });

      it('should return UNKNOWN for empty value', () => {
        expect(detector.detectValuePattern('')).toEqual(['UNKNOWN']);
        expect(detector.detectValuePattern('   ')).toEqual(['UNKNOWN']);
      });
    });
  });

  describe('validateNPI', () => {
    it('should validate correct NPI with Luhn check', () => {
      // 1497758544 is a known valid NPI that passes Luhn check
      expect(detector.validateNPI('1497758544')).toBe(true);
    });

    it('should reject invalid NPI', () => {
      expect(detector.validateNPI('1234567890')).toBe(false);
    });

    it('should reject NPI with wrong length', () => {
      expect(detector.validateNPI('123456789')).toBe(false);
      expect(detector.validateNPI('12345678901')).toBe(false);
    });

    it('should reject NPI with non-digits', () => {
      expect(detector.validateNPI('123456789a')).toBe(false);
    });

    it('should reject empty NPI', () => {
      expect(detector.validateNPI('')).toBe(false);
    });
  });

  describe('analyzeColumn', () => {
    it('should analyze column with phone numbers', () => {
      const values = [
        '555-123-4567',
        '(555) 234-5678',
        '555.345.6789',
        null,
        '555-456-7890',
      ];
      const dna = detector.analyzeColumn('phone_number', values);

      expect(dna.originalName).toBe('phone_number');
      expect(dna.normalizedName).toBe('phone_number');
      expect(dna.primaryPattern).toBe('PHONE');
      expect(dna.patternConfidence).toBeGreaterThan(0.5);
      expect(dna.nullPercentage).toBe(0.2);
      expect(dna.dataTypeInferred).toBe('string');
    });

    it('should analyze column with dates', () => {
      const values = ['2026-01-01', '2026-02-15', '2026-03-20'];
      const dna = detector.analyzeColumn('hire_date', values);

      expect(dna.primaryPattern).toBe('DATE_ISO');
      expect(dna.dataTypeInferred).toBe('date');
    });

    it('should analyze column with alphanumeric IDs', () => {
      // Use alphanumeric IDs that won't match clinical code patterns
      const values = ['EMP-001', 'EMP-002', 'EMP-003', 'EMP-004'];
      const dna = detector.analyzeColumn('employee_id', values);

      // Alphanumeric patterns should be detected as text
      expect(dna.primaryPattern).toBe('TEXT_SHORT');
      expect(dna.dataTypeInferred).toBe('string');
      expect(dna.originalName).toBe('employee_id');
    });

    it('should analyze column with boolean values', () => {
      const values = ['yes', 'no', 'yes', 'yes', 'no'];
      const dna = detector.analyzeColumn('is_active', values);

      expect(dna.primaryPattern).toBe('BOOLEAN');
      expect(dna.dataTypeInferred).toBe('boolean');
    });

    it('should calculate unique percentage correctly', () => {
      const values = ['A', 'B', 'A', 'C', 'A'];
      const dna = detector.analyzeColumn('code', values);

      expect(dna.uniquePercentage).toBe(0.6); // 3 unique out of 5
    });

    it('should store sample values', () => {
      const values = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
      const dna = detector.analyzeColumn('text', values);

      expect(dna.sampleValues).toHaveLength(5);
      expect(dna.sampleValues).toEqual(['one', 'two', 'three', 'four', 'five']);
    });

    it('should calculate average length', () => {
      const values = ['abc', 'defgh', 'ij'];
      const dna = detector.analyzeColumn('text', values);

      expect(dna.avgLength).toBeCloseTo(3.33, 1);
    });

    it('should handle all null values', () => {
      const values = [null, null, null];
      const dna = detector.analyzeColumn('empty', values);

      expect(dna.nullPercentage).toBe(1);
      expect(dna.primaryPattern).toBe('UNKNOWN');
    });

    it('should distinguish TEXT_SHORT from TEXT_LONG', () => {
      const shortValues = ['short text', 'another short'];
      const longValues = [
        'This is a very long text that exceeds fifty characters in length to test the threshold',
        'Another long text that also exceeds the fifty character threshold for classification',
      ];

      const shortDNA = detector.analyzeColumn('short', shortValues);
      const longDNA = detector.analyzeColumn('long', longValues);

      expect(shortDNA.primaryPattern).toBe('TEXT_SHORT');
      expect(longDNA.primaryPattern).toBe('TEXT_LONG');
    });
  });

  describe('normalizeColumnName', () => {
    it('should convert to lowercase', () => {
      expect(detector.normalizeColumnName('FirstName')).toBe('firstname');
    });

    it('should replace special characters with underscores', () => {
      expect(detector.normalizeColumnName('First Name')).toBe('first_name');
      expect(detector.normalizeColumnName('First-Name')).toBe('first_name');
    });

    it('should collapse multiple underscores', () => {
      expect(detector.normalizeColumnName('First__Name')).toBe('first_name');
    });

    it('should trim leading/trailing underscores', () => {
      expect(detector.normalizeColumnName('_name_')).toBe('name');
    });

    it('should handle complex column names', () => {
      expect(detector.normalizeColumnName('Patient DOB (MM/DD/YYYY)')).toBe(
        'patient_dob_mm_dd_yyyy'
      );
    });
  });
});
