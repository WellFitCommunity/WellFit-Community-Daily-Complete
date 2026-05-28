/**
 * MedicationOrderPage — route wrapper for the Medication CPOE form.
 *
 * Route: /admin/cpoe/medication/:patientId
 *   Optional query: ?encounter=<encounterId>
 *
 * The route renders the MedicationOrderForm against the patient identified
 * by the URL parameter. On submit it navigates back to the admin dashboard;
 * on cancel it navigates back one step in history.
 */

import React, { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MedicationOrderForm } from '../../components/admin/cpoe/MedicationOrderForm';

export const MedicationOrderPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const encounterId = searchParams.get('encounter') ?? undefined;

  const handleSubmitted = useCallback(() => {
    navigate('/admin');
  }, [navigate]);

  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (!patientId) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">Medication Order</h1>
        <p className="mt-4 text-red-700">
          No patient was selected. Open a patient chart and choose &quot;Order
          medication&quot; to start a new order.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <MedicationOrderForm
        patientId={patientId}
        encounterId={encounterId}
        onSubmitted={handleSubmitted}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default MedicationOrderPage;
