/**
 * MedicationCard — Individual medication display card
 *
 * Shows medication details, alerts (psych, refill, review), and action buttons.
 * Used in the "All Medications" tab grid.
 */

import React from 'react';
import {
  Pill,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Bell,
  Sparkles,
  Info,
  Shield
} from 'lucide-react';
import { MedicationCardProps } from './MedicineCabinet.types';

export const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  onDelete,
  onTakeDose,
  onAddReminder,
  onVerifyPill
}) => {
  const needsReview = medication.needs_review;
  const needsRefillSoon = medication.next_refill_date &&
    new Date(medication.next_refill_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-linear-to-r from-blue-500 to-purple-500 text-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-lg">{medication.medication_name}</h3>
            {medication.generic_name && (
              <p className="text-sm opacity-90">{medication.generic_name}</p>
            )}
          </div>
          {medication.ai_confidence && (
            <div className="bg-white bg-opacity-20 rounded-lg px-2 py-1 text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {Math.round(medication.ai_confidence * 100)}% AI
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Psychiatric Medication Badge */}
        {medication.is_psychiatric && (
          <div className="bg-purple-100 border border-purple-300 text-purple-800 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            PSYCHIATRIC MEDICATION
            {medication.psych_category && (
              <span className="text-purple-600">
                - {medication.psych_category.replace('_', ' ').toUpperCase()}
              </span>
            )}
          </div>
        )}

        {/* Dosage */}
        <div className="flex items-center gap-2 text-sm">
          <Pill className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{medication.strength || medication.dosage}</span>
          {medication.dosage_form && (
            <span className="text-gray-500">({medication.dosage_form})</span>
          )}
        </div>

        {/* Instructions */}
        {medication.instructions && (
          <div className="flex items-start gap-2 text-sm">
            <Info className="w-4 h-4 text-gray-400 mt-0.5" />
            <span className="text-gray-700">{medication.instructions}</span>
          </div>
        )}

        {/* Frequency */}
        {medication.frequency && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">{medication.frequency}</span>
          </div>
        )}

        {/* Alerts */}
        <div className="space-y-2">
          {needsReview && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Needs review - AI wasn't fully confident
            </div>
          )}
          {needsRefillSoon && medication.next_refill_date && (
            <div className="bg-orange-50 border border-orange-200 text-orange-800 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Refill needed by {new Date(medication.next_refill_date).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex gap-2">
            <button
              onClick={onTakeDose}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Take Dose
            </button>
            <button
              onClick={onAddReminder}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={onVerifyPill}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Verify Pill Matches
          </button>
        </div>
      </div>
    </div>
  );
};
