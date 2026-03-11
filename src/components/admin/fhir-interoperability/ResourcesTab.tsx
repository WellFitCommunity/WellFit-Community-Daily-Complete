/**
 * ResourcesTab — Browse, search, create, edit, and validate FHIR resources
 *
 * Purpose: FHIR CRUD operations via MCP FHIR client
 * Used by: FHIRInteroperabilityDashboard
 */

import React, { useState, useCallback } from 'react';
import { Search, Plus, Edit2, Eye, Loader2, FileText } from 'lucide-react';
import {
  FHIRMCPClient,
  type FHIRResourceType,
  type FHIRBundle,
  type ValidationResult,
} from '../../../services/mcp/mcpFHIRClient';
import { auditLogger } from '../../../services/auditLogger';
import { FHIRResourceForm } from './FHIRResourceForm';
import type { ResourceSearchFilters } from './types';

const SEARCHABLE_TYPES: FHIRResourceType[] = [
  'Condition', 'MedicationRequest', 'Observation', 'AllergyIntolerance',
  'Immunization', 'CarePlan', 'Procedure', 'DiagnosticReport',
  'Encounter', 'Patient',
];

type ViewMode = 'search' | 'create' | 'edit' | 'detail';

interface ResourceEntry {
  id: string;
  resourceType: string;
  data: Record<string, unknown>;
}

