/**
 * Senior Emergency Information Form
 *
 * Collects emergency response information during senior onboarding
 * For Precinct 3 "Are You OK" welfare check program
 */

import React, { useState, useEffect } from 'react';
import { LawEnforcementService } from '../../services/lawEnforcementService';
import type { EmergencyResponseFormData, ResponsePriority } from '../../types/lawEnforcement';

interface SeniorEmergencyInfoFormProps {
  patientId: string;
  onSave?: () => void;
  readOnly?: boolean;
}

export const SeniorEmergencyInfoForm: React.FC<SeniorEmergencyInfoFormProps> = ({
  patientId,
  onSave,
  readOnly = false
}) => {
  const [formData, setFormData] = useState<Partial<EmergencyResponseFormData>>({
    bedBound: false,
    wheelchairBound: false,
    walkerRequired: false,
    caneRequired: false,
    oxygenDependent: false,
    dialysisRequired: false,
    hearingImpaired: false,
    visionImpaired: false,
    cognitiveImpairment: false,
    nonVerbal: false,
    elevatorRequired: false,
    doorOpensInward: true,
    securitySystem: false,
    fallRiskHigh: false,
    responsePriority: 'standard',
    escalationDelayHours: 6,
    consentObtained: false,
    hipaaAuthorization: false,
    medicalEquipment: [],
    criticalMedications: []
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExistingInfo();
  }, [patientId]);

  const loadExistingInfo = async () => {
    const existing = await LawEnforcementService.getEmergencyResponseInfo(patientId);
    if (existing) {
      setFormData({
        bedBound: existing.bedBound,
        wheelchairBound: existing.wheelchairBound,
        walkerRequired: existing.walkerRequired,
        caneRequired: existing.caneRequired,
        mobilityNotes: existing.mobilityNotes || '',
        oxygenDependent: existing.oxygenDependent,
        oxygenTankLocation: existing.oxygenTankLocation || '',
        dialysisRequired: existing.dialysisRequired,
        dialysisSchedule: existing.dialysisSchedule || '',
        medicalEquipment: existing.medicalEquipment,
        hearingImpaired: existing.hearingImpaired,
        hearingImpairedNotes: existing.hearingImpairedNotes || '',
        visionImpaired: existing.visionImpaired,
        visionImpairedNotes: existing.visionImpairedNotes || '',
        cognitiveImpairment: existing.cognitiveImpairment,
        cognitiveImpairmentType: existing.cognitiveImpairmentType || '',
        cognitiveImpairmentNotes: existing.cognitiveImpairmentNotes || '',
        nonVerbal: existing.nonVerbal,
        languageBarrier: existing.languageBarrier || '',
        floorNumber: existing.floorNumber || '',
        buildingQuadrant: existing.buildingQuadrant || '',
        elevatorRequired: existing.elevatorRequired,
        elevatorAccessCode: existing.elevatorAccessCode || '',
        buildingType: existing.buildingType || '',
        stairsToUnit: existing.stairsToUnit || 0,
        doorCode: existing.doorCode || '',
        keyLocation: existing.keyLocation || '',
        accessInstructions: existing.accessInstructions || '',
        doorOpensInward: existing.doorOpensInward,
        securitySystem: existing.securitySystem,
        securitySystemCode: existing.securitySystemCode || '',
        petsInHome: existing.petsInHome || '',
        parkingInstructions: existing.parkingInstructions || '',
        gatedCommunityCode: existing.gatedCommunityCode || '',
        lobbyAccessInstructions: existing.lobbyAccessInstructions || '',
        bestEntrance: existing.bestEntrance || '',
        intercomInstructions: existing.intercomInstructions || '',
        fallRiskHigh: existing.fallRiskHigh,
        fallHistory: existing.fallHistory || '',
        homeHazards: existing.homeHazards || '',
        neighborName: existing.neighborName || '',
        neighborAddress: existing.neighborAddress || '',
        neighborPhone: existing.neighborPhone || '',
        buildingManagerName: existing.buildingManagerName || '',
        buildingManagerPhone: existing.buildingManagerPhone || '',
        responsePriority: existing.responsePriority,
        escalationDelayHours: existing.escalationDelayHours,
        specialInstructions: existing.specialInstructions || '',
        criticalMedications: existing.criticalMedications,
        medicationLocation: existing.medicationLocation || '',
        medicalConditionsSummary: existing.medicalConditionsSummary || '',
        consentObtained: existing.consentObtained,
        consentDate: existing.consentDate || '',
        consentGivenBy: existing.consentGivenBy || '',
        hipaaAuthorization: existing.hipaaAuthorization
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    // Validation
    if (!formData.consentObtained) {
      setError('Consent is required to collect emergency response information');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await LawEnforcementService.upsertEmergencyResponseInfo(patientId, formData);
      if (onSave) onSave();
    } catch (err) {
      setError('Failed to save emergency information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof EmergencyResponseFormData, value: EmergencyResponseFormData[keyof EmergencyResponseFormData]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Emergency Response Information
        </h3>
        <p className="text-sm text-blue-700">
          This information helps first responders during welfare checks. All information is kept confidential and secure.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Mobility Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Mobility Status</h4>
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.bedBound}
              onChange={(e) => updateField('bedBound', e.target.checked)}
              disabled={readOnly}
              className="mr-2"
            />
            <span>Bed-bound or bedridden</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.wheelchairBound}
              onChange={(e) => updateField('wheelchairBound', e.target.checked)}
              disabled={readOnly}
              className="mr-2"
            />
            <span>Wheelchair user</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.walkerRequired}
              onChange={(e) => updateField('walkerRequired', e.target.checked)}
              disabled={readOnly}
              className="mr-2"
            />
            <span>Requires walker</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.caneRequired}
              onChange={(e) => updateField('caneRequired', e.target.checked)}
              disabled={readOnly}
              className="mr-2"
            />
            <span>Requires cane</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional mobility notes
            </label>
            <textarea
              value={formData.mobilityNotes || ''}
              onChange={(e) => updateField('mobilityNotes', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
              rows={2}
              placeholder="e.g., Limited mobility on stairs, uses scooter outdoors"
            />
          </div>
        </div>
      </div>

      {/* Medical Equipment Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Medical Equipment</h4>
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.oxygenDependent}
              onChange={(e) => updateField('oxygenDependent', e.target.checked)}
              disabled={readOnly}
              className="mr-2"
            />
            <span className="font-medium">Requires oxygen</span>
          </label>

          {formData.oxygenDependent && (
            <div className="ml-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Oxygen tank location *
              </label>
              <input
                type="text"
                value={formData.oxygenTankLocation || ''}
                onChange={(e) => updateField('oxygenTankLocation', e.target.value)}
                disabled={readOnly}
                className="w-full p-2 border border-gray-300 rounded-sm"
                placeholder="e.g., Bedroom nightstand, portable with patient"
              />
            </div>
          )}

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.dialysisRequired}
              onChange={(e) => updateField('dialysisRequired', e.target.checked)}
              disabled={readOnly}
              className="mr-2"
            />
            <span className="font-medium">Requires dialysis</span>
          </label>

          {formData.dialysisRequired && (
            <div className="ml-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dialysis schedule
              </label>
              <input
                type="text"
                value={formData.dialysisSchedule || ''}
                onChange={(e) => updateField('dialysisSchedule', e.target.value)}
                disabled={readOnly}
                className="w-full p-2 border border-gray-300 rounded-sm"
                placeholder="e.g., Monday/Wednesday/Friday 8am-12pm at DaVita"
              />
            </div>
          )}
        </div>
      </div>

      {/* Communication Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Communication Needs</h4>
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.hearingImpaired}
              onChange={(e) => updateField('hearingImpaired', e.target.checked)}
              disabled={readOnly}
              className="mr-2"
            />
            <span>Hearing impaired</span>
          </label>

          {formData.hearingImpaired && (
            <div className="ml-6">
              <input
                type="text"
                value={formData.hearingImpairedNotes || ''}
                onChange={(e) => updateField('hearingImpairedNotes', e.target.value)}
                disabled={readOnly}
                className="w-full p-2 border border-gray-300 rounded-sm"
                placeholder="e.g., Knock loudly, doorbell doesn't work, wears hearing aids"
              />
            </div>
          )}

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.cognitiveImpairment}
              onChange={(e) => updateField('cognitiveImpairment', e.target.checked)}
              disabled={readOnly}
              className="mr-2"
            />
            <span>Cognitive impairment (dementia, Alzheimer's, etc.)</span>
          </label>

          {formData.cognitiveImpairment && (
            <div className="ml-6 space-y-2">
              <input
                type="text"
                value={formData.cognitiveImpairmentType || ''}
                onChange={(e) => updateField('cognitiveImpairmentType', e.target.value)}
                disabled={readOnly}
                className="w-full p-2 border border-gray-300 rounded-sm"
                placeholder="e.g., Alzheimer's, Dementia, TBI"
              />
              <textarea
                value={formData.cognitiveImpairmentNotes || ''}
                onChange={(e) => updateField('cognitiveImpairmentNotes', e.target.value)}
                disabled={readOnly}
                className="w-full p-2 border border-gray-300 rounded-sm"
                rows={2}
                placeholder="Special instructions for interacting with senior"
              />
            </div>
          )}
        </div>
      </div>

      {/* Building Location Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Building Location</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Building type
            </label>
            <select
              value={formData.buildingType || ''}
              onChange={(e) => updateField('buildingType', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
            >
              <option value="">Select...</option>
              <option value="Single Family Home">Single Family Home</option>
              <option value="Apartment">Apartment</option>
              <option value="Condo">Condo</option>
              <option value="Assisted Living">Assisted Living</option>
              <option value="Senior Housing">Senior Housing</option>
              <option value="Mobile Home">Mobile Home</option>
              <option value="Townhouse">Townhouse</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Floor number or level
            </label>
            <input
              type="text"
              value={formData.floorNumber || ''}
              onChange={(e) => updateField('floorNumber', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
              placeholder="e.g., Ground, 3, Top Floor, Basement"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Building quadrant/section/location
            </label>
            <input
              type="text"
              value={formData.buildingQuadrant || ''}
              onChange={(e) => updateField('buildingQuadrant', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
              placeholder="e.g., Northeast corner, Right side facing street, Back of building"
            />
          </div>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.elevatorRequired}
              onChange={(e) => updateField('elevatorRequired', e.target.checked)}
              disabled={readOnly}
              className="mr-2"
            />
            <span className="font-medium">Elevator required to reach unit</span>
          </label>

          {formData.elevatorRequired && (
            <div className="ml-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Elevator access code/instructions
              </label>
              <input
                type="text"
                value={formData.elevatorAccessCode || ''}
                onChange={(e) => updateField('elevatorAccessCode', e.target.value)}
                disabled={readOnly}
                className="w-full p-2 border border-gray-300 rounded-sm"
                placeholder="e.g., Code 4567, Key required, Ask front desk"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of stairs to unit
            </label>
            <input
              type="number"
              min="0"
              value={formData.stairsToUnit || ''}
              onChange={(e) => updateField('stairsToUnit', parseInt(e.target.value) || 0)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Parking instructions for emergency vehicles
            </label>
            <textarea
              value={formData.parkingInstructions || ''}
              onChange={(e) => updateField('parkingInstructions', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
              rows={2}
              placeholder="e.g., Visitor parking Lot B, Street parking only, Loading zone in front"
            />
          </div>
        </div>
      </div>

      {/* Emergency Access Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Emergency Access Information</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Key location (for emergency entry)
            </label>
            <input
              type="text"
              value={formData.keyLocation || ''}
              onChange={(e) => updateField('keyLocation', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
              placeholder="e.g., With neighbor Apt 4A, lockbox code 1234, under flower pot"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access instructions
            </label>
            <textarea
              value={formData.accessInstructions || ''}
              onChange={(e) => updateField('accessInstructions', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
              rows={3}
              placeholder="Detailed instructions for officers on how to enter home if no response..."
            />
          </div>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={!formData.doorOpensInward}
              onChange={(e) => updateField('doorOpensInward', !e.target.checked)}
              disabled={readOnly}
              className="mr-2"
            />
            <span>Door opens OUTWARD (important if person has fallen)</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pets in home
            </label>
            <input
              type="text"
              value={formData.petsInHome || ''}
              onChange={(e) => updateField('petsInHome', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
              placeholder="e.g., 2 dogs - friendly, 1 cat - hides under bed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gated community access code
            </label>
            <input
              type="text"
              value={formData.gatedCommunityCode || ''}
              onChange={(e) => updateField('gatedCommunityCode', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
              placeholder="e.g., #5678, Call box code A123"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Building lobby access instructions
            </label>
            <textarea
              value={formData.lobbyAccessInstructions || ''}
              onChange={(e) => updateField('lobbyAccessInstructions', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
              rows={2}
              placeholder="e.g., Lobby open 6am-10pm, After hours use code 9876, Ring buzzer for manager"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Best entrance for emergency response
            </label>
            <select
              value={formData.bestEntrance || ''}
              onChange={(e) => updateField('bestEntrance', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
            >
              <option value="">Select...</option>
              <option value="Front">Front entrance</option>
              <option value="Side">Side entrance</option>
              <option value="Rear">Rear entrance</option>
              <option value="Garage">Garage</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Intercom/buzzer instructions
            </label>
            <input
              type="text"
              value={formData.intercomInstructions || ''}
              onChange={(e) => updateField('intercomInstructions', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
              placeholder="e.g., Buzzer #302, Ring 3 times, Press * for manager"
            />
          </div>
        </div>
      </div>

      {/* Response Priority Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Response Priority</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority level
            </label>
            <select
              value={formData.responsePriority}
              onChange={(e) => updateField('responsePriority', e.target.value as ResponsePriority)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
            >
              <option value="standard">Standard (6+ hours)</option>
              <option value="high">High (4 hours)</option>
              <option value="critical">Critical (2 hours)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              How quickly constables should respond if check-in is missed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special instructions for officers
            </label>
            <textarea
              value={formData.specialInstructions || ''}
              onChange={(e) => updateField('specialInstructions', e.target.value)}
              disabled={readOnly}
              className="w-full p-2 border border-gray-300 rounded-sm"
              rows={3}
              placeholder="Any other important information for responding officers..."
            />
          </div>
        </div>
      </div>

      {/* Consent Section */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Consent & Authorization</h4>
        <div className="space-y-3">
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={formData.consentObtained}
              onChange={(e) => updateField('consentObtained', e.target.checked)}
              disabled={readOnly}
              className="mr-2 mt-1"
              required
            />
            <span className="text-sm">
              <span className="font-medium">I consent</span> to sharing this emergency response information with Precinct 3 constables for welfare check purposes. I understand this information will be kept confidential and used only for emergency response.
            </span>
          </label>

          <label className="flex items-start">
            <input
              type="checkbox"
              checked={formData.hipaaAuthorization}
              onChange={(e) => updateField('hipaaAuthorization', e.target.checked)}
              disabled={readOnly}
              className="mr-2 mt-1"
            />
            <span className="text-sm">
              I authorize the disclosure of health information as necessary for emergency response (HIPAA authorization).
            </span>
          </label>
        </div>
      </div>

      {/* Submit Button */}
      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Emergency Information'}
          </button>
        </div>
      )}
    </form>
  );
};

export default SeniorEmergencyInfoForm;
