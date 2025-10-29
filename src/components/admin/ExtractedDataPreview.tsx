import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, X, UserPlus } from 'lucide-react';

interface ExtractedPatientData {
  // Demographics
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  dob?: string;
  age?: number;
  gender?: string;
  mrn?: string;
  ssn?: string;

  // Contact
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;

  // Emergency Contact
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;

  // Hospital Details
  admissionDate?: string;
  admissionTime?: string;
  hospitalUnit?: string;
  roomNumber?: string;
  bedNumber?: string;
  admissionSource?: string;
  acuityLevel?: string;
  codeStatus?: string;

  // Insurance
  primaryInsurance?: string;
  insuranceId?: string;
  insuranceGroupNumber?: string;
  medicareNumber?: string;
  medicaidNumber?: string;

  // Clinical
  clinicalNotes?: string;
  allergies?: string[];
  nkda?: boolean;

  // Staff
  staffName?: string;
  dateCompleted?: string;
  timeCompleted?: string;

  // Metadata
  confidence?: 'high' | 'medium' | 'low';
  uncertainFields?: string[];
  notes?: string;
}

interface ExtractedDataPreviewProps {
  data: ExtractedPatientData;
  formImage: string;
  onEnroll: (correctedData: ExtractedPatientData) => Promise<void>;
  onCancel: () => void;
}

/**
 * ExtractedDataPreview Component
 *
 * Allows staff to:
 * 1. Review AI-extracted data from paper forms
 * 2. See confidence scores and uncertain fields
 * 3. Edit/correct any fields before enrollment
 * 4. View original form image for reference
 * 5. Bulk enroll corrected patients
 */

