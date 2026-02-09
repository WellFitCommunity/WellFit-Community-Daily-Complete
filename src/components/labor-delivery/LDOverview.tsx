/**
 * LDOverview - Pregnancy overview panel
 * Shows pregnancy info, gestational age, risk level, recent vitals
 */

import React from 'react';
import type { LDDashboardSummary } from '../../types/laborDelivery';
import { calculateGestationalAge } from '../../types/laborDelivery';

interface LDOverviewProps {
  summary: LDDashboardSummary;
}

const RISK_COLORS: Record<string, string> = {
  low: 'text-green-600 bg-green-50',
  moderate: 'text-yellow-600 bg-yellow-50',
  high: 'text-orange-600 bg-orange-50',
  critical: 'text-red-600 bg-red-50',
};

const LDOverview: React.FC<LDOverviewProps> = ({ summary }) => {
  const { pregnancy, recent_prenatal_visits, delivery_record, newborn_assessment } = summary;

  if (!pregnancy) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No pregnancy data available</p>
        <p className="text-sm mt-2">Register a pregnancy to begin tracking</p>
      </div>
    );
  }

  const ga = calculateGestationalAge(pregnancy.edd);
  const latestVisit = recent_prenatal_visits[0];

  return (
    <div className="space-y-6">
      {/* Pregnancy Info */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pregnancy Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Gestational Age</p>
            <p className="text-2xl font-bold text-gray-900">{ga.weeks}w {ga.days}d</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">EDD</p>
            <p className="text-base font-medium text-gray-900">
              {new Date(pregnancy.edd).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">G/P</p>
            <p className="text-xl font-bold text-gray-900">
              G{pregnancy.gravida}P{pregnancy.para}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Risk Level</p>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${RISK_COLORS[pregnancy.risk_level]}`}>
              {pregnancy.risk_level.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <p className="text-sm text-gray-500">Blood Type</p>
            <p className="text-base font-medium">{pregnancy.blood_type}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Rh Factor</p>
            <p className="text-base font-medium">{pregnancy.rh_factor}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">GBS Status</p>
            <p className={`text-base font-medium ${
              pregnancy.gbs_status === 'positive' ? 'text-red-600' : 'text-gray-900'
            }`}>
              {pregnancy.gbs_status}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="text-base font-medium">{pregnancy.status}</p>
          </div>
        </div>
        {pregnancy.risk_factors.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-1">Risk Factors</p>
            <div className="flex flex-wrap gap-1">
              {pregnancy.risk_factors.map((rf) => (
                <span key={rf} className="inline-block px-2 py-1 bg-red-50 text-red-700 rounded text-xs">
                  {rf}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Latest Prenatal Visit */}
      {latestVisit && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest Prenatal Visit</h3>
          <p className="text-xs text-gray-500 mb-3">
            {new Date(latestVisit.visit_date).toLocaleDateString()} | {latestVisit.gestational_age_weeks}w{latestVisit.gestational_age_days}d
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Blood Pressure</p>
              <p className="text-xl font-bold">{latestVisit.bp_systolic}/{latestVisit.bp_diastolic}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Weight</p>
              <p className="text-base font-medium">{latestVisit.weight_kg} kg</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fetal HR</p>
              <p className="text-base font-medium">
                {latestVisit.fetal_heart_rate ? `${latestVisit.fetal_heart_rate} bpm` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fundal Height</p>
              <p className="text-base font-medium">
                {latestVisit.fundal_height_cm ? `${latestVisit.fundal_height_cm} cm` : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Record */}
      {delivery_record && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Method</p>
              <p className="text-base font-medium">{delivery_record.method.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">EBL</p>
              <p className={`text-base font-bold ${delivery_record.estimated_blood_loss_ml > 500 ? 'text-red-600' : 'text-gray-900'}`}>
                {delivery_record.estimated_blood_loss_ml} mL
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Anesthesia</p>
              <p className="text-base font-medium">{delivery_record.anesthesia}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="text-base font-medium">
                {new Date(delivery_record.delivery_datetime).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Newborn Summary */}
      {newborn_assessment && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Newborn</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">APGAR</p>
              <p className="text-xl font-bold">
                {newborn_assessment.apgar_1_min}/{newborn_assessment.apgar_5_min}
                {newborn_assessment.apgar_10_min !== null ? `/${newborn_assessment.apgar_10_min}` : ''}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Weight</p>
              <p className="text-base font-medium">{newborn_assessment.weight_g}g</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sex</p>
              <p className="text-base font-medium capitalize">{newborn_assessment.sex}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Disposition</p>
              <p className="text-base font-medium">{newborn_assessment.disposition.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LDOverview;
