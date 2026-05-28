/**
 * LabOrderPage — route wrapper for the Lab CPOE form.
 *
 * Route: /admin/cpoe/lab/:patientId
 *   Optional query: ?encounter=<encounterId>
 */

import React, { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LabOrderForm } from '../../components/admin/cpoe/LabOrderForm';

export const LabOrderPage: React.FC = () => {
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
        <h1 className="text-2xl font-semibold">Lab Order</h1>
        <p className="mt-4 text-red-700">
          No patient was selected. Open a patient chart and choose &quot;Order
          lab&quot; to start a new lab order.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <LabOrderForm
        patientId={patientId}
        encounterId={encounterId}
        onSubmitted={handleSubmitted}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default LabOrderPage;
