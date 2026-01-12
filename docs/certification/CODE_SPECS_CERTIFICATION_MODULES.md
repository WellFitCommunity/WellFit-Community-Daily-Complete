# Code Specifications: ONC Certification Modules

**Purpose:** Technical specifications for the 4 modules needed for ONC certification
**Estimated Total Effort:** 10-12 weeks
**Author:** Claude Code Assessment
**Date:** January 12, 2026

---

## Module 1: Electronic Clinical Quality Measures (eCQM)

**ONC Criteria:** 170.315(c)(1), (c)(2), (c)(3)
**Effort:** 3-4 weeks
**Purpose:** Calculate clinical quality measures and export in QRDA format for CMS reporting

### 1.1 Database Schema

```sql
-- Migration: XXXXXX_clinical_quality_measures.sql

-- Store measure definitions (CMS publishes these annually)
CREATE TABLE ecqm_measure_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measure_id VARCHAR(20) NOT NULL UNIQUE,  -- e.g., 'CMS122v12'
    cms_id VARCHAR(20) NOT NULL,              -- e.g., 'CMS122'
    version VARCHAR(10) NOT NULL,             -- e.g., 'v12'
    title TEXT NOT NULL,
    description TEXT,
    measure_type VARCHAR(50) NOT NULL,        -- 'proportion', 'ratio', 'continuous_variable'
    numerator_description TEXT,
    denominator_description TEXT,
    cql_library_name VARCHAR(100),            -- Reference to CQL library
    cql_library_version VARCHAR(20),
    value_sets JSONB,                         -- Required value sets (OIDs)
    reporting_period_start DATE,
    reporting_period_end DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store calculation results per patient per measure
CREATE TABLE ecqm_patient_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    measure_id VARCHAR(20) NOT NULL REFERENCES ecqm_measure_definitions(measure_id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,

    -- Population membership
    initial_population BOOLEAN DEFAULT false,
    denominator BOOLEAN DEFAULT false,
    denominator_exclusion BOOLEAN DEFAULT false,
    denominator_exception BOOLEAN DEFAULT false,
    numerator BOOLEAN DEFAULT false,
    numerator_exclusion BOOLEAN DEFAULT false,

    -- For continuous variable measures
    measure_observation DECIMAL(10,4),

    -- Audit trail
    calculation_datetime TIMESTAMPTZ DEFAULT NOW(),
    cql_engine_version VARCHAR(20),
    data_elements_used JSONB,                 -- Which data contributed to result

    UNIQUE(tenant_id, measure_id, patient_id, reporting_period_start)
);

-- Store aggregate results for reporting
CREATE TABLE ecqm_aggregate_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    measure_id VARCHAR(20) NOT NULL,
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,

    initial_population_count INTEGER DEFAULT 0,
    denominator_count INTEGER DEFAULT 0,
    denominator_exclusion_count INTEGER DEFAULT 0,
    denominator_exception_count INTEGER DEFAULT 0,
    numerator_count INTEGER DEFAULT 0,
    numerator_exclusion_count INTEGER DEFAULT 0,

    performance_rate DECIMAL(5,4),            -- numerator / (denominator - exclusions - exceptions)

    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    exported_qrda3_at TIMESTAMPTZ,
    submitted_to_cms_at TIMESTAMPTZ,

    UNIQUE(tenant_id, measure_id, reporting_period_start)
);

-- Track QRDA exports
CREATE TABLE ecqm_qrda_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    export_type VARCHAR(10) NOT NULL,         -- 'QRDA_I' or 'QRDA_III'
    measure_ids TEXT[],                       -- Which measures included
    patient_id UUID,                          -- For QRDA I only
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,
    file_path TEXT,                           -- Storage location
    file_hash VARCHAR(64),                    -- SHA-256 for integrity
    validation_status VARCHAR(20),            -- 'pending', 'valid', 'invalid'
    validation_errors JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_ecqm_patient_results_tenant_measure
    ON ecqm_patient_results(tenant_id, measure_id);
CREATE INDEX idx_ecqm_patient_results_patient
    ON ecqm_patient_results(patient_id);
CREATE INDEX idx_ecqm_aggregate_tenant_period
    ON ecqm_aggregate_results(tenant_id, reporting_period_start);
```

### 1.2 Service Layer

```typescript
// src/services/qualityMeasures/ecqmCalculationService.ts

import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { supabase } from '@/lib/supabase';

// Types
interface ECQMResult {
  measureId: string;
  patientId: string;
  initialPopulation: boolean;
  denominator: boolean;
  denominatorExclusion: boolean;
  denominatorException: boolean;
  numerator: boolean;
  numeratorExclusion: boolean;
  measureObservation?: number;
}

interface ECQMAggregateResult {
  measureId: string;
  initialPopulationCount: number;
  denominatorCount: number;
  denominatorExclusionCount: number;
  denominatorExceptionCount: number;
  numeratorCount: number;
  performanceRate: number;
}

interface CalculationOptions {
  tenantId: string;
  measureIds: string[];
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  patientIds?: string[];  // If not provided, calculate for all patients
}

// CQL Engine Integration
// Option 1: Use cql-execution (JavaScript library)
// npm install cql-execution cql-exec-fhir cql-exec-vsac
import { Library, Executor, Repository } from 'cql-execution';
import { PatientSource } from 'cql-exec-fhir';

export async function calculateMeasure(
  options: CalculationOptions
): Promise<ServiceResult<ECQMResult[]>> {
  const { tenantId, measureIds, reportingPeriodStart, reportingPeriodEnd, patientIds } = options;

  await auditLogger.info('ECQM_CALCULATION_START', {
    tenantId,
    measureIds,
    reportingPeriodStart,
    reportingPeriodEnd,
    patientCount: patientIds?.length || 'all'
  });

  try {
    const results: ECQMResult[] = [];

    for (const measureId of measureIds) {
      // 1. Load measure definition and CQL
      const { data: measureDef, error: measureError } = await supabase
        .from('ecqm_measure_definitions')
        .select('*')
        .eq('measure_id', measureId)
        .single();

      if (measureError || !measureDef) {
        return failure('MEASURE_NOT_FOUND', `Measure ${measureId} not found`);
      }

      // 2. Load CQL library
      const cqlLibrary = await loadCQLLibrary(measureDef.cql_library_name, measureDef.cql_library_version);

      // 3. Load value sets from VSAC (or local cache)
      const valueSets = await loadValueSets(measureDef.value_sets);

      // 4. Get patients to evaluate
      const patients = await getPatientsFHIR(tenantId, patientIds);

      // 5. Execute CQL for each patient
      const repository = new Repository({ [measureDef.cql_library_name]: cqlLibrary });
      const library = new Library(cqlLibrary, repository);

      for (const patient of patients) {
        const patientSource = new PatientSource([patient]);
        const executor = new Executor(library, valueSets, patientSource);

        const cqlResult = await executor.exec({
          Parameters: {
            'Measurement Period': {
              start: reportingPeriodStart,
              end: reportingPeriodEnd
            }
          }
        });

        const patientResult: ECQMResult = {
          measureId,
          patientId: patient.id,
          initialPopulation: cqlResult['Initial Population'] === true,
          denominator: cqlResult['Denominator'] === true,
          denominatorExclusion: cqlResult['Denominator Exclusion'] === true,
          denominatorException: cqlResult['Denominator Exception'] === true,
          numerator: cqlResult['Numerator'] === true,
          numeratorExclusion: cqlResult['Numerator Exclusion'] === true,
          measureObservation: cqlResult['Measure Observation']
        };

        results.push(patientResult);

        // Save to database
        await supabase.from('ecqm_patient_results').upsert({
          tenant_id: tenantId,
          measure_id: measureId,
          patient_id: patient.id,
          reporting_period_start: reportingPeriodStart,
          reporting_period_end: reportingPeriodEnd,
          initial_population: patientResult.initialPopulation,
          denominator: patientResult.denominator,
          denominator_exclusion: patientResult.denominatorExclusion,
          denominator_exception: patientResult.denominatorException,
          numerator: patientResult.numerator,
          numerator_exclusion: patientResult.numeratorExclusion,
          measure_observation: patientResult.measureObservation,
          cql_engine_version: '3.0.0'
        }, {
          onConflict: 'tenant_id,measure_id,patient_id,reporting_period_start'
        });
      }
    }

    await auditLogger.info('ECQM_CALCULATION_COMPLETE', {
      tenantId,
      measureIds,
      resultCount: results.length
    });

    return success(results);

  } catch (err: unknown) {
    await auditLogger.error('ECQM_CALCULATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, measureIds }
    );
    return failure('CALCULATION_ERROR', 'Failed to calculate measures');
  }
}

export async function calculateAggregates(
  tenantId: string,
  measureId: string,
  reportingPeriodStart: Date,
  reportingPeriodEnd: Date
): Promise<ServiceResult<ECQMAggregateResult>> {
  try {
    const { data, error } = await supabase
      .from('ecqm_patient_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('measure_id', measureId)
      .eq('reporting_period_start', reportingPeriodStart);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const results = data || [];

    const aggregate: ECQMAggregateResult = {
      measureId,
      initialPopulationCount: results.filter(r => r.initial_population).length,
      denominatorCount: results.filter(r => r.denominator).length,
      denominatorExclusionCount: results.filter(r => r.denominator_exclusion).length,
      denominatorExceptionCount: results.filter(r => r.denominator_exception).length,
      numeratorCount: results.filter(r => r.numerator).length,
      performanceRate: 0
    };

    // Calculate performance rate
    const eligibleDenominator = aggregate.denominatorCount
      - aggregate.denominatorExclusionCount
      - aggregate.denominatorExceptionCount;

    if (eligibleDenominator > 0) {
      aggregate.performanceRate = aggregate.numeratorCount / eligibleDenominator;
    }

    // Save aggregate
    await supabase.from('ecqm_aggregate_results').upsert({
      tenant_id: tenantId,
      measure_id: measureId,
      reporting_period_start: reportingPeriodStart,
      reporting_period_end: reportingPeriodEnd,
      initial_population_count: aggregate.initialPopulationCount,
      denominator_count: aggregate.denominatorCount,
      denominator_exclusion_count: aggregate.denominatorExclusionCount,
      denominator_exception_count: aggregate.denominatorExceptionCount,
      numerator_count: aggregate.numeratorCount,
      performance_rate: aggregate.performanceRate
    }, {
      onConflict: 'tenant_id,measure_id,reporting_period_start'
    });

    return success(aggregate);

  } catch (err: unknown) {
    await auditLogger.error('ECQM_AGGREGATE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, measureId }
    );
    return failure('AGGREGATION_ERROR', 'Failed to calculate aggregates');
  }
}

// Helper functions
async function loadCQLLibrary(name: string, version: string): Promise<unknown> {
  // Load from local storage or fetch from measure repository
  // CQL libraries are JSON format (ELM - Expression Logical Model)
  const { data } = await supabase.storage
    .from('cql-libraries')
    .download(`${name}-${version}.json`);

  if (data) {
    const text = await data.text();
    return JSON.parse(text);
  }

  throw new Error(`CQL library ${name} v${version} not found`);
}

async function loadValueSets(valueSetOids: Record<string, string>): Promise<unknown> {
  // Load value sets from VSAC cache or API
  // In production, you'd cache these locally and refresh periodically
  // VSAC API: https://vsac.nlm.nih.gov/
  return {};  // Implement VSAC integration
}

async function getPatientsFHIR(tenantId: string, patientIds?: string[]): Promise<unknown[]> {
  // Convert patients to FHIR format for CQL engine
  // Use your existing FHIR services
  return [];  // Implement using existing FHIR patient service
}
```

