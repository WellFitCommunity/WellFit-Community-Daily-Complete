/**
 * BedBoardMetricCards — Summary KPI cards for bed management.
 */

import React from 'react';
import {
  Bed as BedIcon,
  Activity,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { EACard, EACardContent } from '../../envision-atlus';
import { getOccupancyColor } from '../../../types/bed';
import type { BedBoardMetricCardsProps } from './BedBoard.types';

export const BedBoardMetricCards: React.FC<BedBoardMetricCardsProps> = ({
  totalBeds,
  availableBeds,
  pendingClean,
  overallOccupancy,
}) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <EACard>
      <EACardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Total Beds</p>
            <p className="text-2xl font-bold text-white">{totalBeds}</p>
          </div>
          <BedIcon className="w-8 h-8 text-teal-400 opacity-50" />
        </div>
      </EACardContent>
    </EACard>

    <EACard>
      <EACardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Occupancy</p>
            <p className={`text-2xl font-bold ${getOccupancyColor(overallOccupancy)}`}>
              {overallOccupancy}%
            </p>
          </div>
          <Activity className="w-8 h-8 text-blue-400 opacity-50" />
        </div>
        <div className="mt-2 w-full bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${overallOccupancy >= 90 ? 'bg-red-500' : 'bg-teal-500'}`}
            style={{ width: `${Math.min(overallOccupancy, 100)}%` }}
          />
        </div>
      </EACardContent>
    </EACard>

    <EACard>
      <EACardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Available</p>
            <p className="text-2xl font-bold text-green-400">{availableBeds}</p>
          </div>
          <CheckCircle className="w-8 h-8 text-green-400 opacity-50" />
        </div>
      </EACardContent>
    </EACard>

    <EACard>
      <EACardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Pending Clean</p>
            <p className="text-2xl font-bold text-yellow-400">{pendingClean}</p>
          </div>
          <Clock className="w-8 h-8 text-yellow-400 opacity-50" />
        </div>
      </EACardContent>
    </EACard>
  </div>
);

export default BedBoardMetricCards;
