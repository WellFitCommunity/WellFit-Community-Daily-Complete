/**
 * PatientAvatarProfileSection - Compact avatar section for patient profiles
 *
 * Purpose: Embeddable avatar card for any patient view
 * Used by: Patient detail pages, care coordination views
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { EACard, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { PatientAvatar } from './PatientAvatar';

interface PatientAvatarProfileSectionProps {
  patientId: string;
  patientName?: string;
  className?: string;
}

export const PatientAvatarProfileSection: React.FC<PatientAvatarProfileSectionProps> = ({
  patientId,
  patientName,
  className,
}) => {
  const navigate = useNavigate();

  const handleViewFull = () => {
    navigate(`/patient-avatar/${patientId}`);
  };

  return (
    <EACard className={cn('overflow-hidden', className)}>
      <EACardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">Body Map</h3>
          <EAButton variant="secondary" size="sm" onClick={handleViewFull}>
            View Full
          </EAButton>
        </div>
        <PatientAvatar
          patientId={patientId}
          patientName={patientName}
          initialMode="compact"
          editable={false}
        />
      </EACardContent>
    </EACard>
  );
};

PatientAvatarProfileSection.displayName = 'PatientAvatarProfileSection';

export default PatientAvatarProfileSection;
