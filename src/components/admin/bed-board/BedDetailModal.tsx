/**
 * BedDetailModal — Shows bed info, current patient, capabilities, and action buttons.
 */

import React from 'react';
import { XCircle, UserMinus, Activity } from 'lucide-react';
import { EAButton } from '../../envision-atlus';
import { getBedStatusColor, getBedStatusLabel } from '../../../types/bed';
import type { BedDetailModalProps } from './BedBoard.types';

export const BedDetailModal: React.FC<BedDetailModalProps> = ({
  bed,
  onClose,
  onUpdateStatus,
  onDischarge,
  onSetEditing,
}) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-slate-900 rounded-xl shadow-xl max-w-lg w-full mx-4 border border-slate-700">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Bed {bed.bed_label}</h3>
          <button
            onClick={() => { onClose(); onSetEditing(false); }}
            className="text-slate-400 hover:text-white"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-400">Unit</p>
            <p className="text-white">{bed.unit_name}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Room</p>
            <p className="text-white">{bed.room_number}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Status</p>
            <span className={`inline-block px-2 py-1 rounded text-sm ${getBedStatusColor(bed.status)}`}>
              {getBedStatusLabel(bed.status)}
            </span>
          </div>
          <div>
            <p className="text-sm text-slate-400">Type</p>
            <p className="text-white capitalize">{bed.bed_type}</p>
          </div>
        </div>

        {bed.patient_name && (
          <div className="pt-4 border-t border-slate-700">
            <p className="text-sm text-slate-400 mb-2">Current Patient</p>
            <p className="text-white font-medium">{bed.patient_name}</p>
            {bed.patient_mrn && (
              <p className="text-sm text-slate-400">MRN: {bed.patient_mrn}</p>
            )}
            {bed.expected_discharge_date && (
              <p className="text-sm text-slate-400 mt-2">
                Expected Discharge: {bed.expected_discharge_date}
              </p>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-slate-700">
          <p className="text-sm text-slate-400 mb-2">Capabilities</p>
          <div className="flex flex-wrap gap-2">
            {bed.has_telemetry && (
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-sm text-sm flex items-center gap-1">
                <Activity className="w-3 h-3" /> Telemetry
              </span>
            )}
            {bed.has_isolation_capability && (
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-sm text-sm">Isolation</span>
            )}
            {bed.has_negative_pressure && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-sm text-sm">Negative Pressure</span>
            )}
            {!bed.has_telemetry && !bed.has_isolation_capability && !bed.has_negative_pressure && (
              <span className="text-slate-500 text-sm">Standard bed</span>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
        <EAButton variant="secondary" onClick={() => { onClose(); onSetEditing(false); }}>
          Close
        </EAButton>
        {bed.status === 'occupied' && bed.patient_id && (
          <EAButton
            onClick={onDischarge}
            icon={<UserMinus className="w-4 h-4" />}
            variant="secondary"
          >
            Discharge Patient
          </EAButton>
        )}
        {bed.status === 'dirty' && (
          <EAButton
            onClick={() => {
              onUpdateStatus(bed.bed_id, 'cleaning');
              onClose();
              onSetEditing(false);
            }}
          >
            Start Cleaning
          </EAButton>
        )}
        {bed.status === 'cleaning' && (
          <EAButton
            onClick={() => {
              onUpdateStatus(bed.bed_id, 'available');
              onClose();
              onSetEditing(false);
            }}
          >
            Mark Available
          </EAButton>
        )}
      </div>
    </div>
  </div>
);

export default BedDetailModal;
