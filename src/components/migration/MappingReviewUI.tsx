/**
 * WellFit Community - Migration Mapping Review UI
 *
 * Features:
 * - Visual mapping interface with confidence indicators
 * - Drag-and-drop field remapping
 * - Sample data preview
 * - Bulk approve/reject
 * - Learning feedback integration
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  MappingSuggestion,
  SourceDNA,
  ColumnDNA,
  IntelligentMigrationService
} from '../../services/migration-engine';
import { redactSampleValues } from '../../services/migration-engine/phiRedaction';
import {
  type ConfidenceLevel,
  getConfidenceLevel,
  getConfidenceColor,
  getConfidenceBadgeColor,
  TARGET_SCHEMA,
  StatCard,
} from './mappingReviewSupport';
import { MappingRowDetails } from './MappingRowDetails';

// =============================================================================
// TYPES
// =============================================================================

interface MappingReviewProps {
  sourceDNA: SourceDNA;
  suggestions: MappingSuggestion[];
  similarPastMigrations: Array<{
    dnaId: string;
    similarity: number;
    sourceSystem?: string;
  }>;
  estimatedAccuracy: number;
  onConfirm: (confirmedMappings: ConfirmedMapping[]) => void;
  onCancel: () => void;
  migrationService: IntelligentMigrationService;
}

export interface ConfirmedMapping extends MappingSuggestion {
  userModified: boolean;
  userSkipped: boolean;
  originalSuggestion?: {
    targetTable: string;
    targetColumn: string;
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const MappingReviewUI: React.FC<MappingReviewProps> = ({
  sourceDNA,
  suggestions,
  similarPastMigrations,
  estimatedAccuracy,
  onConfirm,
  onCancel,
  migrationService: _migrationService
}) => {
  // State
  const [mappings, setMappings] = useState<ConfirmedMapping[]>(() =>
    suggestions.map(s => ({
      ...s,
      userModified: false,
      userSkipped: false
    }))
  );
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceLevel | 'all'>('all');
  const [showOnlyProblems, setShowOnlyProblems] = useState(false);

  // Derived state
  const stats = useMemo(() => {
    const high = mappings.filter(m => getConfidenceLevel(m.confidence) === 'high').length;
    const medium = mappings.filter(m => getConfidenceLevel(m.confidence) === 'medium').length;
    const low = mappings.filter(m => getConfidenceLevel(m.confidence) === 'low').length;
    const unmapped = mappings.filter(m => m.targetTable === 'UNMAPPED').length;
    const modified = mappings.filter(m => m.userModified).length;
    const skipped = mappings.filter(m => m.userSkipped).length;

    return { high, medium, low, unmapped, modified, skipped, total: mappings.length };
  }, [mappings]);

  const filteredMappings = useMemo(() => {
    return mappings.filter(m => {
      // Search filter
      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        if (!m.sourceColumn.toLowerCase().includes(search) &&
            !m.targetColumn.toLowerCase().includes(search) &&
            !m.targetTable.toLowerCase().includes(search)) {
          return false;
        }
      }

      // Confidence filter
      if (confidenceFilter !== 'all') {
        if (getConfidenceLevel(m.confidence) !== confidenceFilter) {
          return false;
        }
      }

      // Problems only
      if (showOnlyProblems) {
        if (m.confidence >= 0.8 && m.targetTable !== 'UNMAPPED') {
          return false;
        }
      }

      return true;
    });
  }, [mappings, searchFilter, confidenceFilter, showOnlyProblems]);

  // Handlers
  const handleMappingChange = useCallback((
    sourceColumn: string,
    newTable: string,
    newColumn: string
  ) => {
    setMappings(prev => prev.map(m => {
      if (m.sourceColumn === sourceColumn) {
        const wasModified = m.targetTable !== newTable || m.targetColumn !== newColumn;
        return {
          ...m,
          targetTable: newTable,
          targetColumn: newColumn,
          userModified: wasModified,
          userSkipped: false,
          originalSuggestion: wasModified && !m.originalSuggestion
            ? { targetTable: m.targetTable, targetColumn: m.targetColumn }
            : m.originalSuggestion
        };
      }
      return m;
    }));
  }, []);

  const handleSkipMapping = useCallback((sourceColumn: string) => {
    setMappings(prev => prev.map(m => {
      if (m.sourceColumn === sourceColumn) {
        return { ...m, userSkipped: !m.userSkipped };
      }
      return m;
    }));
  }, []);

  const handleBulkApprove = useCallback((level: ConfidenceLevel) => {
    setMappings(prev => prev.map(m => {
      if (getConfidenceLevel(m.confidence) === level && !m.userSkipped) {
        return { ...m, userModified: false };
      }
      return m;
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    const confirmed = mappings.filter(m => !m.userSkipped);
    onConfirm(confirmed);
  }, [mappings, onConfirm]);

  // Get column DNA for a source column
  const getColumnDNA = useCallback((sourceColumn: string): ColumnDNA | undefined => {
    return sourceDNA.columns.find(c => c.originalName === sourceColumn);
  }, [sourceDNA]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Review Field Mappings
            </h1>
            <p className="text-gray-600 mt-1">
              {sourceDNA.sourceSystem ? `${sourceDNA.sourceSystem} ` : ''}
              {sourceDNA.sourceType} • {sourceDNA.rowCount.toLocaleString()} records • {sourceDNA.columnCount} columns
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium"
            >
              Confirm & Import
            </button>
          </div>
        </div>
      </div>

      {/* Accuracy Indicator */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Estimated Mapping Accuracy
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Based on pattern analysis and past migrations
            </p>
          </div>
          <div className="flex items-center gap-6">
            {/* Accuracy Ring */}
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#E5E7EB"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke={estimatedAccuracy >= 0.8 ? '#10B981' : estimatedAccuracy >= 0.5 ? '#F59E0B' : '#EF4444'}
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${estimatedAccuracy * 251.2} 251.2`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">
                  {Math.round(estimatedAccuracy * 100)}%
                </span>
              </div>
            </div>

            {/* Similar Past Migrations */}
            {similarPastMigrations.length > 0 && (
              <div className="border-l border-gray-200 pl-6">
                <p className="text-sm font-medium text-gray-700">Similar Past Imports</p>
                <div className="mt-2 space-y-1">
                  {similarPastMigrations.slice(0, 3).map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span className="text-gray-600">
                        {m.sourceSystem || 'Unknown'} • {Math.round(m.similarity * 100)}% match
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <StatCard
          label="High Confidence"
          value={stats.high}
          color="green"
          onClick={() => setConfidenceFilter('high')}
          active={confidenceFilter === 'high'}
        />
        <StatCard
          label="Medium Confidence"
          value={stats.medium}
          color="yellow"
          onClick={() => setConfidenceFilter('medium')}
          active={confidenceFilter === 'medium'}
        />
        <StatCard
          label="Low Confidence"
          value={stats.low}
          color="orange"
          onClick={() => setConfidenceFilter('low')}
          active={confidenceFilter === 'low'}
        />
        <StatCard
          label="Unmapped"
          value={stats.unmapped}
          color="red"
          onClick={() => setConfidenceFilter('unmapped')}
          active={confidenceFilter === 'unmapped'}
        />
        <StatCard
          label="Modified"
          value={stats.modified}
          color="blue"
        />
        <StatCard
          label="Skipped"
          value={stats.skipped}
          color="gray"
        />
      </div>

      {/* Bulk Actions */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Bulk Actions:</span>
            <button
              onClick={() => handleBulkApprove('high')}
              className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
            >
              Approve All High Confidence
            </button>
            <button
              onClick={() => handleBulkApprove('medium')}
              className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
            >
              Approve All Medium
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showOnlyProblems}
                onChange={(e) => setShowOnlyProblems(e.target.checked)}
                className="rounded-sm border-gray-300"
              />
              Show only problems
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search fields..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {confidenceFilter !== 'all' && (
              <button
                onClick={() => setConfidenceFilter('all')}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mapping Table */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Source Column
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Detected Pattern
              </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Maps To
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Sample Data
              </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredMappings.map((mapping) => {
              const columnDNA = getColumnDNA(mapping.sourceColumn);
              const confidenceLevel = getConfidenceLevel(mapping.confidence);
              const isExpanded = expandedRow === mapping.sourceColumn;

              return (
                <React.Fragment key={mapping.sourceColumn}>
                  <tr
                    className={`
                      ${mapping.userSkipped ? 'bg-gray-50 opacity-50' : ''}
                      ${mapping.userModified ? 'bg-blue-50' : ''}
                      hover:bg-gray-50 transition-colors
                    `}
                  >
                    {/* Source Column */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : mapping.sourceColumn)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div>
                          <p className="font-medium text-gray-900">{mapping.sourceColumn}</p>
                          {mapping.userModified && (
                            <span className="text-xs text-blue-600">Modified</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Detected Pattern */}
                    <td className="px-6 py-4">
                      <span className={`
                        inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                        ${columnDNA?.primaryPattern === 'NPI' ? 'bg-purple-100 text-purple-800' : ''}
                        ${columnDNA?.primaryPattern === 'EMAIL' ? 'bg-blue-100 text-blue-800' : ''}
                        ${columnDNA?.primaryPattern === 'PHONE' ? 'bg-green-100 text-green-800' : ''}
                        ${columnDNA?.primaryPattern === 'DATE' || columnDNA?.primaryPattern === 'DATE_ISO' ? 'bg-orange-100 text-orange-800' : ''}
                        ${!['NPI', 'EMAIL', 'PHONE', 'DATE', 'DATE_ISO'].includes(columnDNA?.primaryPattern || '') ? 'bg-gray-100 text-gray-800' : ''}
                      `}>
                        {columnDNA?.primaryPattern || 'Unknown'}
                      </span>
                    </td>

                    {/* Confidence */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getConfidenceBadgeColor(confidenceLevel)}`}></div>
                        <span className="text-sm font-medium text-gray-900">
                          {Math.round(mapping.confidence * 100)}%
                        </span>
                      </div>
                    </td>

                    {/* Maps To */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          value={mapping.targetTable}
                          onChange={(e) => {
                            const newTable = e.target.value;
                            const firstColumn = TARGET_SCHEMA[newTable]?.[0] || 'UNMAPPED';
                            handleMappingChange(mapping.sourceColumn, newTable, firstColumn);
                          }}
                          disabled={mapping.userSkipped}
                          className={`
                            px-3 py-1.5 border rounded-lg text-sm
                            ${getConfidenceColor(confidenceLevel)}
                          `}
                        >
                          <option value="UNMAPPED">-- Skip --</option>
                          {Object.keys(TARGET_SCHEMA).map(table => (
                            <option key={table} value={table}>{table}</option>
                          ))}
                        </select>
                        {mapping.targetTable !== 'UNMAPPED' && (
                          <>
                            <span className="text-gray-400">→</span>
                            <select
                              value={mapping.targetColumn}
                              onChange={(e) => handleMappingChange(mapping.sourceColumn, mapping.targetTable, e.target.value)}
                              disabled={mapping.userSkipped}
                              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                            >
                              {TARGET_SCHEMA[mapping.targetTable]?.map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Sample Data */}
                    <td className="px-6 py-4">
                      <div className="max-w-xs truncate text-sm text-gray-600">
                        {/* PHI-masked format templates — never raw sample values */}
                        {redactSampleValues(columnDNA?.sampleValues ?? [], 2).join(', ') || 'No samples'}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleSkipMapping(mapping.sourceColumn)}
                        className={`
                          px-3 py-1.5 text-sm rounded-lg transition-colors
                          ${mapping.userSkipped
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }
                        `}
                      >
                        {mapping.userSkipped ? 'Unskip' : 'Skip'}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row - Details & Alternatives */}
                  {isExpanded && (
                    <MappingRowDetails
                      columnDNA={columnDNA}
                      mapping={mapping}
                      onSelectAlternative={handleMappingChange}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {filteredMappings.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            No mappings match your filters
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{stats.total - stats.skipped}</span> fields will be imported
            {stats.modified > 0 && (
              <span className="ml-2 text-blue-600">({stats.modified} modified by you)</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Confirm & Import {stats.total - stats.skipped} Fields
            </button>
          </div>
        </div>
      </div>

      {/* Spacer for fixed bottom bar */}
      <div className="h-24"></div>
    </div>
  );
};

// =============================================================================
// EXPORT
// =============================================================================

export default MappingReviewUI;
