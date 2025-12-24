// Medication Reconciliation Alert Component
// Displays discrepancies and safety alerts for medication reconciliation

import React, { useState, useEffect } from 'react';
import MedicationReconciliationService, {
  type MedicationDiscrepancy,
  type MedRecReport
} from '../../services/medicationReconciliationService';
import JointCommissionFormService from '../../services/jointCommissionFormService';
import HandoffService from '../../services/handoffService';
import type { HandoffPacket } from '../../types/handoff';

interface MedicationReconciliationAlertProps {
  packet: HandoffPacket;
}

const MedicationReconciliationAlert: React.FC<MedicationReconciliationAlertProps> = ({
  packet
}) => {
  const [report, setReport] = useState<MedRecReport | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientDOB, setPatientDOB] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function analyzeAndGenerate() {
      // Decrypt patient name and DOB
      const decryptedName = await HandoffService.decryptPHI(
        packet.patient_name_encrypted || ''
      );
      const decryptedDOB = await HandoffService.decryptPHI(
        packet.patient_dob_encrypted || ''
      );

      // React 19: Check if component is still mounted before state updates
      if (!isMounted) return;

      setPatientName(decryptedName);
      setPatientDOB(decryptedDOB);

      // Generate reconciliation report
      const medRecReport = await MedicationReconciliationService.generateReconciliationReport(
        packet,
        decryptedName
      );

      // React 19: Check again after async operation
      if (!isMounted) return;

      setReport(medRecReport);

      // Auto-expand if discrepancies found
      if (medRecReport.discrepancies.length > 0) {
        setIsExpanded(true);
      }
    }

    analyzeAndGenerate();

    return () => {
      isMounted = false;
    };
  }, [packet]);

  if (!report) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-500">Analyzing medications...</p>
      </div>
    );
  }

  const alertLevel = MedicationReconciliationService.getAlertLevel(report.discrepancies);

  const alertColors = {
    none: 'bg-green-50 border-green-200 text-green-800',
    low: 'bg-blue-50 border-blue-200 text-blue-800',
    medium: 'bg-yellow-50 border-yellow-300 text-yellow-900',
    high: 'bg-orange-50 border-orange-300 text-orange-900',
    critical: 'bg-red-50 border-red-400 text-red-900'
  };

  const alertIcons = {
    none: '✅',
    low: 'ℹ️',
    medium: '⚠️',
    high: '⚠️',
    critical: '🚨'
  };

  const getSeverityBadge = (severity: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-red-100 text-red-800 border-red-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-blue-100 text-blue-800 border-blue-300'
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-sm border ${colors[severity]}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  return (
    <div className={`rounded-lg border-2 p-4 mb-4 ${alertColors[alertLevel]}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{alertIcons[alertLevel]}</span>
          <div>
            <h3 className="font-bold text-lg">
              Medication Reconciliation {alertLevel !== 'none' && `- ${alertLevel.toUpperCase()} ALERT`}
            </h3>
            <p className="text-sm mt-1">
              {report.discrepancies.length === 0 ? (
                'No discrepancies detected - Reconciliation complete'
              ) : (
                <span className="font-semibold">
                  {report.discrepancies.length} discrepanc{report.discrepancies.length === 1 ? 'y' : 'ies'} found
                  {' - '}Review required for patient safety
                </span>
              )}
            </p>
          </div>
        </div>
        <span className="text-xl">{isExpanded ? '▼' : '►'}</span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Summary */}
          <div className="bg-white bg-opacity-70 rounded-lg p-3 border border-current">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs opacity-75">Patient MRN</p>
                <p className="font-mono font-semibold">{report.patient_mrn || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs opacity-75">Total Unique Medications</p>
                <p className="font-semibold">{report.total_medications}</p>
              </div>
              <div>
                <p className="text-xs opacity-75">Transfer ID</p>
                <p className="font-mono text-xs">{report.transfer_id}</p>
              </div>
              <div>
                <p className="text-xs opacity-75">Status</p>
                <p className="font-semibold">
                  {report.reconciliation_status === 'complete' ? '✅ Complete' : '⚠️ Pending Review'}
                </p>
              </div>
            </div>
          </div>

          {/* Discrepancies List */}
          {report.discrepancies.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Discrepancies Requiring Review:</h4>
              {report.discrepancies.map((disc, index) => (
                <div
                  key={index}
                  className="bg-white bg-opacity-80 rounded-lg p-4 border-2 border-current"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getSeverityBadge(disc.severity)}
                        <span className="text-xs uppercase font-semibold opacity-75">
                          {disc.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="font-bold text-base">{disc.medication_name}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-[60px]">Issue:</span>
                      <p>{disc.details}</p>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-[60px]">Lists:</span>
                      <p>
                        <span className="font-mono text-xs bg-white px-2 py-1 rounded-sm">
                          {disc.source_list}
                        </span>
                        {' → '}
                        <span className="font-mono text-xs bg-white px-2 py-1 rounded-sm">
                          {disc.target_list}
                        </span>
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 mt-2">
                      <p className="text-xs font-semibold text-blue-900 mb-1">
                        📋 Recommended Action:
                      </p>
                      <p className="text-xs text-blue-800">{disc.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4 pt-4 border-t-2 border-current border-opacity-30">
            <button
              onClick={async () => {
                const form = await JointCommissionFormService.generateMedRecForm(
                  packet,
                  patientName,
                  patientDOB,
                  report
                );
                JointCommissionFormService.openFormForPrinting(form);
              }}
              className="flex-1 px-4 py-3 bg-purple-600 text-white border-2 border-purple-700 rounded-lg font-bold hover:bg-purple-700 transition text-sm shadow-lg"
            >
              📋 Generate Joint Commission Form (PDF)
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-white border-2 border-current rounded-lg font-semibold hover:opacity-80 transition text-sm"
            >
              🖨️ Print Alert
            </button>
            <button
              onClick={() => {
                const dataStr = JSON.stringify(report, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
                const exportFileDefaultName = `med-rec-${report.transfer_id}.json`;
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click();
              }}
              className="px-4 py-2 bg-white border-2 border-current rounded-lg font-semibold hover:opacity-80 transition text-sm"
            >
              💾 JSON
            </button>
          </div>

          {/* Joint Commission Note */}
          {report.discrepancies.length > 0 && (
            <div className="mt-4 p-3 bg-purple-50 border-2 border-purple-300 rounded-lg">
              <p className="text-xs text-purple-900">
                <span className="font-bold">Joint Commission Requirement:</span> All medication discrepancies must be
                reconciled and documented before patient admission or transfer. This alert satisfies medication
                reconciliation documentation requirements (NPSG.03.06.01).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MedicationReconciliationAlert;
