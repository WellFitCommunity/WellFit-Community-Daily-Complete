/**
 * PatientAvatar - Main Container Component
 *
 * The primary entry point for the Patient Avatar Visualization System.
 * Shows a compact initials thumbnail that navigates to the 3D anatomy viewer.
 */

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PatientAvatarProps } from '../../types/patientAvatar';
import { usePatientAvatar } from './hooks/usePatientAvatar';
import { usePatientMarkers } from './hooks/usePatientMarkers';
import { AvatarThumbnail } from './AvatarThumbnail';

interface PatientAvatarContainerProps extends PatientAvatarProps {
  /** Optional skin tone override (otherwise fetched from DB) */
  skinToneOverride?: 'light' | 'mediumLight' | 'medium' | 'mediumDark' | 'dark';
  /** Optional gender override (otherwise fetched from DB) */
  genderOverride?: 'male' | 'female' | 'neutral';
}

/**
 * PatientAvatar Component
 *
 * Shows a compact initials thumbnail with marker badge.
 * Clicking navigates to the full 3D anatomy viewer at /patient-avatar/:patientId.
 */
export const PatientAvatar: React.FC<PatientAvatarContainerProps> = ({
  patientId,
  patientName,
  skinToneOverride,
  genderOverride,
  className,
}) => {
  const navigate = useNavigate();

  // Hooks
  const { avatar } = usePatientAvatar(patientId);
  const { markers, pendingCount } = usePatientMarkers(patientId);

  // Computed values
  const skinTone = skinToneOverride || avatar?.skin_tone || 'medium';
  const genderPresentation = genderOverride || avatar?.gender_presentation || 'neutral';

  // Clicking the thumbnail navigates to the 3D anatomy viewer
  const handleExpand = useCallback(() => {
    navigate(`/patient-avatar/${patientId}`);
  }, [navigate, patientId]);

  return (
    <AvatarThumbnail
      patientId={patientId}
      patientName={patientName}
      skinTone={skinTone}
      genderPresentation={genderPresentation}
      markers={markers}
      pendingCount={pendingCount}
      onClick={handleExpand}
      className={className}
    />
  );
};

PatientAvatar.displayName = 'PatientAvatar';

export default PatientAvatar;