const ExtractedDataPreview: React.FC<ExtractedDataPreviewProps> = ({
  data,
  formImage,
  onEnroll,
  onCancel,
}) => {
  const [editedData, setEditedData] = useState<ExtractedPatientData>(data);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [showImage, setShowImage] = useState(false);

  const handleFieldChange = (field: keyof ExtractedPatientData, value: any) => {
    setEditedData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEnroll = async () => {
    setIsEnrolling(true);
    try {
      await onEnroll(editedData);
    } catch (error) {

      alert('Failed to enroll patient. Please try again.');
    } finally {
      setIsEnrolling(false);
    }
  };

  const getConfidenceBadge = (confidence?: string) => {
    switch (confidence) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
            <CheckCircle className="w-3 h-3" />
            High Confidence
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
            <AlertTriangle className="w-3 h-3" />
            Medium Confidence
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
            <AlertTriangle className="w-3 h-3" />
            Low Confidence
          </span>
        );
      default:
        return null;
    }
  };

  const isFieldUncertain = (field: string) => {
    return editedData.uncertainFields?.includes(field);
  };

  const InputField: React.FC<{
    label: string;
    field: keyof ExtractedPatientData;
    type?: string;
    required?: boolean;
  }> = ({ label, field, type = 'text', required = false }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
        {isFieldUncertain(field) && (
          <span className="ml-2 text-xs text-yellow-600 font-normal">
            (Uncertain - please verify)
          </span>
        )}
      </label>
      <input
        type={type}
        value={(editedData[field] as string) || ''}
        onChange={(e) => handleFieldChange(field, e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          isFieldUncertain(field) ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
        }`}
      />
    </div>
  );

  const SelectField: React.FC<{
    label: string;
    field: keyof ExtractedPatientData;
    options: string[];
    required?: boolean;
  }> = ({ label, field, options, required = false }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
        {isFieldUncertain(field) && (
          <span className="ml-2 text-xs text-yellow-600 font-normal">
            (Uncertain - please verify)
          </span>
        )}
      </label>
      <select
        value={(editedData[field] as string) || ''}
        onChange={(e) => handleFieldChange(field, e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          isFieldUncertain(field) ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
        }`}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Review Extracted Patient Data</h2>
              <p className="text-sm text-gray-600 mt-1">
                Verify and correct the information before enrolling the patient
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {getConfidenceBadge(editedData.confidence)}
            <button
              onClick={() => setShowImage(!showImage)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {showImage ? 'Hide' : 'Show'} Original Form
            </button>
          </div>

          {editedData.notes && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>AI Notes:</strong> {editedData.notes}
              </p>
            </div>
          )}
        </div>

        {/* Original Form Image */}
        {showImage && (
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <img
              src={formImage}
              alt="Original form"
              className="w-full max-h-96 object-contain rounded-lg border-2 border-gray-300"
            />
          </div>
        )}

        {/* Form Fields */}
        <div className="p-6 space-y-8">
          {/* Section 1: Demographics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-blue-600">
              Patient Demographics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InputField label="First Name" field="firstName" required />
              <InputField label="Last Name" field="lastName" required />
              <InputField label="Middle Initial" field="middleInitial" />
              <InputField label="Date of Birth" field="dob" type="date" required />
              <InputField label="Age" field="age" type="number" />
              <SelectField
                label="Gender"
                field="gender"
                options={['Male', 'Female', 'Other']}
              />
              <InputField label="Medical Record Number (MRN)" field="mrn" />
              <InputField label="Social Security Number" field="ssn" />
            </div>
          </div>

          {/* Section 2: Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-green-600">
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Phone Number" field="phone" type="tel" />
              <InputField label="Email Address" field="email" type="email" />
              <div className="md:col-span-2">
                <InputField label="Street Address" field="address" />
              </div>
              <InputField label="City" field="city" />
              <InputField label="State" field="state" />
              <InputField label="ZIP Code" field="zipCode" />
            </div>
          </div>

          {/* Section 3: Emergency Contact */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-orange-600">
              Emergency Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField label="Emergency Contact Name" field="emergencyContactName" />
              <InputField label="Relationship" field="emergencyContactRelationship" />
              <InputField label="Emergency Contact Phone" field="emergencyContactPhone" type="tel" />
            </div>
          </div>

          {/* Section 4: Hospital Details */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-purple-600">
              Hospital Admission Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InputField label="Admission Date" field="admissionDate" type="date" />
              <InputField label="Admission Time" field="admissionTime" type="time" />
              <InputField label="Hospital Unit" field="hospitalUnit" />
              <InputField label="Room Number" field="roomNumber" />
              <InputField label="Bed Number" field="bedNumber" />
              <SelectField
                label="Admission Source"
                field="admissionSource"
                options={['Emergency Room', 'Physician Referral', 'Transfer', 'Other']}
              />
              <SelectField
                label="Acuity Level"
                field="acuityLevel"
                options={['1-Critical', '2-High', '3-Moderate', '4-Low', '5-Stable']}
              />
              <SelectField
                label="Code Status"
                field="codeStatus"
                options={['Full Code', 'DNR', 'DNR/DNI', 'Comfort Care', 'AND']}
              />
            </div>
          </div>

          {/* Section 5: Insurance */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-teal-600">
              Insurance Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InputField label="Primary Insurance" field="primaryInsurance" />
              <InputField label="Insurance ID" field="insuranceId" />
              <InputField label="Group Number" field="insuranceGroupNumber" />
              <InputField label="Medicare Number" field="medicareNumber" />
              <InputField label="Medicaid Number" field="medicaidNumber" />
            </div>
          </div>

          {/* Section 6: Clinical Notes & Allergies */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-red-600">
              Clinical Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Clinical Notes / Chief Complaint
                </label>
                <textarea
                  value={editedData.clinicalNotes || ''}
                  onChange={(e) => handleFieldChange('clinicalNotes', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allergies (comma-separated)
                </label>
                <input
                  type="text"
                  value={editedData.allergies?.join(', ') || ''}
                  onChange={(e) =>
                    handleFieldChange(
                      'allergies',
                      e.target.value.split(',').map((a) => a.trim()).filter(Boolean)
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Penicillin, Latex, Shellfish"
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editedData.nkda || false}
                    onChange={(e) => handleFieldChange('nkda', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    No Known Drug Allergies (NKDA)
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={onCancel}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleEnroll}
              disabled={isEnrolling || !editedData.firstName || !editedData.lastName}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEnrolling ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enrolling...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Enroll Patient
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtractedDataPreview;
