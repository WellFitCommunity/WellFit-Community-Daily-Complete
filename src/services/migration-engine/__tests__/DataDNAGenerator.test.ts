/**
 * DataDNAGenerator Tests
 *
 * Comprehensive tests for DNA fingerprint generation
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataDNAGenerator } from '../DataDNAGenerator';

describe('DataDNAGenerator', () => {
  let generator: DataDNAGenerator;

  beforeEach(() => {
    generator = new DataDNAGenerator();
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = generator.getConfig();
      expect(config.similarityThreshold).toBe(0.7);
      expect(config.maxSimilarMigrations).toBe(5);
    });

    it('should allow custom configuration', () => {
      const customGenerator = new DataDNAGenerator({
        similarityThreshold: 0.8,
        maxSimilarMigrations: 10,
      });
      const config = customGenerator.getConfig();
      expect(config.similarityThreshold).toBe(0.8);
      expect(config.maxSimilarMigrations).toBe(10);
    });

    it('should update configuration', () => {
      generator.setConfig({ similarityThreshold: 0.5 });
      expect(generator.getSimilarityThreshold()).toBe(0.5);
    });
  });

  describe('generateDNA', () => {
    const sampleData = [
      {
        first_name: 'John',
        last_name: 'Smith',
        email: 'john@example.com',
        phone: '555-123-4567',
        hire_date: '2026-01-15',
      },
      {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        phone: '555-234-5678',
        hire_date: '2026-02-20',
      },
    ];

    it('should generate DNA with correct source type', () => {
      const dna = generator.generateDNA(
        'CSV',
        ['first_name', 'last_name', 'email', 'phone', 'hire_date'],
        sampleData
      );

      expect(dna.sourceType).toBe('CSV');
    });

    it('should generate consistent DNA ID for same structure', () => {
      // DNA ID is based on structure hash - same structure = same ID (for matching similar migrations)
      const dna1 = generator.generateDNA('CSV', ['name'], [{ name: 'test' }]);
      const dna2 = generator.generateDNA('CSV', ['name'], [{ name: 'test' }]);

      expect(dna1.dnaId).toBe(dna2.dnaId);
      expect(dna1.structureHash).toBe(dna2.structureHash);
    });

    it('should generate different DNA ID for different structure', () => {
      const dna1 = generator.generateDNA('CSV', ['name'], [{ name: 'test' }]);
      const dna2 = generator.generateDNA('CSV', ['email'], [{ email: 'test@example.com' }]);

      expect(dna1.dnaId).not.toBe(dna2.dnaId);
    });

    it('should count columns correctly', () => {
      const dna = generator.generateDNA(
        'EXCEL',
        ['first_name', 'last_name', 'email', 'phone', 'hire_date'],
        sampleData
      );

      expect(dna.columnCount).toBe(5);
    });

    it('should count rows correctly', () => {
      const dna = generator.generateDNA(
        'CSV',
        ['first_name', 'last_name'],
        sampleData
      );

      expect(dna.rowCount).toBe(2);
    });

    it('should analyze each column', () => {
      const dna = generator.generateDNA(
        'CSV',
        ['first_name', 'email', 'phone'],
        sampleData
      );

      expect(dna.columns).toHaveLength(3);
      expect(dna.columns.find((c) => c.originalName === 'email')?.primaryPattern).toBe('EMAIL');
      expect(dna.columns.find((c) => c.originalName === 'phone')?.primaryPattern).toBe('PHONE');
    });

    it('should generate structure hash', () => {
      const dna = generator.generateDNA('CSV', ['name', 'email'], [
        { name: 'Test', email: 'test@example.com' },
      ]);

      expect(dna.structureHash).toBeDefined();
      expect(typeof dna.structureHash).toBe('string');
      expect(dna.structureHash.length).toBeGreaterThan(0);
    });

    it('should generate signature vector', () => {
      const dna = generator.generateDNA('CSV', ['name', 'email'], [
        { name: 'Test', email: 'test@example.com' },
      ]);

      expect(dna.signatureVector).toBeDefined();
      expect(Array.isArray(dna.signatureVector)).toBe(true);
      expect(dna.signatureVector.length).toBeGreaterThan(0);
    });

    it('should set detected timestamp', () => {
      const before = new Date();
      const dna = generator.generateDNA('CSV', ['name'], [{ name: 'test' }]);
      const after = new Date();

      expect(dna.detectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(dna.detectedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should use provided source system', () => {
      const dna = generator.generateDNA(
        'DATABASE',
        ['name'],
        [{ name: 'test' }],
        'EPIC'
      );

      expect(dna.sourceSystem).toBe('EPIC');
    });
  });

  describe('source system detection', () => {
    it('should detect Epic from column names', () => {
      const dna = generator.generateDNA(
        'DATABASE',
        ['epic_id', 'patient_name'],
        [{ epic_id: '123', patient_name: 'Test' }]
      );

      expect(dna.sourceSystem).toBe('EPIC');
    });

    it('should detect Cerner from column names', () => {
      const dna = generator.generateDNA(
        'DATABASE',
        ['cerner_mrn', 'prsnl_id'],
        [{ cerner_mrn: '123', prsnl_id: '456' }]
      );

      expect(dna.sourceSystem).toBe('CERNER');
    });

    it('should detect Meditech from column names', () => {
      const dna = generator.generateDNA(
        'DATABASE',
        ['mt_patient_id', 'meditech_code'],
        [{ mt_patient_id: '123', meditech_code: 'ABC' }]
      );

      expect(dna.sourceSystem).toBe('MEDITECH');
    });

    it('should detect Athena from column names', () => {
      const dna = generator.generateDNA(
        'DATABASE',
        ['athena_id', 'ath_patient'],
        [{ athena_id: '123', ath_patient: 'Test' }]
      );

      expect(dna.sourceSystem).toBe('ATHENAHEALTH');
    });

    it('should detect Allscripts from column names', () => {
      const dna = generator.generateDNA(
        'DATABASE',
        ['allscripts_mrn', 'touchworks_id'],
        [{ allscripts_mrn: '123', touchworks_id: '456' }]
      );

      expect(dna.sourceSystem).toBe('ALLSCRIPTS');
    });

    it('should return undefined for unknown source', () => {
      const dna = generator.generateDNA(
        'CSV',
        ['patient_id', 'name'],
        [{ patient_id: '123', name: 'Test' }]
      );

      expect(dna.sourceSystem).toBeUndefined();
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical DNAs', () => {
      const data = [
        { name: 'John', email: 'john@example.com', phone: '555-123-4567' },
      ];
      const dna1 = generator.generateDNA('CSV', ['name', 'email', 'phone'], data);

      // Use the same DNA for comparison
      const similarity = generator.calculateSimilarity(dna1, dna1);

      // Use toBeCloseTo for floating point comparison
      expect(similarity).toBeCloseTo(1, 10);
    });

    it('should return high similarity for similar structures', () => {
      const data1 = [
        { first_name: 'John', email: 'john@example.com', phone: '555-123-4567' },
      ];
      const data2 = [
        { fname: 'Jane', email_addr: 'jane@example.com', telephone: '555-234-5678' },
      ];

      const dna1 = generator.generateDNA('CSV', ['first_name', 'email', 'phone'], data1);
      const dna2 = generator.generateDNA('CSV', ['fname', 'email_addr', 'telephone'], data2);

      const similarity = generator.calculateSimilarity(dna1, dna2);

      // Same patterns (NAME_FIRST, EMAIL, PHONE) should give high similarity
      expect(similarity).toBeGreaterThan(0.8);
    });

    it('should return low similarity for different structures', () => {
      const data1 = [{ npi: '1234567890', license: 'MD-12345' }];
      const data2 = [{ amount: '$1,234.56', date: '2026-01-15' }];

      const dna1 = generator.generateDNA('CSV', ['npi', 'license'], data1);
      const dna2 = generator.generateDNA('CSV', ['amount', 'date'], data2);

      const similarity = generator.calculateSimilarity(dna1, dna2);

      expect(similarity).toBeLessThan(0.5);
    });

    it('should return 0 for mismatched vector lengths', () => {
      const dna1 = generator.generateDNA('CSV', ['name'], [{ name: 'test' }]);
      const dna2 = {
        ...generator.generateDNA('CSV', ['name'], [{ name: 'test' }]),
        signatureVector: [0.5, 0.5], // Different length
      };

      const similarity = generator.calculateSimilarity(dna1, dna2);

      expect(similarity).toBe(0);
    });
  });

  describe('signature vector normalization', () => {
    it('should normalize signature vector', () => {
      const dna = generator.generateDNA('CSV', ['email', 'phone'], [
        { email: 'test@example.com', phone: '555-123-4567' },
      ]);

      // Check that the vector is normalized (magnitude should be ~1)
      const magnitude = Math.sqrt(
        dna.signatureVector.reduce((sum, v) => sum + v * v, 0)
      );

      expect(magnitude).toBeCloseTo(1, 5);
    });
  });

  describe('structure hash consistency', () => {
    it('should generate same hash for same structure', () => {
      const data1 = [{ name: 'John', email: 'john@example.com' }];
      const data2 = [{ name: 'Jane', email: 'jane@example.com' }];

      const dna1 = generator.generateDNA('CSV', ['name', 'email'], data1);
      const dna2 = generator.generateDNA('CSV', ['name', 'email'], data2);

      expect(dna1.structureHash).toBe(dna2.structureHash);
    });

    it('should generate different hash for different structure', () => {
      const dna1 = generator.generateDNA('CSV', ['name', 'email'], [
        { name: 'John', email: 'john@example.com' },
      ]);
      const dna2 = generator.generateDNA('CSV', ['name', 'phone'], [
        { name: 'John', phone: '555-123-4567' },
      ]);

      expect(dna1.structureHash).not.toBe(dna2.structureHash);
    });
  });

  describe('edge cases', () => {
    it('should handle empty column values', () => {
      const data = [{ name: '', email: '' }];
      const dna = generator.generateDNA('CSV', ['name', 'email'], data);

      expect(dna.columns).toHaveLength(2);
      expect(dna.columns[0].primaryPattern).toBe('UNKNOWN');
    });

    it('should handle mixed type values', () => {
      const data = [
        { value: 'text' },
        { value: 123 },
        { value: true },
        { value: null },
      ];
      const dna = generator.generateDNA('CSV', ['value'], data);

      expect(dna.columns).toHaveLength(1);
    });

    it('should handle single row', () => {
      const data = [{ name: 'Test' }];
      const dna = generator.generateDNA('CSV', ['name'], data);

      expect(dna.rowCount).toBe(1);
      expect(dna.columns).toHaveLength(1);
    });

    it('should handle many columns', () => {
      const columns = Array.from({ length: 50 }, (_, i) => `col_${i}`);
      const data = [
        Object.fromEntries(columns.map((c, i) => [c, `value_${i}`])),
      ];
      const dna = generator.generateDNA('CSV', columns, data);

      expect(dna.columnCount).toBe(50);
      expect(dna.columns).toHaveLength(50);
    });
  });
});
