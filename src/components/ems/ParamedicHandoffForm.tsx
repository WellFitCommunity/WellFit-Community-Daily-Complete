// src/components/ems/ParamedicHandoffForm.tsx
// Mobile-optimized form for paramedics to send patient info from ambulance
// Design: 60-second entry, big buttons, voice-to-text ready

import React, { useState } from 'react';
import { createPrehospitalHandoff, type PrehospitalHandoff } from '../../services/emsService';
import { auditLogger } from '../../services/auditLogger';

const ParamedicHandoffForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState<'M' | 'F' | 'X' | 'U'>('U');

  // Vitals
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [o2Sat, setO2Sat] = useState('');
  const [respRate, setRespRate] = useState('');
  const [gcs, setGcs] = useState('');

  // ETA
  const [etaMinutes, setEtaMinutes] = useState('15');

  // Alerts
  const [strokeAlert, setStrokeAlert] = useState(false);
  const [stemiAlert, setStemiAlert] = useState(false);
  const [traumaAlert, setTraumaAlert] = useState(false);
  const [sepsisAlert, setSepsisAlert] = useState(false);

  // EMS Info
  const [paramedicName, setParamedicName] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [hospitalName, setHospitalName] = useState('');

  // Notes
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Calculate ETA
      const eta = new Date();
      eta.setMinutes(eta.getMinutes() + parseInt(etaMinutes || '15'));

      const handoff: PrehospitalHandoff = {
        chief_complaint: chiefComplaint,
        patient_age: patientAge ? parseInt(patientAge) : undefined,
        patient_gender: patientGender,
        eta_hospital: eta.toISOString(),
        vitals: {
          blood_pressure_systolic: bpSystolic ? parseInt(bpSystolic) : undefined,
          blood_pressure_diastolic: bpDiastolic ? parseInt(bpDiastolic) : undefined,
          heart_rate: heartRate ? parseInt(heartRate) : undefined,
          oxygen_saturation: o2Sat ? parseInt(o2Sat) : undefined,
          respiratory_rate: respRate ? parseInt(respRate) : undefined,
          gcs_score: gcs ? parseInt(gcs) : undefined,
        },
        stroke_alert: strokeAlert,
        stemi_alert: stemiAlert,
        trauma_alert: traumaAlert,
        sepsis_alert: sepsisAlert,
        alert_notes: notes || undefined,
        paramedic_name: paramedicName,
        unit_number: unitNumber,
        receiving_hospital_name: hospitalName,
        status: 'en_route',
      };

      const { error: submitError } = await createPrehospitalHandoff(handoff);

      if (submitError) {
        throw submitError;
      }

      setSuccess(true);

      // Auto-clear after 3 seconds
      setTimeout(() => {
        resetForm();
      }, 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send handoff';
      auditLogger.error('ParamedicHandoffForm: Failed to submit handoff', errorMessage, {
        chiefComplaint,
        paramedicName,
        unitNumber
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSuccess(false);
    setChiefComplaint('');
    setPatientAge('');
    setPatientGender('U');
    setBpSystolic('');
    setBpDiastolic('');
    setHeartRate('');
    setO2Sat('');
    setRespRate('');
    setGcs('');
    setStrokeAlert(false);
    setStemiAlert(false);
    setTraumaAlert(false);
    setSepsisAlert(false);
    setNotes('');
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
        ✅ Handoff Sent Successfully!
        <div style={{ fontSize: '1rem', marginTop: '1rem' }}>
          ER has been notified
        </div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '1rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 'bold' }}>
        📡 EMS Handoff
      </h1>

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
        {/* Chief Complaint */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Chief Complaint *
          </label>
          <input
            type="text"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="Chest pain, difficulty breathing..."
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

        {/* Patient Demographics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Age
            </label>
            <input
              type="number"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              placeholder="67"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #d1d5db',
                borderRadius: '8px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Gender
            </label>
            <select
              value={patientGender}
              onChange={(e) => setPatientGender(e.target.value as 'M' | 'F' | 'X' | 'U')}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #d1d5db',
                borderRadius: '8px'
              }}
            >
              <option value="U">Unknown</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="X">Other</option>
            </select>
          </div>
        </div>

        {/* Vitals */}
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Vitals</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <input
              type="number"
              value={bpSystolic}
              onChange={(e) => setBpSystolic(e.target.value)}
              placeholder="BP Systolic"
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
            <input
              type="number"
              value={bpDiastolic}
              onChange={(e) => setBpDiastolic(e.target.value)}
              placeholder="BP Diastolic"
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
            <input
              type="number"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              placeholder="Heart Rate"
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
            <input
              type="number"
              value={o2Sat}
              onChange={(e) => setO2Sat(e.target.value)}
              placeholder="O2 Sat %"
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
            <input
              type="number"
              value={respRate}
              onChange={(e) => setRespRate(e.target.value)}
              placeholder="Resp Rate"
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
            <input
              type="number"
              value={gcs}
              onChange={(e) => setGcs(e.target.value)}
              placeholder="GCS Score"
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
        </div>

        {/* Critical Alerts */}
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>🚨 Critical Alerts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {[
              { label: '❤️ STEMI', value: stemiAlert, setter: setStemiAlert, color: '#dc2626' },
              { label: '🧠 STROKE', value: strokeAlert, setter: setStrokeAlert, color: '#ea580c' },
              { label: '🏥 TRAUMA', value: traumaAlert, setter: setTraumaAlert, color: '#ca8a04' },
              { label: '🦠 SEPSIS', value: sepsisAlert, setter: setSepsisAlert, color: '#7c3aed' },
            ].map((alert) => (
              <button
                key={alert.label}
                type="button"
                onClick={() => alert.setter(!alert.value)}
                style={{
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  border: `3px solid ${alert.value ? alert.color : '#d1d5db'}`,
                  backgroundColor: alert.value ? alert.color : 'white',
                  color: alert.value ? 'white' : '#374151',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                {alert.label}
              </button>
            ))}
          </div>
        </div>

        {/* ETA */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            ETA (minutes) *
          </label>
          <select
            value={etaMinutes}
            onChange={(e) => setEtaMinutes(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '2px solid #d1d5db',
              borderRadius: '8px'
            }}
          >
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
          </select>

          {/* Calculated Arrival Time Display */}
          <div style={{
            marginTop: '0.5rem',
            padding: '1rem',
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            border: '2px solid #3b82f6',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              ESTIMATED ARRIVAL TIME
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e3a8a' }}>
              {new Date(Date.now() + parseInt(etaMinutes) * 60 * 1000).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#1e40af', marginTop: '0.25rem' }}>
              ({etaMinutes} minutes from now)
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Additional Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Patient found unresponsive, CPR in progress..."
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

        {/* EMS Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Your Name *
            </label>
            <input
              type="text"
              value={paramedicName}
              onChange={(e) => setParamedicName(e.target.value)}
              placeholder="Paramedic Smith"
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
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Unit # *
            </label>
            <input
              type="text"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="Medic 7"
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
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Hospital *
          </label>
          <input
            type="text"
            value={hospitalName}
            onChange={(e) => setHospitalName(e.target.value)}
            placeholder="County General Hospital"
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

        {/* Submit */}
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
          {loading ? 'Sending...' : '📡 Send Handoff to ER'}
        </button>
      </form>
    </div>
  );
};

export default ParamedicHandoffForm;
