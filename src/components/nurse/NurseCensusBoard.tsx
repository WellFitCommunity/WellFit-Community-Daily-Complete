/**
 * NurseCensusBoard - Patient census with avatar thumbnails
 *
 * Purpose: Route /nurse-census showing all patients with mini avatars
 * Used by: Nurses for at-a-glance patient overview
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { EACard, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';
import { AvatarThumbnail } from '../patient-avatar/AvatarThumbnail';
import { usePatientMarkers } from '../patient-avatar/hooks/usePatientMarkers';
import { usePatientAvatar } from '../patient-avatar/hooks/usePatientAvatar';
import { auditLogger } from '../../services/auditLogger';
import type { PatientMarker, SkinTone, GenderPresentation } from '../../types/patientAvatar';

// ============================================================================
// TYPES
// ============================================================================

interface CensusPatient {
  id: string;
  first_name: string;
  last_name: string;
  room_number?: string;
  bed_number?: string;
  acuity_level?: number;
}

// ============================================================================
// CENSUS PATIENT CARD (internal component)
// ============================================================================

interface CensusPatientCardProps {
  patient: CensusPatient;
  onViewAvatar: (patientId: string) => void;
}

const CensusPatientCard: React.FC<CensusPatientCardProps> = ({ patient, onViewAvatar }) => {
  const { avatar } = usePatientAvatar(patient.id);
  const { markers, pendingCount } = usePatientMarkers(patient.id);

  const skinTone: SkinTone = avatar?.skin_tone ?? 'medium';
  const genderPresentation: GenderPresentation = avatar?.gender_presentation ?? 'neutral';

  const activeMarkers: PatientMarker[] = useMemo(
    () => markers.filter((m) => m.is_active && m.status !== 'rejected'),
    [markers]
  );

  const acuityColor = useMemo(() => {
    const level = patient.acuity_level ?? 0;
    if (level >= 4) return 'text-red-400';
    if (level >= 3) return 'text-amber-400';
    if (level >= 2) return 'text-yellow-400';
    return 'text-green-400';
  }, [patient.acuity_level]);

  return (
    <EACard className="hover:border-[#00857a]/50 transition-colors cursor-pointer" onClick={() => onViewAvatar(patient.id)}>
      <EACardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Avatar thumbnail */}
          <div className="shrink-0">
            <AvatarThumbnail
              patientId={patient.id}
              patientName={`${patient.first_name} ${patient.last_name}`}
              skinTone={skinTone}
              genderPresentation={genderPresentation}
              markers={activeMarkers}
              pendingCount={pendingCount}
            />
          </div>

          {/* Patient info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {patient.last_name}, {patient.first_name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {patient.room_number && (
                <span className="text-xs text-slate-400">
                  Room {patient.room_number}
                  {patient.bed_number ? `-${patient.bed_number}` : ''}
                </span>
              )}
              {patient.acuity_level !== undefined && patient.acuity_level > 0 && (
                <EABadge variant={patient.acuity_level >= 4 ? 'critical' : patient.acuity_level >= 3 ? 'high' : 'info'} className="text-[10px]">
                  <span className={acuityColor}>Acuity {patient.acuity_level}</span>
                </EABadge>
              )}
            </div>
            <div className="mt-1">
              <span className="text-xs text-slate-500">
                {activeMarkers.length} marker{activeMarkers.length !== 1 ? 's' : ''}
                {pendingCount > 0 && (
                  <span className="text-amber-400 ml-1">({pendingCount} pending)</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </EACardContent>
    </EACard>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const NurseCensusBoard: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<CensusPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Query profiles for active patients
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, room_number, bed_number, acuity_level')
        .eq('is_active', true)
        .order('last_name', { ascending: true })
        .limit(100);

      if (queryError) {
        setError(queryError.message);
        return;
      }

      const mapped: CensusPatient[] = (data ?? []).map((row) => ({
        id: row.user_id as string,
        first_name: (row.first_name as string) || 'Unknown',
        last_name: (row.last_name as string) || 'Unknown',
        room_number: row.room_number as string | undefined,
        bed_number: row.bed_number as string | undefined,
        acuity_level: row.acuity_level as number | undefined,
      }));

      setPatients(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load patients';
      setError(message);
      auditLogger.error(
        'CENSUS_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { component: 'NurseCensusBoard' }
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleViewAvatar = useCallback((patientId: string) => {
    navigate(`/patient-avatar/${patientId}`);
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#00857a] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400">Loading patient census...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to load census</p>
          <p className="text-sm text-slate-500">{error}</p>
          <EAButton variant="secondary" size="sm" onClick={loadPatients} className="mt-4">
            Retry
          </EAButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Nurse Census Board</h1>
          <p className="text-sm text-slate-400">
            {patients.length} patient{patients.length !== 1 ? 's' : ''} on unit
          </p>
        </div>
        <EAButton variant="secondary" size="sm" onClick={loadPatients}>
          Refresh
        </EAButton>
      </div>

      {/* Patient Grid */}
      {patients.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500">No active patients found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {patients.map((patient) => (
            <CensusPatientCard
              key={patient.id}
              patient={patient}
              onViewAvatar={handleViewAvatar}
            />
          ))}
        </div>
      )}
    </div>
  );
};

NurseCensusBoard.displayName = 'NurseCensusBoard';

export default NurseCensusBoard;
