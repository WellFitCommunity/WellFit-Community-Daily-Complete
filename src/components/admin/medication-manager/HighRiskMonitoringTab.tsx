/**
 * HighRiskMonitoringTab — High-risk medication categories + patient list
 * Extracted from MedicationManager for decomposition
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { AlertTriangle, Droplets, Brain, Heart } from 'lucide-react';
import type { PatientMedication } from './MedicationManager.types';
import { getRiskBadgeColor } from './MedicationManagerHelpers';

interface HighRiskMonitoringTabProps {
  patientMedications: PatientMedication[];
  onPatientSelect: (patient: PatientMedication) => void;
}

export const HighRiskMonitoringTab: React.FC<HighRiskMonitoringTabProps> = ({
  patientMedications,
  onPatientSelect,
}) => {
  const anticoagulantCount = patientMedications.filter(p =>
    p.medications.some(m =>
      m.name.toLowerCase().includes('warfarin') ||
      m.name.toLowerCase().includes('heparin') ||
      m.name.toLowerCase().includes('xarelto') ||
      m.name.toLowerCase().includes('eliquis')
    )
  ).length;

  const opioidCount = patientMedications.filter(p =>
    p.medications.some(m =>
      m.name.toLowerCase().includes('oxycodone') ||
      m.name.toLowerCase().includes('hydrocodone') ||
      m.name.toLowerCase().includes('morphine') ||
      m.name.toLowerCase().includes('fentanyl')
    )
  ).length;

  const insulinCount = patientMedications.filter(p =>
    p.medications.some(m =>
      m.name.toLowerCase().includes('insulin') ||
      m.name.toLowerCase().includes('lantus') ||
      m.name.toLowerCase().includes('novolog')
    )
  ).length;

  const highRiskPatients = patientMedications.filter(
    p => p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL'
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Droplets className="h-4 w-4 text-red-500" />
              Anticoagulants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{anticoagulantCount}</div>
            <div className="text-sm text-gray-600">patients on blood thinners</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              Opioids
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{opioidCount}</div>
            <div className="text-sm text-gray-600">patients on opioid therapy</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="h-4 w-4 text-blue-500" />
              Insulin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insulinCount}</div>
            <div className="text-sm text-gray-600">patients on insulin</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            High-Risk Medication Patients
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {highRiskPatients.map(patient => (
              <div
                key={patient.patientId}
                className="p-3 border rounded-lg flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{patient.patientName}</div>
                  <div className="text-sm text-gray-600">
                    {patient.medications.filter(m => m.isHighRisk).length} high-risk medications
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getRiskBadgeColor(patient.riskLevel)}>
                    {patient.riskLevel}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => onPatientSelect(patient)}>
                    View Details
                  </Button>
                </div>
              </div>
            ))}
            {highRiskPatients.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No high-risk patients identified
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HighRiskMonitoringTab;
