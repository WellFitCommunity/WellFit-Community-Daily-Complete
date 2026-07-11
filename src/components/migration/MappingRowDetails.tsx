/**
 * Expanded detail row for the Migration Mapping Review table: column statistics,
 * PHI-masked sample formats, alternative mappings, and the "why this mapping"
 * reasons. Extracted from MappingReviewUI to keep it under the 600-line rule.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import type { ColumnDNA, MappingSuggestion } from '../../services/migration-engine';
import { redactSampleValue } from '../../services/migration-engine/phiRedaction';

interface MappingRowDetailsProps {
  columnDNA: ColumnDNA | undefined;
  mapping: MappingSuggestion;
  onSelectAlternative: (sourceColumn: string, targetTable: string, targetColumn: string) => void;
}

export const MappingRowDetails: React.FC<MappingRowDetailsProps> = ({
  columnDNA,
  mapping,
  onSelectAlternative,
}) => (
  <tr className="bg-gray-50">
    <td colSpan={6} className="px-6 py-4">
      <div className="grid grid-cols-3 gap-6">
        {/* Column Stats */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Column Statistics</h4>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-500">Null %:</span> {Math.round((columnDNA?.nullPercentage || 0) * 100)}%</p>
            <p><span className="text-gray-500">Unique %:</span> {Math.round((columnDNA?.uniquePercentage || 0) * 100)}%</p>
            <p><span className="text-gray-500">Avg Length:</span> {Math.round(columnDNA?.avgLength || 0)} chars</p>
            <p><span className="text-gray-500">Data Type:</span> {columnDNA?.dataTypeInferred || 'unknown'}</p>
          </div>
        </div>

        {/* Sample Values */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Sample Value Formats</h4>
          <p className="text-xs text-gray-400 mb-1">PHI-masked (X=letter, 9=digit)</p>
          <ul className="space-y-1 text-sm text-gray-600">
            {columnDNA?.sampleValues.map((val, i) => (
              <li key={i} className="truncate">• {redactSampleValue(val)}</li>
            ))}
          </ul>
        </div>

        {/* Alternative Mappings */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Alternative Mappings</h4>
          {mapping.alternativeMappings.length > 0 ? (
            <div className="space-y-2">
              {mapping.alternativeMappings.map((alt, i) => (
                <button
                  key={i}
                  onClick={() => onSelectAlternative(mapping.sourceColumn, alt.targetTable, alt.targetColumn)}
                  className="block w-full text-left px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {alt.targetTable}.{alt.targetColumn}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {Math.round(alt.confidence * 100)}%
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No alternatives suggested</p>
          )}
        </div>

        {/* Mapping Reasons */}
        <div className="col-span-3 border-t border-gray-200 pt-4 mt-2">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Why this mapping?</h4>
          <div className="flex flex-wrap gap-2">
            {mapping.reasons.map((reason, i) => (
              <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {reason}
              </span>
            ))}
          </div>
        </div>
      </div>
    </td>
  </tr>
);