### 1.3 QRDA Export Service

```typescript
// src/services/qualityMeasures/qrdaExportService.ts

import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { supabase } from '@/lib/supabase';
import { create } from 'xmlbuilder2';

interface QRDAExportOptions {
  tenantId: string;
  measureIds: string[];
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  exportType: 'QRDA_I' | 'QRDA_III';
  patientId?: string;  // Required for QRDA I
}

// QRDA Category I - Patient-level export
export async function exportQRDAI(
  options: QRDAExportOptions & { patientId: string }
): Promise<ServiceResult<string>> {
  const { tenantId, patientId, measureIds, reportingPeriodStart, reportingPeriodEnd } = options;

  try {
    // Get patient data
    const patient = await getPatientData(tenantId, patientId);

    // Get measure results for this patient
    const { data: results } = await supabase
      .from('ecqm_patient_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('patient_id', patientId)
      .in('measure_id', measureIds)
      .eq('reporting_period_start', reportingPeriodStart);

    // Build QRDA I XML
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('ClinicalDocument', {
        'xmlns': 'urn:hl7-org:v3',
        'xmlns:sdtc': 'urn:hl7-org:sdtc',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
      })
        .ele('realmCode', { code: 'US' }).up()
        .ele('typeId', { root: '2.16.840.1.113883.1.3', extension: 'POCD_HD000040' }).up()
        // QRDA I template ID
        .ele('templateId', { root: '2.16.840.1.113883.10.20.24.1.1', extension: '2017-08-01' }).up()
        .ele('templateId', { root: '2.16.840.1.113883.10.20.24.1.2', extension: '2019-12-01' }).up()

        // Document ID
        .ele('id', { root: generateUUID() }).up()

        // Document type
        .ele('code', {
          code: '55182-0',
          codeSystem: '2.16.840.1.113883.6.1',
          displayName: 'Quality Measure Report'
        }).up()

        // Title
        .ele('title').txt('QRDA Category I Report').up()

        // Effective time
        .ele('effectiveTime', { value: formatHL7Date(new Date()) }).up()

        // Patient (recordTarget)
        .ele('recordTarget')
          .ele('patientRole')
            .ele('id', { root: '2.16.840.1.113883.4.572', extension: patient.mrn }).up()
            .ele('patient')
              .ele('name')
                .ele('given').txt(patient.firstName).up()
                .ele('family').txt(patient.lastName).up()
              .up()
              .ele('administrativeGenderCode', {
                code: patient.gender,
                codeSystem: '2.16.840.1.113883.5.1'
              }).up()
              .ele('birthTime', { value: formatHL7Date(patient.birthDate) }).up()
            .up()
          .up()
        .up();

    // Add measure sections
    for (const result of results || []) {
      addMeasureSection(doc, result);
    }

    // Add clinical data sections (encounters, diagnoses, medications, etc.)
    await addClinicalDataSections(doc, tenantId, patientId, reportingPeriodStart, reportingPeriodEnd);

    const xml = doc.end({ prettyPrint: true });

    // Store export
    const exportId = generateUUID();
    await supabase.from('ecqm_qrda_exports').insert({
      id: exportId,
      tenant_id: tenantId,
      export_type: 'QRDA_I',
      measure_ids: measureIds,
      patient_id: patientId,
      reporting_period_start: reportingPeriodStart,
      reporting_period_end: reportingPeriodEnd,
      validation_status: 'pending'
    });

    // Store XML file
    await supabase.storage
      .from('qrda-exports')
      .upload(`${tenantId}/${exportId}.xml`, xml);

    await auditLogger.info('QRDA_I_EXPORT_COMPLETE', {
      tenantId,
      patientId,
      exportId
    });

    return success(xml);

  } catch (err: unknown) {
    await auditLogger.error('QRDA_I_EXPORT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId }
    );
    return failure('EXPORT_ERROR', 'Failed to generate QRDA I');
  }
}

// QRDA Category III - Aggregate export
export async function exportQRDAIII(
  options: QRDAExportOptions
): Promise<ServiceResult<string>> {
  const { tenantId, measureIds, reportingPeriodStart, reportingPeriodEnd } = options;

  try {
    // Get aggregate results
    const { data: aggregates } = await supabase
      .from('ecqm_aggregate_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('measure_id', measureIds)
      .eq('reporting_period_start', reportingPeriodStart);

    // Get organization info
    const org = await getOrganizationData(tenantId);

    // Build QRDA III XML
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('ClinicalDocument', {
        'xmlns': 'urn:hl7-org:v3',
        'xmlns:sdtc': 'urn:hl7-org:sdtc'
      })
        .ele('realmCode', { code: 'US' }).up()
        .ele('typeId', { root: '2.16.840.1.113883.1.3', extension: 'POCD_HD000040' }).up()
        // QRDA III template ID
        .ele('templateId', { root: '2.16.840.1.113883.10.20.27.1.1', extension: '2017-06-01' }).up()

        .ele('id', { root: generateUUID() }).up()
        .ele('code', {
          code: '55184-6',
          codeSystem: '2.16.840.1.113883.6.1',
          displayName: 'Quality Measure Report'
        }).up()
        .ele('title').txt('QRDA Category III Report').up()
        .ele('effectiveTime', { value: formatHL7Date(new Date()) }).up()

        // Reporting organization (custodian)
        .ele('custodian')
          .ele('assignedCustodian')
            .ele('representedCustodianOrganization')
              .ele('id', { root: '2.16.840.1.113883.4.336', extension: org.npi }).up()
              .ele('name').txt(org.name).up()
            .up()
          .up()
        .up()

        // Reporting period
        .ele('documentationOf')
          .ele('serviceEvent', { classCode: 'PCPR' })
            .ele('effectiveTime')
              .ele('low', { value: formatHL7Date(reportingPeriodStart) }).up()
              .ele('high', { value: formatHL7Date(reportingPeriodEnd) }).up()
            .up()
          .up()
        .up()

        // Component with measure results
        .ele('component')
          .ele('structuredBody');

    // Add measure sections with aggregate data
    for (const aggregate of aggregates || []) {
      addAggregateMeasureSection(doc, aggregate);
    }

    const xml = doc.end({ prettyPrint: true });

    // Store export
    const exportId = generateUUID();
    await supabase.from('ecqm_qrda_exports').insert({
      id: exportId,
      tenant_id: tenantId,
      export_type: 'QRDA_III',
      measure_ids: measureIds,
      reporting_period_start: reportingPeriodStart,
      reporting_period_end: reportingPeriodEnd,
      validation_status: 'pending'
    });

    await supabase.storage
      .from('qrda-exports')
      .upload(`${tenantId}/${exportId}.xml`, xml);

    await auditLogger.info('QRDA_III_EXPORT_COMPLETE', {
      tenantId,
      exportId,
      measureCount: measureIds.length
    });

    return success(xml);

  } catch (err: unknown) {
    await auditLogger.error('QRDA_III_EXPORT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('EXPORT_ERROR', 'Failed to generate QRDA III');
  }
}

// Helper functions
function generateUUID(): string {
  return crypto.randomUUID();
}

function formatHL7Date(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0];
}

function addMeasureSection(doc: unknown, result: unknown): void {
  // Add measure-specific XML section
}

function addAggregateMeasureSection(doc: unknown, aggregate: unknown): void {
  // Add aggregate measure section with counts
}

async function addClinicalDataSections(
  doc: unknown,
  tenantId: string,
  patientId: string,
  start: Date,
  end: Date
): Promise<void> {
  // Add encounters, diagnoses, medications, procedures, etc.
  // Use existing FHIR services to get data
}

async function getPatientData(tenantId: string, patientId: string): Promise<unknown> {
  // Get patient demographics
  return {};
}

async function getOrganizationData(tenantId: string): Promise<unknown> {
  // Get organization info
  return {};
}
```

### 1.4 Edge Function

```typescript
// supabase/functions/ecqm-calculate/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const { tenantId, measureIds, reportingPeriodStart, reportingPeriodEnd, patientIds } = await req.json();

    // Validate inputs
    if (!tenantId || !measureIds || !reportingPeriodStart || !reportingPeriodEnd) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Calculate measures (call service logic)
    // In production, this would be more sophisticated
    const results = await calculateMeasures({
      tenantId,
      measureIds,
      reportingPeriodStart: new Date(reportingPeriodStart),
      reportingPeriodEnd: new Date(reportingPeriodEnd),
      patientIds
    });

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('eCQM calculation error:', err);
    return new Response(
      JSON.stringify({ error: 'Calculation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### 1.5 Dashboard Component

```tsx
// src/components/admin/ECQMDashboard.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Download, RefreshCw, TrendingUp, Users } from 'lucide-react';

interface MeasureResult {
  measureId: string;
  title: string;
  performanceRate: number;
  numerator: number;
  denominator: number;
  trend: 'up' | 'down' | 'stable';
}

