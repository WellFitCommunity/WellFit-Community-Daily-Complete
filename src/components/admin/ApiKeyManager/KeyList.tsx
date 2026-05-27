// src/components/admin/ApiKeyManager/KeyList.tsx
//
// Renders the search/filter controls, the API keys table, and the table
// footer. Sort + filter state lives here; the underlying data and mutators
// are passed in from the parent.

import React from 'react';
import type { ApiKey } from './types';
import {
  displayableApiKeyRepresentation,
  formatDate,
  getRelativeTime,
  toComparable,
} from './sortUtils';

export type SortField = keyof ApiKey;
export type SortDirection = 'asc' | 'desc';
export type FilterStatus = 'all' | 'active' | 'inactive';

interface KeyListProps {
  apiKeys: ApiKey[];
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterStatus: FilterStatus;
  setFilterStatus: (v: FilterStatus) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onCopy: (text: string, label?: string) => void;
  onToggleStatus: (keyId: string, currentStatus: boolean, orgName: string) => void;
  onRevoke: (keyId: string, orgName: string) => void;
  onExportCsv: () => void;
  autoRefreshActive: boolean;
  filteredAndSortedKeys: ApiKey[];
}

/**
 * Compute the filtered + sorted key list for the current search/filter/sort
 * state. Exposed as a module-level helper so the parent can also use it for
 * derived UI (the "filtered count" badge, the CSV export, etc.).
 */
