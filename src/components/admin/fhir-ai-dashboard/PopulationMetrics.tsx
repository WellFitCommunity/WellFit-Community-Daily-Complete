// Population Health Metrics Component for FHIR AI Dashboard

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import type { PopulationOverview } from './FhirAiDashboard.types';

interface PopulationMetricsProps {
  overview: PopulationOverview | undefined;
}

const PopulationMetrics: React.FC<PopulationMetricsProps> = ({ overview }) => {
  if (!overview) return <div>Loading population metrics...</div>;

  const engagementRate = overview.totalPatients > 0 ?
    Math.round((overview.activePatients / overview.totalPatients) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-label="Population Health Metrics">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Total Patients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.totalPatients}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Active Patients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{overview.activePatients}</div>
          <div className="text-xs text-gray-500">{engagementRate}% engagement</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">High Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{overview.highRiskPatients}</div>
          <div className="text-xs text-gray-500">
            {overview.totalPatients > 0 ? Math.round((overview.highRiskPatients / overview.totalPatients) * 100) : 0}% of total
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Health Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{overview.averageHealthScore}/100</div>
          <div className="text-xs text-gray-500">Population average</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PopulationMetrics;