export const ECQMDashboard: React.FC = () => {
  const { tenant } = useAuth();
  const [measures, setMeasures] = useState<MeasureResult[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('2026-Q1');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (tenant?.id) {
      loadMeasureResults();
    }
  }, [tenant?.id, selectedPeriod]);

  const loadMeasureResults = async () => {
    const [year, quarter] = selectedPeriod.split('-');
    const startMonth = (parseInt(quarter.replace('Q', '')) - 1) * 3;
    const start = new Date(parseInt(year), startMonth, 1);
    const end = new Date(parseInt(year), startMonth + 3, 0);

    const { data } = await supabase
      .from('ecqm_aggregate_results')
      .select(`
        *,
        ecqm_measure_definitions(title)
      `)
      .eq('tenant_id', tenant?.id)
      .gte('reporting_period_start', start.toISOString())
      .lte('reporting_period_end', end.toISOString());

    if (data) {
      setMeasures(data.map(d => ({
        measureId: d.measure_id,
        title: d.ecqm_measure_definitions?.title || d.measure_id,
        performanceRate: d.performance_rate * 100,
        numerator: d.numerator_count,
        denominator: d.denominator_count - d.denominator_exclusion_count - d.denominator_exception_count,
        trend: 'stable'
      })));
    }
  };

  const handleRecalculate = async () => {
    setIsCalculating(true);
    try {
      const response = await fetch('/api/ecqm-calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant?.id,
          measureIds: measures.map(m => m.measureId),
          reportingPeriodStart: getQuarterStart(selectedPeriod),
          reportingPeriodEnd: getQuarterEnd(selectedPeriod)
        })
      });

      if (response.ok) {
        await loadMeasureResults();
      }
    } finally {
      setIsCalculating(false);
    }
  };

  const handleExportQRDA = async (type: 'I' | 'III') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/qrda-export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant?.id,
          exportType: `QRDA_${type}`,
          measureIds: measures.map(m => m.measureId),
          reportingPeriodStart: getQuarterStart(selectedPeriod),
          reportingPeriodEnd: getQuarterEnd(selectedPeriod)
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QRDA_${type}_${selectedPeriod}.xml`;
        a.click();
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Clinical Quality Measures</h1>
        <div className="flex gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026-Q1">2026 Q1</SelectItem>
              <SelectItem value="2025-Q4">2025 Q4</SelectItem>
              <SelectItem value="2025-Q3">2025 Q3</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleRecalculate} disabled={isCalculating}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isCalculating ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>

          <Button variant="outline" onClick={() => handleExportQRDA('III')} disabled={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            Export QRDA III
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {measures.map(measure => (
          <Card key={measure.measureId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {measure.measureId}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {measure.performanceRate.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {measure.title}
              </p>
              <Progress value={measure.performanceRate} className="h-2" />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {measure.numerator} / {measure.denominator}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {measure.trend}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {measures.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No measure results for this period. Click "Recalculate" to generate.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function getQuarterStart(period: string): string {
  const [year, quarter] = period.split('-');
  const month = (parseInt(quarter.replace('Q', '')) - 1) * 3;
  return new Date(parseInt(year), month, 1).toISOString();
}

function getQuarterEnd(period: string): string {
  const [year, quarter] = period.split('-');
  const month = parseInt(quarter.replace('Q', '')) * 3;
  return new Date(parseInt(year), month, 0).toISOString();
}

export default ECQMDashboard;
```

---

## Module 2: Syndromic Surveillance Reporting

**ONC Criteria:** 170.315(f)(2)
**Effort:** 2-3 weeks
**Purpose:** Report ED/urgent care visits to public health for disease surveillance

### 2.1 Database Schema

```sql
-- Migration: XXXXXX_syndromic_surveillance.sql

-- Track reportable encounters
CREATE TABLE syndromic_surveillance_encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    encounter_id UUID NOT NULL REFERENCES encounters(id),
    patient_id UUID NOT NULL,

    -- Visit information
    visit_type VARCHAR(20) NOT NULL,          -- 'ED', 'UC', 'IP'
    facility_id UUID REFERENCES facilities(id),
    admission_datetime TIMESTAMPTZ NOT NULL,
    discharge_datetime TIMESTAMPTZ,

    -- Chief complaint (free text, will be coded)
    chief_complaint TEXT,
    chief_complaint_code VARCHAR(20),         -- Mapped code

    -- Diagnosis
    diagnosis_codes TEXT[],                   -- ICD-10 codes

    -- Demographics for reporting
    patient_age INTEGER,
    patient_gender VARCHAR(10),
    patient_zip VARCHAR(10),
    patient_race VARCHAR(50),
    patient_ethnicity VARCHAR(50),

    -- Reporting status
    report_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'sent', 'acknowledged', 'error'
    hl7_message_id VARCHAR(50),
    sent_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track transmissions to public health
CREATE TABLE syndromic_surveillance_transmissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Destination
    destination_type VARCHAR(50) NOT NULL,    -- 'state_health_dept', 'nssp_biosense'
    destination_endpoint TEXT NOT NULL,

    -- Message details
    message_type VARCHAR(10) NOT NULL,        -- 'ADT_A01', 'ADT_A03', 'ADT_A04'
    hl7_message TEXT NOT NULL,
    message_control_id VARCHAR(50) NOT NULL,

    -- Linked encounters
    encounter_ids UUID[],

    -- Transmission status
    status VARCHAR(20) DEFAULT 'pending',     -- 'pending', 'sent', 'ack', 'nack', 'error'
    sent_at TIMESTAMPTZ,
    response_received_at TIMESTAMPTZ,
    ack_code VARCHAR(10),                     -- 'AA', 'AE', 'AR'
    error_details JSONB,

    -- Retry tracking
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration per tenant
CREATE TABLE syndromic_surveillance_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,

    -- State health department connection
    state_code VARCHAR(2) NOT NULL,
    state_endpoint TEXT,
    state_credentials JSONB,                  -- Encrypted

    -- NSSP BioSense Platform
    nssp_enabled BOOLEAN DEFAULT false,
    nssp_facility_id VARCHAR(50),
    nssp_endpoint TEXT,
    nssp_credentials JSONB,

    -- Reporting rules
    auto_report_enabled BOOLEAN DEFAULT true,
    report_delay_minutes INTEGER DEFAULT 15,  -- Buffer before sending
    include_visit_types TEXT[] DEFAULT ARRAY['ED', 'UC'],

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ss_encounters_tenant_status
    ON syndromic_surveillance_encounters(tenant_id, report_status);
CREATE INDEX idx_ss_encounters_admission
    ON syndromic_surveillance_encounters(admission_datetime);
CREATE INDEX idx_ss_transmissions_status
    ON syndromic_surveillance_transmissions(status, next_retry_at);
```

### 2.2 HL7 ADT Message Generator

```typescript
// src/services/publicHealth/hl7AdtGenerator.ts

import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';

interface ADTMessageData {
  messageType: 'A01' | 'A03' | 'A04' | 'A08';  // Admit, Discharge, Register, Update
  messageControlId: string;
  sendingFacility: {
    name: string;
    oid: string;
  };
  receivingFacility: {
    name: string;
    oid: string;
  };
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dob: Date;
    gender: 'M' | 'F' | 'U';
    race: string;
    ethnicity: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  visit: {
    visitNumber: string;
    admitDateTime: Date;
    dischargeDateTime?: Date;
    chiefComplaint: string;
    diagnoses: Array<{
      code: string;
      system: 'ICD10';
      description: string;
    }>;
    facility: {
      id: string;
      name: string;
    };
    patientClass: 'E' | 'I' | 'O';  // Emergency, Inpatient, Outpatient
  };
}

export function generateADTMessage(data: ADTMessageData): ServiceResult<string> {
  try {
    const timestamp = formatHL7Timestamp(new Date());
    const segments: string[] = [];

    // MSH - Message Header
    segments.push([
      'MSH',
      '^~\\&',                                    // Encoding characters
      data.sendingFacility.name,                 // Sending application
      data.sendingFacility.oid,                  // Sending facility
      data.receivingFacility.name,               // Receiving application
      data.receivingFacility.oid,                // Receiving facility
      timestamp,                                  // Date/time of message
      '',                                         // Security
      `ADT^${data.messageType}^ADT_${data.messageType}`,  // Message type
      data.messageControlId,                     // Message control ID
      'P',                                        // Processing ID (P=Production)
      '2.5.1',                                   // Version ID
      '',                                         // Sequence number
      '',                                         // Continuation pointer
      '',                                         // Accept ack type
      '',                                         // Application ack type
      '',                                         // Country code
      'UTF-8'                                    // Character set
    ].join('|'));

    // EVN - Event Type
    segments.push([
      'EVN',
      data.messageType,                          // Event type code
      timestamp,                                  // Recorded date/time
      '',                                         // Date/time planned event
      '',                                         // Event reason code
      '',                                         // Operator ID
      timestamp                                   // Event occurred
    ].join('|'));

    // PID - Patient Identification
    segments.push([
      'PID',
      '1',                                        // Set ID
      '',                                         // Patient ID (external)
      `${data.patient.id}^^^${data.sendingFacility.oid}^MR`,  // Patient ID (internal)
      '',                                         // Alternate patient ID
      `${data.patient.lastName}^${data.patient.firstName}`,   // Patient name
      '',                                         // Mother's maiden name
      formatHL7Date(data.patient.dob),           // Date of birth
      data.patient.gender,                        // Sex
      '',                                         // Patient alias
      mapRaceToHL7(data.patient.race),           // Race
      `${data.patient.address.street}^^${data.patient.address.city}^${data.patient.address.state}^${data.patient.address.zip}^USA`,  // Address
      '',                                         // County code
      '',                                         // Phone - home
      '',                                         // Phone - business
      '',                                         // Primary language
      '',                                         // Marital status
      '',                                         // Religion
      '',                                         // Patient account number
      '',                                         // SSN
      '',                                         // Driver's license
      '',                                         // Mother's identifier
      mapEthnicityToHL7(data.patient.ethnicity)  // Ethnic group
    ].join('|'));

    // PV1 - Patient Visit
    segments.push([
      'PV1',
      '1',                                        // Set ID
      data.visit.patientClass,                   // Patient class
      `${data.visit.facility.id}^^^${data.visit.facility.name}`,  // Assigned location
      'E',                                        // Admission type (E=Emergency)
      '',                                         // Preadmit number
      '',                                         // Prior patient location
      '',                                         // Attending doctor
      '',                                         // Referring doctor
      '',                                         // Consulting doctor
      '',                                         // Hospital service
      '',                                         // Temporary location
      '',                                         // Preadmit test indicator
      '',                                         // Re-admission indicator
      '',                                         // Admit source
      '',                                         // Ambulatory status
      '',                                         // VIP indicator
      '',                                         // Admitting doctor
      '',                                         // Patient type
      data.visit.visitNumber,                    // Visit number
      '',                                         // Financial class
      '',                                         // Charge price indicator
      '',                                         // Courtesy code
      '',                                         // Credit rating
      '',                                         // Contract code
      '',                                         // Contract effective date
      '',                                         // Contract amount
      '',                                         // Contract period
      '',                                         // Interest code
      '',                                         // Transfer to bad debt code
      '',                                         // Transfer to bad debt date
      '',                                         // Bad debt agency code
      '',                                         // Bad debt transfer amount
      '',                                         // Bad debt recovery amount
      '',                                         // Delete account indicator
      '',                                         // Delete account date
      '',                                         // Discharge disposition
      '',                                         // Discharged to location
      '',                                         // Diet type
      '',                                         // Servicing facility
      '',                                         // Bed status
      '',                                         // Account status
      '',                                         // Pending location
      '',                                         // Prior temporary location
      formatHL7Timestamp(data.visit.admitDateTime),  // Admit date/time
      data.visit.dischargeDateTime ? formatHL7Timestamp(data.visit.dischargeDateTime) : ''  // Discharge date/time
    ].join('|'));

    // PV2 - Patient Visit Additional Info (Chief Complaint)
    segments.push([
      'PV2',
      '',                                         // Prior pending location
      '',                                         // Accommodation code
      `${data.visit.chiefComplaint}`,            // Admit reason (Chief Complaint)
      '',                                         // Transfer reason
      '',                                         // Patient valuables
      '',                                         // Patient valuables location
      '',                                         // Visit user code
      '',                                         // Expected admit date/time
      '',                                         // Expected discharge date/time
      ''                                          // Estimated length of inpatient stay
    ].join('|'));

    // DG1 - Diagnosis (one segment per diagnosis)
    data.visit.diagnoses.forEach((dx, index) => {
      segments.push([
        'DG1',
        String(index + 1),                        // Set ID
        'I10',                                    // Diagnosis coding method (ICD-10)
        `${dx.code}^${dx.description}^I10`,      // Diagnosis code
        dx.description,                           // Diagnosis description
        formatHL7Timestamp(data.visit.admitDateTime),  // Diagnosis date/time
        index === 0 ? 'A' : 'F'                  // Diagnosis type (A=Admitting, F=Final)
      ].join('|'));
    });

    const message = segments.join('\r');

    return success(message);

  } catch (err: unknown) {
    return failure('HL7_GENERATION_ERROR',
      err instanceof Error ? err.message : 'Failed to generate HL7 message');
  }
}

// Helper functions
function formatHL7Timestamp(date: Date): string {
  return date.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '')
    .split('.')[0];
}

function formatHL7Date(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

function mapRaceToHL7(race: string): string {
  const raceMap: Record<string, string> = {
    'white': '2106-3^White^CDCREC',
    'black': '2054-5^Black or African American^CDCREC',
    'asian': '2028-9^Asian^CDCREC',
    'native': '1002-5^American Indian or Alaska Native^CDCREC',
    'pacific': '2076-8^Native Hawaiian or Other Pacific Islander^CDCREC',
    'other': '2131-1^Other Race^CDCREC',
    'unknown': 'UNK^Unknown^NULLFL'
  };
  return raceMap[race.toLowerCase()] || raceMap['unknown'];
}

function mapEthnicityToHL7(ethnicity: string): string {
  const ethnicityMap: Record<string, string> = {
    'hispanic': '2135-2^Hispanic or Latino^CDCREC',
    'non-hispanic': '2186-5^Not Hispanic or Latino^CDCREC',
    'unknown': 'UNK^Unknown^NULLFL'
  };
  return ethnicityMap[ethnicity.toLowerCase()] || ethnicityMap['unknown'];
}
```

