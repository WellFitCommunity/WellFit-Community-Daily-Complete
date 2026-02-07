/**
 * BedBoardRealTimeTab — Bed board grid grouped by unit + unit capacity table + filters.
 */

import React from 'react';
import {
  Bed as BedIcon,
  Building2,
  Search,
  TrendingUp,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { EACard, EACardHeader, EACardContent } from '../../envision-atlus';
import { getBedStatusColor, getBedStatusLabel, getUnitTypeLabel, getAcuityColor, getOccupancyColor } from '../../../types/bed';
import type { BedStatus } from '../../../types/bed';
import { UNIT_TYPE_CATEGORIES } from './BedBoard.types';
import type { BedBoardRealTimeTabProps } from './BedBoard.types';

export const BedBoardRealTimeTab: React.FC<BedBoardRealTimeTabProps> = ({
  bedBoard,
  bedsByUnit,
  unitCapacity,
  units,
  selectedUnit,
  selectedStatus,
  searchQuery,
  selectedUnitTypeCategory,
  expandedUnit,
  onSetUnit,
  onSetStatus,
  onSetSearch,
  onSetUnitTypeCategory,
  onSetExpandedUnit,
  onSelectBed,
  onUpdateStatus,
  onGenerateForecast,
  onSetEditing,
}) => (
  <div className="space-y-4">
    {/* Unit Type Quick Filter */}
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Quick Filter by Unit Type</p>
      <div className="flex flex-wrap gap-2">
        {UNIT_TYPE_CATEGORIES.map((category) => {
          const bedCount = category.id === 'all'
            ? bedBoard.length
            : bedBoard.filter((b) => category.types.includes(b.unit_type)).length;

          return (
            <button
              key={category.id}
              onClick={() => onSetUnitTypeCategory(category.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                selectedUnitTypeCategory === category.id
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {category.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                selectedUnitTypeCategory === category.id
                  ? 'bg-teal-700 text-teal-100'
                  : 'bg-slate-700 text-slate-400'
              }`}>
                {bedCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>

    {/* Filters */}
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search beds, rooms, patients..."
          value={searchQuery}
          onChange={(e) => onSetSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>

      <select
        value={selectedUnit}
        onChange={(e) => onSetUnit(e.target.value)}
        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
      >
        <option value="">All Units</option>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>{unit.unit_name}</option>
        ))}
      </select>

      <select
        value={selectedStatus}
        onChange={(e) => onSetStatus(e.target.value as BedStatus | '')}
        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
      >
        <option value="">All Statuses</option>
        <option value="available">Available</option>
        <option value="occupied">Occupied</option>
        <option value="dirty">Needs Cleaning</option>
        <option value="cleaning">Being Cleaned</option>
        <option value="blocked">Blocked</option>
        <option value="maintenance">Maintenance</option>
        <option value="reserved">Reserved</option>
      </select>
    </div>

    {/* Bed Board Grid */}
    {Object.values(bedsByUnit).length === 0 ? (
      <EACard>
        <EACardContent className="p-8 text-center">
          <BedIcon className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">No beds found</p>
          <p className="text-sm text-slate-500 mt-1">
            Try adjusting your filters or add beds to units
          </p>
        </EACardContent>
      </EACard>
    ) : (
      Object.values(bedsByUnit).map((unitGroup) => (
        <EACard key={unitGroup.unitId}>
          <EACardHeader
            icon={<Building2 className="w-5 h-5" />}
            className="cursor-pointer"
            onClick={() => onSetExpandedUnit(expandedUnit === unitGroup.unitId ? null : unitGroup.unitId)}
          >
            <div className="flex items-center justify-between w-full">
              <div>
                <span className="font-semibold">{unitGroup.unitName}</span>
                <span className="text-sm text-slate-400 ml-2">({unitGroup.unitCode})</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-400">
                  {unitGroup.beds.filter((b) => b.status === 'occupied').length}/{unitGroup.beds.length} occupied
                </span>
                {expandedUnit === unitGroup.unitId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </EACardHeader>

          {(expandedUnit === unitGroup.unitId || !expandedUnit) && (
            <EACardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {unitGroup.beds.map((bed) => (
                  <div
                    key={bed.bed_id}
                    id={`bed-${bed.bed_id}`}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:ring-2 hover:ring-teal-500 ${getBedStatusColor(bed.status)}`}
                    onClick={() => {
                      onSelectBed(bed);
                      onSetEditing(true, `bed-${bed.bed_label}`);
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">{bed.bed_label}</span>
                      {bed.has_telemetry && <Activity className="w-3 h-3 text-blue-500" />}
                    </div>
                    <div className="text-xs">
                      {bed.status === 'occupied' && bed.patient_name ? (
                        <>
                          <p className="truncate font-medium">{bed.patient_name}</p>
                          {bed.patient_acuity && (
                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs mt-1 ${getAcuityColor(bed.patient_acuity)}`}>
                              {bed.patient_acuity}
                            </span>
                          )}
                        </>
                      ) : (
                        <p className="capitalize">{getBedStatusLabel(bed.status)}</p>
                      )}
                    </div>
                    {bed.status === 'dirty' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdateStatus(bed.bed_id, 'cleaning'); }}
                        className="mt-2 w-full text-xs bg-orange-500 text-white py-1 rounded-sm hover:bg-orange-600 transition-colors"
                      >
                        Start Cleaning
                      </button>
                    )}
                    {bed.status === 'cleaning' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdateStatus(bed.bed_id, 'available'); }}
                        className="mt-2 w-full text-xs bg-green-500 text-white py-1 rounded-sm hover:bg-green-600 transition-colors"
                      >
                        Mark Ready
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </EACardContent>
          )}
        </EACard>
      ))
    )}

    {/* Unit Capacity Table */}
    {unitCapacity.length > 0 && (
      <div className="space-y-4 mt-6">
        <EACard>
          <EACardHeader icon={<Building2 className="w-5 h-5" />}>
            Unit Capacity Overview
          </EACardHeader>
          <EACardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-4 text-slate-400 font-medium">Unit</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Type</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Total</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Occupied</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Available</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Pending</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Occupancy</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {unitCapacity.map((unit) => (
                  <tr key={unit.unit_id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-white">{unit.unit_name}</p>
                        <p className="text-sm text-slate-400">{unit.unit_code}</p>
                      </div>
                    </td>
                    <td className="p-4 text-center text-slate-300">{getUnitTypeLabel(unit.unit_type)}</td>
                    <td className="p-4 text-center text-white font-medium">{unit.total_beds}</td>
                    <td className="p-4 text-center text-blue-400">{unit.occupied}</td>
                    <td className="p-4 text-center text-green-400">{unit.available}</td>
                    <td className="p-4 text-center text-yellow-400">{unit.pending_clean}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${(unit.occupancy_pct ?? 0) >= 90 ? 'bg-red-500' : 'bg-teal-500'}`}
                            style={{ width: `${Math.min(unit.occupancy_pct ?? 0, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm ${getOccupancyColor(unit.occupancy_pct ?? 0)}`}>
                          {(unit.occupancy_pct ?? 0).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => onGenerateForecast(unit.unit_id)}
                        className="text-teal-400 hover:text-teal-300 text-sm"
                      >
                        <TrendingUp className="w-4 h-4 inline mr-1" />
                        Forecast
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </EACardContent>
        </EACard>
      </div>
    )}
  </div>
);

export default BedBoardRealTimeTab;
