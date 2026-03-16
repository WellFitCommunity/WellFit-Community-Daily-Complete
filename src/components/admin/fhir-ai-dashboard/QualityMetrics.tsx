// Quality Metrics Component for FHIR AI Dashboard

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import type { QualityMetricsData } from './FhirAiDashboard.types';

interface QualityMetricsProps {
  qualityMetrics: QualityMetricsData | null;
}

const QualityMetrics: React.FC<QualityMetricsProps> = ({ qualityMetrics }) => {
  if (!qualityMetrics) return <div>Loading quality metrics...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-label="Quality Metrics">
      <Card>
        <CardHeader>
          <CardTitle>FHIR Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2">
            {Math.round(qualityMetrics.fhirCompliance?.score || 0)}%
          </div>
          <div className="text-sm text-gray-600">
            {qualityMetrics.fhirCompliance?.issues?.length || 0} issues found
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Completeness:</span>
              <span className="font-medium">{Math.round(qualityMetrics.dataQuality?.completeness || 0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Accuracy:</span>
              <span className="font-medium">{Math.round(qualityMetrics.dataQuality?.accuracy || 0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Consistency:</span>
              <span className="font-medium">{Math.round(qualityMetrics.dataQuality?.consistency || 0)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clinical Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2">
            {Math.round(qualityMetrics.clinicalQuality?.adherenceToGuidelines || 0)}%
          </div>
          <div className="text-sm text-gray-600">Guideline adherence</div>
          <div className="text-xs text-gray-500 mt-2">
            Readmission rate: {qualityMetrics.clinicalQuality?.outcomeMetrics?.readmissionRate || 0}%
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QualityMetrics;