### 2.3 Surveillance Service

```typescript
// src/services/publicHealth/syndromicSurveillanceService.ts

import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { supabase } from '@/lib/supabase';
import { generateADTMessage } from './hl7AdtGenerator';

interface SurveillanceConfig {
  tenantId: string;
  stateCode: string;
  stateEndpoint: string;
  nsspEnabled: boolean;
  nsspFacilityId?: string;
}

export async function reportEncounter(
  encounterId: string,
  tenantId: string
): Promise<ServiceResult<{ messageId: string }>> {
  try {
    // Get config
    const { data: config } = await supabase
      .from('syndromic_surveillance_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (!config || !config.is_active) {
      return failure('CONFIG_NOT_FOUND', 'Syndromic surveillance not configured');
    }

    // Get encounter with patient data
    const { data: encounter } = await supabase
      .from('encounters')
      .select(`
        *,
        patients(*),
        facilities(*),
        encounter_diagnoses(*)
      `)
      .eq('id', encounterId)
      .single();

    if (!encounter) {
      return failure('ENCOUNTER_NOT_FOUND', 'Encounter not found');
    }

    // Generate HL7 message
    const messageControlId = `SS${Date.now()}`;
    const messageResult = generateADTMessage({
      messageType: encounter.status === 'completed' ? 'A03' : 'A01',
      messageControlId,
      sendingFacility: {
        name: encounter.facilities?.name || 'UNKNOWN',
        oid: encounter.facilities?.oid || tenantId
      },
      receivingFacility: {
        name: getStateHealthDeptName(config.stateCode),
        oid: getStateHealthDeptOid(config.stateCode)
      },
      patient: {
        id: encounter.patients.id,
        firstName: encounter.patients.first_name,
        lastName: encounter.patients.last_name,
        dob: new Date(encounter.patients.date_of_birth),
        gender: encounter.patients.gender,
        race: encounter.patients.race || 'unknown',
        ethnicity: encounter.patients.ethnicity || 'unknown',
        address: {
          street: encounter.patients.address_line1 || '',
          city: encounter.patients.city || '',
          state: encounter.patients.state || '',
          zip: encounter.patients.zip_code || ''
        }
      },
      visit: {
        visitNumber: encounter.visit_number,
        admitDateTime: new Date(encounter.start_time),
        dischargeDateTime: encounter.end_time ? new Date(encounter.end_time) : undefined,
        chiefComplaint: encounter.chief_complaint || '',
        diagnoses: (encounter.encounter_diagnoses || []).map((dx: { icd10_code: string; description: string }) => ({
          code: dx.icd10_code,
          system: 'ICD10' as const,
          description: dx.description
        })),
        facility: {
          id: encounter.facilities?.id || '',
          name: encounter.facilities?.name || ''
        },
        patientClass: encounter.encounter_type === 'emergency' ? 'E' : 'O'
      }
    });

    if (!messageResult.success) {
      return failure('MESSAGE_GENERATION_FAILED', messageResult.error || 'Failed to generate message');
    }

    // Store transmission record
    const { data: transmission, error: txError } = await supabase
      .from('syndromic_surveillance_transmissions')
      .insert({
        tenant_id: tenantId,
        destination_type: 'state_health_dept',
        destination_endpoint: config.state_endpoint,
        message_type: `ADT_${encounter.status === 'completed' ? 'A03' : 'A01'}`,
        hl7_message: messageResult.data,
        message_control_id: messageControlId,
        encounter_ids: [encounterId],
        status: 'pending'
      })
      .select()
      .single();

    if (txError) {
      return failure('DATABASE_ERROR', txError.message);
    }

    // Send message (async - will be processed by background job)
    await queueTransmission(transmission.id);

    await auditLogger.info('SYNDROMIC_SURVEILLANCE_QUEUED', {
      tenantId,
      encounterId,
      messageControlId
    });

    return success({ messageId: messageControlId });

  } catch (err: unknown) {
    await auditLogger.error('SYNDROMIC_SURVEILLANCE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { encounterId, tenantId }
    );
    return failure('SURVEILLANCE_ERROR', 'Failed to report encounter');
  }
}

export async function processTransmissionQueue(): Promise<ServiceResult<number>> {
  try {
    // Get pending transmissions
    const { data: pending } = await supabase
      .from('syndromic_surveillance_transmissions')
      .select('*')
      .eq('status', 'pending')
      .or('next_retry_at.is.null,next_retry_at.lte.now()')
      .limit(50);

    let processed = 0;

    for (const transmission of pending || []) {
      try {
        // Get config for tenant
        const { data: config } = await supabase
          .from('syndromic_surveillance_config')
          .select('*')
          .eq('tenant_id', transmission.tenant_id)
          .single();

        if (!config) continue;

        // Send to state health department
        const response = await sendHL7Message(
          transmission.hl7_message,
          config.state_endpoint,
          config.state_credentials
        );

        // Update transmission status
        await supabase
          .from('syndromic_surveillance_transmissions')
          .update({
            status: response.ackCode === 'AA' ? 'ack' : 'nack',
            sent_at: new Date().toISOString(),
            response_received_at: new Date().toISOString(),
            ack_code: response.ackCode,
            error_details: response.errors ? { errors: response.errors } : null
          })
          .eq('id', transmission.id);

        // Update encounter status
        await supabase
          .from('syndromic_surveillance_encounters')
          .update({
            report_status: response.ackCode === 'AA' ? 'sent' : 'error',
            sent_at: new Date().toISOString(),
            error_message: response.errors?.join('; ')
          })
          .in('encounter_id', transmission.encounter_ids);

        processed++;

      } catch (err) {
        // Mark for retry
        await supabase
          .from('syndromic_surveillance_transmissions')
          .update({
            status: 'error',
            retry_count: transmission.retry_count + 1,
            next_retry_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),  // 15 min
            error_details: { error: err instanceof Error ? err.message : String(err) }
          })
          .eq('id', transmission.id);
      }
    }

    return success(processed);

  } catch (err: unknown) {
    await auditLogger.error('SURVEILLANCE_QUEUE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return failure('QUEUE_ERROR', 'Failed to process queue');
  }
}

// Placeholder for actual HTTP/MLLP transmission
async function sendHL7Message(
  message: string,
  endpoint: string,
  credentials: unknown
): Promise<{ ackCode: string; errors?: string[] }> {
  // Implementation depends on state requirements:
  // - Some use HTTPS POST
  // - Some use MLLP (Minimal Lower Layer Protocol)
  // - Some use SFTP

  // This is a placeholder - implement based on target state
  return { ackCode: 'AA' };
}

async function queueTransmission(transmissionId: string): Promise<void> {
  // Queue for background processing
  // Could use pg_cron, Supabase Edge Function scheduler, or external queue
}

function getStateHealthDeptName(stateCode: string): string {
  const names: Record<string, string> = {
    'TX': 'Texas DSHS',
    'CA': 'California DPH',
    'FL': 'Florida DOH',
    // Add more states
  };
  return names[stateCode] || `${stateCode} Health Dept`;
}

function getStateHealthDeptOid(stateCode: string): string {
  const oids: Record<string, string> = {
    'TX': '2.16.840.1.114222.4.1.214284',
    'CA': '2.16.840.1.114222.4.1.214285',
    'FL': '2.16.840.1.114222.4.1.214286',
    // Add more states - these are examples
  };
  return oids[stateCode] || '2.16.840.1.114222.4.1.999999';
}
```

---

## Module 3: Immunization Registry Reporting (IIS)

**ONC Criteria:** 170.315(f)(1)
**Effort:** 1-2 weeks
**Purpose:** Submit vaccination records to state immunization registries

### 3.1 Database Schema

