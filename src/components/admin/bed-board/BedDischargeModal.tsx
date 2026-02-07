/**
 * BedDischargeModal — Discharge workflow with disposition selection and transfer notice.
 */

import React from 'react';
import {
  UserMinus,
  XCircle,
  FileText,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { EAButton } from '../../envision-atlus';
import { DISCHARGE_DISPOSITIONS } from './BedBoard.types';
import type { BedDischargeModalProps } from './BedBoard.types';

export const BedDischargeModal: React.FC<BedDischargeModalProps> = ({
  bed,
  dischargeDisposition,
  discharging,
  onSetDisposition,
  onDischarge,
  onClose,
}) => {
  const selectedDisp = DISCHARGE_DISPOSITIONS.find((d) => d.value === dischargeDisposition);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl shadow-xl max-w-lg w-full mx-4 border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-orange-400" />
              Discharge Patient
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 bg-slate-800 rounded-lg">
            <p className="text-sm text-slate-400 mb-1">Patient</p>
            <p className="text-white font-medium">{bed.patient_name}</p>
            {bed.patient_mrn && (
              <p className="text-sm text-slate-400">MRN: {bed.patient_mrn}</p>
            )}
            <p className="text-sm text-slate-400 mt-2">
              Bed: {bed.bed_label} | Room: {bed.room_number}
            </p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Discharge Disposition
            </label>
            <select
              value={dischargeDisposition}
              onChange={(e) => onSetDisposition(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select disposition...</option>
              {DISCHARGE_DISPOSITIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {selectedDisp?.isPostAcute && (
            <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-teal-400 mt-0.5" />
                <div>
                  <p className="text-sm text-teal-400 font-medium">Transfer Packet Required</p>
                  <p className="text-xs text-slate-400 mt-1">
                    This discharge type requires a clinical handoff packet. After confirming
                    discharge, you will be redirected to create the transfer documentation.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
          <EAButton variant="secondary" onClick={onClose}>
            Cancel
          </EAButton>
          <EAButton
            onClick={onDischarge}
            disabled={!dischargeDisposition || discharging}
            icon={selectedDisp?.isPostAcute
              ? <ArrowRight className="w-4 h-4" />
              : <CheckCircle className="w-4 h-4" />
            }
          >
            {discharging
              ? 'Processing...'
              : selectedDisp?.isPostAcute
              ? 'Discharge & Create Transfer'
              : 'Confirm Discharge'}
          </EAButton>
        </div>
      </div>
    </div>
  );
};

export default BedDischargeModal;
