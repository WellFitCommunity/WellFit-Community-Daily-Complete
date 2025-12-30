// Provider Sign-Off Form for EMS Handoffs
// Role-agnostic: Supports MD, DO, PA, NP, Resident accepting transfers
// Electronic signature for accepting responsibility

import React, { useState } from 'react';
import { createProviderSignoff } from '../../services/emsNotificationService';
import type { IncomingPatient } from '../../services/emsService';
import { auditLogger } from '../../services/auditLogger';

type ProviderRole = 'physician' | 'pa' | 'np' | 'resident';
type SignoffType = 'acceptance' | 'acknowledgement' | 'treatment_plan' | 'final_signoff';

interface ProviderSignoffFormProps {
  handoff: IncomingPatient;
  onSignoffComplete?: () => void;
}

const ProviderSignoffForm: React.FC<ProviderSignoffFormProps> = ({
  handoff,
  onSignoffComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Provider Info
  const [providerName, setProviderName] = useState('');
  const [providerRole, setProviderRole] = useState<ProviderRole>('physician');
  const [providerCredentials, setProviderCredentials] = useState('MD');

  // Signoff Type
  const [signoffType, setSignoffType] = useState<SignoffType>('acceptance');

  // Clinical Assessment
  const [patientCondition, setPatientCondition] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [disposition, setDisposition] = useState<string>('');

  // Electronic Signature
  const [electronicSignature, setElectronicSignature] = useState('');
  const [signatureAgreement, setSignatureAgreement] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate signature
    if (electronicSignature.trim().toLowerCase() !== providerName.trim().toLowerCase()) {
      setError('Electronic signature must match provider name exactly.');
      setLoading(false);
      return;
    }

    if (!signatureAgreement) {
      setError('You must agree to the electronic signature statement.');
      setLoading(false);
      return;
    }

    try {
      const { error: submitError } = await createProviderSignoff({
        handoffId: handoff.id,
        providerName,
        providerRole,
        providerCredentials,
        signoffType,
        patientConditionOnArrival: patientCondition,
        treatmentPlanNotes: treatmentPlan,
        disposition: disposition || undefined,
        electronicSignature,
      });

      if (submitError) {
        throw submitError;
      }

      setSuccess(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        if (onSignoffComplete) {
          onSignoffComplete();
        }
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit sign-off';
      auditLogger.error('ProviderSignoffForm: Failed to submit sign-off', errorMessage, {
        handoffId: handoff.id,
        providerName,
        providerRole,
        signoffType
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: '#10b981',
        color: 'white',
        borderRadius: '8px',
        fontSize: '1.5rem'
      }}>
        ✅ Sign-Off Completed!
        <div style={{ fontSize: '1rem', marginTop: '1rem' }}>
          Transfer accepted by {providerName}, {providerCredentials}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '1.5rem',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '2px solid #d1d5db',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Provider Sign-Off
      </h2>

      {/* Patient Info Summary */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        marginBottom: '1.5rem'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Patient Transfer Details:</div>
        <div style={{ fontSize: '0.875rem', color: '#374151' }}>
          <div>Chief Complaint: {handoff.chief_complaint}</div>
          <div>Age: {handoff.patient_age || 'Unknown'} • Gender: {handoff.patient_gender || 'Unknown'}</div>
          <div>From: {handoff.unit_number} ({handoff.paramedic_name})</div>
          <div>
            Alerts:{' '}
            {handoff.stroke_alert && '🧠 STROKE '}
            {handoff.stemi_alert && '❤️ STEMI '}
            {handoff.trauma_alert && '🏥 TRAUMA '}
            {handoff.sepsis_alert && '🦠 SEPSIS '}
            {handoff.cardiac_arrest && '🚨 CARDIAC ARREST '}
            {!handoff.stroke_alert && !handoff.stemi_alert && !handoff.trauma_alert &&
             !handoff.sepsis_alert && !handoff.cardiac_arrest && 'None'}
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Provider Information */}
        <div style={{
          padding: '1rem',
          backgroundColor: '#eff6ff',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '0.75rem' }}>Provider Information</h3>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Full Name *
            </label>
            <input
              type="text"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="Dr. Jane Smith"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #d1d5db',
                borderRadius: '8px'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Role *
              </label>
              <select
                value={providerRole}
                onChange={(e) => setProviderRole(e.target.value as ProviderRole)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px'
                }}
              >
                <option value="physician">Physician</option>
                <option value="pa">Physician Assistant</option>
                <option value="np">Nurse Practitioner</option>
                <option value="resident">Resident</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Credentials *
              </label>
              <select
                value={providerCredentials}
                onChange={(e) => setProviderCredentials(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px'
                }}
              >
                <option value="MD">MD</option>
                <option value="DO">DO</option>
                <option value="PA-C">PA-C</option>
                <option value="NP-C">NP-C</option>
                <option value="NP">NP</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sign-Off Type */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Sign-Off Type *
          </label>
          <select
            value={signoffType}
            onChange={(e) => setSignoffType(e.target.value as SignoffType)}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '2px solid #d1d5db',
              borderRadius: '8px'
            }}
          >
            <option value="acceptance">Acceptance - I accept this patient transfer</option>
            <option value="acknowledgement">Acknowledgement - I acknowledge receipt of transfer</option>
            <option value="treatment_plan">Treatment Plan - I have established initial treatment plan</option>
            <option value="final_signoff">Final Sign-Off - Transfer complete, patient in my care</option>
          </select>
        </div>

        {/* Clinical Assessment */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Patient Condition on Arrival
          </label>
          <textarea
            value={patientCondition}
            onChange={(e) => setPatientCondition(e.target.value)}
            placeholder="Describe patient's condition when arrived... (e.g., Alert and oriented x3, in moderate distress, vital signs stable...)"
            rows={3}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '2px solid #d1d5db',
              borderRadius: '8px'
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Treatment Plan / Initial Interventions
          </label>
          <textarea
            value={treatmentPlan}
            onChange={(e) => setTreatmentPlan(e.target.value)}
            placeholder="Document initial treatment plan... (e.g., IV fluids initiated, pain management, diagnostic workup ordered...)"
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '2px solid #d1d5db',
              borderRadius: '8px'
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Disposition
          </label>
          <select
            value={disposition}
            onChange={(e) => setDisposition(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '2px solid #d1d5db',
              borderRadius: '8px'
            }}
          >
            <option value="">-- Select Disposition --</option>
            <option value="er_observation">ER Observation</option>
            <option value="admitted">Admitted to Hospital</option>
            <option value="icu">Admitted to ICU</option>
            <option value="transferred">Transferred to Another Facility</option>
            <option value="discharged">Discharged Home</option>
          </select>
        </div>

        {/* Electronic Signature */}
        <div style={{
          padding: '1rem',
          backgroundColor: '#fef3c7',
          border: '2px solid #fbbf24',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#92400e' }}>
            Electronic Signature Required
          </h3>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Type Your Full Name to Sign *
            </label>
            <input
              type="text"
              value={electronicSignature}
              onChange={(e) => setElectronicSignature(e.target.value)}
              placeholder="Enter your full name exactly as shown above"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #d97706',
                borderRadius: '8px',
                backgroundColor: 'white'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="signature-agreement"
              checked={signatureAgreement}
              onChange={(e) => setSignatureAgreement(e.target.checked)}
              required
              style={{ marginTop: '0.25rem' }}
            />
            <label htmlFor="signature-agreement" style={{ fontSize: '0.875rem', color: '#92400e' }}>
              I certify that by typing my name above, I am electronically signing this document.
              I accept full responsibility for the care of this patient and acknowledge that this
              signature has the same legal effect as a handwritten signature.
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            backgroundColor: loading ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Submitting Sign-Off...' : '✍️ Submit Provider Sign-Off'}
        </button>
      </form>

      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        fontSize: '0.75rem',
        color: '#6b7280',
        textAlign: 'center'
      }}>
        All sign-offs are logged with timestamp and provider information for compliance and audit purposes.
        This document is part of the patient's permanent medical record.
      </div>
    </div>
  );
};

export default ProviderSignoffForm;