```sql
-- Migration: XXXXXX_immunization_registry.sql

-- Track immunization submissions to state registries
CREATE TABLE immunization_registry_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    immunization_id UUID NOT NULL,            -- Reference to FHIR immunization
    patient_id UUID NOT NULL,

    -- Registry info
    state_code VARCHAR(2) NOT NULL,
    registry_patient_id VARCHAR(50),           -- Patient ID in state registry

    -- Message details
    message_type VARCHAR(10) NOT NULL,         -- 'VXU' (update), 'QBP' (query)
    hl7_message TEXT,
    message_control_id VARCHAR(50),

    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending',      -- 'pending', 'sent', 'ack', 'error'
    sent_at TIMESTAMPTZ,
    response_received_at TIMESTAMPTZ,
    ack_code VARCHAR(10),
    response_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store query responses from registry
CREATE TABLE immunization_registry_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL,
    state_code VARCHAR(2) NOT NULL,

    -- Query details
    queried_at TIMESTAMPTZ DEFAULT NOW(),

    -- Response data (parsed from HL7 RSP)
    immunizations JSONB,                       -- Array of immunization records

    -- Raw response
    hl7_response TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registry configuration per tenant per state
CREATE TABLE immunization_registry_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    state_code VARCHAR(2) NOT NULL,

    -- Connection details
    endpoint_url TEXT NOT NULL,
    auth_type VARCHAR(20) NOT NULL,            -- 'basic', 'certificate', 'oauth'
    credentials JSONB,                         -- Encrypted

    -- Facility identification
    facility_id VARCHAR(50) NOT NULL,          -- State-assigned facility ID
    provider_pin VARCHAR(50),                  -- Provider PIN if required

    -- Options
    auto_submit_enabled BOOLEAN DEFAULT true,
    query_enabled BOOLEAN DEFAULT false,       -- Not all states support query

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, state_code)
);

CREATE INDEX idx_imm_registry_tenant_status
    ON immunization_registry_submissions(tenant_id, status);
```

### 3.2 HL7 VXU Message Generator

```typescript
// src/services/publicHealth/hl7VxuGenerator.ts

import { ServiceResult, success, failure } from '../_base';

interface VXUMessageData {
  messageControlId: string;
  sendingFacility: {
    name: string;
    id: string;
  };
  receivingRegistry: {
    name: string;
    id: string;
  };
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    dob: Date;
    gender: 'M' | 'F' | 'U';
    motherMaidenName?: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    phone?: string;
  };
  immunization: {
    id: string;
    vaccineCode: string;           // CVX code
    vaccineName: string;
    manufacturerCode?: string;     // MVX code
    lotNumber?: string;
    expirationDate?: Date;
    administeredDate: Date;
    administeredAmount?: number;
    administeredUnits?: string;
    route?: string;                // HL7 route code
    site?: string;                 // HL7 body site code
    administeringProvider?: {
      id: string;
      firstName: string;
      lastName: string;
    };
    informationSource: 'A' | 'H';  // A=Administered, H=Historical
    refusalReason?: string;
    visDate?: Date;                // Vaccine Information Statement date
  };
}

export function generateVXUMessage(data: VXUMessageData): ServiceResult<string> {
  try {
    const timestamp = formatHL7Timestamp(new Date());
    const segments: string[] = [];

    // MSH - Message Header
    segments.push([
      'MSH',
      '^~\\&',
      data.sendingFacility.name,
      data.sendingFacility.id,
      data.receivingRegistry.name,
      data.receivingRegistry.id,
      timestamp,
      '',
      'VXU^V04^VXU_V04',                       // Unsolicited vaccination record update
      data.messageControlId,
      'P',                                      // Production
      '2.5.1',
      '',
      '',
      'NE',                                     // Never send ack (most registries)
      'NE',
      '',
      'UTF-8'
    ].join('|'));

    // PID - Patient Identification
    segments.push([
      'PID',
      '1',
      '',
      `${data.patient.id}^^^${data.sendingFacility.id}^MR`,
      '',
      `${data.patient.lastName}^${data.patient.firstName}^${data.patient.middleName || ''}`,
      data.patient.motherMaidenName || '',
      formatHL7Date(data.patient.dob),
      data.patient.gender,
      '',
      '',
      `${data.patient.address.street}^^${data.patient.address.city}^${data.patient.address.state}^${data.patient.address.zip}^USA^M`,
      '',
      data.patient.phone ? `^PRN^PH^^^${data.patient.phone}` : ''
    ].join('|'));

    // PD1 - Patient Additional Demographics
    segments.push('PD1||||||||||||N|');  // N = No publicity code

    // NK1 - Next of Kin (optional, often required for pediatric)
    // Add if data available

    // ORC - Order Control
    segments.push([
      'ORC',
      'RE',                                     // RE = Observations to follow
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      timestamp,
      '',
      '',
      data.immunization.administeringProvider
        ? `${data.immunization.administeringProvider.id}^${data.immunization.administeringProvider.lastName}^${data.immunization.administeringProvider.firstName}`
        : ''
    ].join('|'));

    // RXA - Pharmacy/Treatment Administration
    segments.push([
      'RXA',
      '0',
      '1',
      formatHL7Timestamp(data.immunization.administeredDate),
      formatHL7Timestamp(data.immunization.administeredDate),
      `${data.immunization.vaccineCode}^${data.immunization.vaccineName}^CVX`,
      data.immunization.administeredAmount?.toString() || '',
      data.immunization.administeredUnits || '',
      '',
      data.immunization.informationSource === 'A' ? '00^New immunization record^NIP001' : '01^Historical information^NIP001',
      '',
      '',
      '',
      data.immunization.lotNumber || '',
      data.immunization.expirationDate ? formatHL7Date(data.immunization.expirationDate) : '',
      data.immunization.manufacturerCode ? `${data.immunization.manufacturerCode}^^MVX` : '',
      data.immunization.refusalReason || '',
      '',
      '',
      'CP'                                      // Completion status: Complete
    ].join('|'));

    // RXR - Route (if provided)
    if (data.immunization.route || data.immunization.site) {
      segments.push([
        'RXR',
        data.immunization.route || '',
        data.immunization.site || ''
      ].join('|'));
    }

    // OBX - Observation for VIS (Vaccine Information Statement)
    if (data.immunization.visDate) {
      segments.push([
        'OBX',
        '1',
        'CE',
        '30956-7^Vaccine Type^LN',
        '1',
        `${data.immunization.vaccineCode}^${data.immunization.vaccineName}^CVX`,
        '',
        '',
        '',
        '',
        '',
        'F'
      ].join('|'));

      segments.push([
        'OBX',
        '2',
        'TS',
        '29769-7^VIS Presentation Date^LN',
        '1',
        formatHL7Date(data.immunization.visDate),
        '',
        '',
        '',
        '',
        '',
        'F'
      ].join('|'));
    }

    const message = segments.join('\r');
    return success(message);

  } catch (err: unknown) {
    return failure('VXU_GENERATION_ERROR',
      err instanceof Error ? err.message : 'Failed to generate VXU message');
  }
}

function formatHL7Timestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace('T', '').split('.')[0];
}

function formatHL7Date(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}
```

### 3.3 Registry Service

```typescript
// src/services/publicHealth/immunizationRegistryService.ts

import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { supabase } from '@/lib/supabase';
import { generateVXUMessage } from './hl7VxuGenerator';

export async function submitImmunization(
  immunizationId: string,
  tenantId: string
): Promise<ServiceResult<{ messageId: string }>> {
  try {
    // Get immunization with patient data
    const { data: immunization } = await supabase
      .from('fhir_immunizations')
      .select(`
        *,
        patients:patient_id(*)
      `)
      .eq('id', immunizationId)
      .single();

    if (!immunization) {
      return failure('NOT_FOUND', 'Immunization not found');
    }

    const stateCode = immunization.patients?.state || 'TX';

    // Get registry config
    const { data: config } = await supabase
      .from('immunization_registry_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('state_code', stateCode)
      .single();

    if (!config || !config.is_active) {
      return failure('CONFIG_NOT_FOUND', `Registry not configured for ${stateCode}`);
    }

    // Generate VXU message
    const messageControlId = `IMM${Date.now()}`;
    const vxuResult = generateVXUMessage({
      messageControlId,
      sendingFacility: {
        name: 'WellFit',
        id: config.facility_id
      },
      receivingRegistry: {
        name: getRegistryName(stateCode),
        id: getRegistryId(stateCode)
      },
      patient: {
        id: immunization.patients.id,
        firstName: immunization.patients.first_name,
        lastName: immunization.patients.last_name,
        dob: new Date(immunization.patients.date_of_birth),
        gender: immunization.patients.gender,
        address: {
          street: immunization.patients.address_line1 || '',
          city: immunization.patients.city || '',
          state: immunization.patients.state || '',
          zip: immunization.patients.zip_code || ''
        }
      },
      immunization: {
        id: immunization.id,
        vaccineCode: immunization.vaccine_code,
        vaccineName: immunization.vaccine_display,
        lotNumber: immunization.lot_number,
        administeredDate: new Date(immunization.occurrence_datetime),
        informationSource: immunization.primary_source ? 'A' : 'H',
        manufacturerCode: immunization.manufacturer_code
      }
    });

    if (!vxuResult.success) {
      return failure('MESSAGE_GENERATION_FAILED', vxuResult.error || 'Failed to generate message');
    }

    // Store submission
    const { data: submission } = await supabase
      .from('immunization_registry_submissions')
      .insert({
        tenant_id: tenantId,
        immunization_id: immunizationId,
        patient_id: immunization.patient_id,
        state_code: stateCode,
        message_type: 'VXU',
        hl7_message: vxuResult.data,
        message_control_id: messageControlId,
        status: 'pending'
      })
      .select()
      .single();

    // Send to registry (implementation varies by state)
    const sendResult = await sendToRegistry(config, vxuResult.data!);

    // Update status
    await supabase
      .from('immunization_registry_submissions')
      .update({
        status: sendResult.success ? 'ack' : 'error',
        sent_at: new Date().toISOString(),
        ack_code: sendResult.ackCode,
        response_message: sendResult.message
      })
      .eq('id', submission?.id);

    await auditLogger.info('IMMUNIZATION_REGISTRY_SUBMITTED', {
      tenantId,
      immunizationId,
      stateCode,
      messageControlId
    });

    return success({ messageId: messageControlId });

  } catch (err: unknown) {
    await auditLogger.error('IMMUNIZATION_REGISTRY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { immunizationId, tenantId }
    );
    return failure('REGISTRY_ERROR', 'Failed to submit to registry');
  }
}

// Query patient immunization history from registry
export async function queryRegistryHistory(
  patientId: string,
  tenantId: string,
  stateCode: string
): Promise<ServiceResult<unknown[]>> {
  try {
    const { data: config } = await supabase
      .from('immunization_registry_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('state_code', stateCode)
      .single();

    if (!config?.query_enabled) {
      return failure('QUERY_NOT_SUPPORTED', 'Registry query not available');
    }

    // Get patient data
    const { data: patient } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (!patient) {
      return failure('PATIENT_NOT_FOUND', 'Patient not found');
    }

    // Generate QBP (Query By Parameter) message
    // Implementation varies significantly by state

    // Send query and parse response
    // Store in immunization_registry_history

    return success([]);  // Return parsed immunizations

  } catch (err: unknown) {
    await auditLogger.error('REGISTRY_QUERY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { patientId, tenantId, stateCode }
    );
    return failure('QUERY_ERROR', 'Failed to query registry');
  }
}

async function sendToRegistry(
  config: unknown,
  message: string
): Promise<{ success: boolean; ackCode?: string; message?: string }> {
  // Implementation varies by state:
  // - Texas ImmTrac2: SOAP web service
  // - California CAIR2: REST API
  // - Florida: SFTP batch
  // Add state-specific implementations

  return { success: true, ackCode: 'AA' };
}

function getRegistryName(stateCode: string): string {
  const names: Record<string, string> = {
    'TX': 'ImmTrac2',
    'CA': 'CAIR2',
    'FL': 'Florida SHOTS'
  };
  return names[stateCode] || `${stateCode} IIS`;
}

function getRegistryId(stateCode: string): string {
  return `2.16.840.1.114222.4.1.${stateCode}`;
}
```

