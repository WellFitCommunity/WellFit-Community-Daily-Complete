/**
 * Overview tab for the Enterprise Migration Dashboard: file upload, source
 * analysis, mapping suggestions, execute button, and recent batches. Extracted
 * from EnterpriseMigrationDashboard (600-line rule).
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import type { SourceDNA, MappingSuggestion } from '../../services/migration-engine';
import { EACard, EACardHeader, EACardContent, EAButton } from '../envision-atlus';
import { getStatusBadge, type MigrationBatch } from './enterpriseMigrationHelpers';

interface OverviewTabProps {
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadedFile: File | null;
  parsedData: Record<string, unknown>[] | null;
  sourceDNA: SourceDNA | null;
  mappingSuggestions: MappingSuggestion[];
  onExecuteMigration: () => void;
  isMigrating: boolean;
  migrationProgress: number;
  batches: MigrationBatch[];
  selectedBatch: string | null;
  onSelectBatch: (batchId: string) => void;
}

export const EnterpriseMigrationOverviewTab: React.FC<OverviewTabProps> = ({
  onFileUpload,
  uploadedFile,
  parsedData,
  sourceDNA,
  mappingSuggestions,
  onExecuteMigration,
  isMigrating,
  migrationProgress,
  batches,
  selectedBatch,
  onSelectBatch,
}) => (
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
              onChange={onFileUpload}
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
              onClick={onExecuteMigration}
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
                onClick={() => onSelectBatch(batch.batchId)}
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