export function selectFilteredSortedKeys(
  apiKeys: ApiKey[],
  searchTerm: string,
  filterStatus: FilterStatus,
  sortField: SortField,
  sortDirection: SortDirection,
): ApiKey[] {
  const filtered = apiKeys.filter((key) => {
    const matchesSearch =
      key.org_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      key.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'active' && key.active) ||
      (filterStatus === 'inactive' && !key.active);

    return matchesSearch && matchesFilter;
  });

  return filtered.sort((a, b) => {
    const aValue = toComparable(a[sortField]);
    const bValue = toComparable(b[sortField]);

    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return sortDirection === 'asc' ? -1 : 1;
    if (bValue === null) return sortDirection === 'asc' ? 1 : -1;

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

function getSortIcon(field: SortField, sortField: SortField, sortDirection: SortDirection): string {
  if (sortField !== field) return '↕️';
  return sortDirection === 'asc' ? '↑' : '↓';
}

export const KeyList: React.FC<KeyListProps> = ({
  apiKeys,
  loading,
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  sortField,
  sortDirection,
  onSort,
  onCopy,
  onToggleStatus,
  onRevoke,
  onExportCsv,
  autoRefreshActive,
  filteredAndSortedKeys,
}) => {
  return (
    <>
      {/* Search and Filter Controls */}
      <div className="mb-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
        <div className="grow">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search API Keys
          </label>
          <input
            id="search"
            type="text"
            placeholder="Search by organization or key ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="filter" className="block text-sm font-medium text-gray-700 mb-1">
            Filter Status
          </label>
          <select
            id="filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-transparent"
          >
            <option value="all">All Keys</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={onExportCsv}
            disabled={loading || filteredAndSortedKeys.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
          >
            <span>📊</span>
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Results Summary */}
      {searchTerm || filterStatus !== 'all' ? (
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredAndSortedKeys.length} of {apiKeys.length} API keys
          {searchTerm && ` matching "${searchTerm}"`}
          {filterStatus !== 'all' && ` (${filterStatus} only)`}
        </div>
      ) : null}

      {/* No Results State */}
      {!loading && apiKeys.length > 0 && filteredAndSortedKeys.length === 0 && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-600">No API keys match your current filters.</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterStatus('all');
            }}
            className="mt-2 text-[var(--ea-primary)] hover:text-[var(--ea-primary-hover)] underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* API Keys Table */}
      {filteredAndSortedKeys.length > 0 && (
        <div className="overflow-x-auto">
          <table
            className="w-full table-auto border-collapse border border-gray-300"
            aria-label="API Keys"
          >
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => onSort('org_name')}
                  title="Click to sort by organization"
                >
                  <div className="flex items-center justify-between">
                    <span>Organization</span>
                    <span className="text-xs">{getSortIcon('org_name', sortField, sortDirection)}</span>
                  </div>
                </th>
                <th className="border border-gray-300 px-4 py-3 text-left">Key Identifier</th>
                <th
                  className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => onSort('active')}
                  title="Click to sort by status"
                >
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <span className="text-xs">{getSortIcon('active', sortField, sortDirection)}</span>
                  </div>
                </th>
                <th
                  className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => onSort('usage_count')}
                  title="Click to sort by usage count"
                >
                  <div className="flex items-center justify-between">
                    <span>Usage</span>
                    <span className="text-xs">
                      {getSortIcon('usage_count', sortField, sortDirection)}
                    </span>
                  </div>
                </th>
                <th
                  className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => onSort('last_used')}
                  title="Click to sort by last used date"
                >
                  <div className="flex items-center justify-between">
                    <span>Last Used</span>
                    <span className="text-xs">
                      {getSortIcon('last_used', sortField, sortDirection)}
                    </span>
                  </div>
                </th>
                <th
                  className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => onSort('created_at')}
                  title="Click to sort by creation date"
                >
                  <div className="flex items-center justify-between">
                    <span>Created</span>
                    <span className="text-xs">
                      {getSortIcon('created_at', sortField, sortDirection)}
                    </span>
                  </div>
                </th>
                <th className="border border-gray-300 px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedKeys.map((key, index) => (
                <tr
                  key={key.id}
                  className={`${loading ? 'opacity-50' : ''} ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  } hover:bg-[var(--ea-primary)]/5 transition-colors`}
                >
                  <td className="border border-gray-300 px-4 py-3">
                    <div className="font-medium text-gray-900">{key.org_name}</div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <span>ID: {key.id.slice(0, 8)}...</span>
                      <button
                        onClick={() => onCopy(key.id, 'Key ID')}
                        className="text-[var(--ea-primary)] hover:text-[var(--ea-primary-hover)] transition-colors"
                        title="Copy full key ID"
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  <td className="border border-gray-300 px-4 py-3">
                    <div className="flex items-center gap-2 font-mono text-sm">
                      <span>{displayableApiKeyRepresentation(key.api_key_hash, key.org_name)}</span>
                      <button
                        onClick={() => onCopy(key.id, 'Key ID')}
                        className="text-[var(--ea-primary)] hover:text-[var(--ea-primary-hover)] transition-colors text-xs"
                        title="Copy key ID"
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  <td className="border border-gray-300 px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        key.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 mr-1.5 rounded-full ${
                          key.active ? 'bg-green-400' : 'bg-red-400'
                        }`}
                      ></span>
                      {key.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-4 py-3">
                    <div className="font-medium">{key.usage_count.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">total requests</div>
                  </td>
                  <td className="border border-gray-300 px-4 py-3">
                    <div className="text-sm">{formatDate(key.last_used)}</div>
                    <div className="text-xs text-gray-500">{getRelativeTime(key.last_used)}</div>
                  </td>
                  <td className="border border-gray-300 px-4 py-3">
                    <div className="text-sm">{formatDate(key.created_at)}</div>
                    <div className="text-xs text-gray-500">{getRelativeTime(key.created_at)}</div>
                    {key.created_by && (
                      <div className="text-xs text-gray-400 mt-1">by {key.created_by}</div>
                    )}
                  </td>
                  <td className="border border-gray-300 px-4 py-3">
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={() => onToggleStatus(key.id, key.active, key.org_name)}
                        disabled={loading}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                          key.active
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                        title={key.active ? 'Disable this API key' : 'Enable this API key'}
                      >
                        {key.active ? '⏸️ Disable' : '▶️ Enable'}
                      </button>

                      <button
                        onClick={() => onRevoke(key.id, key.org_name)}
                        disabled={loading}
                        className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                        title="Permanently revoke this API key"
                      >
                        🗑️ Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Table Footer with Pagination Info */}
      {filteredAndSortedKeys.length > 0 && (
        <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
          <div>
            Displaying {filteredAndSortedKeys.length}{' '}
            {filteredAndSortedKeys.length === 1 ? 'key' : 'keys'}
          </div>
          <div className="flex items-center space-x-4">
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
            {autoRefreshActive && (
              <span className="text-green-600 flex items-center space-x-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span>Auto-refreshing</span>
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default KeyList;