---

## Module 4: Electronic Case Reporting (eCR)

**ONC Criteria:** 170.315(f)(5)
**Effort:** 2-3 weeks
**Purpose:** Automatically report notifiable conditions to public health

### 4.1 Database Schema

```sql
-- Migration: XXXXXX_electronic_case_reporting.sql

-- Trigger conditions (from RCKMS - Reportable Conditions Knowledge Management System)
CREATE TABLE ecr_trigger_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Condition identification
    condition_code VARCHAR(20) NOT NULL,       -- SNOMED or ICD-10
    code_system VARCHAR(20) NOT NULL,          -- 'SNOMED', 'ICD10'
    condition_name TEXT NOT NULL,

    -- Reporting rules
    is_nationally_notifiable BOOLEAN DEFAULT false,
    state_codes TEXT[],                        -- States where reportable (empty = all)

    -- Trigger criteria
    trigger_type VARCHAR(20) NOT NULL,         -- 'diagnosis', 'lab_result', 'medication'
    lab_loinc_codes TEXT[],                    -- For lab-based triggers
    lab_value_criteria JSONB,                  -- e.g., {"operator": ">", "value": 100}

    -- Timing
    report_within_hours INTEGER DEFAULT 24,

    is_active BOOLEAN DEFAULT true,
    source VARCHAR(50) DEFAULT 'RCKMS',
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Generated case reports
CREATE TABLE electronic_case_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL,
    encounter_id UUID,

    -- Trigger info
    trigger_condition_id UUID REFERENCES ecr_trigger_conditions(id),
    trigger_type VARCHAR(20) NOT NULL,
    trigger_code VARCHAR(20) NOT NULL,
    trigger_description TEXT,

    -- Report details
    report_status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'ready', 'sent', 'acknowledged'
    eicr_document TEXT,                        -- CDA eICR XML
    eicr_version VARCHAR(10) DEFAULT '3.1',

    -- Submission tracking
    destination_type VARCHAR(50),              -- 'aims_platform', 'state_health_dept'
    submitted_at TIMESTAMPTZ,
    submission_id VARCHAR(100),

    -- Reportability Response
    rr_received_at TIMESTAMPTZ,
    rr_document TEXT,                          -- CDA RR XML
    rr_status VARCHAR(20),                     -- 'reportable', 'not_reportable', 'may_be_reportable'
    rr_determination_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Track detection events
CREATE TABLE ecr_trigger_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL,

    -- What triggered
    trigger_condition_id UUID REFERENCES ecr_trigger_conditions(id),
    trigger_source VARCHAR(20) NOT NULL,       -- 'encounter_diagnosis', 'lab_result', 'problem_list'
    trigger_source_id UUID,                    -- ID of the triggering record

    -- Resolution
    case_report_id UUID REFERENCES electronic_case_reports(id),
    suppressed BOOLEAN DEFAULT false,
    suppression_reason TEXT,

    detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration
CREATE TABLE ecr_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,

    -- AIMS Platform connection
    aims_enabled BOOLEAN DEFAULT true,
    aims_endpoint TEXT DEFAULT 'https://aims.aimsplatform.org/ecr',
    aims_credentials JSONB,

    -- Options
    auto_submit BOOLEAN DEFAULT false,          -- Require human review by default
    suppress_duplicates_hours INTEGER DEFAULT 72,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ecr_trigger_conditions_code
    ON ecr_trigger_conditions(condition_code, code_system);
CREATE INDEX idx_ecr_reports_tenant_status
    ON electronic_case_reports(tenant_id, report_status);
CREATE INDEX idx_ecr_trigger_events_patient
    ON ecr_trigger_events(patient_id, detected_at);

-- Seed some common trigger conditions
INSERT INTO ecr_trigger_conditions (condition_code, code_system, condition_name, is_nationally_notifiable, trigger_type) VALUES
('27836007', 'SNOMED', 'Pertussis (Whooping Cough)', true, 'diagnosis'),
('76902006', 'SNOMED', 'Tetanus', true, 'diagnosis'),
('14189004', 'SNOMED', 'Measles', true, 'diagnosis'),
('36989005', 'SNOMED', 'Mumps', true, 'diagnosis'),
('38907003', 'SNOMED', 'Varicella (Chickenpox)', true, 'diagnosis'),
('186431008', 'SNOMED', 'Tuberculosis', true, 'diagnosis'),
('840539006', 'SNOMED', 'COVID-19', true, 'diagnosis'),
('6142004', 'SNOMED', 'Influenza', false, 'diagnosis'),
('A37', 'ICD10', 'Whooping Cough', true, 'diagnosis'),
('A33', 'ICD10', 'Tetanus neonatorum', true, 'diagnosis'),
('B05', 'ICD10', 'Measles', true, 'diagnosis'),
('B26', 'ICD10', 'Mumps', true, 'diagnosis'),
('U07.1', 'ICD10', 'COVID-19', true, 'diagnosis');
```

### 4.2 Trigger Detection Service

```typescript
// src/services/publicHealth/ecrTriggerDetectionService.ts

import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { supabase } from '@/lib/supabase';

interface TriggerEvent {
  triggerConditionId: string;
  patientId: string;
  sourceType: 'encounter_diagnosis' | 'lab_result' | 'problem_list';
  sourceId: string;
  conditionName: string;
}

// Check if a diagnosis triggers case reporting
export async function checkDiagnosisTrigger(
  diagnosisCode: string,
  codeSystem: 'ICD10' | 'SNOMED',
  patientId: string,
  sourceId: string,
  tenantId: string
): Promise<ServiceResult<TriggerEvent | null>> {
  try {
    // Look up trigger condition
    const { data: trigger } = await supabase
      .from('ecr_trigger_conditions')
      .select('*')
      .eq('condition_code', diagnosisCode)
      .eq('code_system', codeSystem)
      .eq('is_active', true)
      .single();

    if (!trigger) {
      return success(null);  // Not a reportable condition
    }

    // Check if we've already triggered for this patient recently
    const { data: existing } = await supabase
      .from('ecr_trigger_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('patient_id', patientId)
      .eq('trigger_condition_id', trigger.id)
      .eq('suppressed', false)
      .gte('detected_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      // Already triggered recently - suppress duplicate
      return success(null);
    }

    // Create trigger event
    const { data: event } = await supabase
      .from('ecr_trigger_events')
      .insert({
        tenant_id: tenantId,
        patient_id: patientId,
        trigger_condition_id: trigger.id,
        trigger_source: 'encounter_diagnosis',
        trigger_source_id: sourceId
      })
      .select()
      .single();

    await auditLogger.info('ECR_TRIGGER_DETECTED', {
      tenantId,
      patientId,
      conditionCode: diagnosisCode,
      conditionName: trigger.condition_name
    });

    return success({
      triggerConditionId: trigger.id,
      patientId,
      sourceType: 'encounter_diagnosis',
      sourceId,
      conditionName: trigger.condition_name
    });

  } catch (err: unknown) {
    await auditLogger.error('ECR_TRIGGER_CHECK_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { diagnosisCode, patientId }
    );
    return failure('TRIGGER_ERROR', 'Failed to check trigger');
  }
}

// Check lab result triggers
export async function checkLabResultTrigger(
  loincCode: string,
  resultValue: number,
  resultUnits: string,
  patientId: string,
  sourceId: string,
  tenantId: string
): Promise<ServiceResult<TriggerEvent | null>> {
  try {
    // Find triggers that include this LOINC code
    const { data: triggers } = await supabase
      .from('ecr_trigger_conditions')
      .select('*')
      .eq('trigger_type', 'lab_result')
      .eq('is_active', true)
      .contains('lab_loinc_codes', [loincCode]);

    for (const trigger of triggers || []) {
      // Check value criteria if defined
      if (trigger.lab_value_criteria) {
        const criteria = trigger.lab_value_criteria as { operator: string; value: number };
        let matches = false;

        switch (criteria.operator) {
          case '>': matches = resultValue > criteria.value; break;
          case '>=': matches = resultValue >= criteria.value; break;
          case '<': matches = resultValue < criteria.value; break;
          case '<=': matches = resultValue <= criteria.value; break;
          case '=': matches = resultValue === criteria.value; break;
          case 'positive': matches = resultValue > 0; break;
        }

        if (!matches) continue;
      }

      // Create trigger event
      const { data: event } = await supabase
        .from('ecr_trigger_events')
        .insert({
          tenant_id: tenantId,
          patient_id: patientId,
          trigger_condition_id: trigger.id,
          trigger_source: 'lab_result',
          trigger_source_id: sourceId
        })
        .select()
        .single();

      await auditLogger.info('ECR_LAB_TRIGGER_DETECTED', {
        tenantId,
        patientId,
        loincCode,
        conditionName: trigger.condition_name
      });

      return success({
        triggerConditionId: trigger.id,
        patientId,
        sourceType: 'lab_result',
        sourceId,
        conditionName: trigger.condition_name
      });
    }

    return success(null);

  } catch (err: unknown) {
    await auditLogger.error('ECR_LAB_TRIGGER_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { loincCode, patientId }
    );
    return failure('TRIGGER_ERROR', 'Failed to check lab trigger');
  }
}
```

### 4.3 eICR Document Generator

