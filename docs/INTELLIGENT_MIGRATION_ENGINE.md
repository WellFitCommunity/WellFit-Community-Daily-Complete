# Intelligent Migration Engine

## Data DNA Fingerprinting & Adaptive Field Mapping

The Intelligent Migration Engine is WellFit's proprietary system for migrating healthcare data from legacy EHR systems. Unlike traditional migration tools that require manual field mapping, this engine learns from each migration and gets smarter over time.

---

## Table of Contents

1. [Overview](#overview)
2. [Key Differentiators](#key-differentiators)
3. [Architecture](#architecture)
4. [Quick Start](#quick-start)
5. [Core Concepts](#core-concepts)
6. [Healthcare Patterns](#healthcare-patterns)
7. [Configuration Reference](#configuration-reference)
8. [API Reference](#api-reference)
9. [AI-Assisted Mapping](#ai-assisted-mapping)
10. [Learning System](#learning-system)
11. [Enterprise Features](#enterprise-features)
12. [Examples](#examples)

---

## Overview

### The Problem

Healthcare data migration is expensive and error-prone:
- **Manual mapping**: Consultants charge $200-500K to map fields from Epic, Cerner, etc.
- **No memory**: Each migration starts from scratch, even for identical source systems
- **Clinical codes ignored**: Generic tools don't understand NPI, LOINC, ICD-10, CPT, etc.
- **High error rates**: Manual processes lead to data quality issues

### The Solution

The Intelligent Migration Engine solves this with:

| Feature | Benefit |
|---------|---------|
| **Data DNA Fingerprinting** | Creates unique signatures for source datasets |
| **Pattern Recognition** | Auto-detects healthcare data types (NPI, SSN, clinical codes) |
| **Institutional Memory** | Learns from each migration, improves suggestions |
| **AI-Assisted Hybrid Mapping** | Falls back to Claude AI for ambiguous fields |
| **Confidence Scoring** | Ranks suggestions so users approve high-confidence, review low |

---

## Key Differentiators

### vs. Traditional Migration Tools

| Capability | Traditional Tools | Intelligent Migration Engine |
|------------|-------------------|------------------------------|
| Field mapping | Manual drag-and-drop | Auto-suggested with confidence scores |
| Learning | None | Remembers what worked, improves over time |
| Healthcare awareness | Generic | NPI Luhn, LOINC, SNOMED, ICD-10, CPT, NDC |
| Source recognition | Manual config | Auto-detects Epic, Cerner, Meditech, Athena |
| Similar migrations | Start fresh | DNA matching finds similar past migrations |
| AI assistance | None | Claude AI for low-confidence fields |

### Cost Comparison

| Approach | Typical Cost | Time |
|----------|--------------|------|
| Epic consultant manual migration | $200K - $500K | 6-12 months |
| Generic ETL tool + mapping | $50K - $100K | 3-6 months |
| **Intelligent Migration Engine** | **Included** | **Days to weeks** |

---

## Architecture

```
src/services/migration-engine/
├── index.ts                      # Single import point
├── types.ts                      # TypeScript interfaces
├── config.ts                     # Configurable thresholds
├── PatternDetector.ts            # Healthcare pattern recognition
├── DataDNAGenerator.ts           # Fingerprinting & similarity
├── MappingIntelligence.ts        # AI-assisted field mapping
├── IntelligentMigrationService.ts # Main orchestration
├── targetSchema.ts               # WellFit database schema
└── __tests__/                    # 139 comprehensive tests
```

### Component Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  Source Data    │────▶│  PatternDetector │────▶│  DataDNAGenerator  │
│  (CSV, Excel,   │     │  - NPI validation │     │  - Fingerprint     │
│   Database)     │     │  - Clinical codes │     │  - Signature vector│
└─────────────────┘     │  - PHI detection  │     │  - Structure hash  │
                        └──────────────────┘     └────────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  Target Tables  │◀────│  Migration       │◀────│  MappingIntelligence│
│  (hc_staff,     │     │  Service         │     │  - Learned mappings │
│   fhir_patient) │     │  - Validation    │     │  - AI assistance   │
└─────────────────┘     │  - Batch insert  │     │  - Confidence score│
                        └──────────────────┘     └────────────────────┘
```

---

## Quick Start

### Basic Usage

```typescript
import {
  IntelligentMigrationService,
  DataDNAGeneratorStatic
} from './services/migration-engine';
import { supabase } from './lib/supabase';

// 1. Generate DNA fingerprint from source data
const columns = ['first_name', 'last_name', 'npi', 'email', 'hire_date'];
const data = [
  { first_name: 'John', last_name: 'Smith', npi: '1234567890', email: 'john@hospital.org', hire_date: '2020-01-15' },
  { first_name: 'Jane', last_name: 'Doe', npi: '0987654321', email: 'jane@hospital.org', hire_date: '2021-03-20' },
];

const dna = DataDNAGeneratorStatic.generateDNA('CSV', columns, data);

// 2. Initialize migration service
const migrationService = new IntelligentMigrationService(supabase, 'org-123');

// 3. Get mapping suggestions
const suggestions = await migrationService.suggestMappings(dna);

// suggestions:
// [
//   { sourceColumn: 'first_name', targetTable: 'hc_staff', targetColumn: 'first_name', confidence: 0.95 },
//   { sourceColumn: 'last_name', targetTable: 'hc_staff', targetColumn: 'last_name', confidence: 0.95 },
//   { sourceColumn: 'npi', targetTable: 'hc_staff', targetColumn: 'npi', confidence: 0.98 },
//   { sourceColumn: 'email', targetTable: 'hc_staff', targetColumn: 'email', confidence: 0.92 },
//   { sourceColumn: 'hire_date', targetTable: 'hc_staff', targetColumn: 'hire_date', confidence: 0.90 },
// ]

// 4. Execute migration (after user approval)
const result = await migrationService.executeMigration(dna, confirmedMappings, data);
```

### Using Static Helpers

For quick pattern detection without instantiation:

```typescript
import {
  PatternDetectorStatic,
  DataDNAGeneratorStatic
} from './services/migration-engine';

// Validate an NPI number
const isValid = PatternDetectorStatic.validateNPI('1497758544'); // true

// Detect patterns in a value
const patterns = PatternDetectorStatic.detectValuePattern('123-45-6789'); // ['SSN']

// Generate DNA fingerprint
const dna = DataDNAGeneratorStatic.generateDNA('CSV', columns, data);

// Calculate similarity between two datasets
const similarity = DataDNAGeneratorStatic.calculateSimilarity(dna1, dna2); // 0.0 - 1.0
```

---

## Core Concepts

### Data DNA Fingerprinting

Every dataset gets a unique "DNA" fingerprint that captures its structure:

```typescript
interface SourceDNA {
  dnaId: string;              // Unique identifier
  sourceType: 'CSV' | 'EXCEL' | 'DATABASE' | 'API' | 'HL7' | 'FHIR';
  sourceSystem?: string;      // Auto-detected: EPIC, CERNER, MEDITECH, etc.
  columnCount: number;
  rowCount: number;
  columns: ColumnDNA[];       // Per-column analysis
  structureHash: string;      // Hash for finding identical structures
  signatureVector: number[];  // Vector for similarity matching
  detectedAt: Date;
}
```

### Column DNA

Each column is analyzed for patterns and data characteristics:

```typescript
interface ColumnDNA {
  originalName: string;       // 'Provider NPI'
  normalizedName: string;     // 'provider_npi'
  primaryPattern: DataPattern; // 'NPI'
  secondaryPatterns: DataPattern[];
  patternConfidence: number;  // 0.0 - 1.0
  dataTypeInferred: 'string' | 'number' | 'date' | 'boolean';
  nullPercentage: number;
  uniquePercentage: number;
  avgLength: number;
  sampleValues: string[];     // First 5 non-null values
}
```

### Signature Vectors

The engine creates a normalized vector for each dataset based on pattern frequencies. This enables cosine similarity matching to find similar past migrations:

```typescript
// Dataset 1: [email, phone, name, date]
// Vector: [0.5, 0.5, 0.5, 0.5, 0, 0, 0, ...] (normalized)

// Dataset 2: [email_addr, telephone, full_name, hire_date]
// Vector: [0.5, 0.5, 0.5, 0.5, 0, 0, 0, ...] (normalized)

// Similarity: 1.0 (identical patterns, different column names)
```

---

## Healthcare Patterns

The PatternDetector recognizes these healthcare-specific patterns:

### Identifier Patterns

| Pattern | Description | Example | Validation |
|---------|-------------|---------|------------|
| `NPI` | National Provider Identifier | `1234567890` | Luhn algorithm |
| `SSN` | Social Security Number | `123-45-6789` | Format + masking |
| `ID_UUID` | UUID identifier | `550e8400-e29b-41d4-...` | UUID format |
| `ID_NUMERIC` | Numeric identifier | `12345678` | Pure digits |

### Clinical Code Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `LOINC` | Lab/observation codes | `12345-6` |
| `SNOMED_CT` | Clinical terminology | `123456789` |
| `ICD10` | Diagnosis codes | `A00.1`, `Z99.89` |
| `CPT` | Procedure codes | `99213` |
| `NDC` | Drug codes | `12345-678-90` |
| `FHIR_REFERENCE` | FHIR resource refs | `Patient/12345` |
| `FHIR_RESOURCE_TYPE` | FHIR types | `Patient`, `Observation` |

### Contact Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `EMAIL` | Email address | `user@hospital.org` |
| `PHONE` | Phone number | `(555) 123-4567` |
| `STATE_CODE` | US state | `TX`, `CA` |
| `ZIP` | ZIP code | `12345`, `12345-6789` |

### Date/Time Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `DATE_ISO` | ISO 8601 | `2026-01-17` |
| `DATE` | Various formats | `01/17/2026`, `Jan 17, 2026` |

### Name Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `NAME_FULL` | Full name | `Smith, John` or `John Smith` |
| `NAME_FIRST` | First name | `John` |
| `NAME_LAST` | Last name | `O'Connor-Smith` |

### Other Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `CURRENCY` | Money amounts | `$1,234.56` |
| `PERCENTAGE` | Percentages | `75%` |
| `BOOLEAN` | Boolean values | `yes`, `no`, `true`, `1` |
| `TEXT_SHORT` | Short text (<50 chars) | `Active` |
| `TEXT_LONG` | Long text (>=50 chars) | Notes, descriptions |

---

## Configuration Reference

All thresholds are configurable - no hardcoded values:

### Pattern Detector Config

```typescript
import { PatternDetector } from './services/migration-engine';

const detector = new PatternDetector({
  sampleSize: 100,           // Values to analyze per column (default: 100)
  storedSampleCount: 5,      // Sample values to store in DNA (default: 5)
  textLengthThreshold: 50,   // Chars to distinguish SHORT vs LONG (default: 50)
});
```

### DNA Generator Config

```typescript
import { DataDNAGenerator } from './services/migration-engine';

const generator = new DataDNAGenerator({
  similarityThreshold: 0.7,  // Min similarity for "similar" (default: 0.7)
  maxSimilarMigrations: 5,   // Max similar migrations to return (default: 5)
});
```

### Mapping Intelligence Config

```typescript
import { MappingIntelligence } from './services/migration-engine';

const intelligence = new MappingIntelligence(supabase, 'org-123', {
  minimumCandidateScore: 0.2,      // Min score to consider (default: 0.2)
  patternMatchWeight: 0.3,         // Weight for pattern matching (default: 0.3)
  nameSimilarityWeight: 0.4,       // Weight for name similarity (default: 0.4)
  nameSimilarityThreshold: 0.5,    // Min name similarity (default: 0.5)
  synonymMatchWeight: 0.25,        // Weight for synonym matches (default: 0.25)
  nameContainsWeight: 0.1,         // Weight for partial matches (default: 0.1)
  learnedMappingBaseConfidence: 0.5, // Base for learned mappings (default: 0.5)
  learnedMappingMaxBonus: 0.5,     // Max bonus from learning (default: 0.5)
  maxAlternativeMappings: 3,       // Alternative suggestions (default: 3)
  maxAIConfidence: 0.95,           // Cap on AI confidence (default: 0.95)
});
```

### AI Config

```typescript
intelligence.setAIConfig({
  enabled: true,                    // Enable AI assistance (default: true)
  confidenceThreshold: 0.6,         // Below this, ask AI (default: 0.6)
  apiEndpoint: '/api/anthropic-chats', // AI endpoint (default)
  maxTokens: 2000,                  // Max tokens per request (default: 2000)
  cacheResponses: true,             // Cache AI responses (default: true)
});
```

### Full Engine Config

```typescript
import { IntelligentMigrationService, createConfig } from './services/migration-engine';

const config = createConfig({
  patternDetector: { sampleSize: 200 },
  dnaGenerator: { similarityThreshold: 0.8 },
  mappingIntelligence: { maxAlternativeMappings: 5 },
  migrationService: { defaultBatchSize: 500 },
  ai: { enabled: false },
});

const service = new IntelligentMigrationService(supabase, 'org-123', config);
```

---

## API Reference

### IntelligentMigrationService

The main orchestration class:

```typescript
class IntelligentMigrationService {
  constructor(
    supabase: SupabaseClient,
    organizationId: string,
    config?: DeepPartial<MigrationEngineConfig>
  );

  // Analyze source data and generate DNA
  analyzeSource(
    sourceType: SourceType,
    columns: string[],
    sampleData: Record<string, unknown>[]
  ): Promise<SourceAnalysisResult>;

  // Get mapping suggestions for a DNA fingerprint
  suggestMappings(dna: SourceDNA): Promise<MappingSuggestion[]>;

  // Find similar past migrations
  findSimilarMigrations(dna: SourceDNA): Promise<SimilarMigration[]>;

  // Execute migration with confirmed mappings
  executeMigration(
    dna: SourceDNA,
    mappings: ConfirmedMapping[],
    data: Record<string, unknown>[],
    options?: MigrationOptions
  ): Promise<MigrationExecutionResult>;

  // Learn from migration results
  learnFromResults(
    dna: SourceDNA,
    results: MigrationResult[]
  ): Promise<void>;
}
```

### PatternDetector

```typescript
class PatternDetector {
  constructor(config?: Partial<PatternDetectorConfig>);

  // Detect patterns in a single value
  detectValuePattern(value: string): DataPattern[];

  // Analyze a full column
  analyzeColumn(columnName: string, values: unknown[]): ColumnDNA;

  // Validate NPI using Luhn algorithm
  validateNPI(npi: string): boolean;

  // Normalize column name for matching
  normalizeColumnName(name: string): string;

  // Get/set configuration
  getConfig(): PatternDetectorConfig;
  setConfig(config: Partial<PatternDetectorConfig>): void;
}

// Static helper (no instantiation needed)
const PatternDetectorStatic = {
  detectValuePattern(value: string): DataPattern[];
  validateNPI(npi: string): boolean;
  normalizeColumnName(name: string): string;
};
```

### DataDNAGenerator

```typescript
class DataDNAGenerator {
  constructor(config?: Partial<DataDNAGeneratorConfig>);

  // Generate DNA fingerprint for dataset
  generateDNA(
    sourceType: SourceType,
    columns: string[],
    sampleData: Record<string, unknown>[],
    sourceSystem?: string
  ): SourceDNA;

  // Calculate similarity between two DNAs (0.0 - 1.0)
  calculateSimilarity(dna1: SourceDNA, dna2: SourceDNA): number;

  // Get/set configuration
  getConfig(): DataDNAGeneratorConfig;
  setConfig(config: Partial<DataDNAGeneratorConfig>): void;
  getSimilarityThreshold(): number;
}

// Static helper
const DataDNAGeneratorStatic = {
  generateDNA(...): SourceDNA;
  calculateSimilarity(dna1: SourceDNA, dna2: SourceDNA): number;
};
```

### MappingIntelligence

```typescript
class MappingIntelligence {
  constructor(
    supabase: SupabaseClient,
    organizationId: string,
    config?: Partial<MappingIntelligenceConfig>
  );

  // Get mapping suggestions for DNA
  suggestMappings(dna: SourceDNA): Promise<MappingSuggestion[]>;

  // Find similar past migrations
  findSimilarMigrations(dna: SourceDNA): Promise<SimilarMigration[]>;

  // Learn from migration results
  learnFromResults(dna: SourceDNA, results: MigrationResult[]): Promise<void>;

  // Configuration
  getConfig(): MappingIntelligenceConfig;
  setConfig(config: Partial<MappingIntelligenceConfig>): void;
  getAIConfig(): AIAssistConfig;
  setAIConfig(config: Partial<AIAssistConfig>): void;
  clearAICache(): void;
}
```

---

## AI-Assisted Mapping

When pattern matching and learned mappings produce low confidence, the engine falls back to Claude AI:

### How It Works

1. **Confidence threshold**: If best match confidence < 0.6, AI is consulted
2. **Context provided**: Column name, sample values, detected patterns, target schema
3. **AI suggests**: Target table, target column, confidence, reasoning
4. **Confidence capped**: AI confidence capped at 0.95 (never 100% certain)
5. **Response cached**: Same column patterns reuse cached AI responses

### AI Prompt Structure

```typescript
// The engine sends context like:
{
  columnName: 'provider_given_name',
  normalizedName: 'provider_given_name',
  sampleValues: ['John', 'Jane', 'Robert', 'Maria', 'David'],
  detectedPatterns: ['NAME_FIRST'],
  targetSchema: { /* WellFit table definitions */ }
}

// AI responds:
{
  suggestedTable: 'hc_staff',
  suggestedColumn: 'first_name',
  confidence: 0.85,
  reasoning: 'Column name contains "given_name" which is a synonym for first_name, and sample values are typical first names'
}
```

### Disabling AI

```typescript
const service = new IntelligentMigrationService(supabase, 'org-123', {
  ai: { enabled: false }
});

// Or at runtime:
service.getMappingIntelligence().setAIConfig({ enabled: false });
```

---

## Learning System

The engine learns from each migration to improve future suggestions.

### What Gets Learned

| Data | Purpose |
|------|---------|
| Source column pattern | Match future columns with same pattern |
| Successful target mapping | Increase confidence for this mapping |
| User corrections | Decrease confidence for wrong suggestions |
| Transformation applied | Remember format conversions needed |

### Learning Flow

```
Migration Completed
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ For each mapping:                                       │
│ ├─ If user accepted → Increase mapping confidence       │
│ ├─ If user corrected → Decrease wrong, learn correct    │
│ └─ Store column pattern → target mapping association    │
└─────────────────────────────────────────────────────────┘
       │
       ▼
Next Migration: Similar patterns get higher confidence
```

### Database Tables

```sql
-- Learned mappings storage
CREATE TABLE migration_learned_mappings (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  source_pattern TEXT,           -- e.g., 'EMAIL'
  source_column_normalized TEXT, -- e.g., 'email_address'
  target_table TEXT,             -- e.g., 'hc_staff'
  target_column TEXT,            -- e.g., 'email'
  confidence DECIMAL(3,2),       -- 0.00 - 1.00
  times_used INTEGER,
  times_succeeded INTEGER,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

---

## Enterprise Features

The `EnterpriseMigrationService` extends the base engine with:

### 1. Data Lineage Tracking

Full audit trail from source to target:

```typescript
interface LineageRecord {
  lineageId: string;
  sourceFileName: string;
  sourceRowNumber: number;
  sourceColumnName: string;
  sourceValueHash: string;       // SHA-256 of original
  transformations: TransformationStep[];
  targetTable: string;
  targetColumn: string;
  targetRowId: string;
  targetValueHash: string;       // SHA-256 of result
  validationPassed: boolean;
}
```

### 2. Rollback Capability

Point-in-time snapshots for recovery:

```typescript
// Create snapshot before migration
const snapshotId = await enterpriseService.createSnapshot('hc_staff');

// Execute migration
await enterpriseService.migrate(data);

// If something goes wrong, rollback
await enterpriseService.rollbackToSnapshot(snapshotId);
```

### 3. Delta/Incremental Sync

Only sync changed records:

```typescript
await enterpriseService.incrementalSync({
  sourceTable: 'legacy_staff',
  targetTable: 'hc_staff',
  changeDetection: 'timestamp',  // or 'hash'
  lastSyncTime: previousSync.completedAt,
});
```

### 4. Fuzzy Deduplication

Find and merge duplicate records:

```typescript
const duplicates = await enterpriseService.findDuplicates('hc_staff', {
  matchFields: ['first_name', 'last_name', 'date_of_birth'],
  algorithm: 'soundex',  // or 'levenshtein'
  threshold: 0.85,
});
```

### 5. Data Quality Scoring

Post-migration quality reports:

```typescript
const quality = await enterpriseService.assessQuality('hc_staff');
// {
//   overallScore: 0.94,
//   grade: 'A',
//   completeness: 0.98,
//   accuracy: 0.92,
//   consistency: 0.95,
//   issues: [{ field: 'phone', issue: '3% invalid format' }]
// }
```

---

## Examples

### Example 1: Simple CSV Migration

```typescript
import { IntelligentMigrationService, DataDNAGeneratorStatic } from './services/migration-engine';

// Parse CSV (using any CSV library)
const csvData = parseCSV(fileContents);
const columns = Object.keys(csvData[0]);

// Generate DNA
const dna = DataDNAGeneratorStatic.generateDNA('CSV', columns, csvData);

// Get suggestions
const service = new IntelligentMigrationService(supabase, organizationId);
const suggestions = await service.suggestMappings(dna);

// Show to user for approval...
const confirmed = await showMappingUI(suggestions);

// Execute
const result = await service.executeMigration(dna, confirmed, csvData);

console.log(`Migrated ${result.recordsSucceeded} of ${result.recordsAttempted} records`);
```

### Example 2: Finding Similar Past Migrations

```typescript
// New hospital uploads their staff data
const newDNA = DataDNAGeneratorStatic.generateDNA('CSV', columns, data);

// Find similar past migrations (e.g., other Epic exports)
const similar = await service.findSimilarMigrations(newDNA);

if (similar.length > 0) {
  console.log(`Found ${similar.length} similar past migrations:`);
  similar.forEach(s => {
    console.log(`  - ${s.sourceSystem || 'Unknown'}: ${(s.similarity * 100).toFixed(0)}% similar`);
  });

  // Use mappings from most similar migration as starting point
  const suggestions = await service.suggestMappings(newDNA);
  // Suggestions will have higher confidence due to learned mappings
}
```

### Example 3: Validating Healthcare Identifiers

```typescript
import { PatternDetectorStatic } from './services/migration-engine';

// Validate NPIs before migration
const invalidNPIs = staffData.filter(staff =>
  staff.npi && !PatternDetectorStatic.validateNPI(staff.npi)
);

if (invalidNPIs.length > 0) {
  console.error(`Found ${invalidNPIs.length} invalid NPIs:`);
  invalidNPIs.forEach(s => console.error(`  - ${s.name}: ${s.npi}`));
}
```

### Example 4: Custom Configuration

```typescript
import { IntelligentMigrationService, createConfig } from './services/migration-engine';

// Strict configuration for high-stakes migration
const strictConfig = createConfig({
  mappingIntelligence: {
    minimumCandidateScore: 0.5,      // Higher threshold
    maxAIConfidence: 0.8,            // Don't trust AI too much
  },
  migrationService: {
    defaultBatchSize: 50,            // Smaller batches
  },
  ai: {
    enabled: true,
    confidenceThreshold: 0.8,        // Only use AI for very uncertain
  },
});

const service = new IntelligentMigrationService(supabase, orgId, strictConfig);
```

---

## Test Coverage

The migration engine has comprehensive test coverage:

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| PatternDetector.test.ts | 58 | Pattern detection, NPI validation |
| DataDNAGenerator.test.ts | 30 | DNA generation, similarity |
| MappingIntelligence.test.ts | 25 | Suggestions, AI, learning |
| IntelligentMigrationService.test.ts | 26 | Full integration |
| **Total** | **139** | All core functionality |

Run tests:

```bash
npm test -- --run src/services/migration-engine/__tests__/
```

---

## Related Documentation

- [Epic Integration Guide](./EPIC_INTEGRATION_GUIDE.md) - Connecting to Epic FHIR
- [FHIR Implementation](./FHIR_IMPLEMENTATION_COMPLETE.md) - FHIR R4 compliance
- [Data Handling](./DATA_HANDLING.md) - PHI and data security
- [HIPAA Compliance](./HIPAA_COMPLIANCE.md) - Regulatory requirements

---

## Support

For issues or questions:
- GitHub: https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete/issues
- Contact: info@thewellfitcommunity.org