export const ResourcesTab: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [filters, setFilters] = useState<ResourceSearchFilters>({
    resourceType: 'Condition',
    patientId: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });
  const [results, setResults] = useState<ResourceEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<ResourceEntry | null>(null);

  const client = FHIRMCPClient.getInstance();

  const handleSearch = useCallback(async () => {
    setSearching(true);
    setSearchError(null);
    setSaveSuccess(null);
    try {
      const result = await client.searchResources(
        filters.resourceType as FHIRResourceType,
        {
          patientId: filters.patientId || undefined,
          status: filters.status || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          limit: 50,
        }
      );

      if (result.success && result.data) {
        const bundle = result.data as FHIRBundle;
        const entries: ResourceEntry[] = (bundle.entry || []).map(e => ({
          id: (e.resource as Record<string, unknown>).id as string || e.fullUrl.split('/').pop() || '',
          resourceType: (e.resource as Record<string, unknown>).resourceType as string || filters.resourceType,
          data: e.resource,
        }));
        setResults(entries);
      } else {
        setSearchError(result.error || 'Search failed');
        setResults([]);
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'FHIR_RESOURCE_SEARCH_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { resourceType: filters.resourceType }
      );
      setSearchError('Failed to search resources');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [client, filters]);

  const handleCreate = useCallback(async (
    resourceType: FHIRResourceType,
    data: Record<string, string>,
    patientId: string
  ) => {
    setSaving(true);
    setSaveSuccess(null);
    try {
      const resourceData: Record<string, unknown> = { ...data };
      // Transform observation value to value_quantity for FHIR format
      if (resourceType === 'Observation' && data.value && data.unit) {
        resourceData.value_quantity = { value: parseFloat(data.value), unit: data.unit };
        delete resourceData.value;
        delete resourceData.unit;
      }
      delete resourceData.patient_id;

      const result = await client.createResource(resourceType, resourceData, patientId);
      if (result.success) {
        setSaveSuccess(`${resourceType} created successfully`);
        setViewMode('search');
        await auditLogger.info('FHIR_RESOURCE_CREATED', {
          resourceType,
          patientId,
        });
      } else {
        throw new Error(result.error || 'Create failed');
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'FHIR_RESOURCE_CREATE_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { resourceType }
      );
      throw err;
    } finally {
      setSaving(false);
    }
  }, [client]);

  const handleUpdate = useCallback(async (
    resourceType: FHIRResourceType,
    data: Record<string, string>,
    _patientId: string
  ) => {
    if (!selectedResource) return;
    setSaving(true);
    setSaveSuccess(null);
    try {
      const resourceData: Record<string, unknown> = { ...data };
      delete resourceData.patient_id;

      const result = await client.updateResource(
        resourceType,
        selectedResource.id,
        resourceData
      );
      if (result.success) {
        setSaveSuccess(`${resourceType} updated successfully`);
        setViewMode('search');
        setSelectedResource(null);
        await auditLogger.info('FHIR_RESOURCE_UPDATED', {
          resourceType,
          resourceId: selectedResource.id,
        });
      } else {
        throw new Error(result.error || 'Update failed');
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'FHIR_RESOURCE_UPDATE_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { resourceType, resourceId: selectedResource.id }
      );
      throw err;
    } finally {
      setSaving(false);
    }
  }, [client, selectedResource]);

  const handleValidate = useCallback(async (
    resourceType: FHIRResourceType,
    data: Record<string, unknown>
  ): Promise<ValidationResult> => {
    const result = await client.validateResource(resourceType, data);
    if (result.success && result.data) {
      return result.data;
    }
    return { valid: false, errors: [result.error || 'Validation failed'] };
  }, [client]);

  const handleViewDetail = useCallback((entry: ResourceEntry) => {
    setSelectedResource(entry);
    setViewMode('detail');
  }, []);

  const handleEdit = useCallback((entry: ResourceEntry) => {
    setSelectedResource(entry);
    setViewMode('edit');
  }, []);

  const getDisplayValue = (data: Record<string, unknown>, key: string): string => {
    const val = data[key];
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  if (viewMode === 'create') {
    return (
      <FHIRResourceForm
        mode="create"
        onSave={handleCreate}
        onValidate={handleValidate}
        onCancel={() => setViewMode('search')}
        saving={saving}
      />
    );
  }

  if (viewMode === 'edit' && selectedResource) {
    const flatData: Record<string, string> = {};
    for (const [k, v] of Object.entries(selectedResource.data)) {
      if (typeof v === 'string' || typeof v === 'number') {
        flatData[k] = String(v);
      }
    }
    return (
      <FHIRResourceForm
        mode="edit"
        initialResourceType={selectedResource.resourceType as FHIRResourceType}
        initialData={flatData}
        resourceId={selectedResource.id}
        onSave={handleUpdate}
        onValidate={handleValidate}
        onCancel={() => { setViewMode('search'); setSelectedResource(null); }}
        saving={saving}
      />
    );
  }

  if (viewMode === 'detail' && selectedResource) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedResource.resourceType} — {selectedResource.id}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleEdit(selectedResource)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition min-h-[44px]"
            >
              <Edit2 className="w-4 h-4" /> Edit
            </button>
            <button
              onClick={() => { setViewMode('search'); setSelectedResource(null); }}
              className="px-3 py-2 text-gray-600 hover:text-gray-900 transition min-h-[44px]"
            >
              Back
            </button>
          </div>
        </div>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto text-sm font-mono max-h-96">
          {JSON.stringify(selectedResource.data, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800" role="status">
          {saveSuccess}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            FHIR Resources
          </h3>
          <button
            onClick={() => setViewMode('create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            Create Resource
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label htmlFor="search-resource-type" className="block text-sm font-medium text-gray-700 mb-1">
              Resource Type
            </label>
            <select
              id="search-resource-type"
              value={filters.resourceType}
              onChange={(e) => setFilters(prev => ({ ...prev, resourceType: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base"
            >
              {SEARCHABLE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search-patient-id" className="block text-sm font-medium text-gray-700 mb-1">
              Patient ID
            </label>
            <input
              id="search-patient-id"
              type="text"
              value={filters.patientId}
              onChange={(e) => setFilters(prev => ({ ...prev, patientId: e.target.value }))}
              placeholder="Filter by patient"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base"
            />
          </div>
          <div>
            <label htmlFor="search-status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <input
              id="search-status"
              type="text"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              placeholder="e.g. active"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base"
            />
          </div>
          <div>
            <label htmlFor="search-date-from" className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              id="search-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={searching}
              className="flex items-center gap-2 w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition disabled:opacity-50 min-h-[44px] justify-center"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Search Error */}
      {searchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800" role="alert">
          {searchError}
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm text-gray-600">{results.length} resources found</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">ID</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Type</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Status</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Display</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-3 text-sm font-mono text-gray-600">
                      {entry.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">{entry.resourceType}</td>
                    <td className="px-6 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getDisplayValue(entry.data, 'clinical_status') ||
                         getDisplayValue(entry.data, 'status')}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {getDisplayValue(entry.data, 'code_display') ||
                       getDisplayValue(entry.data, 'medication_name') ||
                       getDisplayValue(entry.data, 'code') ||
                       '—'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleViewDetail(entry)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label={`View ${entry.resourceType} ${entry.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(entry)}
                          className="p-2 text-gray-400 hover:text-green-600 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label={`Edit ${entry.resourceType} ${entry.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!searching && results.length === 0 && !searchError && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Search for FHIR resources or create a new one</p>
          <p className="text-gray-400 mt-2">Select a resource type and click Search to browse</p>
        </div>
      )}
    </div>
  );
};

export default ResourcesTab;
