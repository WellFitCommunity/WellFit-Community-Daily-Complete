// Predictive Alerts Component for FHIR AI Dashboard

import React from 'react';
import { Alert, AlertDescription } from '../../ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import type { PredictiveAlert } from './FhirAiDashboard.types';

interface PredictiveAlertsProps {
  alerts: PredictiveAlert[] | undefined;
}

const PredictiveAlerts: React.FC<PredictiveAlertsProps> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Predictive Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-4">
            No predictive alerts at this time
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card aria-label="Predictive Alerts">
      <CardHeader>
        <CardTitle>Predictive Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.map((alert, index) => (
          <Alert key={index} variant={alert.severity === 'CRITICAL' ? 'destructive' : 'default'}>
            <AlertDescription>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{alert.message}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Probability: {alert.probabilityScore}% | Timeframe: {alert.timeframe}
                  </div>
                  {alert.recommendedActions && alert.recommendedActions.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium">Recommended Actions:</div>
                      <ul className="text-xs list-disc list-inside">
                        {alert.recommendedActions.slice(0, 2).map((action: string, i: number) => (
                          <li key={i}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : 'secondary'}>
                  {alert.severity}
                </Badge>
              </div>
            </AlertDescription>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
};

export default PredictiveAlerts;
