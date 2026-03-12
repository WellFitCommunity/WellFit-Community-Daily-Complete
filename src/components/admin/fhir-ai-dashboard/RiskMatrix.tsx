// Risk Matrix Visualization Component for FHIR AI Dashboard

import React from 'react';
import type { RiskMatrixData } from './FhirAiDashboard.types';

interface RiskMatrixProps {
  riskMatrix: RiskMatrixData | undefined;
}

const RiskMatrix: React.FC<RiskMatrixProps> = ({ riskMatrix }) => {
  if (!riskMatrix) return <div>Loading risk matrix...</div>;

  const { quadrants } = riskMatrix;
  const total = Object.values(quadrants).reduce((sum: number, count: number) => sum + count, 0);

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4 text-center">
        <h4 className="font-semibold text-red-800">High Risk, Low Adherence</h4>
        <div className="text-2xl font-bold text-red-600">{quadrants.highRiskLowAdherence}</div>
        <div className="text-xs text-red-600">
          {total > 0 ? Math.round((quadrants.highRiskLowAdherence / total) * 100) : 0}% of patients
        </div>
      </div>

      <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-4 text-center">
        <h4 className="font-semibold text-yellow-800">High Risk, High Adherence</h4>
        <div className="text-2xl font-bold text-yellow-600">{quadrants.highRiskHighAdherence}</div>
        <div className="text-xs text-yellow-600">
          {total > 0 ? Math.round((quadrants.highRiskHighAdherence / total) * 100) : 0}% of patients
        </div>
      </div>

      <div className="bg-orange-100 border-2 border-orange-300 rounded-lg p-4 text-center">
        <h4 className="font-semibold text-orange-800">Low Risk, Low Adherence</h4>
        <div className="text-2xl font-bold text-orange-600">{quadrants.lowRiskLowAdherence}</div>
        <div className="text-xs text-orange-600">
          {total > 0 ? Math.round((quadrants.lowRiskLowAdherence / total) * 100) : 0}% of patients
        </div>
      </div>

      <div className="bg-green-100 border-2 border-green-300 rounded-lg p-4 text-center">
        <h4 className="font-semibold text-green-800">Low Risk, High Adherence</h4>
        <div className="text-2xl font-bold text-green-600">{quadrants.lowRiskHighAdherence}</div>
        <div className="text-xs text-green-600">
          {total > 0 ? Math.round((quadrants.lowRiskHighAdherence / total) * 100) : 0}% of patients
        </div>
      </div>
    </div>
  );
};

export default RiskMatrix;
