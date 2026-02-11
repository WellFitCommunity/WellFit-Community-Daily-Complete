/**
 * StatusBadgeRing - Displays status badges around the patient avatar
 *
 * Badges are positioned around the perimeter of the avatar:
 * - Top: Code Status (DNR, DNI, Full Code, Comfort Care)
 * - Left: Precautions (Fall Risk, Aspiration, NPO, etc.) + OB badges
 * - Right: Isolation & Alerts (Contact, Droplet, Airborne, Allergies)
 *
 * Learning components (BadgeLegend, BadgeOnboardingTour, useBadgeOnboarding,
 * BADGE_DESCRIPTIONS) extracted to StatusBadgeLearning.tsx for file size compliance.
 */

import React from 'react';
import { HelpCircle, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { PatientMarker } from '../../types/patientAvatar';
import { getMarkerTypeDefinition } from './constants/markerTypeLibrary';
import {
  BadgeIconMap,
  BADGE_DESCRIPTIONS,
  BadgeLegend,
  BadgeOnboardingTour,
  useBadgeOnboarding,
} from './StatusBadgeLearning';

// Re-export for barrel compatibility
export { BadgeLegend, BadgeOnboardingTour, useBadgeOnboarding, BADGE_DESCRIPTIONS };

interface StatusBadgeRingProps {
  markers: PatientMarker[];
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show count on allergy badge */
  allergyCount?: number;
  /** Callback when badge is clicked */
  onBadgeClick?: (marker: PatientMarker) => void;
  /** Show the legend below the avatar */
  showLegend?: boolean;
  /** Show first-time onboarding tour */
  showOnboarding?: boolean;
  className?: string;
}

/**
 * Individual badge component using Lucide icons
 */
const StatusBadge: React.FC<{
  marker: PatientMarker;
  size: 'sm' | 'md' | 'lg';
  position: { x: number; y: number };
  index: number;
  onClick?: (marker: PatientMarker) => void;
  count?: number;
}> = ({ marker, size, position, index, onClick, count }) => {
  const typeDef = getMarkerTypeDefinition(marker.marker_type);
  const iconKey = typeDef?.badge_icon || marker.marker_type;
  const Icon: LucideIcon = BadgeIconMap[iconKey] || HelpCircle;
  const badgeInfo = BADGE_DESCRIPTIONS[iconKey];
  const color = typeDef?.badge_color || badgeInfo?.color || '#64748b';

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <button
      className={cn(
        'absolute flex items-center justify-center rounded-full',
        'border-2 border-slate-800 shadow-md',
        'transition-all duration-200',
        'hover:scale-125 hover:z-20 hover:shadow-lg',
        'focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900',
        sizeClasses[size],
        onClick && 'cursor-pointer'
      )}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        backgroundColor: color,
        zIndex: 10 + index,
      }}
      onClick={() => onClick?.(marker)}
      title={`${marker.display_name}${badgeInfo ? `: ${badgeInfo.description}` : ''}`}
      aria-label={marker.display_name}
    >
      <Icon className={cn(iconSizeClasses[size], 'text-white')} strokeWidth={2.5} />

      {/* Count badge for allergies */}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'absolute -top-1 -right-1 flex items-center justify-center',
            'bg-white text-xs font-bold rounded-full',
            'border border-slate-300',
            size === 'sm' ? 'w-3 h-3 text-[8px]' : 'w-4 h-4 text-[10px]'
          )}
          style={{ color }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
};

/**
 * StatusBadgeRing Component
 */
export const StatusBadgeRing: React.FC<StatusBadgeRingProps> = ({
  markers,
  size = 'sm',
  allergyCount,
  onBadgeClick,
  showLegend = false,
  showOnboarding = true,
  className,
}) => {
  const { showTour, completeTour, skipTour } = useBadgeOnboarding();

  // Separate badges by position
  const { topBadges, leftBadges, rightBadges } = React.useMemo(() => {
    const top: PatientMarker[] = [];
    const left: PatientMarker[] = [];
    const right: PatientMarker[] = [];

    for (const marker of markers) {
      if (!marker.is_active || marker.status === 'rejected') continue;

      const typeDef = getMarkerTypeDefinition(marker.marker_type);
      if (!typeDef?.is_status_badge) continue;

      const type = marker.marker_type;
      if (type.startsWith('code_')) {
        top.push(marker);
      } else if (
        type.startsWith('isolation_') ||
        type.startsWith('allergy') ||
        type === 'difficult_airway' ||
        type === 'difficult_iv' ||
        type === 'limb_alert'
      ) {
        right.push(marker);
      } else {
        // Precautions + OB badges go on left
        left.push(marker);
      }
    }

    return { topBadges: top, leftBadges: left, rightBadges: right };
  }, [markers]);

  // Calculate positions for each section
  const getPositions = (
    badges: PatientMarker[],
    section: 'top' | 'left' | 'right'
  ): Array<{ marker: PatientMarker; position: { x: number; y: number } }> => {
    const positions: Array<{ marker: PatientMarker; position: { x: number; y: number } }> = [];

    badges.forEach((marker, index) => {
      let x: number, y: number;

      switch (section) {
        case 'top': {
          const topSpacing = 20;
          const topStart = 50 - ((badges.length - 1) * topSpacing) / 2;
          x = topStart + index * topSpacing;
          y = -5;
          break;
        }
        case 'left':
          x = -5;
          y = 20 + index * 18;
          break;
        case 'right':
          x = 105;
          y = 20 + index * 18;
          break;
      }

      positions.push({ marker, position: { x, y } });
    });

    return positions;
  };

  const allPositions = [
    ...getPositions(topBadges, 'top'),
    ...getPositions(leftBadges, 'left'),
    ...getPositions(rightBadges, 'right'),
  ];

  if (allPositions.length === 0 && !showLegend) return null;

  return (
    <>
      {/* Onboarding tour */}
      {showOnboarding && showTour && (
        <BadgeOnboardingTour onComplete={completeTour} onSkip={skipTour} />
      )}

      {/* Badge ring */}
      <div className={cn('absolute inset-0 pointer-events-none', className)}>
        {allPositions.map(({ marker, position }, index) => (
          <div key={marker.id} className="pointer-events-auto">
            <StatusBadge
              marker={marker}
              size={size}
              position={position}
              index={index}
              onClick={onBadgeClick}
              count={
                marker.marker_type === 'allergy_alert' || marker.marker_type === 'allergy'
                  ? allergyCount
                  : undefined
              }
            />
          </div>
        ))}
      </div>

      {/* Optional legend */}
      {showLegend && (
        <div className="pointer-events-auto">
          <BadgeLegend />
        </div>
      )}
    </>
  );
};

StatusBadgeRing.displayName = 'StatusBadgeRing';

export default StatusBadgeRing;
