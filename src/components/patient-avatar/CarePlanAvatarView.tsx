/**
 * CarePlanAvatarView - Avatar with category filtering for care plans
 *
 * Purpose: Compact avatar view with optional category/type filters
 * Used by: Care plan views to show relevant markers only
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { EACard, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { usePatientAvatar } from './hooks/usePatientAvatar';
import { usePatientMarkers } from './hooks/usePatientMarkers';
import { AvatarBody } from './AvatarBody';
import { AvatarMarker } from './AvatarMarker';
import { MarkerCategory } from '../../types/patientAvatar';

interface CarePlanAvatarViewProps {
  patientId: string;
  filterCategories?: MarkerCategory[];
  highlightTypes?: string[];
  className?: string;
}

export const CarePlanAvatarView: React.FC<CarePlanAvatarViewProps> = ({
  patientId,
  filterCategories,
  highlightTypes,
  className,
}) => {
  const navigate = useNavigate();
  const { avatar } = usePatientAvatar(patientId);
  const { markers } = usePatientMarkers(patientId);

  const skinTone = avatar?.skin_tone ?? 'medium';
  const genderPresentation = avatar?.gender_presentation ?? 'neutral';

  const filteredMarkers = useMemo(() => {
    let active = markers.filter((m) => m.is_active && m.status !== 'rejected' && m.body_view === 'front');

    if (filterCategories && filterCategories.length > 0) {
      active = active.filter((m) => filterCategories.includes(m.category));
    }

    return active;
  }, [markers, filterCategories]);

  const handleViewFull = () => {
    navigate(`/patient-avatar/${patientId}`);
  };

  return (
    <EACard className={cn('overflow-hidden', className)}>
      <EACardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">
            {filteredMarkers.length} marker{filteredMarkers.length !== 1 ? 's' : ''}
          </span>
          <EAButton variant="secondary" size="sm" onClick={handleViewFull}>
            View Full
          </EAButton>
        </div>
        <div className="flex justify-center">
          <AvatarBody
            skinTone={skinTone}
            genderPresentation={genderPresentation}
            view="front"
            size="thumbnail"
          >
            {filteredMarkers.map((marker) => (
              <AvatarMarker
                key={marker.id}
                marker={marker}
                size="sm"
                isHighlighted={highlightTypes ? highlightTypes.includes(marker.marker_type) : false}
              />
            ))}
          </AvatarBody>
        </div>
      </EACardContent>
    </EACard>
  );
};

CarePlanAvatarView.displayName = 'CarePlanAvatarView';

export default CarePlanAvatarView;
