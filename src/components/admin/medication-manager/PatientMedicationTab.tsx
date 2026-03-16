/**
 * PatientMedicationTab — Patient list + medication detail panels
 * Extracted from MedicationManager for decomposition
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Users, Pill, AlertTriangle, AlertCircle, Search } from 'lucide-react';
import type { PatientMedication } from './MedicationManager.types';
import { getRiskBadgeColor } from './MedicationManagerHelpers';

interface PatientMedicationTabProps {
  filteredPatients: PatientMedication[];
  selectedPatient: PatientMedication | null;
  searchTerm: string;
  filterRisk: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onPatientSelect: (patient: PatientMedication) => void;
}

export const PatientMedicationTab: React.FC<PatientMedicationTabProps> = ({
  filteredPatients,
  selectedPatient,
  searchTerm,
  filterRisk,
  onSearchChange,
  onFilterChange,
  onPatientSelect,
}) => {
  return (
    <div className="space-y-4" aria-label="Patient Medications">
      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patients..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)]"
          />
        </div>
        <select
          value={filterRisk}
          onChange={(e) => onFilterChange(e.target.value)}
          className="px-4 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)]"
        >
          <option value="all">All Risk Levels</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MODERATE">Moderate</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {/* Patient List + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Patients ({filteredPatients.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {filteredPatients.map(patient => (
                <div
                  key={patient.patientId}
                  onClick={() => onPatientSelect(patient)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedPatient?.patientId === patient.patientId
                      ? 'border-[var(--ea-primary)] bg-[var(--ea-primary)]/10'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{patient.patientName}</div>
                      <div className="text-sm text-gray-600">
                        {patient.medicationCount} medications
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getRiskBadgeColor(patient.riskLevel)}>
                        {patient.riskLevel}
                      </Badge>
                      {patient.needsReconciliation && (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredPatients.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No patients match your search criteria
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5" />
              {selectedPatient ? `${selectedPatient.patientName}'s Medications` : 'Select a Patient'}
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {selectedPatient ? (
              <div className="space-y-3">
                {selectedPatient.medications.map(med => (
                  <div key={med.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {med.name}
                          {med.isHighRisk && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="text-sm text-gray-600">{med.dosage}</div>
                        <div className="text-sm text-gray-500">{med.frequency}</div>
                      </div>
                      <Badge variant={med.status === 'active' ? 'default' : 'secondary'}>
                        {med.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span>Prescribed: {new Date(med.prescribedDate).toLocaleDateString()}</span>
                      <span>Refills: {med.refillsRemaining}</span>
                    </div>
                  </div>
                ))}
                {selectedPatient.medications.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No medications on record
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Select a patient to view their medications
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PatientMedicationTab;
