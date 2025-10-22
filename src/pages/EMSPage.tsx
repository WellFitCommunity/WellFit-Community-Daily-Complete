// src/pages/EMSPage.tsx
// EMS Prehospital Handoff System
// Two views: Paramedic form (mobile) and ER dashboard (desktop)

import React, { useState } from 'react';
import ParamedicHandoffForm from '../components/ems/ParamedicHandoffForm';
import ERIncomingPatientBoard from '../components/ems/ERIncomingPatientBoard';

const EMSPage: React.FC = () => {
  const [view, setView] = useState<'paramedic' | 'er'>('er');

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '1rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header with View Toggle */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        marginBottom: '2rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            🚑 EMS Prehospital Handoff
          </h1>
        </div>

        {/* View Toggle */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          backgroundColor: 'white',
          padding: '0.25rem',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
          width: 'fit-content'
        }}>
          <button
            onClick={() => setView('er')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: view === 'er' ? '#2563eb' : 'transparent',
              color: view === 'er' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🏥 ER Dashboard
          </button>
          <button
            onClick={() => setView('paramedic')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: view === 'paramedic' ? '#2563eb' : 'transparent',
              color: view === 'paramedic' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            📡 Paramedic Form
          </button>
        </div>

        {/* Info Banner */}
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#dbeafe',
          borderLeft: '4px solid #2563eb',
          borderRadius: '8px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
            {view === 'er' ? '🏥 ER View' : '📡 Paramedic View'}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
            {view === 'er'
              ? 'Real-time incoming patient notifications. Updates automatically when EMS sends handoff.'
              : 'Quick entry form for paramedics. Sends real-time alert to ER. Works offline.'}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {view === 'er' ? (
          <ERIncomingPatientBoard hospitalName="County General Hospital" />
        ) : (
          <ParamedicHandoffForm />
        )}
      </div>

      {/* Demo Instructions */}
      <div style={{
        maxWidth: '1200px',
        margin: '2rem auto 0',
        padding: '1.5rem',
        backgroundColor: '#fef3c7',
        borderRadius: '8px',
        border: '2px solid #f59e0b'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
          💡 Demo Instructions
        </div>
        <div style={{ fontSize: '0.875rem' }}>
          <strong>To test:</strong>
          <ol style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li>Switch to "Paramedic Form" view</li>
            <li>Fill out a patient (use "County General Hospital" as hospital name)</li>
            <li>Click one of the critical alert buttons (STEMI, Stroke, etc.)</li>
            <li>Submit the form</li>
            <li>Switch back to "ER Dashboard" view</li>
            <li>You'll see the patient appear instantly!</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default EMSPage;
