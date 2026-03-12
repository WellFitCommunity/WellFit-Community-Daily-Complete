/**
 * ComplianceTargetsCard - DR compliance target summary
 *
 * Purpose: Display RPO, RTO, and other compliance targets
 * Used by: DisasterRecoveryDashboard
 *
 * Copyright (c) 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import { TrendingUp } from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../../envision-atlus';

export const ComplianceTargetsCard: React.FC = () => {
  return (
    <EACard>
      <EACardHeader>
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Compliance Targets
        </h3>
      </EACardHeader>
      <EACardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold text-blue-600">15 min</div>
            <div className="text-sm text-gray-500">RPO Target</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold text-blue-600">4 hrs</div>
            <div className="text-sm text-gray-500">RTO Target</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold text-blue-600">95%</div>
            <div className="text-sm text-gray-500">Backup Success</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold text-blue-600">90%</div>
            <div className="text-sm text-gray-500">Drill Pass Rate</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold text-blue-600">Weekly</div>
            <div className="text-sm text-gray-500">Drill Frequency</div>
          </div>
        </div>
      </EACardContent>
    </EACard>
  );
};