```typescript
// src/services/publicHealth/eicrGeneratorService.ts

import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { supabase } from '@/lib/supabase';
import { create } from 'xmlbuilder2';

interface EICRGenerationOptions {
  tenantId: string;
  patientId: string;
  encounterId?: string;
  triggerId: string;
}

export async function generateEICR(
  options: EICRGenerationOptions
): Promise<ServiceResult<string>> {
  const { tenantId, patientId, encounterId, triggerId } = options;

  try {
    // Gather all required data
    const [patient, encounter, problems, medications, labs, immunizations, trigger] = await Promise.all([
      getPatient(patientId),
      encounterId ? getEncounter(encounterId) : null,
      getProblems(patientId),
      getMedications(patientId),
      getLabResults(patientId),
      getImmunizations(patientId),
      getTrigger(triggerId)
    ]);

    if (!patient) {
      return failure('PATIENT_NOT_FOUND', 'Patient not found');
    }

    // Build eICR CDA document
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('ClinicalDocument', {
        'xmlns': 'urn:hl7-org:v3',
        'xmlns:sdtc': 'urn:hl7-org:sdtc',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
      });

    // Header
    addHeader(doc, patient, trigger);

    // Record Target (Patient)
    addRecordTarget(doc, patient);

    // Author (System)
    addAuthor(doc, tenantId);

    // Custodian (Organization)
    addCustodian(doc, tenantId);

    // Component (Structured Body)
    const body = doc.ele('component').ele('structuredBody');

    // Encounters Section
    if (encounter) {
      addEncountersSection(body, encounter);
    }

    // Reason for Visit / Chief Complaint
    if (encounter?.chief_complaint) {
      addReasonForVisitSection(body, encounter.chief_complaint);
    }

    // Problems Section
    addProblemsSection(body, problems, trigger);

    // Medications Section
    addMedicationsSection(body, medications);

    // Results Section (Labs)
    addResultsSection(body, labs);

    // Immunizations Section
    addImmunizationsSection(body, immunizations);

    // Social History Section
    addSocialHistorySection(body, patient);

    // Reportability Response Information Section (placeholder)
    addReportabilitySection(body);

    const xml = doc.end({ prettyPrint: true });

    // Store the report
    const { data: report } = await supabase
      .from('electronic_case_reports')
      .insert({
        tenant_id: tenantId,
        patient_id: patientId,
        encounter_id: encounterId,
        trigger_condition_id: triggerId,
        trigger_type: trigger?.trigger_type,
        trigger_code: trigger?.condition_code,
        trigger_description: trigger?.condition_name,
        report_status: 'ready',
        eicr_document: xml
      })
      .select()
      .single();

    // Link to trigger event
    await supabase
      .from('ecr_trigger_events')
      .update({ case_report_id: report?.id })
      .eq('trigger_condition_id', triggerId)
      .eq('patient_id', patientId);

    await auditLogger.info('EICR_GENERATED', {
      tenantId,
      patientId,
      reportId: report?.id,
      conditionName: trigger?.condition_name
    });

    return success(xml);

  } catch (err: unknown) {
    await auditLogger.error('EICR_GENERATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { patientId, triggerId }
    );
    return failure('GENERATION_ERROR', 'Failed to generate eICR');
  }
}

// Helper functions to add CDA sections
function addHeader(doc: unknown, patient: unknown, trigger: unknown): void {
  // Implementation - add CDA header elements
}

function addRecordTarget(doc: unknown, patient: unknown): void {
  // Implementation - add patient demographics
}

function addAuthor(doc: unknown, tenantId: string): void {
  // Implementation - add authoring system info
}

function addCustodian(doc: unknown, tenantId: string): void {
  // Implementation - add custodian organization
}

function addEncountersSection(body: unknown, encounter: unknown): void {
  // Implementation - Encounters section 2.16.840.1.113883.10.20.22.2.22.1
}

function addReasonForVisitSection(body: unknown, chiefComplaint: string): void {
  // Implementation - Reason for Visit section 2.16.840.1.113883.10.20.22.2.12
}

function addProblemsSection(body: unknown, problems: unknown[], trigger: unknown): void {
  // Implementation - Problems section with trigger condition highlighted
}

function addMedicationsSection(body: unknown, medications: unknown[]): void {
  // Implementation - Medications section
}

function addResultsSection(body: unknown, labs: unknown[]): void {
  // Implementation - Results section
}

function addImmunizationsSection(body: unknown, immunizations: unknown[]): void {
  // Implementation - Immunizations section
}

function addSocialHistorySection(body: unknown, patient: unknown): void {
  // Implementation - Social history (occupation, travel, etc.)
}

function addReportabilitySection(body: unknown): void {
  // Implementation - Placeholder for RR response
}

// Data fetching functions
async function getPatient(patientId: string): Promise<unknown> {
  const { data } = await supabase.from('patients').select('*').eq('id', patientId).single();
  return data;
}

async function getEncounter(encounterId: string): Promise<unknown> {
  const { data } = await supabase.from('encounters').select('*').eq('id', encounterId).single();
  return data;
}

async function getProblems(patientId: string): Promise<unknown[]> {
  const { data } = await supabase.from('fhir_conditions').select('*').eq('patient_id', patientId);
  return data || [];
}

async function getMedications(patientId: string): Promise<unknown[]> {
  const { data } = await supabase.from('fhir_medication_requests').select('*').eq('patient_id', patientId);
  return data || [];
}

async function getLabResults(patientId: string): Promise<unknown[]> {
  const { data } = await supabase.from('fhir_observations').select('*').eq('patient_id', patientId).eq('category', 'laboratory');
  return data || [];
}

async function getImmunizations(patientId: string): Promise<unknown[]> {
  const { data } = await supabase.from('fhir_immunizations').select('*').eq('patient_id', patientId);
  return data || [];
}

async function getTrigger(triggerId: string): Promise<unknown> {
  const { data } = await supabase.from('ecr_trigger_conditions').select('*').eq('id', triggerId).single();
  return data;
}
```

---

## Module 5: SAFER Guides Self-Assessment

**ONC Criteria:** CMS Promoting Interoperability requirement
**Effort:** 1 week
**Purpose:** EHR safety self-assessment (9 guides)

### 5.1 Database Schema

```sql
-- Migration: XXXXXX_safer_guides.sql

-- SAFER Guide definitions
CREATE TABLE safer_guide_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_number INTEGER NOT NULL UNIQUE,
    guide_name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    question_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Individual questions within each guide
CREATE TABLE safer_guide_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_id UUID NOT NULL REFERENCES safer_guide_definitions(id),
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    help_text TEXT,
    response_type VARCHAR(20) DEFAULT 'yes_no_na',  -- 'yes_no_na', 'scale', 'text'
    is_required BOOLEAN DEFAULT true,
    display_order INTEGER,

    UNIQUE(guide_id, question_number)
);

-- Assessment responses per tenant
CREATE TABLE safer_guide_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    assessment_year INTEGER NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'in_progress',      -- 'in_progress', 'complete', 'attested'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    attested_at TIMESTAMPTZ,
    attested_by UUID REFERENCES auth.users(id),

    -- Scores per guide
    guide_scores JSONB,                            -- { "1": 85, "2": 90, ... }
    overall_score DECIMAL(5,2),

    -- Export
    attestation_pdf_path TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, assessment_year)
);

-- Individual question responses
CREATE TABLE safer_guide_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES safer_guide_assessments(id),
    question_id UUID NOT NULL REFERENCES safer_guide_questions(id),

    response VARCHAR(20),                          -- 'yes', 'no', 'na', or scale value
    notes TEXT,

    responded_at TIMESTAMPTZ DEFAULT NOW(),
    responded_by UUID REFERENCES auth.users(id),

    UNIQUE(assessment_id, question_id)
);

-- Seed the 9 SAFER Guides
INSERT INTO safer_guide_definitions (guide_number, guide_name, description, category) VALUES
(1, 'High Priority Practices', 'Critical safety practices that should be addressed first', 'Foundation'),
(2, 'Organizational Responsibilities', 'Leadership and governance for EHR safety', 'Governance'),
(3, 'Contingency Planning', 'Procedures for system downtime and recovery', 'Operations'),
(4, 'System Configuration', 'Safe configuration of EHR settings', 'Technical'),
(5, 'System Interfaces', 'Safe management of system integrations', 'Technical'),
(6, 'Patient Identification', 'Ensuring correct patient matching', 'Clinical'),
(7, 'Computerized Provider Order Entry with Decision Support', 'Safe ordering practices', 'Clinical'),
(8, 'Test Results Reporting and Follow-up', 'Managing test result communications', 'Clinical'),
(9, 'Clinician Communication', 'Safe clinical messaging practices', 'Clinical');

-- Seed sample questions for Guide 1 (High Priority Practices)
INSERT INTO safer_guide_questions (guide_id, question_number, question_text, help_text, display_order)
SELECT
    id,
    q.num,
    q.text,
    q.help,
    q.num
FROM safer_guide_definitions,
(VALUES
    (1, 'Do you have a process to rapidly communicate critical patient safety issues related to the EHR?', 'E.g., urgent alerts, patient safety officer notification'),
    (2, 'Is there a designated individual or team responsible for EHR safety?', 'This could be a safety officer, committee, or IT leadership'),
    (3, 'Do you track and analyze EHR-related safety events?', 'Including near-misses and adverse events'),
    (4, 'Are EHR safety issues included in your organizations quality improvement program?', 'Regular review and action planning'),
    (5, 'Do you have documented downtime procedures?', 'Procedures for when the EHR is unavailable')
) AS q(num, text, help)
WHERE guide_number = 1;
```

### 5.2 Assessment Service

