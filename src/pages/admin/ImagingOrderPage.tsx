/**
 * ImagingOrderPage — route wrapper for the Imaging CPOE form.
 *
 * Route: /admin/cpoe/imaging/:patientId
 *   Optional query: ?encounter=<encounterId>
 */

import React, { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ImagingOrderForm } from '../../components/admin/cpoe/ImagingOrderForm';

export const ImagingOrderPage: React.FC = () => {
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
        <h1 className="text-2xl font-semibold">Imaging Order</h1>
        <p className="mt-4 text-red-700">
          No patient was selected. Open a patient chart and choose &quot;New
          imaging order&quot; to start.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <ImagingOrderForm
        patientId={patientId}
        encounterId={encounterId}
        onSubmitted={handleSubmitted}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default ImagingOrderPage;
