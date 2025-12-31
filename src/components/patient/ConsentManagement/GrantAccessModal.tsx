/**
 * GrantAccessModal - Grant Data Access to Providers/Apps
 *
 * Allows patients to manually grant access to their health data
 * to healthcare providers or systems.
 *
 * Compliance: HIPAA, 21st Century Cures Act
 */

import React, { useState } from 'react';
import { X, Shield, Users, Building, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';

interface GrantAccessModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type AccessType = 'provider' | 'organization' | 'research';

interface GrantFormData {
  accessType: AccessType;
  recipientName: string;
  recipientEmail: string;
  purpose: string;
  dataCategories: string[];
  expirationDays: number | null;
}

const DATA_CATEGORIES = [
  { id: 'demographics', label: 'Basic Information', description: 'Name, DOB, contact info' },
  { id: 'medications', label: 'Medications', description: 'Current and past medications' },
  { id: 'allergies', label: 'Allergies', description: 'Known allergies and reactions' },
  { id: 'conditions', label: 'Conditions', description: 'Diagnoses and health conditions' },
  { id: 'vitals', label: 'Vitals & Labs', description: 'Lab results and vital signs' },
  { id: 'immunizations', label: 'Immunizations', description: 'Vaccination records' },
  { id: 'procedures', label: 'Procedures', description: 'Past procedures and surgeries' },
  { id: 'notes', label: 'Clinical Notes', description: 'Provider notes and summaries' },
];

const GrantAccessModal: React.FC<GrantAccessModalProps> = ({ userId, onClose, onSuccess }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const { showToast, ToastContainer } = useToast();
  const [formData, setFormData] = useState<GrantFormData>({
    accessType: 'provider',
    recipientName: '',
    recipientEmail: '',
    purpose: '',
    dataCategories: [],
    expirationDays: 365,
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../../../lib/supabaseClient');

      // Map data categories to FHIR scopes
      const scopeMap: Record<string, string[]> = {
        demographics: ['patient/Patient.read'],
        medications: ['patient/MedicationRequest.read'],
        allergies: ['patient/AllergyIntolerance.read'],
        conditions: ['patient/Condition.read'],
        vitals: ['patient/Observation.read'],
        immunizations: ['patient/Immunization.read'],
        procedures: ['patient/Procedure.read'],
        notes: ['patient/DocumentReference.read'],
      };

      const scopes = formData.dataCategories.flatMap(cat => scopeMap[cat] || []);

      // Calculate expiration date
      const expiresAt = formData.expirationDays
        ? new Date(Date.now() + formData.expirationDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Create consent record
      const { error } = await supabase.from('patient_consents').insert({
        patient_id: userId,
        consent_category: formData.accessType === 'research' ? 'research' : 'data_sharing',
        purpose: formData.purpose || `Access granted to ${formData.recipientName}`,
        external_system_name: formData.recipientName,
        scopes_granted: scopes,
        data_categories: formData.dataCategories,
        status: 'active',
        expires_at: expiresAt,
        consent_method: 'electronic',
        audit_log: [{
          action: 'consent_granted',
          timestamp: new Date().toISOString(),
          recipient: formData.recipientName,
          recipient_email: formData.recipientEmail,
        }],
      });

      if (error) {
        throw error;
      }

      showToast('success', 'Access granted successfully.');
      onSuccess();
    } catch (err: unknown) {
      showToast('error', 'Failed to grant access. Please try again.');
    }
    setLoading(false);
  };

  const toggleCategory = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      dataCategories: prev.dataCategories.includes(categoryId)
        ? prev.dataCategories.filter(c => c !== categoryId)
        : [...prev.dataCategories, categoryId],
    }));
  };

  const selectAllCategories = () => {
    setFormData(prev => ({
      ...prev,
      dataCategories: DATA_CATEGORIES.map(c => c.id),
    }));
  };

  const canProceedStep1 = formData.recipientName.trim() !== '';
  const canProceedStep2 = formData.dataCategories.length > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <ToastContainer />
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-auto z-10">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-blue-600" />
              Grant Data Access
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="px-4 pt-4">
            <div className="flex items-center justify-center space-x-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step >= s
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`w-12 h-1 mx-2 ${
                        step > s ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500 px-4">
              <span>Recipient</span>
              <span>Data</span>
              <span>Confirm</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Step 1: Recipient Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Who are you granting access to?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'provider', label: 'Provider', icon: Users },
                      { id: 'organization', label: 'Organization', icon: Building },
                      { id: 'research', label: 'Research', icon: Shield },
                    ].map((type) => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.id}
                          onClick={() => setFormData(prev => ({ ...prev, accessType: type.id as AccessType }))}
                          className={`p-3 rounded-lg border text-center ${
                            formData.accessType === type.id
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon className="w-5 h-5 mx-auto mb-1" />
                          <span className="text-sm">{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name or Organization
                  </label>
                  <input
                    type="text"
                    value={formData.recipientName}
                    onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                    placeholder="e.g., Dr. Smith, Methodist Hospital"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    value={formData.recipientEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                    placeholder="contact@example.com"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purpose (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.purpose}
                    onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                    placeholder="e.g., Second opinion, Care coordination"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Data Selection */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Select data to share:
                  </label>
                  <button
                    onClick={selectAllCategories}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Select all
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {DATA_CATEGORIES.map((category) => (
                    <label
                      key={category.id}
                      className={`flex items-start p-3 rounded-lg border cursor-pointer ${
                        formData.dataCategories.includes(category.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.dataCategories.includes(category.id)}
                        onChange={() => toggleCategory(category.id)}
                        className="mt-1 mr-3"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{category.label}</p>
                        <p className="text-sm text-gray-500">{category.description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access expires after:
                  </label>
                  <select
                    value={formData.expirationDays ?? 'never'}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      expirationDays: e.target.value === 'never' ? null : parseInt(e.target.value),
                    }))}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">6 months</option>
                    <option value="365">1 year</option>
                    <option value="never">Never (until I revoke)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Step 3: Confirmation */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">Review before confirming</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        You are about to share your health information. Please review the details below.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Sharing with:</p>
                    <p className="font-medium text-gray-900">{formData.recipientName}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Data included:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {formData.dataCategories.map((catId) => {
                        const cat = DATA_CATEGORIES.find(c => c.id === catId);
                        return (
                          <span
                            key={catId}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                          >
                            {cat?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Expires:</p>
                    <p className="font-medium text-gray-900">
                      {formData.expirationDays
                        ? `In ${formData.expirationDays} days`
                        : 'Never (until you revoke)'}
                    </p>
                  </div>

                  {formData.purpose && (
                    <div>
                      <p className="text-sm text-gray-500">Purpose:</p>
                      <p className="font-medium text-gray-900">{formData.purpose}</p>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-600">
                  By clicking "Grant Access", you authorize {formData.recipientName} to view
                  the selected health information. You can revoke this access at any time
                  from your Consent Management dashboard.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button
              onClick={step === 1 ? onClose : () => setStep((step - 1) as 1 | 2)}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep((step + 1) as 2 | 3)}
                disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Granting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Grant Access
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrantAccessModal;
