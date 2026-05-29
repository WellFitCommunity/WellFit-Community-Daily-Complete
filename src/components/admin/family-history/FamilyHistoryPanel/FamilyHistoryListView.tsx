/**
 * FamilyHistoryListView — renders the patient's family members joined with
 * their conditions (condition, age at onset, outcome).
 *
 * Read-only display. The Add flow lives in AddFamilyHistoryForm.
 */

import React from 'react';
import type {
  FamilyMemberHistory,
  FamilyMemberHistoryCondition,
} from '../../../../types/fhir';

export interface FamilyHistoryRow {
  member: FamilyMemberHistory;
  conditions: FamilyMemberHistoryCondition[];
}

export interface FamilyHistoryListViewProps {
  rows: FamilyHistoryRow[];
  loading: boolean;
  error: string | null;
}

export const FamilyHistoryListView: React.FC<FamilyHistoryListViewProps> = ({
  rows,
  loading,
  error,
}) => {
  if (loading) {
    return (
      <p role="status" className="text-gray-600">
        Loading family history…
      </p>
    );
  }

  if (error) {
    return (
      <div role="alert" className="p-4 rounded-lg border bg-yellow-50 border-yellow-300 text-yellow-900">
        <p className="font-medium">Could not load family history</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-6 rounded-lg border border-dashed border-gray-300 text-center text-gray-600">
        <p>No family health history on file for this patient.</p>
        <p className="text-sm mt-1">Use the “Add family member” button above to record one.</p>
      </div>
    );
  }

  return (
    <ul aria-label="Family health history" className="space-y-3">
      {rows.map(({ member, conditions }) => (
        <li key={member.id} className="p-4 rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {member.relationship_display}
                {member.name ? ` — ${member.name}` : ''}
              </h3>
              <p className="text-sm text-gray-600">
                {member.sex_display || member.sex_code || 'Sex unknown'}
                {member.deceased_boolean
                  ? ` · Deceased${member.deceased_age_string ? ` (age ${member.deceased_age_string})` : ''}`
                  : ' · Living'}
              </p>
            </div>
            <span
              className={`text-xs uppercase px-2 py-1 rounded-full ${
                member.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {member.status}
            </span>
          </div>

          {conditions.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {conditions.map((c) => (
                <li key={c.id} className="text-sm border-l-2 border-cyan-300 pl-3">
                  <span className="font-medium text-gray-900">{c.condition_display}</span>
                  {c.onset_age_string && (
                    <span className="text-gray-600"> · onset age {c.onset_age_string}</span>
                  )}
                  {c.outcome_display && (
                    <span className="text-gray-600"> · {c.outcome_display}</span>
                  )}
                  {c.contributed_to_death && (
                    <span className="text-red-700"> · contributed to death</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No conditions recorded.</p>
          )}

          {member.note && (
            <p className="mt-2 text-xs text-gray-500">{member.note}</p>
          )}
        </li>
      ))}
    </ul>
  );
};

export default FamilyHistoryListView;
