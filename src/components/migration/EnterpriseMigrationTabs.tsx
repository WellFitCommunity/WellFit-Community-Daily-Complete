/**
 * Quality / Duplicates / Rollback / Retries / Lineage tabs for the Enterprise
 * Migration Dashboard. Extracted from EnterpriseMigrationDashboard (600-line
 * rule). Each is a presentational component reading one state slice.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import type {
  QualityScore,
  DedupCandidate,
  MigrationSnapshot,
  RetryQueueItem,
} from '../../services/enterpriseMigrationEngine';
import { EACard, EACardHeader, EACardContent, EAButton, EABadge, EAAlert } from '../envision-atlus';
import { getGradeColor, type LineageRecord } from './enterpriseMigrationHelpers';

export const EnterpriseMigrationQualityTab: React.FC<{ qualityScore: QualityScore | null }> = ({
  qualityScore,
}) => (
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

interface DuplicatesTabProps {
  duplicates: DedupCandidate[];
  onResolve: (candidateId: string, resolution: DedupCandidate['resolution']) => void;
}

export const EnterpriseMigrationDuplicatesTab: React.FC<DuplicatesTabProps> = ({
  duplicates,
  onResolve,
}) => (
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
                    onClick={() => onResolve(dup.candidateId, 'merge_a')}
                  >
                    Keep A
                  </EAButton>
                  <EAButton
                    variant="secondary"
                    size="sm"
                    onClick={() => onResolve(dup.candidateId, 'merge_b')}
                  >
                    Keep B
                  </EAButton>
                  <EAButton
                    variant="secondary"
                    size="sm"
                    onClick={() => onResolve(dup.candidateId, 'keep_both')}
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

interface RollbackTabProps {
  snapshots: MigrationSnapshot[];
  onRollback: (snapshotId: string) => void;
}

export const EnterpriseMigrationRollbackTab: React.FC<RollbackTabProps> = ({
  snapshots,
  onRollback,
}) => (
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
                  onClick={() => onRollback(snap.snapshotId)}
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

export const EnterpriseMigrationRetriesTab: React.FC<{ retryQueue: RetryQueueItem[] }> = ({
  retryQueue,
}) => (
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

export const EnterpriseMigrationLineageTab: React.FC<{ lineageRecords: LineageRecord[] }> = ({
  lineageRecords,
}) => (
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
