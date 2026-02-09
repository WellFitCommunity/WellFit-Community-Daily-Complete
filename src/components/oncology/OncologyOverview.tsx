/**
 * OncologyOverview - Patient oncology overview panel
 * Shows registry info, staging, treatment plan, latest labs, and active side effects
 */

import React from 'react';
import type { OncologyDashboardSummary } from '../../types/oncology';
import { ECOG_DESCRIPTIONS, CTCAE_GRADE_DESCRIPTIONS, RECIST_LABELS } from '../../types/oncology';
import type { ECOGStatus, CTCAEGrade } from '../../types/oncology';

interface OncologyOverviewProps {
  summary: OncologyDashboardSummary;
}

const OncologyOverview: React.FC<OncologyOverviewProps> = ({ summary }) => {
  const { registry, staging, treatment_plan, latest_labs, latest_imaging, active_side_effects } = summary;

  return (
    <div className="space-y-6">
      {/* Cancer Registry */}
      {registry && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cancer Registry</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Primary Site</p>
              <p className="text-base font-medium text-gray-900">{registry.primary_site}</p>
              <p className="text-xs text-gray-500">{registry.histology}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">ICD-10</p>
              <p className="text-base font-medium text-gray-900">{registry.icd10_code}</p>
              <p className="text-xs text-gray-500">
                Dx: {new Date(registry.diagnosis_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">ECOG Status</p>
              <p className="text-2xl font-bold text-gray-900">{registry.ecog_status}</p>
              <p className="text-xs text-gray-500">
                {ECOG_DESCRIPTIONS[registry.ecog_status as ECOGStatus]}
              </p>
            </div>
          </div>
          {Object.keys(registry.biomarkers).length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-1">Biomarkers</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(registry.biomarkers).map(([key, value]) => (
                  <span key={key} className="inline-block px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Staging */}
      {staging && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">TNM Staging</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">T</p>
              <p className="text-2xl font-bold text-gray-900">{staging.t_stage}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">N</p>
              <p className="text-2xl font-bold text-gray-900">{staging.n_stage}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">M</p>
              <p className="text-2xl font-bold text-gray-900">{staging.m_stage}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Stage</p>
              <p className="text-2xl font-bold text-gray-900">{staging.overall_stage}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Type</p>
              <p className="text-base font-medium text-gray-900">
                {staging.staging_type === 'clinical' ? 'Clinical' : 'Pathological'}
              </p>
              <p className="text-xs text-gray-500">AJCC {staging.ajcc_edition}th</p>
            </div>
          </div>
        </div>
      )}

      {/* Treatment Plan */}
      {treatment_plan && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Treatment Plan</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Regimen</p>
              <p className="text-base font-bold text-gray-900">{treatment_plan.regimen_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Intent</p>
              <p className="text-base font-medium text-gray-900 capitalize">{treatment_plan.intent}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Cycles</p>
              <p className="text-xl font-bold text-gray-900">{treatment_plan.cycle_count}</p>
              <p className="text-xs text-gray-500">q{treatment_plan.cycle_length_days}d</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className={`text-base font-bold ${
                treatment_plan.status === 'active' ? 'text-green-600' :
                treatment_plan.status === 'completed' ? 'text-blue-600' :
                treatment_plan.status === 'discontinued' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {treatment_plan.status.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-sm text-gray-500">Drugs</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {treatment_plan.drugs.map((drug) => (
                <span key={drug} className="inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                  {drug}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Latest Labs */}
      {latest_labs && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest Labs</h3>
          <p className="text-xs text-gray-500 mb-3">
            {new Date(latest_labs.lab_date).toLocaleDateString()}
          </p>
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
            {[
              { label: 'WBC', value: latest_labs.wbc, unit: 'K', warn: latest_labs.wbc !== null && latest_labs.wbc < 4 },
              { label: 'ANC', value: latest_labs.anc, unit: '', warn: latest_labs.anc !== null && latest_labs.anc < 1500 },
              { label: 'Hgb', value: latest_labs.hemoglobin, unit: 'g/dL', warn: latest_labs.hemoglobin !== null && latest_labs.hemoglobin < 10 },
              { label: 'PLT', value: latest_labs.platelets, unit: 'K', warn: latest_labs.platelets !== null && latest_labs.platelets < 100000 },
              { label: 'Cr', value: latest_labs.creatinine, unit: '', warn: latest_labs.creatinine !== null && latest_labs.creatinine > 1.5 },
              { label: 'ALT', value: latest_labs.alt, unit: 'U/L', warn: latest_labs.alt !== null && latest_labs.alt > 56 },
              { label: 'AST', value: latest_labs.ast, unit: 'U/L', warn: latest_labs.ast !== null && latest_labs.ast > 40 },
            ].map((item) => (
              <div key={item.label} className={`text-center p-2 rounded ${item.warn ? 'bg-red-50' : 'bg-gray-50'}`}>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={`text-sm font-bold ${item.warn ? 'text-red-600' : 'text-gray-900'}`}>
                  {item.value !== null ? item.value : 'N/A'}
                </p>
                {item.unit && <p className="text-xs text-gray-400">{item.unit}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Latest Imaging */}
      {latest_imaging && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest Imaging</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Modality</p>
              <p className="text-base font-medium text-gray-900">
                {latest_imaging.modality.toUpperCase().replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Region</p>
              <p className="text-base text-gray-900">{latest_imaging.body_region}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">RECIST</p>
              <p className="text-base font-bold text-gray-900">
                {latest_imaging.recist_response
                  ? RECIST_LABELS[latest_imaging.recist_response]
                  : 'Not evaluated'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">New Lesions</p>
              <p className={`text-base font-bold ${latest_imaging.new_lesions ? 'text-red-600' : 'text-green-600'}`}>
                {latest_imaging.new_lesions ? 'YES' : 'No'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Side Effects */}
      {active_side_effects.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Active Side Effects ({active_side_effects.length})
          </h3>
          <div className="space-y-2">
            {active_side_effects.map((se) => (
              <div key={se.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{se.ctcae_term}</p>
                  <p className="text-xs text-gray-500">
                    {se.ctcae_category.replace(/_/g, ' ')} | {se.outcome}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                    se.ctcae_grade >= 4 ? 'bg-red-100 text-red-800' :
                    se.ctcae_grade === 3 ? 'bg-orange-100 text-orange-800' :
                    se.ctcae_grade === 2 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    Grade {se.ctcae_grade}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {CTCAE_GRADE_DESCRIPTIONS[se.ctcae_grade as CTCAEGrade]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!registry && !staging && !treatment_plan && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No oncology data available</p>
          <p className="text-sm mt-2">Register the patient in the cancer registry to begin tracking</p>
        </div>
      )}
    </div>
  );
};

export default OncologyOverview;
