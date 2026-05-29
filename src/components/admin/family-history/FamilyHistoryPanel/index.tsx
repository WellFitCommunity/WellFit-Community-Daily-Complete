/**
 * FamilyHistoryPanel — ONC 170.315(a)(12) orchestrator.
 *
 * Loads the patient's FamilyMemberHistory records + their conditions, joins
 * them, and renders the list view above a collapsible AddFamilyHistoryForm.
 * After a successful add, the list refreshes and the form collapses.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FamilyMemberHistoryService } from '../../../../services/fhir/FamilyMemberHistoryService';
import { FamilyMemberHistoryConditionService } from '../../../../services/fhir/FamilyMemberHistoryConditionService';
import type {
  FamilyMemberHistory,
  FamilyMemberHistoryCondition,
} from '../../../../types/fhir';
import AddFamilyHistoryForm from './AddFamilyHistoryForm';
import FamilyHistoryListView, { type FamilyHistoryRow } from './FamilyHistoryListView';
import type { FamilyHistoryPanelProps } from './types';

function joinMembersWithConditions(
  members: FamilyMemberHistory[],
  conditions: FamilyMemberHistoryCondition[]
): FamilyHistoryRow[] {
  const byMember = new Map<string, FamilyMemberHistoryCondition[]>();
  for (const c of conditions) {
    const list = byMember.get(c.family_member_history_id) ?? [];
    list.push(c);
    byMember.set(c.family_member_history_id, list);
  }
  return members.map((m) => ({
    member: m,
    conditions: m.id ? (byMember.get(m.id) ?? []) : [],
  }));
}

export const FamilyHistoryPanel: React.FC<FamilyHistoryPanelProps> = ({ patientId }) => {
  const [rows, setRows] = useState<FamilyHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [membersResult, conditionsResult] = await Promise.all([
      FamilyMemberHistoryService.getByPatient(patientId),
      FamilyMemberHistoryConditionService.getByPatient(patientId),
    ]);

    if (!membersResult.success) {
      setError(membersResult.error ?? 'Failed to load family history');
      setRows([]);
      setLoading(false);
      return;
    }
    // Conditions failing is non-fatal — still show members, just without conditions
    const members = membersResult.data ?? [];
    const conditions = conditionsResult.success ? (conditionsResult.data ?? []) : [];

    setRows(joinMembersWithConditions(members, conditions));
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSubmitted = useCallback(() => {
    setAdding(false);
    void refresh();
  }, [refresh]);

  return (
    <section aria-labelledby="family-history-heading" className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 id="family-history-heading" className="text-2xl font-semibold text-gray-900">
            Family Health History
          </h1>
          <p className="text-sm text-gray-600">
            ONC 170.315(a)(12) — FHIR FamilyMemberHistory records.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-[44px] px-5 text-base font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500"
          >
            Add family member
          </button>
        )}
      </header>

      {adding && (
        <div className="p-4 sm:p-6 rounded-lg border border-gray-200 bg-gray-50">
          <AddFamilyHistoryForm
            patientId={patientId}
            onSubmitted={handleSubmitted}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      <FamilyHistoryListView rows={rows} loading={loading} error={error} />
    </section>
  );
};

export default FamilyHistoryPanel;
