/**
 * FHIR Conflict Resolution UI
 *
 * Admin interface for managing FHIR data synchronization conflicts
 * Allows manual resolution when automated conflict resolution fails
 *
 * SOC 2 Compliant: Audit logging for all conflict resolutions
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  GitMerge,
  Eye,
  Clock,
  User,
  Database,
  RefreshCw,
} from 'lucide-react';

interface FHIRConflict {
  id: string;
  connection_id: string;
  connection_name?: string;
  patient_id: string;
  patient_name?: string;
  resource_type: string;
  resource_id: string;
  conflict_type: 'data_mismatch' | 'version_conflict' | 'missing_resource' | 'other';
  fhir_data: any;
  community_data: any;
  detected_at: string;
  resolution_action?: 'use_fhir' | 'use_community' | 'merge' | 'manual';
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

export const FHIRConflictResolution: React.FC = () => {
  const [conflicts, setConflicts] = useState<FHIRConflict[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<FHIRConflict | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [filter, setFilter] = useState<'unresolved' | 'all'>('unresolved');

  useEffect(() => {
    fetchConflicts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('fhir_sync_conflicts')
        .select(`
          *,
          fhir_connections(name),
          profiles!fhir_sync_conflicts_patient_id_fkey(first_name, last_name)
        `)
        .order('detected_at', { ascending: false });

      if (filter === 'unresolved') {
        query = query.is('resolved_at', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mappedConflicts = (data || []).map((conflict: any) => ({
        ...conflict,
        connection_name: conflict.fhir_connections?.name,
        patient_name: conflict.profiles
          ? `${conflict.profiles.first_name} ${conflict.profiles.last_name}`
          : 'Unknown Patient',
      }));

      setConflicts(mappedConflicts);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const resolveConflict = async (
    conflictId: string,
    action: 'use_fhir' | 'use_community' | 'merge' | 'manual',
    notes: string
  ) => {
    setResolving(true);
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;

      // Update conflict resolution
      const { error: updateError } = await supabase
        .from('fhir_sync_conflicts')
        .update({
          resolution_action: action,
          resolved_at: new Date().toISOString(),
          resolved_by: currentUser?.id,
          resolution_notes: notes,
        })
        .eq('id', conflictId);

      if (updateError) throw updateError;

      // Apply the resolution
      if (selectedConflict) {
        await applyResolution(selectedConflict, action);
      }

      // Log audit event
      await supabase.from('audit_logs').insert({
        event_type: 'FHIR_CONFLICT_RESOLVED',
        event_category: 'DATA_SYNC',
        metadata: {
          conflict_id: conflictId,
          resolution_action: action,
          resource_type: selectedConflict?.resource_type,
          resolved_by: currentUser?.id,
        },
      });

      // Refresh list
      await fetchConflicts();
      setSelectedConflict(null);
    } catch (error) {

      alert('Failed to resolve conflict. Please try again.');
    } finally {
      setResolving(false);
    }
  };

  const applyResolution = async (
    conflict: FHIRConflict,
    action: 'use_fhir' | 'use_community' | 'merge' | 'manual'
  ) => {
    const resourceTableMap: Record<string, string> = {
      Patient: 'profiles',
      Observation: 'patient_observations',
      Condition: 'patient_conditions',
      MedicationRequest: 'patient_medications',
      AllergyIntolerance: 'patient_allergies',
      Procedure: 'patient_procedures',
      Immunization: 'patient_immunizations',
      Encounter: 'patient_encounters',
      DiagnosticReport: 'diagnostic_reports',
      CarePlan: 'care_plans',
    };

    const tableName = resourceTableMap[conflict.resource_type];

    switch (action) {
      case 'use_fhir':
        // Update community data with FHIR data
        if (tableName && conflict.fhir_data) {
          // Map FHIR data to community schema based on resource type
          const mappedData = mapFHIRToCommunitySchema(conflict.resource_type, conflict.fhir_data);

          if (mappedData) {
            const { error } = await supabase
              .from(tableName)
              .upsert({
                id: conflict.resource_id,
                ...mappedData,
                updated_at: new Date().toISOString(),
                fhir_synced_at: new Date().toISOString(),
              }, { onConflict: 'id' });

            if (error) throw new Error(`Failed to apply FHIR data: ${error.message}`);
          }
        }
        break;

      case 'use_community':
        // Keep community data, update sync log to mark as manually resolved
        await supabase.from('fhir_sync_log').insert({
          connection_id: conflict.connection_id,
          patient_id: conflict.patient_id,
          resource_type: conflict.resource_type,
          resource_id: conflict.resource_id,
          sync_action: 'conflict_resolved_keep_local',
          sync_status: 'success',
          synced_at: new Date().toISOString(),
          metadata: {
            conflict_id: conflict.id,
            resolution: 'use_community',
            fhir_data_rejected: true,
          },
        });
        break;

      case 'merge':
        // Smart merge: combine non-conflicting fields, prefer FHIR for clinical data
        if (tableName && conflict.fhir_data && conflict.community_data) {
          const mergedData = smartMerge(
            conflict.resource_type,
            conflict.community_data,
            conflict.fhir_data
          );

          const { error } = await supabase
            .from(tableName)
            .update({
              ...mergedData,
              updated_at: new Date().toISOString(),
              fhir_synced_at: new Date().toISOString(),
              merge_source: 'conflict_resolution',
            })
            .eq('id', conflict.resource_id);

          if (error) throw new Error(`Failed to merge data: ${error.message}`);

          // Log the merge in sync log
          await supabase.from('fhir_sync_log').insert({
            connection_id: conflict.connection_id,
            patient_id: conflict.patient_id,
            resource_type: conflict.resource_type,
            resource_id: conflict.resource_id,
            sync_action: 'conflict_resolved_merge',
            sync_status: 'success',
            synced_at: new Date().toISOString(),
            metadata: {
              conflict_id: conflict.id,
              merged_fields: Object.keys(mergedData),
            },
          });
        }
        break;

      case 'manual':
        // Do nothing - admin will manually fix via other UI
        // Just log that manual resolution was chosen
        await supabase.from('fhir_sync_log').insert({
          connection_id: conflict.connection_id,
          patient_id: conflict.patient_id,
          resource_type: conflict.resource_type,
          resource_id: conflict.resource_id,
          sync_action: 'conflict_deferred_manual',
          sync_status: 'pending',
          synced_at: new Date().toISOString(),
          metadata: {
            conflict_id: conflict.id,
            resolution: 'manual',
          },
        });
        break;
    }
  };

  /**
   * Map FHIR resource data to community database schema
   */
  const mapFHIRToCommunitySchema = (
    resourceType: string,
    fhirData: any
  ): Record<string, any> | null => {
    switch (resourceType) {
      case 'Patient':
        return {
          first_name: fhirData.name?.[0]?.given?.[0],
          last_name: fhirData.name?.[0]?.family,
          date_of_birth: fhirData.birthDate,
          gender: fhirData.gender,
          phone: fhirData.telecom?.find((t: any) => t.system === 'phone')?.value,
          email: fhirData.telecom?.find((t: any) => t.system === 'email')?.value,
          address_line1: fhirData.address?.[0]?.line?.[0],
          city: fhirData.address?.[0]?.city,
          state: fhirData.address?.[0]?.state,
          zip: fhirData.address?.[0]?.postalCode,
        };
      case 'Observation':
        return {
          code: fhirData.code?.coding?.[0]?.code,
          display_name: fhirData.code?.coding?.[0]?.display,
          value: fhirData.valueQuantity?.value,
          unit: fhirData.valueQuantity?.unit,
          effective_date: fhirData.effectiveDateTime,
          status: fhirData.status,
        };
      case 'Condition':
        return {
          code: fhirData.code?.coding?.[0]?.code,
          display_name: fhirData.code?.coding?.[0]?.display,
          clinical_status: fhirData.clinicalStatus?.coding?.[0]?.code,
          onset_date: fhirData.onsetDateTime,
          recorded_date: fhirData.recordedDate,
        };
      case 'MedicationRequest':
        return {
          medication_code: fhirData.medicationCodeableConcept?.coding?.[0]?.code,
          medication_name: fhirData.medicationCodeableConcept?.coding?.[0]?.display,
          dosage_instruction: fhirData.dosageInstruction?.[0]?.text,
          status: fhirData.status,
          authored_on: fhirData.authoredOn,
        };
      default:
        // For unsupported types, return the raw data for manual review
        return null;
    }
  };

  /**
   * Smart merge: prefer FHIR for clinical fields, keep community for administrative
   */
  const smartMerge = (
    resourceType: string,
    communityData: any,
    fhirData: any
  ): Record<string, any> => {
    const merged = { ...communityData };

    // Clinical fields that FHIR should take precedence on
    const clinicalFields: Record<string, string[]> = {
      Patient: ['date_of_birth', 'gender'],
      Observation: ['value', 'unit', 'effective_date', 'status'],
      Condition: ['clinical_status', 'code', 'onset_date'],
      MedicationRequest: ['dosage_instruction', 'status', 'medication_code'],
    };

    // Administrative fields that community data should keep
    const adminFields = ['created_at', 'created_by', 'tenant_id', 'notes', 'custom_fields'];

    const fhirMapped = mapFHIRToCommunitySchema(resourceType, fhirData) || {};
    const preferFhirFields = clinicalFields[resourceType] || [];

    // Merge: prefer FHIR for clinical fields, keep community for admin
    for (const [key, value] of Object.entries(fhirMapped)) {
      if (value !== null && value !== undefined) {
        if (preferFhirFields.includes(key) || !adminFields.includes(key)) {
          // FHIR takes precedence for clinical fields
          merged[key] = value;
        }
        // Otherwise keep community value (already in merged)
      }
    }

    return merged;
  };

  const getConflictIcon = (type: string) => {
    switch (type) {
      case 'data_mismatch':
        return <GitMerge className="w-5 h-5 text-yellow-500" />;
      case 'version_conflict':
        return <Clock className="w-5 h-5 text-orange-500" />;
      case 'missing_resource':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getConflictBadgeColor = (type: string) => {
    switch (type) {
      case 'data_mismatch':
        return 'bg-yellow-100 text-yellow-800';
      case 'version_conflict':
        return 'bg-orange-100 text-orange-800';
      case 'missing_resource':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          FHIR Conflict Resolution
        </h1>
        <p className="text-gray-600">
          Manage data synchronization conflicts between FHIR servers and community database
        </p>
      </div>

      {/* Filters and Stats */}
      <div className="bg-white rounded-lg shadow-sm mb-6 p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <button
              onClick={() => setFilter('unresolved')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'unresolved'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unresolved ({conflicts.filter(c => !c.resolved_at).length})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Conflicts ({conflicts.length})
            </button>
          </div>
          <button
            onClick={fetchConflicts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Conflicts List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Conflict List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Conflicts</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading conflicts...</div>
            ) : conflicts.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No conflicts found</p>
                <p className="text-sm text-gray-500 mt-1">
                  All FHIR syncs are running smoothly
                </p>
              </div>
            ) : (
              conflicts.map(conflict => (
                <div
                  key={conflict.id}
                  onClick={() => setSelectedConflict(conflict)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedConflict?.id === conflict.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getConflictIcon(conflict.conflict_type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 truncate">
                          {conflict.resource_type}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getConflictBadgeColor(
                            conflict.conflict_type
                          )}`}
                        >
                          {conflict.conflict_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        Patient: {conflict.patient_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {conflict.connection_name} •{' '}
                        {new Date(conflict.detected_at).toLocaleDateString()}
                      </p>
                      {conflict.resolved_at && (
                        <div className="mt-2 flex items-center gap-1 text-green-600 text-xs">
                          <CheckCircle className="w-3 h-3" />
                          Resolved: {conflict.resolution_action?.replace('_', ' ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Conflict Details & Resolution */}
        <div className="bg-white rounded-lg shadow-sm">
          {selectedConflict ? (
            <>
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold">Conflict Details</h2>
              </div>
              <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                {/* Conflict Info */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Information</h3>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Resource Type:</span>
                      <span className="font-medium">{selectedConflict.resource_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Patient:</span>
                      <span className="font-medium">{selectedConflict.patient_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Connection:</span>
                      <span className="font-medium">{selectedConflict.connection_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Detected:</span>
                      <span className="font-medium">
                        {new Date(selectedConflict.detected_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Data Comparison */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Data Comparison</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">FHIR Server</span>
                      </div>
                      <pre className="bg-blue-50 rounded-lg p-3 text-xs overflow-auto max-h-64 border border-blue-200">
                        {JSON.stringify(selectedConflict.fhir_data, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-700">Community DB</span>
                      </div>
                      <pre className="bg-green-50 rounded-lg p-3 text-xs overflow-auto max-h-64 border border-green-200">
                        {JSON.stringify(selectedConflict.community_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Resolution Actions */}
                {!selectedConflict.resolved_at && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Resolution Actions</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() =>
                          resolveConflict(
                            selectedConflict.id,
                            'use_fhir',
                            'Admin chose to use FHIR server data'
                          )
                        }
                        disabled={resolving}
                        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <span className="font-medium text-blue-900">Use FHIR Server Data</span>
                        <Database className="w-5 h-5 text-blue-600" />
                      </button>
                      <button
                        onClick={() =>
                          resolveConflict(
                            selectedConflict.id,
                            'use_community',
                            'Admin chose to keep community database data'
                          )
                        }
                        disabled={resolving}
                        className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <span className="font-medium text-green-900">
                          Keep Community Data
                        </span>
                        <Database className="w-5 h-5 text-green-600" />
                      </button>
                      <button
                        onClick={() =>
                          resolveConflict(
                            selectedConflict.id,
                            'merge',
                            'Admin chose to merge both datasets'
                          )
                        }
                        disabled={resolving}
                        className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <span className="font-medium text-purple-900">Merge Both</span>
                        <GitMerge className="w-5 h-5 text-purple-600" />
                      </button>
                      <button
                        onClick={() =>
                          resolveConflict(
                            selectedConflict.id,
                            'manual',
                            'Marked for manual resolution - will fix separately'
                          )
                        }
                        disabled={resolving}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <span className="font-medium text-gray-900">
                          Mark as Manual
                        </span>
                        <User className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Resolution Info (if resolved) */}
                {selectedConflict.resolved_at && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-900">Conflict Resolved</span>
                    </div>
                    <div className="text-sm text-green-800 space-y-1">
                      <p>
                        Action: <strong>{selectedConflict.resolution_action?.replace('_', ' ')}</strong>
                      </p>
                      <p>
                        Resolved: {new Date(selectedConflict.resolved_at).toLocaleString()}
                      </p>
                      {selectedConflict.resolution_notes && (
                        <p className="mt-2 italic">"{selectedConflict.resolution_notes}"</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Eye className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>Select a conflict to view details and resolve</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FHIRConflictResolution;
