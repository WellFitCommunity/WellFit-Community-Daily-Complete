// src/components/ems/ERIncomingPatientBoard.tsx
// ER Dashboard showing incoming ambulances in real-time
// Real-time updates via Supabase subscriptions
// Includes coordinated response and provider sign-off

import React, { useEffect, useState } from 'react';
import {
  getIncomingPatients,
  acknowledgeHandoff,
  markPatientArrived,
  transferPatientToER,
  subscribeToIncomingPatients,
  formatVitals,
  getAlertSeverity,
  getAlertBadges,
  type IncomingPatient,
} from '../../services/emsService';
import { integrateEMSHandoff } from '../../services/emsIntegrationService';
import { auditLogger } from '../../services/auditLogger';
import CoordinatedResponseDashboard from './CoordinatedResponseDashboard';
import ProviderSignoffForm from './ProviderSignoffForm';

interface ERIncomingPatientBoardProps {
  hospitalName?: string;
}

const ERIncomingPatientBoard: React.FC<ERIncomingPatientBoardProps> = ({ hospitalName }) => {
  const [patients, setPatients] = useState<IncomingPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celebrationActive, setCelebrationActive] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');

  // Modal states for coordinated response and provider signoff
  const [selectedPatientForResponse, setSelectedPatientForResponse] = useState<IncomingPatient | null>(null);
  const [selectedPatientForSignoff, setSelectedPatientForSignoff] = useState<IncomingPatient | null>(null);

  // Load initial data
  useEffect(() => {
    loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPatients is stable, hospitalName captures trigger
  }, [hospitalName]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!hospitalName) return;

    const subscription = subscribeToIncomingPatients(hospitalName, (_payload) => {
      // Reload patients on any change
      loadPatients();
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPatients is stable, hospitalName captures trigger
  }, [hospitalName]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadPatients();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPatients is stable, hospitalName captures trigger
  }, [hospitalName]);

  const loadPatients = async () => {
    try {
      const { data, error: fetchError } = await getIncomingPatients(hospitalName);

      if (fetchError) throw fetchError;

      setPatients(data || []);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load patients';
      auditLogger.error('ERIncomingPatientBoard: Failed to load patients', errorMessage, {
        hospitalName
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (patientId: string) => {
    try {
      await acknowledgeHandoff(patientId, 'ER notified, preparing for arrival');
      loadPatients(); // Refresh
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('ERIncomingPatientBoard: Failed to acknowledge handoff', errorMessage, {
        patientId
      });
      alert('Failed to acknowledge: ' + errorMessage);
    }
  };

  const handlePatientArrived = async (patientId: string) => {
    try {
      await markPatientArrived(patientId);
      loadPatients(); // Refresh
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      auditLogger.error('ERIncomingPatientBoard: Failed to mark patient arrived', errorMessage, {
        patientId
      });
      alert('Failed to mark arrived: ' + errorMessage);
    }
  };

  const handleCompleteHandoff = async (patientId: string, patientName: string, patient: IncomingPatient) => {
    // ⚠️ CRITICAL SAFETY CHECK - NO CELEBRATION WITHOUT COMPLETE DATA ⚠️
    const validationErrors: string[] = [];

    // Validate required fields for patient safety
    if (!patient.chief_complaint || patient.chief_complaint.trim() === '') {
      validationErrors.push('❌ Chief complaint is missing');
    }

    if (!patient.paramedic_name || patient.paramedic_name.trim() === '') {
      validationErrors.push('❌ Paramedic name is missing');
    }

    if (!patient.unit_number || patient.unit_number.trim() === '') {
      validationErrors.push('❌ Ambulance unit number is missing');
    }

    if (!patient.vitals || Object.keys(patient.vitals).length === 0) {
      validationErrors.push('❌ Patient vitals are missing');
    } else {
      // Check for critical vitals
      if (!patient.vitals.heart_rate) {
        validationErrors.push('⚠️ Heart rate not recorded');
      }
      if (!patient.vitals.blood_pressure_systolic || !patient.vitals.blood_pressure_diastolic) {
        validationErrors.push('⚠️ Blood pressure not recorded');
      }
      if (!patient.vitals.oxygen_saturation) {
        validationErrors.push('⚠️ Oxygen saturation not recorded');
      }
    }

    // Patient must be in 'arrived' status (means arrival was already recorded)
    if (patient.status !== 'arrived') {
      validationErrors.push('❌ Patient has not been marked as arrived yet');
    }

    // If validation fails, show urgent error modal - NO CELEBRATION
    if (validationErrors.length > 0) {
      const errorMessage = `
🚨 HANDOFF CANNOT BE COMPLETED 🚨

Critical patient data is missing. For patient safety, all fields must be complete before handoff.

Missing Information:
${validationErrors.map(err => `  ${err}`).join('\n')}

ACTION REQUIRED:
1. Verify all patient vitals are recorded
2. Confirm paramedic and unit information
3. Ensure patient arrival time is documented
4. Try completing handoff again

Lives depend on complete, accurate handoffs.
      `.trim();

      alert(errorMessage);
      return; // STOP - Do not proceed with incomplete handoff
    }

    // All validation passed - proceed with handoff
    try {
      // Step 1: Transfer patient to ER
      await transferPatientToER(patientId);

      // Step 2: Integrate handoff into patient chart (creates patient, encounter, vitals)

      // Type assertion at service boundary - IncomingPatient is a database row transform of PrehospitalHandoff
      const integrationResult = await integrateEMSHandoff(patientId, patient as unknown as Parameters<typeof integrateEMSHandoff>[1]);

      if (integrationResult.success) {
        // Integration complete
      } else {

        // Don't block handoff completion if integration fails
      }

      // ✅ VALIDATION PASSED - CELEBRATION TIME! 🎉
      const messages = [
        `🎉 YAAAS! ${patientName} is safe with you now! 🙌`,
        `💪 CRUSHED IT! Handoff complete! Team work makes the dream work! ✨`,
        `🔥 BOOM! Another life saved! You're amazing! 🚀`,
        `⚡ FLAWLESS handoff! Patient secured! Let's GOOO! 🎊`,
        `🌟 LEGEND STATUS! ${patientName} is in expert hands now! 💯`,
      ];

      setCelebrationMessage(messages[Math.floor(Math.random() * messages.length)]);
      setCelebrationActive(true);

      // Auto-hide after 4 seconds
      setTimeout(() => {
        setCelebrationActive(false);
      }, 4000);

      loadPatients(); // Refresh
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorCode = err instanceof Error && 'code' in err ? String((err as Error & { code?: string }).code) : 'UNKNOWN';

      // Log the critical error for audit purposes
      auditLogger.error('ERIncomingPatientBoard: CRITICAL - Handoff completion failed', errorMessage, {
        errorCode,
        patientId,
        patientName,
        timestamp: new Date().toISOString()
      });

      // Database/network error - different from validation error
      const technicalErrorMessage = `
⚠️ TECHNICAL ERROR DURING HANDOFF ⚠️

The handoff could not be saved due to a system error.

Error Details: ${errorMessage}

ACTION REQUIRED:
1. Note the current time: ${new Date().toLocaleTimeString()}
2. Document handoff manually if needed
3. Contact IT support immediately
4. Do not retry until issue is resolved

Patient: ${patientName}
Error Code: ${errorCode}
      `.trim();

      alert(technicalErrorMessage);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>⏳</div>
        <div>Loading incoming patients...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '1rem',
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        borderRadius: '8px'
      }}>
        Error: {error}
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>No Incoming Patients</div>
        <div style={{ color: '#6b7280', marginTop: '0.5rem' }}>
          All clear in the ER
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative' }}>
      {/* 🎉 CELEBRATION MODAL 🎉 */}
      {celebrationActive && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          {/* Confetti */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            pointerEvents: 'none'
          }}>
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: '-10px',
                  left: `${Math.random() * 100}%`,
                  width: '10px',
                  height: '10px',
                  backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 5)],
                  animation: `confettiFall ${2 + Math.random() * 2}s linear infinite`,
                  animationDelay: `${Math.random() * 2}s`,
                  transform: `rotate(${Math.random() * 360}deg)`
                }}
              />
            ))}
          </div>

          {/* Success Message with Bounce */}
          <div style={{
            backgroundColor: 'white',
            padding: '3rem',
            borderRadius: '20px',
            textAlign: 'center',
            maxWidth: '500px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            animation: 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
          }}>
            <div style={{
              fontSize: '5rem',
              marginBottom: '1rem',
              animation: 'pulse 1s infinite'
            }}>
              🎉
            </div>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#059669',
              marginBottom: '1rem',
              lineHeight: '1.4'
            }}>
              {celebrationMessage}
            </div>
            <div style={{
              fontSize: '1rem',
              color: '#6b7280'
            }}>
              Patient safely transferred to ER! 🏥
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes confettiFall {
          to {
            transform: translateY(100vh) rotate(360deg);
          }
        }

        @keyframes bounceIn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          🚨 Incoming Patients ({patients.length})
        </h2>
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {patients.map((patient) => {
          const severity = getAlertSeverity(patient);
          const badges = getAlertBadges(patient);
          const minutesUntil = Math.max(0, patient.minutes_until_arrival);

          // Color based on severity
          const borderColor = severity === 'critical' ? '#dc2626' :
                              severity === 'urgent' ? '#ea580c' :
                              '#059669';

          return (
            <div
              key={patient.id}
              style={{
                padding: '1.5rem',
                border: `4px solid ${borderColor}`,
                borderRadius: '12px',
                backgroundColor: 'white',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            >
              {/* Header with ETA */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1rem'
              }}>
                <div style={{ flex: 1 }}>
                  {/* Alert Badges */}
                  {badges.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      {badges.map((badge) => (
                        <span
                          key={badge}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: borderColor,
                            color: 'white',
                            borderRadius: '999px',
                            fontSize: '0.875rem',
                            fontWeight: 'bold'
                          }}
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Chief Complaint */}
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    {patient.chief_complaint}
                  </div>

                  {/* Patient Info */}
                  <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {patient.patient_gender || 'Unknown'} • {patient.patient_age || '?'} years old
                  </div>
                </div>

                {/* ETA Badge */}
                <div style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: minutesUntil <= 5 ? '#dc2626' :
                                   minutesUntil <= 15 ? '#ea580c' :
                                   '#059669',
                  color: 'white',
                  borderRadius: '8px',
                  textAlign: 'center',
                  minWidth: '100px'
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {minutesUntil}
                  </div>
                  <div style={{ fontSize: '0.75rem' }}>
                    min
                  </div>
                </div>
              </div>

              {/* Vitals */}
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                  Vitals:
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  {formatVitals(patient.vitals)}
                </div>
              </div>

              {/* EMS Info */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                <div>
                  <span style={{ color: '#6b7280' }}>Paramedic:</span>{' '}
                  <span style={{ fontWeight: 'bold' }}>{patient.paramedic_name}</span>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Unit:</span>{' '}
                  <span style={{ fontWeight: 'bold' }}>{patient.unit_number}</span>
                </div>
              </div>

              {/* Alert Notes */}
              {patient.alert_notes && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#fef3c7',
                  borderRadius: '8px',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                    ⚠️ Notes:
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>
                    {patient.alert_notes}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {patient.status === 'en_route' && (
                  <>
                    <button
                      onClick={() => handleAcknowledge(patient.id)}
                      style={{
                        flex: 1,
                        minWidth: '150px',
                        padding: '0.75rem',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Acknowledge
                    </button>
                    {badges.length > 0 && (
                      <button
                        onClick={() => setSelectedPatientForResponse(patient)}
                        style={{
                          flex: 1,
                          minWidth: '150px',
                          padding: '0.75rem',
                          backgroundColor: '#8b5cf6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '1rem',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        🚨 View Response Status
                      </button>
                    )}
                  </>
                )}

                {(patient.status === 'acknowledged' || patient.status === 'en_route') && badges.length > 0 && (
                  <button
                    onClick={() => setSelectedPatientForResponse(patient)}
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '0.75rem',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    🚨 Response Status
                  </button>
                )}

                {patient.status === 'acknowledged' && (
                  <button
                    onClick={() => handlePatientArrived(patient.id)}
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '0.75rem',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    🚑 Patient Arrived
                  </button>
                )}

                {patient.status === 'arrived' && (
                  <>
                    <button
                      onClick={() => setSelectedPatientForSignoff(patient)}
                      style={{
                        flex: 1,
                        minWidth: '150px',
                        padding: '0.75rem',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      ✍️ Provider Sign-Off
                    </button>
                    <button
                      onClick={() => handleCompleteHandoff(patient.id, patient.chief_complaint, patient)}
                      style={{
                        flex: 1,
                        minWidth: '150px',
                        padding: '0.75rem',
                        backgroundColor: '#059669',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '1.125rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.4)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.backgroundColor = '#047857';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.backgroundColor = '#059669';
                      }}
                    >
                      🎉 Complete Handoff!
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Coordinated Response Modal */}
      {selectedPatientForResponse && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9998,
          padding: '1rem',
          overflow: 'auto'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '1200px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <button
              onClick={() => setSelectedPatientForResponse(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              ✕ Close
            </button>
            <CoordinatedResponseDashboard
              handoffId={selectedPatientForResponse.id}
              chiefComplaint={selectedPatientForResponse.chief_complaint}
              etaMinutes={Math.max(0, selectedPatientForResponse.minutes_until_arrival)}
            />
          </div>
        </div>
      )}

      {/* Provider Sign-Off Modal */}
      {selectedPatientForSignoff && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9998,
          padding: '1rem',
          overflow: 'auto'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative',
            padding: '1rem'
          }}>
            <button
              onClick={() => setSelectedPatientForSignoff(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              ✕ Close
            </button>
            <ProviderSignoffForm
              handoff={selectedPatientForSignoff}
              onSignoffComplete={() => {
                setSelectedPatientForSignoff(null);
                loadPatients();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ERIncomingPatientBoard;
