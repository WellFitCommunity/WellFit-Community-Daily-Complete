/**
 * FamilyHistoryPage — route wrapper for the Family Health History panel.
 *
 * Route: /admin/family-history/:patientId
 *
 * ONC 170.315(a)(12) — patient-scoped list of family members with structured
 * conditions and age at onset.
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import { FamilyHistoryPanel } from '../../components/admin/family-history/FamilyHistoryPanel';

export const FamilyHistoryPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();

  if (!patientId) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">Family Health History</h1>
        <p className="mt-4 text-red-700">
          No patient was selected. Open a patient chart and choose &quot;Family
          health history&quot; to view their records.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <FamilyHistoryPanel patientId={patientId} />
    </div>
  );
};

export default FamilyHistoryPage;
