/**
 * VitalCapturePage
 * Page wrapper for the VitalCapture component
 * Route: /vital-capture
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VitalCapture } from '../components/vitals';
import { VitalType, VitalReading } from '../components/vitals/types';

const VitalCapturePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get vital type from query param (default to blood_pressure)
  const typeParam = searchParams.get('type') as VitalType | null;
  const vitalType: VitalType = typeParam && ['blood_pressure', 'glucose', 'weight', 'heart_rate', 'temperature', 'pulse_oximeter'].includes(typeParam)
    ? typeParam
    : 'blood_pressure';

  // Get facility from query param (optional)
  const facilityId = searchParams.get('facility') || undefined;

  // Handle completion
  const handleComplete = (reading: VitalReading) => {
    // Navigate back to check-in page after saving
    navigate('/check-in', { state: { vitalSaved: true, reading } });
  };

  // Handle cancel
  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <VitalCapture
      vitalType={vitalType}
      facilityId={facilityId}
      onComplete={handleComplete}
      onCancel={handleCancel}
      showBackButton={true}
    />
  );
};

export default VitalCapturePage;
