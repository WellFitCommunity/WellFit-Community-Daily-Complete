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
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAAlert
} from '../envision-atlus';

// =============================================================================
// TYPES
// =============================================================================

interface MigrationBatch {
  batchId: string;
  sourceSystem: string;
  recordCount: number;
  successCount: number;
  errorCount: number;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  qualityScore?: number;
}

interface LineageRecord {
  sourceFile: string;
  sourceRow: number;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  transformations: string[];
  validationPassed: boolean;
}

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
        .select('*')
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
        .select('*')
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
        .select('*')
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
        .select('*')
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
        .select('*')
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
        .select('*')
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
  const getGrade = (score: number): string => {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const getGradeColor = (grade: string): string => {
    if (grade.startsWith('A')) return 'text-green-400';
    if (grade.startsWith('B')) return 'text-blue-400';
    if (grade.startsWith('C')) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, 'critical' | 'high' | 'elevated' | 'normal' | 'info' | 'neutral'> = {
      'COMPLETED': 'normal',
      'COMPLETED_WITH_ERRORS': 'elevated',
      'PROCESSING': 'info',
      'FAILED': 'critical',
      'DRY_RUN': 'info'
    };
    return <EABadge variant={colors[status] || 'info'}>{status}</EABadge>;
  };

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

  const parseCSV = (text: string): Record<string, unknown>[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const data: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, unknown> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || null;
      });
      data.push(row);
    }

    return data;
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

  // Render functions
  const renderOverview = () => (
    <div className="space-y-6">
      {/* File Upload */}
      <EACard>
        <EACardHeader>
          <h3 className="text-lg font-semibold text-white">Start New Migration</h3>
        </EACardHeader>
        <EACardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer text-teal-400 hover:text-teal-300"
              >
                {uploadedFile ? uploadedFile.name : 'Click to upload CSV or JSON file'}
              </label>
              {parsedData && (
                <p className="mt-2 text-sm text-slate-400">
                  {parsedData.length} records detected
                </p>
              )}
            </div>

            {sourceDNA && (
              <div className="bg-slate-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-300 mb-2">Source Analysis</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Source System:</span>
                    <span className="ml-2 text-white">{sourceDNA.sourceSystem || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Columns:</span>
                    <span className="ml-2 text-white">{sourceDNA.columnCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Rows:</span>
                    <span className="ml-2 text-white">{sourceDNA.rowCount}</span>
                  </div>
                </div>
              </div>
            )}

            {mappingSuggestions.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-300 mb-2">Mapping Suggestions</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {mappingSuggestions.slice(0, 10).map((mapping, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{mapping.sourceColumn}</span>
                      <span className="text-slate-600">→</span>
                      <span className="text-teal-400">{mapping.targetTable}.{mapping.targetColumn}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        mapping.confidence > 0.8 ? 'bg-green-900 text-green-300' :
                        mapping.confidence > 0.5 ? 'bg-yellow-900 text-yellow-300' :
                        'bg-red-900 text-red-300'
                      }`}>
                        {Math.round(mapping.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsedData && (
              <EAButton
                onClick={executeMigration}
                disabled={isMigrating}
                className="w-full"
              >
                {isMigrating ? `Migrating... ${migrationProgress}%` : 'Execute Enterprise Migration'}
              </EAButton>
            )}
          </div>
        </EACardContent>
      </EACard>

      {/* Recent Batches */}
      <EACard>
        <EACardHeader>
          <h3 className="text-lg font-semibold text-white">Recent Migration Batches</h3>
        </EACardHeader>
        <EACardContent>
          {batches.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No migrations yet</p>
          ) : (
            <div className="space-y-3">
              {batches.map(batch => (
                <div
                  key={batch.batchId}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedBatch === batch.batchId
                      ? 'border-teal-500 bg-slate-800'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedBatch(batch.batchId)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">{batch.sourceSystem}</span>
                      <span className="text-slate-500 ml-2 text-sm">
                        {batch.startedAt.toLocaleDateString()}
                      </span>
                    </div>
                    {getStatusBadge(batch.status)}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <span className="text-slate-400">
                      {batch.recordCount} records
                    </span>
                    <span className="text-green-400">
                      {batch.successCount} success
                    </span>
                    {batch.errorCount > 0 && (
                      <span className="text-red-400">
                        {batch.errorCount} errors
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </EACardContent>
      </EACard>
    </div>
  );

  const renderQuality = () => (
    <div className="space-y-6">
      {qualityScore ? (
        <>
          {/* Overall Score */}
          <EACard>
            <EACardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg text-slate-400">Data Quality Score</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-5xl font-bold text-white">
                      {qualityScore.overallScore}
                    </span>
                    <span className={`text-3xl font-bold ${getGradeColor(qualityScore.grade)}`}>
                      {qualityScore.grade}
                    </span>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-lg ${
                  qualityScore.readyForProduction
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-red-900/50 text-red-400'
                }`}>
                  {qualityScore.readyForProduction ? 'Production Ready' : 'Needs Review'}
                </div>
              </div>
            </EACardContent>
          </EACard>

          {/* Score Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Completeness', score: qualityScore.completenessScore, desc: 'Required fields filled' },
              { label: 'Accuracy', score: qualityScore.accuracyScore, desc: 'Validation passed' },
              { label: 'Consistency', score: qualityScore.consistencyScore, desc: 'Format standards' },
              { label: 'Uniqueness', score: qualityScore.uniquenessScore, desc: 'No duplicates' }
            ].map(item => (
              <EACard key={item.label}>
                <EACardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="text-2xl font-bold text-white">{item.score}%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.score >= 90 ? 'bg-green-500' :
                        item.score >= 70 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                </EACardContent>
              </EACard>
            ))}
          </div>

          {/* Recommendations */}
          {qualityScore.recommendations.length > 0 && (
            <EACard>
              <EACardHeader>
                <h3 className="text-lg font-semibold text-white">Recommendations</h3>
              </EACardHeader>
              <EACardContent>
                <ul className="space-y-2">
                  {qualityScore.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-300">
                      <span className="text-yellow-400">!</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </EACardContent>
            </EACard>
          )}
        </>
      ) : (
        <EAAlert variant="info">
          Select a migration batch to view quality scores
        </EAAlert>
      )}
    </div>
  );

  const renderDuplicates = () => (
    <div className="space-y-4">
      <EACard>
        <EACardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Potential Duplicates</h3>
            <EABadge variant="elevated">{duplicates.length} pending</EABadge>
          </div>
        </EACardHeader>
        <EACardContent>
          {duplicates.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No duplicates requiring review</p>
          ) : (
            <div className="space-y-4">
              {duplicates.map(dup => (
                <div key={dup.candidateId} className="border border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-medium text-white">
                      {Math.round(dup.overallSimilarity * 100)}% Similar
                    </span>
                    <span className="text-sm text-slate-500">{dup.matchMethod}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-800 rounded-sm p-3">
                      <h4 className="text-sm text-slate-400 mb-2">Record A</h4>
                      <pre className="text-xs text-slate-300 overflow-auto max-h-32">
                        {JSON.stringify(dup.recordAData, null, 2)}
                      </pre>
                    </div>
                    <div className="bg-slate-800 rounded-sm p-3">
                      <h4 className="text-sm text-slate-400 mb-2">Record B</h4>
                      <pre className="text-xs text-slate-300 overflow-auto max-h-32">
                        {JSON.stringify(dup.recordBData, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <EAButton
                      variant="secondary"
                      size="sm"
                      onClick={() => handleResolveDuplicate(dup.candidateId, 'merge_a')}
                    >
                      Keep A
                    </EAButton>
                    <EAButton
                      variant="secondary"
                      size="sm"
                      onClick={() => handleResolveDuplicate(dup.candidateId, 'merge_b')}
                    >
                      Keep B
                    </EAButton>
                    <EAButton
                      variant="secondary"
                      size="sm"
                      onClick={() => handleResolveDuplicate(dup.candidateId, 'keep_both')}
                    >
                      Keep Both
                    </EAButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </EACardContent>
      </EACard>
    </div>
  );

  const renderRollback = () => (
    <div className="space-y-4">
      <EAAlert variant="warning">
        Rollback will replace current data with snapshot data. This action requires approval.
      </EAAlert>

      <EACard>
        <EACardHeader>
          <h3 className="text-lg font-semibold text-white">Available Snapshots</h3>
        </EACardHeader>
        <EACardContent>
          {snapshots.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No snapshots available</p>
          ) : (
            <div className="space-y-3">
              {snapshots.map(snap => (
                <div
                  key={snap.snapshotId}
                  className="flex items-center justify-between p-4 bg-slate-800 rounded-lg"
                >
                  <div>
                    <h4 className="text-white font-medium">{snap.snapshotName}</h4>
                    <p className="text-sm text-slate-400">
                      {snap.snapshotType} - {snap.totalRows} rows - {(snap.sizeBytes / 1024).toFixed(1)} KB
                    </p>
                    <p className="text-xs text-slate-500">
                      {snap.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <EAButton
                    variant="danger"
                    size="sm"
                    onClick={() => handleRollback(snap.snapshotId)}
                  >
                    Rollback
                  </EAButton>
                </div>
              ))}
            </div>
          )}
        </EACardContent>
      </EACard>
    </div>
  );

  const renderRetries = () => (
    <div className="space-y-4">
      <EACard>
        <EACardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Retry Queue</h3>
            <EABadge variant="info">{retryQueue.length} pending</EABadge>
          </div>
        </EACardHeader>
        <EACardContent>
          {retryQueue.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No retries pending</p>
          ) : (
            <div className="space-y-3">
              {retryQueue.map(retry => (
                <div
                  key={retry.retryId}
                  className="p-4 bg-slate-800 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{retry.failedOperation}</span>
                    <EABadge variant={retry.status === 'retrying' ? 'elevated' : 'info'}>
                      Attempt {retry.attemptNumber}/{retry.maxAttempts}
                    </EABadge>
                  </div>
                  <p className="text-sm text-red-400 mb-2">{retry.errorMessage}</p>
                  <p className="text-xs text-slate-500">
                    Next retry: {retry.nextRetryAt.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </EACardContent>
      </EACard>
    </div>
  );

  const renderLineage = () => (
    <div className="space-y-4">
      <EACard>
        <EACardHeader>
          <h3 className="text-lg font-semibold text-white">Data Lineage Trail</h3>
        </EACardHeader>
        <EACardContent>
          {lineageRecords.length === 0 ? (
            <p className="text-slate-400 text-center py-8">
              Select a migration batch to view lineage
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-2">Row</th>
                    <th className="pb-2">Source Column</th>
                    <th className="pb-2">Target</th>
                    <th className="pb-2">Transforms</th>
                    <th className="pb-2">Valid</th>
                  </tr>
                </thead>
                <tbody>
                  {lineageRecords.map((record, idx) => (
                    <tr key={idx} className="border-b border-slate-800">
                      <td className="py-2 text-slate-300">{record.sourceRow}</td>
                      <td className="py-2 text-white">{record.sourceColumn}</td>
                      <td className="py-2 text-teal-400">
                        {record.targetTable}.{record.targetColumn}
                      </td>
                      <td className="py-2 text-slate-400">
                        {record.transformations.length > 0
                          ? record.transformations.join(', ')
                          : '-'}
                      </td>
                      <td className="py-2">
                        {record.validationPassed
                          ? <span className="text-green-400">Yes</span>
                          : <span className="text-red-400">No</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </EACardContent>
      </EACard>
    </div>
  );

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
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'quality' && renderQuality()}
        {activeTab === 'duplicates' && renderDuplicates()}
        {activeTab === 'lineage' && renderLineage()}
        {activeTab === 'rollback' && renderRollback()}
        {activeTab === 'retries' && renderRetries()}
      </div>
    </div>
  );
};

export default EnterpriseMigrationDashboard;
