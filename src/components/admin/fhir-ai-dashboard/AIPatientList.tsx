// Patient List with AI Insights Component for FHIR AI Dashboard

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import type { AIPatientData } from './FhirAiDashboard.types';

interface AIPatientListProps {
  patients: AIPatientData[];
  onPatientSelect: (patientId: string) => void;
}

const AIPatientList: React.FC<AIPatientListProps> = ({ patients, onPatientSelect }) => {
  if (!patients || patients.length === 0) {
    return <div>Loading patient data...</div>;
  }

  return (
    <Card aria-label="AI Patient List">
      <CardHeader>
        <CardTitle>High-Priority Patients</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {patients.slice(0, 10).map((patient, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
              onClick={() => onPatientSelect(patient.patientId)}
            >
              <div className="flex-1">
                <div className="font-medium">{patient.patientName}</div>
                <div className="text-sm text-gray-600">
                  Health Score: {patient.overallHealthScore}/100 |
                  Adherence: {patient.adherenceScore}%
                </div>
                {patient.emergencyAlerts && patient.emergencyAlerts.length > 0 && (
                  <div className="text-xs text-red-600 mt-1">
                    {patient.emergencyAlerts.length} active alert(s)
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end space-y-1">
                <Badge
                  variant={
                    patient.riskAssessment?.riskLevel === 'CRITICAL' ? 'destructive' :
                    patient.riskAssessment?.riskLevel === 'HIGH' ? 'destructive' :
                    patient.riskAssessment?.riskLevel === 'MODERATE' ? 'secondary' : 'default'
                  }
                >
                  {patient.riskAssessment?.riskLevel || 'Unknown'}
                </Badge>
                <div className="text-xs text-gray-500">
                  Priority: {patient.riskAssessment?.priority || 'N/A'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AIPatientList;
