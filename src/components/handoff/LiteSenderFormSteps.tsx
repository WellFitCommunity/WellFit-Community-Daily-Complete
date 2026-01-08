/**
 * Form Steps Component for LiteSenderPortal
 * Lazy-loaded component containing all 5 form steps
 */

import React from 'react';
import type {
  CompleteHandoffFormData,
  UrgencyLevel,
  Medication,
  Allergy,
  LabResult,
} from '../../types/handoff';
import type { UseLiteSenderLogicReturn } from './hooks/useLiteSenderLogic';

interface LiteSenderFormStepsProps {
  currentStep: number;
  formData: CompleteHandoffFormData;
  setFormData: UseLiteSenderLogicReturn['setFormData'];
  isLookingUpPatient: boolean;
  handlePatientLookup: UseLiteSenderLogicReturn['handlePatientLookup'];
  medicationsGiven: Medication[];
  addMedicationGiven: UseLiteSenderLogicReturn['addMedicationGiven'];
  updateMedicationGiven: UseLiteSenderLogicReturn['updateMedicationGiven'];
  removeMedicationGiven: UseLiteSenderLogicReturn['removeMedicationGiven'];
  medicationsPrescribed: Medication[];
  addMedicationPrescribed: UseLiteSenderLogicReturn['addMedicationPrescribed'];
  updateMedicationPrescribed: UseLiteSenderLogicReturn['updateMedicationPrescribed'];
  removeMedicationPrescribed: UseLiteSenderLogicReturn['removeMedicationPrescribed'];
  medicationsCurrent: Medication[];
  addMedicationCurrent: UseLiteSenderLogicReturn['addMedicationCurrent'];
  updateMedicationCurrent: UseLiteSenderLogicReturn['updateMedicationCurrent'];
  removeMedicationCurrent: UseLiteSenderLogicReturn['removeMedicationCurrent'];
  allergies: Allergy[];
  addAllergy: UseLiteSenderLogicReturn['addAllergy'];
  updateAllergy: UseLiteSenderLogicReturn['updateAllergy'];
  removeAllergy: UseLiteSenderLogicReturn['removeAllergy'];
  labs: LabResult[];
  addLab: UseLiteSenderLogicReturn['addLab'];
  updateLab: UseLiteSenderLogicReturn['updateLab'];
  removeLab: UseLiteSenderLogicReturn['removeLab'];
  attachments: File[];
  handleFileSelect: UseLiteSenderLogicReturn['handleFileSelect'];
  removeAttachment: UseLiteSenderLogicReturn['removeAttachment'];
}

