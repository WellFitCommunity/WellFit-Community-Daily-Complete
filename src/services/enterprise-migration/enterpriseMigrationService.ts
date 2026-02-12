/**
 * Enterprise Migration Engine — Main Orchestrator Service
 *
 * Coordinates all enterprise migration features: lineage tracking,
 * snapshots, retry logic, deduplication, quality scoring,
 * conditional mappings, and workflow orchestration.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  IntelligentMigrationService,
  SourceDNA,
  MappingSuggestion,
  MigrationResult
} from '../migration-engine';
import { auditLogger } from '../auditLogger';
import { CryptoUtils } from './cryptoUtils';
import { DataLineageService } from './lineageService';
import { SnapshotService } from './snapshotService';
import { RetryService } from './retryService';
import { DeduplicationService } from './deduplicationService';
import { QualityScoringService } from './qualityService';
import { ConditionalMappingService } from './conditionalMappingService';
import { WorkflowOrchestrationService } from './workflowService';
import { transformValueWithTracking, validateValueEnterprise } from './transformUtils';
import type {
  TransformationStep,
  EnterpriseMigrationOptions,
  EnterpriseMigrationResult,
  QualityScore
} from './types';

export class EnterpriseMigrationService extends IntelligentMigrationService {
  private enterpriseSupabase: SupabaseClient;
  private enterpriseOrgId: string;

  // Enterprise services
  private snapshotService: SnapshotService;
  private retryService: RetryService;
  private dedupService: DeduplicationService;
  private qualityService: QualityScoringService;
  private conditionalService: ConditionalMappingService;
  private workflowService: WorkflowOrchestrationService;

  constructor(supabase: SupabaseClient, organizationId: string) {
    super(supabase, organizationId);
    this.enterpriseSupabase = supabase;
    this.enterpriseOrgId = organizationId;

    // Initialize enterprise services
    this.snapshotService = new SnapshotService(supabase);
    this.retryService = new RetryService(supabase);
    this.dedupService = new DeduplicationService(supabase);
    this.qualityService = new QualityScoringService(supabase);
    this.conditionalService = new ConditionalMappingService(supabase);
    this.workflowService = new WorkflowOrchestrationService(supabase);
  }

  /**
   * Execute enterprise-grade migration with all features
   */
  async executeEnterpriseMigration(
    dna: SourceDNA,
    data: Record<string, unknown>[],
    mappings: MappingSuggestion[],
    options: EnterpriseMigrationOptions = {}
  ): Promise<EnterpriseMigrationResult> {
    const startTime = Date.now();
    let snapshotId: string | undefined;
    let lineageService: DataLineageService | undefined;
    let workflowExecutionId: string | undefined;
    let retriesQueued = 0;
    let duplicatesFound = 0;
    let lineageRecordsCreated = 0;

    // Default options
    const opts: Required<EnterpriseMigrationOptions> = {
      dryRun: options.dryRun ?? false,
      validateOnly: options.validateOnly ?? false,
      batchSize: options.batchSize ?? 100,
      enableLineageTracking: options.enableLineageTracking ?? true,
      createPreMigrationSnapshot: options.createPreMigrationSnapshot ?? true,
      enableRetryLogic: options.enableRetryLogic ?? true,
      maxRetryAttempts: options.maxRetryAttempts ?? 5,
      enableParallelProcessing: options.enableParallelProcessing ?? false,
      workerCount: options.workerCount ?? 4,
      enableDeduplication: options.enableDeduplication ?? true,
      dedupThreshold: options.dedupThreshold ?? 0.8,
      enableQualityScoring: options.enableQualityScoring ?? true,
      enableConditionalMappings: options.enableConditionalMappings ?? true,
      useWorkflowOrchestration: options.useWorkflowOrchestration ?? false,
      workflowTemplateId: options.workflowTemplateId ?? 'healthcare_staff_standard',
      encryptPHI: options.encryptPHI ?? true,
      phiFields: options.phiFields ?? [],
      stopOnError: options.stopOnError ?? false,
      stopOnQualityThreshold: options.stopOnQualityThreshold ?? 70
    };

    auditLogger.info('EnterpriseMigration: Starting enterprise migration', {
      organizationId: this.enterpriseOrgId,
      sourceSystem: dna.sourceSystem,
      rowCount: data.length,
      options: opts
    });

    try {
      // 1. Pre-migration snapshot
      if (opts.createPreMigrationSnapshot && !opts.dryRun) {
        const tables = [...new Set(mappings.map(m => m.targetTable).filter(t => t !== 'UNMAPPED'))];
        snapshotId = await this.snapshotService.createSnapshot(
          tables,
          undefined, // batch ID not yet created
          'pre_migration',
          `Pre-migration snapshot for ${dna.sourceSystem || dna.sourceType} import`
        );
        auditLogger.info('EnterpriseMigration: Created pre-migration snapshot', { snapshotId });
      }

      // 2. Deduplication check
      if (opts.enableDeduplication) {
        const duplicates = await this.dedupService.findDuplicates(
          'temp-batch',
          data
        );
        duplicatesFound = duplicates.length;

        if (duplicatesFound > 0) {
          auditLogger.warn('EnterpriseMigration: Duplicates found', {
            count: duplicatesFound,
            threshold: opts.dedupThreshold
          });
        }
      }

      // 3. Workflow orchestration setup
      if (opts.useWorkflowOrchestration) {
        const template = await this.workflowService.getTemplate(opts.workflowTemplateId);
        if (template) {
          workflowExecutionId = await this.workflowService.createExecution(
            'temp-batch',
            opts.workflowTemplateId,
            template
          );
        }
      }

      // 4. Create migration batch
      const { data: batch } = await this.enterpriseSupabase
        .from('hc_migration_batch')
        .insert({
          organization_id: this.enterpriseOrgId,
          source_system: dna.sourceSystem || dna.sourceType,
          record_count: data.length,
          status: opts.dryRun ? 'DRY_RUN' : 'PROCESSING',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      const batchId = batch?.batch_id || crypto.randomUUID();

      // 5. Initialize lineage tracking
      if (opts.enableLineageTracking) {
        lineageService = new DataLineageService(
          this.enterpriseSupabase,
          batchId,
          `${dna.sourceSystem || dna.sourceType}_${Date.now()}`
        );
      }

      // 6. Process with conditional mappings
      const processedMappings = opts.enableConditionalMappings
        ? await this.applyConditionalMappings(mappings, data)
        : mappings;

      // 7. Execute migration with lineage tracking
      const errors: Array<{ row: number; field: string; error: string }> = [];
      const results: MigrationResult[] = [];
      let successCount = 0;
      let errorCount = 0;

      // Group by target table
      const tableGroups = this.groupByTable(processedMappings);

      for (const [table, tableMappings] of Object.entries(tableGroups)) {
        if (table === 'UNMAPPED') continue;

        // Check workflow dependencies if using orchestration
        if (opts.useWorkflowOrchestration && workflowExecutionId) {
          const nextStep = await this.workflowService.getNextStep(workflowExecutionId);
          if (!nextStep || nextStep.table !== table) {
            // Skip - dependencies not met
            continue;
          }
        }

        for (let i = 0; i < data.length; i += opts.batchSize) {
          const batchData = data.slice(i, i + opts.batchSize);

          try {
            const batchResult = await this.processBatchWithLineage(
              table,
              tableMappings,
              batchData,
              dna,
              batchId,
              i,
              lineageService,
              opts
            );

            successCount += batchResult.successCount;
            errorCount += batchResult.errorCount;
            errors.push(...batchResult.errors);
            results.push(...batchResult.results);
            lineageRecordsCreated += batchResult.lineageCount;
          } catch (batchError) {
            // Queue for retry if enabled
            if (opts.enableRetryLogic && !opts.dryRun) {
              const rowNumbers = batchData.map((_, idx) => i + idx);
              await this.retryService.queueRetry(
                batchId,
                'batch_insert',
                table,
                rowNumbers,
                'BATCH_ERROR',
                batchError instanceof Error ? batchError.message : 'Unknown error',
                { mappings: tableMappings }
              );
              retriesQueued++;
            }
            errorCount += batchData.length;
          }
        }

        // Mark workflow step completed
        if (opts.useWorkflowOrchestration && workflowExecutionId) {
          await this.workflowService.completeStep(workflowExecutionId, table);
        }
      }

      // 8. Flush lineage records
      if (lineageService) {
        await lineageService.flush();
      }

      // 9. Update batch status
      await this.enterpriseSupabase
        .from('hc_migration_batch')
        .update({
          status: errorCount === 0 ? 'COMPLETED' : 'COMPLETED_WITH_ERRORS',
          success_count: successCount,
          error_count: errorCount,
          completed_at: new Date().toISOString()
        })
        .eq('batch_id', batchId);

      // 10. Calculate quality score
      let qualityScore: QualityScore | undefined;
      if (opts.enableQualityScoring && !opts.dryRun) {
        qualityScore = await this.qualityService.calculateScore(batchId);

        // Check quality threshold
        if (qualityScore.overallScore < opts.stopOnQualityThreshold) {
          auditLogger.warn('EnterpriseMigration: Quality below threshold', {
            score: qualityScore.overallScore,
            threshold: opts.stopOnQualityThreshold
          });
        }
      }

      const endTime = Date.now();
      const processingTimeMs = endTime - startTime;
      const throughput = data.length / (processingTimeMs / 1000);

      auditLogger.info('EnterpriseMigration: Migration completed', {
        batchId,
        successCount,
        errorCount,
        qualityScore: qualityScore?.overallScore,
        processingTimeMs,
        throughputRowsPerSecond: throughput
      });

      return {
        batchId,
        totalRecords: data.length,
        successCount,
        errorCount,
        errors,
        results,
        snapshotId,
        lineageRecordsCreated,
        retriesQueued,
        duplicatesFound,
        qualityScore,
        workflowExecutionId,
        processingTimeMs,
        throughputRowsPerSecond: Math.round(throughput * 100) / 100
      };
    } catch (error) {
      auditLogger.error('EnterpriseMigration', 'Migration failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /** Apply conditional mappings to data */
  private async applyConditionalMappings(
    mappings: MappingSuggestion[],
    data: Record<string, unknown>[]
  ): Promise<MappingSuggestion[]> {
    // For each mapping, check if there are conditional rules
    const processed: MappingSuggestion[] = [];

    for (const mapping of mappings) {
      // Check if any records trigger conditional rules
      const conditionalMappings = await this.conditionalService.loadMappings(mapping.sourceColumn);

      if (conditionalMappings.length === 0) {
        processed.push(mapping);
        continue;
      }

      // Apply conditional logic (simplified - just use first record to determine)
      const result = await this.conditionalService.evaluate(mapping.sourceColumn, data[0]);

      if (result.matched && result.actionType === 'skip') {
        // Skip this mapping
        continue;
      } else if (result.matched && result.actionType === 'map_to_column') {
        // Override mapping
        const config = result.actionConfig as { target_table?: string; target_column?: string };
        processed.push({
          ...mapping,
          targetTable: config.target_table || mapping.targetTable,
          targetColumn: config.target_column || mapping.targetColumn
        });
      } else {
        processed.push(mapping);
      }
    }

    return processed;
  }

  /** Group mappings by target table */
  private groupByTable(mappings: MappingSuggestion[]): Record<string, MappingSuggestion[]> {
    const groups: Record<string, MappingSuggestion[]> = {};

    for (const mapping of mappings) {
      if (!groups[mapping.targetTable]) {
        groups[mapping.targetTable] = [];
      }
      groups[mapping.targetTable].push(mapping);
    }

    return groups;
  }

  /** Process a batch with lineage tracking */
  private async processBatchWithLineage(
    table: string,
    mappings: MappingSuggestion[],
    data: Record<string, unknown>[],
    dna: SourceDNA,
    batchId: string,
    startIndex: number,
    lineageService: DataLineageService | undefined,
    options: Required<EnterpriseMigrationOptions>
  ): Promise<{
    successCount: number;
    errorCount: number;
    errors: Array<{ row: number; field: string; error: string }>;
    results: MigrationResult[];
    lineageCount: number;
  }> {
    const errors: Array<{ row: number; field: string; error: string }> = [];
    const results: MigrationResult[] = [];
    const transformedRows: Record<string, unknown>[] = [];
    let successCount = 0;
    let errorCount = 0;
    let lineageCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = startIndex + i + 1;
      const transformed: Record<string, unknown> = {
        organization_id: this.enterpriseOrgId,
        source_system: dna.sourceSystem || dna.sourceType,
        source_id: String(row['id'] || row['employee_id'] || rowNumber),
        migration_batch_id: batchId,
        migration_status: 'IMPORTED'
      };

      let rowHasError = false;

      for (const mapping of mappings) {
        try {
          const sourceValue = row[mapping.sourceColumn];
          if (sourceValue === undefined) continue;

          // Transform
          const transformedValue = transformValueWithTracking(
            sourceValue,
            mapping.transformRequired
          );

          // Validate
          const validation = validateValueEnterprise(
            transformedValue,
            mapping.targetColumn,
            table
          );

          // Track lineage
          if (lineageService) {
            const transformations: TransformationStep[] = mapping.transformRequired
              ? [{
                  step: 1,
                  type: mapping.transformRequired,
                  beforeHash: await CryptoUtils.hashValue(String(sourceValue)),
                  afterHash: await CryptoUtils.hashValue(String(transformedValue))
                }]
              : [];

            await lineageService.trackTransformation(
              rowNumber,
              mapping.sourceColumn,
              sourceValue,
              table,
              mapping.targetColumn,
              transformations,
              transformedValue,
              undefined, // targetRowId set after insert
              validation.valid,
              validation.error ? [validation.error] : []
            );
            lineageCount++;
          }

          if (!validation.valid) {
            errors.push({
              row: rowNumber,
              field: mapping.sourceColumn,
              error: validation.error || 'Validation failed'
            });
            rowHasError = true;
          } else {
            transformed[mapping.targetColumn] = transformedValue;
          }
        } catch (err) {
          errors.push({
            row: rowNumber,
            field: mapping.sourceColumn,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
          rowHasError = true;
        }
      }

      if (!rowHasError) {
        transformedRows.push(transformed);
        successCount++;
      } else {
        errorCount++;
      }
    }

    // Insert if not dry run
    if (!options.dryRun && !options.validateOnly && transformedRows.length > 0) {
      const { error: insertError } = await this.enterpriseSupabase
        .from(table)
        .insert(transformedRows);

      if (insertError) {
        errors.push({
          row: startIndex + 1,
          field: 'INSERT',
          error: insertError.message
        });
      }
    }

    return { successCount, errorCount, errors, results, lineageCount };
  }

  // =========================================================================
  // PUBLIC SERVICE ACCESSORS
  // =========================================================================

  /** Get snapshot service for rollback operations */
  getSnapshotService(): SnapshotService {
    return this.snapshotService;
  }

  /** Get retry service for failed operation handling */
  getRetryService(): RetryService {
    return this.retryService;
  }

  /** Get deduplication service */
  getDeduplicationService(): DeduplicationService {
    return this.dedupService;
  }

  /** Get quality scoring service */
  getQualityService(): QualityScoringService {
    return this.qualityService;
  }

  /** Get workflow orchestration service */
  getWorkflowService(): WorkflowOrchestrationService {
    return this.workflowService;
  }
}
