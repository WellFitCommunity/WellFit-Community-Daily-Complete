/**
 * Enterprise Migration Dashboard
 *
 * Six-to-Seven Figure Epic Migration Feature Parity UI
 *
 * Features:
 * - Data lineage visualization
 * - Point-in-time rollback controls
 * - Quality scoring with grades
 * - Duplicate resolution workflow
 * - Real-time progress tracking
 * - Retry queue management
 * - Workflow orchestration view
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import {
  EnterpriseMigrationService,
  QualityScore,
  DedupCandidate,
  MigrationSnapshot,
  RetryQueueItem
} from '../../services/enterpriseMigrationEngine';
import { SourceDNA, MappingSuggestion, DataDNAGeneratorStatic } from '../../services/migration-engine';
import { EAAlert } from '../envision-atlus';
import {
  getGrade,
  parseCSV,
  type MigrationBatch,
  type LineageRecord,
} from './enterpriseMigrationHelpers';
import { EnterpriseMigrationOverviewTab } from './EnterpriseMigrationOverviewTab';
import {
  EnterpriseMigrationQualityTab,
  EnterpriseMigrationDuplicatesTab,
  EnterpriseMigrationRollbackTab,
  EnterpriseMigrationRetriesTab,
  EnterpriseMigrationLineageTab,
} from './EnterpriseMigrationTabs';

// =============================================================================
// COMPONENT
// =============================================================================

export const EnterpriseMigrationDashboard: React.FC = () => {
  const supabase = useSupabaseClient();

  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'lineage' | 'quality' | 'duplicates' | 'rollback' | 'retries'>('overview');
  const [batches, setBatches] = useState<MigrationBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [duplicates, setDuplicates] = useState<DedupCandidate[]>([]);
  const [snapshots, setSnapshots] = useState<MigrationSnapshot[]>([]);
  const [retryQueue, setRetryQueue] = useState<RetryQueueItem[]>([]);
  const [lineageRecords, setLineageRecords] = useState<LineageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, unknown>[] | null>(null);
  const [sourceDNA, setSourceDNA] = useState<SourceDNA | null>(null);
  const [mappingSuggestions, setMappingSuggestions] = useState<MappingSuggestion[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);

  // Load batches
  const loadBatches = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('hc_migration_batch')
        .select('batch_id, source_system, record_count, success_count, error_count, status, started_at, completed_at')
        .order('started_at', { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;

      setBatches((data || []).map(row => ({
        batchId: row.batch_id,
        sourceSystem: row.source_system,
        recordCount: row.record_count,
        successCount: row.success_count || 0,
        errorCount: row.error_count || 0,
        status: row.status,
        startedAt: new Date(row.started_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined
      })));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load batches');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Load quality score for selected batch
  const loadQualityScore = useCallback(async (batchId: string) => {
    try {
      const { data } = await supabase
        .from('migration_quality_scores')
        .select('overall_score, completeness_score, accuracy_score, consistency_score, uniqueness_score, recommendations')
        .eq('migration_batch_id', batchId)
        .single();

      if (data) {
        setQualityScore({
          overallScore: data.overall_score,
          completenessScore: data.completeness_score,
          accuracyScore: data.accuracy_score,
          consistencyScore: data.consistency_score,
          uniquenessScore: data.uniqueness_score,
          grade: getGrade(data.overall_score),
          recommendations: data.recommendations || [],
          readyForProduction: data.overall_score >= 85
        });
      }
    } catch {
      // Quality score may not exist
    }
  }, [supabase]);

  // Load duplicates
  const loadDuplicates = useCallback(async (batchId: string) => {
    try {
      const { data } = await supabase
        .from('migration_dedup_candidates')
        .select('candidate_id, record_a_id, record_a_data, record_b_id, record_b_data, overall_similarity, name_similarity, dob_match, phone_similarity, email_similarity, match_method, resolution, requires_human_review')
        .eq('migration_batch_id', batchId)
        .eq('resolution', 'pending')
        .order('overall_similarity', { ascending: false });

      setDuplicates((data || []).map(row => ({
        candidateId: row.candidate_id,
        recordAId: row.record_a_id,
        recordAData: row.record_a_data,
        recordBId: row.record_b_id,
        recordBData: row.record_b_data,
        overallSimilarity: row.overall_similarity,
        nameSimilarity: row.name_similarity,
        dobMatch: row.dob_match,
        phoneSimilarity: row.phone_similarity,
        emailSimilarity: row.email_similarity,
        matchMethod: row.match_method,
        resolution: row.resolution,
        requiresHumanReview: row.requires_human_review
      })));
    } catch {
      // Duplicates may not exist
    }
  }, [supabase]);

  // Load snapshots
  const loadSnapshots = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('migration_snapshots')
        .select('snapshot_id, migration_batch_id, snapshot_name, snapshot_type, description, tables_included, snapshot_data, total_rows, size_bytes, status, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10);

      setSnapshots((data || []).map(row => ({
        snapshotId: row.snapshot_id,
        migrationBatchId: row.migration_batch_id,
        snapshotName: row.snapshot_name,
        snapshotType: row.snapshot_type,
        description: row.description,
        tablesIncluded: row.tables_included,
        snapshotData: row.snapshot_data,
        totalRows: row.total_rows,
        sizeBytes: row.size_bytes,
        status: row.status,
        createdAt: new Date(row.created_at)
      })));
    } catch {
      // Snapshots may not exist
    }
  }, [supabase]);

  // Load retry queue
  const loadRetryQueue = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('migration_retry_queue')
        .select('retry_id, migration_batch_id, failed_operation, target_table, source_row_numbers, error_code, error_message, attempt_number, max_attempts, next_retry_at, status')
        .in('status', ['pending', 'retrying'])
        .order('next_retry_at', { ascending: true })
        .limit(20);

      setRetryQueue((data || []).map(row => ({
        retryId: row.retry_id,
        migrationBatchId: row.migration_batch_id,
        failedOperation: row.failed_operation,
        targetTable: row.target_table,
        sourceRowNumbers: row.source_row_numbers,
        errorCode: row.error_code,
        errorMessage: row.error_message,
        attemptNumber: row.attempt_number,
        maxAttempts: row.max_attempts,
        nextRetryAt: new Date(row.next_retry_at),
        status: row.status
      })));
    } catch {
      // Retry queue may not exist
    }
  }, [supabase]);

  // Load lineage records
  const loadLineage = useCallback(async (batchId: string) => {
    try {
      const { data } = await supabase
        .from('migration_data_lineage')
        .select('source_file_name, source_row_number, source_column_name, target_table, target_column, transformations, validation_passed')
        .eq('migration_batch_id', batchId)
        .order('source_row_number')
        .limit(100);

      setLineageRecords((data || []).map(row => ({
        sourceFile: row.source_file_name,
        sourceRow: row.source_row_number,
        sourceColumn: row.source_column_name,
        targetTable: row.target_table,
        targetColumn: row.target_column,
        transformations: (row.transformations || []).map((t: { type: string }) => t.type),
        validationPassed: row.validation_passed
      })));
    } catch {
      // Lineage may not exist
    }
  }, [supabase]);

  // Initial load
  useEffect(() => {
    loadBatches();
    loadSnapshots();
    loadRetryQueue();
  }, [loadBatches, loadSnapshots, loadRetryQueue]);

  // Load batch details when selected
  useEffect(() => {
    if (selectedBatch) {
      loadQualityScore(selectedBatch);
      loadDuplicates(selectedBatch);
      loadLineage(selectedBatch);
    }
  }, [selectedBatch, loadQualityScore, loadDuplicates, loadLineage]);

  // Helper functions
  // File handling
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setError(null);

    try {
      const text = await file.text();
      let data: Record<string, unknown>[];

      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        data = parseCSV(text);
      } else {
        throw new Error('Unsupported file type. Please upload CSV or JSON.');
      }

      setParsedData(data);

      // Generate DNA
      const columns = Object.keys(data[0] || {});
      const dna = DataDNAGeneratorStatic.generateDNA('CSV', columns, data);
      setSourceDNA(dna);

      // Get mapping suggestions
      const service = new EnterpriseMigrationService(supabase, 'temp');
      const analysis = await service.analyzeSource('CSV', data);
      setMappingSuggestions(analysis.suggestions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  };

  // Execute migration
  const executeMigration = async () => {
    if (!parsedData || !sourceDNA || mappingSuggestions.length === 0) return;

    setIsMigrating(true);
    setMigrationProgress(0);
    setError(null);

    try {
      const service = new EnterpriseMigrationService(supabase, 'WF-0001');

      const result = await service.executeEnterpriseMigration(
        sourceDNA,
        parsedData,
        mappingSuggestions,
        {
          enableLineageTracking: true,
          createPreMigrationSnapshot: true,
          enableDeduplication: true,
          enableQualityScoring: true,
          enableRetryLogic: true
        }
      );

      setMigrationProgress(100);
      setSelectedBatch(result.batchId);

      // Reload data
      await loadBatches();
      await loadSnapshots();

      if (result.qualityScore) {
        setQualityScore(result.qualityScore);
      }

      // Show success
      setActiveTab('quality');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setIsMigrating(false);
    }
  };

  // Rollback
  const handleRollback = async (snapshotId: string) => {
    if (!confirm('Are you sure you want to rollback to this snapshot? This will replace current data.')) {
      return;
    }

    try {
      const { error: rollbackError } = await supabase.rpc('rollback_to_snapshot', {
        p_snapshot_id: snapshotId,
        p_reason: 'User-initiated rollback from dashboard',
        p_user_id: null,
        p_approver_id: null
      });

      if (rollbackError) throw rollbackError;

      await loadSnapshots();
      await loadBatches();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    }
  };

  // Resolve duplicate
  const handleResolveDuplicate = async (candidateId: string, resolution: DedupCandidate['resolution']) => {
    try {
      await supabase
        .from('migration_dedup_candidates')
        .update({
          resolution,
          resolved_at: new Date().toISOString()
        })
        .eq('candidate_id', candidateId);

      if (selectedBatch) {
        await loadDuplicates(selectedBatch);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve duplicate');
    }
  };

  // Main render
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Enterprise Migration Engine</h1>
          <p className="text-slate-400">Six-to-Seven Figure Epic Migration Feature Parity</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <EAAlert variant="critical" onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'quality', label: 'Quality Score' },
          { id: 'duplicates', label: 'Duplicates' },
          { id: 'lineage', label: 'Data Lineage' },
          { id: 'rollback', label: 'Rollback' },
          { id: 'retries', label: 'Retries' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-slate-800 text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <EnterpriseMigrationOverviewTab
            onFileUpload={handleFileUpload}
            uploadedFile={uploadedFile}
            parsedData={parsedData}
            sourceDNA={sourceDNA}
            mappingSuggestions={mappingSuggestions}
            onExecuteMigration={executeMigration}
            isMigrating={isMigrating}
            migrationProgress={migrationProgress}
            batches={batches}
            selectedBatch={selectedBatch}
            onSelectBatch={setSelectedBatch}
          />
        )}
        {activeTab === 'quality' && <EnterpriseMigrationQualityTab qualityScore={qualityScore} />}
        {activeTab === 'duplicates' && (
          <EnterpriseMigrationDuplicatesTab duplicates={duplicates} onResolve={handleResolveDuplicate} />
        )}
        {activeTab === 'lineage' && <EnterpriseMigrationLineageTab lineageRecords={lineageRecords} />}
        {activeTab === 'rollback' && (
          <EnterpriseMigrationRollbackTab snapshots={snapshots} onRollback={handleRollback} />
        )}
        {activeTab === 'retries' && <EnterpriseMigrationRetriesTab retryQueue={retryQueue} />}
      </div>
    </div>
  );
};

export default EnterpriseMigrationDashboard;