const LiteSenderFormSteps: React.FC<LiteSenderFormStepsProps> = ({
  currentStep,
  formData,
  setFormData,
  isLookingUpPatient,
  handlePatientLookup,
  medicationsGiven,
  addMedicationGiven,
  updateMedicationGiven,
  removeMedicationGiven,
  medicationsPrescribed,
  addMedicationPrescribed,
  updateMedicationPrescribed,
  removeMedicationPrescribed,
  medicationsCurrent,
  addMedicationCurrent,
  updateMedicationCurrent,
  removeMedicationCurrent,
  allergies,
  addAllergy,
  updateAllergy,
  removeAllergy,
  labs,
  addLab,
  updateLab,
  removeLab,
  attachments,
  handleFileSelect,
  removeAttachment,
}) => {
  return (
    <div className="min-h-[400px] mb-6">
      {/* Step 1: Patient Demographics */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            👤 Patient Demographics
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient Name *
            </label>
            <input
              type="text"
              value={formData.patient_name}
              onChange={(e) =>
                setFormData({ ...formData, patient_name: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of Birth *
            </label>
            <input
              type="date"
              value={formData.patient_dob}
              onChange={(e) =>
                setFormData({ ...formData, patient_dob: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MRN (Optional - Auto-fills if found)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.patient_mrn}
                  onChange={(e) =>
                    setFormData({ ...formData, patient_mrn: e.target.value })
                  }
                  onBlur={(e) => handlePatientLookup(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="123456"
                />
                <button
                  type="button"
                  onClick={() => handlePatientLookup(formData.patient_mrn || '')}
                  disabled={isLookingUpPatient || !formData.patient_mrn}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                >
                  {isLookingUpPatient ? '🔍' : '🔍 Lookup'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Auto-populates patient data from previous transfers</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                value={formData.patient_gender || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    patient_gender: e.target.value as 'M' | 'F' | 'X' | 'U',
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="X">Non-binary</option>
                <option value="U">Unknown</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sending Facility *
            </label>
            <input
              type="text"
              value={formData.sending_facility}
              onChange={(e) =>
                setFormData({ ...formData, sending_facility: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Community Hospital - ER"
            />
          </div>
        </div>
      )}

      {/* Step 2: Reason for Transfer */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            🚑 Reason for Transfer
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chief Complaint / Reason *
            </label>
            <textarea
              value={formData.reason_for_transfer}
              onChange={(e) =>
                setFormData({ ...formData, reason_for_transfer: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Patient presenting with chest pain, needs cardiac catheterization..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Urgency Level *
            </label>
            <div className="grid grid-cols-4 gap-3">
              {(['routine', 'urgent', 'emergent', 'critical'] as UrgencyLevel[]).map(
                (level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({ ...formData, urgency_level: level })}
                    className={`px-4 py-3 border-2 rounded-lg font-medium transition-all ${
                      formData.urgency_level === level
                        ? level === 'routine'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : level === 'urgent'
                          ? 'border-yellow-600 bg-yellow-50 text-yellow-700'
                          : level === 'emergent'
                          ? 'border-orange-600 bg-orange-50 text-orange-700'
                          : 'border-red-600 bg-red-50 text-red-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Clinical Snapshot */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">💊 Clinical Snapshot</h2>

          {/* Vitals */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-3">Last Vitals</h3>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="BP Systolic"
                value={formData.vitals?.blood_pressure_systolic || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    vitals: {
                      ...formData.vitals,
                      blood_pressure_systolic: parseInt(e.target.value) || undefined,
                    },
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="BP Diastolic"
                value={formData.vitals?.blood_pressure_diastolic || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    vitals: {
                      ...formData.vitals,
                      blood_pressure_diastolic: parseInt(e.target.value) || undefined,
                    },
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Heart Rate"
                value={formData.vitals?.heart_rate || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    vitals: {
                      ...formData.vitals,
                      heart_rate: parseInt(e.target.value) || undefined,
                    },
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Temp (°F)"
                value={formData.vitals?.temperature || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    vitals: {
                      ...formData.vitals,
                      temperature: parseFloat(e.target.value) || undefined,
                      temperature_unit: 'F',
                    },
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="O2 Sat %"
                value={formData.vitals?.oxygen_saturation || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    vitals: {
                      ...formData.vitals,
                      oxygen_saturation: parseInt(e.target.value) || undefined,
                    },
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Resp Rate"
                value={formData.vitals?.respiratory_rate || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    vitals: {
                      ...formData.vitals,
                      respiratory_rate: parseInt(e.target.value) || undefined,
                    },
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Medications Given During Visit */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-blue-800">💉 Medications Given During Visit</h3>
              <button
                type="button"
                onClick={addMedicationGiven}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                + Add Med
              </button>
            </div>
            {medicationsGiven.map((med, index) => (
              <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Medication"
                  value={med.name}
                  onChange={(e) => updateMedicationGiven(index, 'name', e.target.value)}
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Dosage"
                  value={med.dosage}
                  onChange={(e) => updateMedicationGiven(index, 'dosage', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Route"
                  value={med.route || ''}
                  onChange={(e) => updateMedicationGiven(index, 'route', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeMedicationGiven(index)}
                  className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Currently Prescribed Medications */}
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-purple-800">📋 Currently Prescribed Medications</h3>
              <button
                type="button"
                onClick={addMedicationPrescribed}
                className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
              >
                + Add Med
              </button>
            </div>
            {medicationsPrescribed.map((med, index) => (
              <div key={index} className="grid grid-cols-6 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Medication"
                  value={med.name}
                  onChange={(e) => updateMedicationPrescribed(index, 'name', e.target.value)}
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Dosage"
                  value={med.dosage}
                  onChange={(e) => updateMedicationPrescribed(index, 'dosage', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Route"
                  value={med.route || ''}
                  onChange={(e) => updateMedicationPrescribed(index, 'route', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Frequency"
                  value={med.frequency || ''}
                  onChange={(e) => updateMedicationPrescribed(index, 'frequency', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeMedicationPrescribed(index)}
                  className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Medications Currently Taking (Including OTC) */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-green-800">💊 Currently Taking (Including OTC)</h3>
              <button
                type="button"
                onClick={addMedicationCurrent}
                className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
              >
                + Add Med
              </button>
            </div>
            {medicationsCurrent.map((med, index) => (
              <div key={index} className="grid grid-cols-6 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Medication/Supplement"
                  value={med.name}
                  onChange={(e) => updateMedicationCurrent(index, 'name', e.target.value)}
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Dosage"
                  value={med.dosage}
                  onChange={(e) => updateMedicationCurrent(index, 'dosage', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Route"
                  value={med.route || ''}
                  onChange={(e) => updateMedicationCurrent(index, 'route', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Frequency"
                  value={med.frequency || ''}
                  onChange={(e) => updateMedicationCurrent(index, 'frequency', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeMedicationCurrent(index)}
                  className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Allergies */}
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-red-800">⚠️ Allergies</h3>
              <button
                type="button"
                onClick={addAllergy}
                className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                + Add Allergy
              </button>
            </div>
            {allergies.map((allergy, index) => (
              <div key={index} className="grid grid-cols-4 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Allergen"
                  value={allergy.allergen}
                  onChange={(e) => updateAllergy(index, 'allergen', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Reaction"
                  value={allergy.reaction}
                  onChange={(e) => updateAllergy(index, 'reaction', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <select
                  value={allergy.severity || 'mild'}
                  onChange={(e) =>
                    updateAllergy(
                      index,
                      'severity',
                      e.target.value as 'mild' | 'moderate' | 'severe' | 'life-threatening'
                    )
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                  <option value="life-threatening">Life-threatening</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeAllergy(index)}
                  className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Lab Results - Structured for Analytics */}
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-yellow-800">🔬 Lab Results (Optional - for analytics)</h3>
              <button
                type="button"
                onClick={addLab}
                className="px-3 py-1 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700"
              >
                + Add Lab
              </button>
            </div>
            <p className="text-xs text-yellow-700 mb-2">Enter key lab values for analytics. Attach full lab reports in Step 5.</p>
            {labs.map((lab, index) => (
              <div key={index} className="grid grid-cols-6 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Test Name"
                  value={lab.test_name}
                  onChange={(e) => updateLab(index, 'test_name', e.target.value)}
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={lab.value}
                  onChange={(e) => updateLab(index, 'value', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Unit"
                  value={lab.unit || ''}
                  onChange={(e) => updateLab(index, 'unit', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <div className="flex items-center px-3">
                  <label className="flex items-center text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lab.abnormal || false}
                      onChange={(e) => updateLab(index, 'abnormal', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">Abnormal</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeLab(index)}
                  className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Clinical Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Clinical Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Any additional clinical information..."
            />
          </div>
        </div>
      )}

      {/* Step 4: Sender Info */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📞 Sender Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provider Name *
            </label>
            <input
              type="text"
              value={formData.sender_provider_name}
              onChange={(e) =>
                setFormData({ ...formData, sender_provider_name: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Dr. Jane Smith, MD"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Callback Number *
            </label>
            <input
              type="tel"
              value={formData.sender_callback_number}
              onChange={(e) =>
                setFormData({ ...formData, sender_callback_number: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              value={formData.sender_notes}
              onChange={(e) =>
                setFormData({ ...formData, sender_notes: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Special instructions, follow-up needed, etc..."
            />
          </div>
        </div>
      )}

      {/* Step 5: Attachments */}
      {currentStep === 5 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📎 Attachments</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Receiving Facility *
            </label>
            <input
              type="text"
              value={formData.receiving_facility}
              onChange={(e) =>
                setFormData({ ...formData, receiving_facility: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="University Medical Center - Cardiology"
            />
          </div>

          <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
            <label className="block text-center cursor-pointer">
              <div className="text-4xl mb-2">📁</div>
              <p className="text-gray-700 font-medium mb-1">
                Upload Labs, EKG, Imaging
              </p>
              <p className="text-sm text-gray-500 mb-3">
                PDF, JPG, PNG (max 50MB each)
              </p>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />
              <span className="px-4 py-2 bg-blue-600 text-white rounded-lg inline-block hover:bg-blue-700">
                Select Files
              </span>
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                {attachments.length} file(s) selected:
              </p>
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">📄</span>
                    <div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LiteSenderFormSteps;
