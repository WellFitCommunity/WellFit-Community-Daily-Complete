/**
 * ImplantableDevicesPage — route wrapper for the Implanted Devices panel.
 *
 * Route: /admin/devices/:patientId
 *
 * ONC 170.315(a)(14) — patient-scoped list of implantable devices with
 * UDI, manufacturer, model, serial, lot, and clinical implant context.
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import { ImplantableDevicesPanel } from '../../components/admin/devices/ImplantableDevicesPanel';

export const ImplantableDevicesPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();

  if (!patientId) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">Implanted Devices</h1>
        <p className="mt-4 text-red-700">
          No patient was selected. Open a patient chart and choose &quot;Implanted
          devices&quot; to view their devices.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <ImplantableDevicesPanel patientId={patientId} />
    </div>
  );
};

export default ImplantableDevicesPage;
