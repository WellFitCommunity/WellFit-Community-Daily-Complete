/**
 * DrugInteractionsTab — Drug interaction alerts + override button
 * Extracted from MedicationManager for decomposition
 * Wires into MedicationAlertOverrideModal for structured override logging
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Zap, CheckCircle } from 'lucide-react';
import type { DrugInteraction } from './MedicationManager.types';
import { getSeverityColor } from './MedicationManagerHelpers';
import { MedicationAlertOverrideModal } from '../MedicationAlertOverrideModal';
import type { AlertSeverity } from '../../../services/medicationOverrideService';

interface DrugInteractionsTabProps {
  interactions: DrugInteraction[];
  tenantId?: string;
}

/** Map DrugInteraction severity to override service AlertSeverity */
const mapSeverity = (severity: DrugInteraction['severity']): AlertSeverity => {
  switch (severity) {
    case 'CONTRAINDICATED': return 'contraindicated';
    case 'MAJOR': return 'high';
    case 'MODERATE': return 'moderate';
    default: return 'low';
  }
};

export const DrugInteractionsTab: React.FC<DrugInteractionsTabProps> = ({
  interactions,
  tenantId,
}) => {
  const [overrideTarget, setOverrideTarget] = useState<DrugInteraction | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Drug Interaction Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {interactions.length > 0 ? (
            <div className="space-y-3">
              {interactions.map(interaction => (
                <div
                  key={interaction.id}
                  className={`p-4 border rounded-lg ${getSeverityColor(interaction.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">
                        {interaction.drug1} + {interaction.drug2}
                      </div>
                      <div className="text-sm mt-1">{interaction.description}</div>
                      <div className="text-sm mt-2 font-medium">
                        Recommendation: {interaction.recommendation}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="destructive">{interaction.severity}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOverrideTarget(interaction)}
                        className="text-xs"
                      >
                        Override Alert
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs">
                    Patient: {interaction.patientName}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <div className="text-lg font-medium text-gray-900">No Drug Interactions Detected</div>
              <div className="text-gray-600">
                All patient medication profiles have been analyzed
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Override Modal */}
      {overrideTarget && (
        <MedicationAlertOverrideModal
          onClose={() => setOverrideTarget(null)}
          onOverrideComplete={() => setOverrideTarget(null)}
          alertType="drug_interaction"
          alertSeverity={mapSeverity(overrideTarget.severity)}
          alertDescription={overrideTarget.description}
          alertRecommendations={[overrideTarget.recommendation]}
          medicationName={`${overrideTarget.drug1} + ${overrideTarget.drug2}`}
          patientId={overrideTarget.patientId}
          tenantId={tenantId}
        />
      )}
    </div>
  );
};

export default DrugInteractionsTab;
