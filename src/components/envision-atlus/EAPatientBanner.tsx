/**
 * EAPatientBanner - Persistent Patient Display Banner
 *
 * ATLUS Enhancement: Unity - Shows currently selected patient across all dashboards
 *
 * This solves the critical problem where clinicians lose track of which patient
 * they were working with when navigating between dashboards.
 *
 * Features:
 * - Shows selected patient name, MRN, room, and risk level
 * - Quick access to patient history (recent 10)
 * - Clear button to deselect patient
 * - Integrates with PatientRiskStrip for at-a-glance risk
 * - Sticky positioning for always-visible patient context
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { usePatientContextSafe, SelectedPatient } from '../../contexts/PatientContext';
import { PatientAvatar } from '../patient-avatar/PatientAvatar';
import { AvatarThumbnail } from '../patient-avatar';
import {
  User,
  X,
  Clock,
  ChevronDown,
  AlertTriangle,
  Building2,
  Hash,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface EAPatientBannerProps {
  /** Show recent patients dropdown */
  showRecent?: boolean;
  /** Show risk level badge */
  showRisk?: boolean;
  /** Show clinical avatar thumbnail */
  showAvatar?: boolean;
  /** Compact mode for smaller screens */
  compact?: boolean;
  /** Additional class names */
  className?: string;
  /** Callback when patient is selected from history */
  onPatientChange?: (patient: SelectedPatient | null) => void;
}

const riskColors = {
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const EAPatientBanner: React.FC<EAPatientBannerProps> = ({
  showRecent = true,
  showRisk = true,
  showAvatar = true,
  compact = false,
  className,
  onPatientChange,
}) => {
  const patientContext = usePatientContextSafe();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFullAvatar, setShowFullAvatar] = useState(false);

  // Don't render if no patient context or no patient selected
  if (!patientContext || !patientContext.hasPatient) {
    return null;
  }

  const { selectedPatient, recentPatients, selectFromHistory, clearPatient } = patientContext;

  if (!selectedPatient) {
    return null;
  }

  const handleClear = () => {
    clearPatient();
    onPatientChange?.(null);
  };

  const handleSelectRecent = (patientId: string) => {
    selectFromHistory(patientId);
    setShowDropdown(false);
    const patient = recentPatients.find(p => p.id === patientId);
    if (patient) {
      onPatientChange?.(patient);
    }
  };

  const padding = compact ? 'px-3 py-1.5' : 'px-4 py-2';
  const textSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div
      className={cn(
        'flex items-center gap-3 bg-slate-800/90 border-b border-slate-700 backdrop-blur-xs',
        padding,
        className
      )}
      role="banner"
      aria-label="Selected patient"
    >
      {/* Patient Avatar/Icon */}
      {showAvatar ? (
        <button
          onClick={() => setShowFullAvatar(!showFullAvatar)}
          className="relative group"
          title="Click to view clinical avatar with markers"
        >
          <AvatarThumbnail
            patientId={selectedPatient.id}
            patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
            skinTone="medium"
            genderPresentation="neutral"
            markers={[]}
            className="border-2 border-teal-500/30 hover:border-teal-400 transition-colors"
          />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 className="w-2.5 h-2.5 text-teal-400" />
          </div>
        </button>
      ) : (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30">
          <User className="w-4 h-4 text-teal-400" />
        </div>
      )}

      {/* Patient Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Name */}
          <span className={cn('font-semibold text-slate-100 truncate', textSize)}>
            {selectedPatient.lastName}, {selectedPatient.firstName}
          </span>

          {/* Risk Badge */}
          {showRisk && selectedPatient.riskLevel && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium border',
                riskColors[selectedPatient.riskLevel]
              )}
            >
              {selectedPatient.riskLevel === 'critical' && (
                <AlertTriangle className="w-3 h-3 inline mr-1" />
              )}
              {selectedPatient.riskLevel.toUpperCase()}
            </span>
          )}
        </div>

        {/* Secondary Info */}
        <div className={cn('flex items-center gap-3 text-slate-400', compact ? 'text-xs' : 'text-xs')}>
          {selectedPatient.mrn && (
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              MRN: {selectedPatient.mrn}
            </span>
          )}
          {selectedPatient.roomNumber && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              Room {selectedPatient.roomNumber}
            </span>
          )}
          {selectedPatient.snapshot?.primaryDiagnosis && (
            <span className="truncate max-w-[200px]">
              {selectedPatient.snapshot.primaryDiagnosis}
            </span>
          )}
        </div>
      </div>

      {/* Recent Patients Dropdown */}
      {showRecent && recentPatients.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-sm hover:bg-slate-700 transition-colors',
              textSize,
              'text-slate-400 hover:text-slate-200'
            )}
            title="Recent patients"
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Recent</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showDropdown && 'rotate-180')} />
          </button>

          {showDropdown && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDropdown(false)}
              />

              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-700 text-xs text-slate-400 font-medium">
                  Recent Patients
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {recentPatients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => handleSelectRecent(patient.id)}
                      className={cn(
                        'w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors flex items-center gap-2',
                        patient.id === selectedPatient.id && 'bg-teal-900/30'
                      )}
                    >
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-200 truncate">
                          {patient.lastName}, {patient.firstName}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {patient.mrn ? `MRN: ${patient.mrn}` : patient.roomNumber ? `Room ${patient.roomNumber}` : ''}
                        </div>
                      </div>
                      {patient.riskLevel && (
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded-sm text-xs font-medium',
                            riskColors[patient.riskLevel]
                          )}
                        >
                          {patient.riskLevel[0].toUpperCase()}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Clear Button */}
      <button
        onClick={handleClear}
        className="p-1.5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
        title="Clear patient selection"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Full Avatar Panel (Expandable) */}
      {showFullAvatar && selectedPatient && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowFullAvatar(false)}
          />

          {/* Avatar Panel */}
          <div className="fixed right-4 top-20 z-50 w-[400px] max-h-[80vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  Clinical Avatar
                </h3>
                <p className="text-sm text-slate-400">
                  {selectedPatient.lastName}, {selectedPatient.firstName}
                  {selectedPatient.roomNumber && ` • Room ${selectedPatient.roomNumber}`}
                </p>
              </div>
              <button
                onClick={() => setShowFullAvatar(false)}
                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                title="Close avatar view"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>

            {/* Avatar Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
              <PatientAvatar
                patientId={selectedPatient.id}
                patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                initialMode="expanded"
                editable={false}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EAPatientBanner;