```typescript
// src/services/saferGuides/saferGuidesService.ts

import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { supabase } from '@/lib/supabase';

interface GuideProgress {
  guideNumber: number;
  guideName: string;
  totalQuestions: number;
  answeredQuestions: number;
  score: number | null;
  status: 'not_started' | 'in_progress' | 'complete';
}

interface AssessmentSummary {
  assessmentId: string;
  year: number;
  status: string;
  overallScore: number | null;
  guides: GuideProgress[];
}

export async function getOrCreateAssessment(
  tenantId: string,
  year: number = new Date().getFullYear()
): Promise<ServiceResult<AssessmentSummary>> {
  try {
    // Check for existing assessment
    let { data: assessment } = await supabase
      .from('safer_guide_assessments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('assessment_year', year)
      .single();

    // Create if doesn't exist
    if (!assessment) {
      const { data: newAssessment, error } = await supabase
        .from('safer_guide_assessments')
        .insert({
          tenant_id: tenantId,
          assessment_year: year,
          status: 'in_progress'
        })
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }
      assessment = newAssessment;
    }

    // Get guide definitions and response counts
    const { data: guides } = await supabase
      .from('safer_guide_definitions')
      .select(`
        *,
        safer_guide_questions(count)
      `)
      .eq('is_active', true)
      .order('guide_number');

    const { data: responses } = await supabase
      .from('safer_guide_responses')
      .select('question_id, response, safer_guide_questions(guide_id)')
      .eq('assessment_id', assessment.id);

    // Calculate progress per guide
    const guideProgress: GuideProgress[] = (guides || []).map(guide => {
      const guideResponses = (responses || []).filter(
        r => (r.safer_guide_questions as { guide_id: string })?.guide_id === guide.id
      );

      const yesCount = guideResponses.filter(r => r.response === 'yes').length;
      const applicableCount = guideResponses.filter(r => r.response !== 'na').length;

      return {
        guideNumber: guide.guide_number,
        guideName: guide.guide_name,
        totalQuestions: guide.safer_guide_questions?.[0]?.count || 0,
        answeredQuestions: guideResponses.length,
        score: applicableCount > 0 ? Math.round((yesCount / applicableCount) * 100) : null,
        status: guideResponses.length === 0
          ? 'not_started'
          : guideResponses.length >= (guide.safer_guide_questions?.[0]?.count || 0)
            ? 'complete'
            : 'in_progress'
      };
    });

    // Calculate overall score
    const completedGuides = guideProgress.filter(g => g.score !== null);
    const overallScore = completedGuides.length > 0
      ? Math.round(completedGuides.reduce((sum, g) => sum + (g.score || 0), 0) / completedGuides.length)
      : null;

    return success({
      assessmentId: assessment.id,
      year: assessment.assessment_year,
      status: assessment.status,
      overallScore,
      guides: guideProgress
    });

  } catch (err: unknown) {
    await auditLogger.error('SAFER_ASSESSMENT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, year }
    );
    return failure('ASSESSMENT_ERROR', 'Failed to get assessment');
  }
}

export async function saveResponse(
  assessmentId: string,
  questionId: string,
  response: 'yes' | 'no' | 'na',
  notes: string | null,
  userId: string
): Promise<ServiceResult<void>> {
  try {
    await supabase
      .from('safer_guide_responses')
      .upsert({
        assessment_id: assessmentId,
        question_id: questionId,
        response,
        notes,
        responded_by: userId,
        responded_at: new Date().toISOString()
      }, {
        onConflict: 'assessment_id,question_id'
      });

    return success(undefined);

  } catch (err: unknown) {
    return failure('SAVE_ERROR', 'Failed to save response');
  }
}

export async function attestAssessment(
  assessmentId: string,
  userId: string,
  tenantId: string
): Promise<ServiceResult<{ pdfPath: string }>> {
  try {
    // Verify all guides are complete
    const summary = await getOrCreateAssessment(tenantId);
    if (!summary.success) {
      return failure('ASSESSMENT_ERROR', 'Could not verify assessment');
    }

    const incomplete = summary.data!.guides.filter(g => g.status !== 'complete');
    if (incomplete.length > 0) {
      return failure('INCOMPLETE', `Guides not complete: ${incomplete.map(g => g.guideName).join(', ')}`);
    }

    // Generate attestation PDF
    const pdfPath = await generateAttestationPDF(assessmentId, summary.data!);

    // Update assessment
    await supabase
      .from('safer_guide_assessments')
      .update({
        status: 'attested',
        attested_at: new Date().toISOString(),
        attested_by: userId,
        overall_score: summary.data!.overallScore,
        guide_scores: Object.fromEntries(
          summary.data!.guides.map(g => [g.guideNumber.toString(), g.score])
        ),
        attestation_pdf_path: pdfPath
      })
      .eq('id', assessmentId);

    await auditLogger.info('SAFER_ASSESSMENT_ATTESTED', {
      tenantId,
      assessmentId,
      overallScore: summary.data!.overallScore
    });

    return success({ pdfPath });

  } catch (err: unknown) {
    await auditLogger.error('SAFER_ATTESTATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { assessmentId }
    );
    return failure('ATTESTATION_ERROR', 'Failed to attest assessment');
  }
}

async function generateAttestationPDF(
  assessmentId: string,
  summary: AssessmentSummary
): Promise<string> {
  // Generate PDF using a library like pdfkit or puppeteer
  // Store in Supabase Storage
  // Return path
  return `safer-guides/${assessmentId}/attestation.pdf`;
}
```

### 5.3 UI Component

```tsx
// src/components/admin/SaferGuidesAssessment.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import {
  getOrCreateAssessment,
  saveResponse,
  attestAssessment
} from '@/services/saferGuides/saferGuidesService';
import { CheckCircle, Circle, AlertCircle, FileText, Download } from 'lucide-react';

interface Question {
  id: string;
  questionNumber: number;
  questionText: string;
  helpText?: string;
  response?: 'yes' | 'no' | 'na';
  notes?: string;
}

interface Guide {
  guideNumber: number;
  guideName: string;
  status: 'not_started' | 'in_progress' | 'complete';
  score: number | null;
  questions?: Question[];
}

export const SaferGuidesAssessment: React.FC = () => {
  const { user, tenant } = useAuth();
  const [assessment, setAssessment] = useState<{
    assessmentId: string;
    year: number;
    status: string;
    overallScore: number | null;
    guides: Guide[];
  } | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadAssessment();
  }, [tenant?.id]);

  const loadAssessment = async () => {
    if (!tenant?.id) return;
    setIsLoading(true);
    const result = await getOrCreateAssessment(tenant.id);
    if (result.success && result.data) {
      setAssessment(result.data);
    }
    setIsLoading(false);
  };

  const loadGuideQuestions = async (guideNumber: number) => {
    setSelectedGuide(guideNumber);
    // Load questions for this guide
    // Implementation: fetch from supabase
  };

  const handleResponseChange = async (
    questionId: string,
    response: 'yes' | 'no' | 'na'
  ) => {
    if (!assessment || !user?.id) return;

    setIsSaving(true);
    await saveResponse(assessment.assessmentId, questionId, response, null, user.id);

    // Update local state
    setQuestions(prev => prev.map(q =>
      q.id === questionId ? { ...q, response } : q
    ));

    setIsSaving(false);

    // Reload assessment to update progress
    await loadAssessment();
  };

  const handleAttest = async () => {
    if (!assessment || !user?.id || !tenant?.id) return;

    const result = await attestAssessment(assessment.assessmentId, user.id, tenant.id);
    if (result.success) {
      await loadAssessment();
      // Optionally trigger PDF download
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in_progress': return <Circle className="w-5 h-5 text-yellow-500" />;
      default: return <Circle className="w-5 h-5 text-gray-300" />;
    }
  };

  if (isLoading) {
    return <div>Loading assessment...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">SAFER Guides Self-Assessment</h1>
          <p className="text-muted-foreground">
            {assessment?.year} Annual Assessment
          </p>
        </div>

        {assessment?.status === 'attested' ? (
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download Attestation
          </Button>
        ) : (
          <Button
            onClick={handleAttest}
            disabled={assessment?.guides.some(g => g.status !== 'complete')}
          >
            <FileText className="w-4 h-4 mr-2" />
            Complete & Attest
          </Button>
        )}
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress
              value={
                ((assessment?.guides.filter(g => g.status === 'complete').length || 0) / 9) * 100
              }
              className="flex-1"
            />
            <span className="text-lg font-semibold">
              {assessment?.guides.filter(g => g.status === 'complete').length || 0} / 9 Complete
            </span>
            {assessment?.overallScore !== null && (
              <span className="text-lg font-semibold text-primary">
                Score: {assessment.overallScore}%
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Guide List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {assessment?.guides.map(guide => (
          <Card
            key={guide.guideNumber}
            className={`cursor-pointer transition-colors hover:border-primary ${
              selectedGuide === guide.guideNumber ? 'border-primary' : ''
            }`}
            onClick={() => loadGuideQuestions(guide.guideNumber)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {getStatusIcon(guide.status)}
                <div className="flex-1">
                  <h3 className="font-medium">
                    Guide {guide.guideNumber}: {guide.guideName}
                  </h3>
                  {guide.score !== null && (
                    <p className="text-sm text-muted-foreground">
                      Score: {guide.score}%
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Question Panel */}
      {selectedGuide && (
        <Card>
          <CardHeader>
            <CardTitle>
              Guide {selectedGuide}: {assessment?.guides.find(g => g.guideNumber === selectedGuide)?.guideName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {questions.map((question, index) => (
              <div key={question.id} className="p-4 border rounded-lg">
                <p className="font-medium mb-2">
                  {index + 1}. {question.questionText}
                </p>
                {question.helpText && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {question.helpText}
                  </p>
                )}
                <RadioGroup
                  value={question.response}
                  onValueChange={(value) => handleResponseChange(question.id, value as 'yes' | 'no' | 'na')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                    <Label htmlFor={`${question.id}-yes`}>Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id={`${question.id}-no`} />
                    <Label htmlFor={`${question.id}-no`}>No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id={`${question.id}-na`} />
                    <Label htmlFor={`${question.id}-na`}>N/A</Label>
                  </div>
                </RadioGroup>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SaferGuidesAssessment;
```

---

## Dependencies to Install

```bash
# For eCQM (CQL execution)
npm install cql-execution cql-exec-fhir cql-exec-vsac

# For XML generation (eICR, QRDA)
npm install xmlbuilder2

# For PDF generation (SAFER attestation)
npm install @react-pdf/renderer
# OR
npm install pdfkit

# Types
npm install -D @types/xmlbuilder2
```

---

## Implementation Order

| Week | Module | Deliverables |
|------|--------|--------------|
| 1-2 | Syndromic Surveillance | Schema, HL7 generator, service, edge function |
| 2-3 | Immunization Registry | Schema, VXU generator, state API integration |
| 3-4 | Electronic Case Reporting | Schema, trigger detection, eICR generator |
| 4-5 | eCQM System | Schema, CQL engine, QRDA export, dashboard |
| 5 | SAFER Guides | Schema, service, UI component |

---

## Testing Strategy

For each module:
1. Unit tests for HL7/CDA message generation
2. Integration tests with Supabase
3. Validation against official test tools:
   - NIST HL7 validator for ADT/VXU messages
   - eCQI Resource Center for QRDA
   - AIMS Sandbox for eICR

---

## State-Specific Considerations

**You'll need to research requirements for your target states:**

| State | Syndromic | IIS | Notes |
|-------|-----------|-----|-------|
| Texas | DSHS | ImmTrac2 | SOAP web service |
| California | CalREDIE | CAIR2 | REST API |
| Florida | ESSENCE-FL | FL SHOTS | SFTP batch |

Each state has different:
- Connection methods (HTTPS, MLLP, SFTP)
- Authentication (certificates, OAuth, basic auth)
- Message format variations
- Onboarding processes

Start with your pilot state and expand.
