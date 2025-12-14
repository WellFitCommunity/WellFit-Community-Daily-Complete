/**
 * StatusBadgeRing - Displays status badges around the patient avatar
 *
 * Badges are positioned around the perimeter of the avatar:
 * - Top: Code Status (DNR, DNI, Full Code, Comfort Care)
 * - Left: Precautions (Fall Risk, Aspiration, NPO, etc.)
 * - Right: Isolation & Alerts (Contact, Droplet, Airborne, Allergies)
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { PatientMarker } from '../../types/patientAvatar';
import { getMarkerTypeDefinition } from './constants/markerTypeLibrary';

interface StatusBadgeRingProps {
  markers: PatientMarker[];
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show count on allergy badge */
  allergyCount?: number;
  /** Callback when badge is clicked */
  onBadgeClick?: (marker: PatientMarker) => void;
  className?: string;
}

/**
 * Badge icon components
 */
const BadgeIcons: Record<string, React.FC<{ className?: string }>> = {
  // Precautions
  fall: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
  aspiration: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.20-1.10-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/>
    </svg>
  ),
  npo: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 5H3v14h18V5zm-2 12H5V7h14v10zm-3-7H8v2h8v-2z"/>
      <path d="M3 3L1 5l2 2v12h12l6 6 1.41-1.41L3 3z"/>
    </svg>
  ),
  seizure: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 2v11h3v9l7-12h-4l4-8H7z"/>
    </svg>
  ),
  bleeding: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c-4 4-8 7.46-8 12 0 4.42 3.58 8 8 8s8-3.58 8-8c0-4.54-4-8-8-12zm0 18c-3.31 0-6-2.69-6-6 0-2.97 2.16-5.7 4-7.65V18h4V6.35c1.84 1.95 4 4.68 4 7.65 0 3.31-2.69 6-6 6z"/>
    </svg>
  ),
  elopement: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
    </svg>
  ),

  // Isolation
  isolation_contact: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
    </svg>
  ),
  isolation_droplet: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z"/>
    </svg>
  ),
  isolation_airborne: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.5 17c0 1.65-1.35 3-3 3s-3-1.35-3-3h2c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1H2v-2h9.5c1.65 0 3 1.35 3 3zM19 6.5C19 4.57 17.43 3 15.5 3S12 4.57 12 6.5h2c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S16.33 8 15.5 8H2v2h13.5c1.93 0 3.5-1.57 3.5-3.5zm-.5 4.5H2v2h16.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5v2c1.93 0 3.5-1.57 3.5-3.5S20.43 11 18.5 11z"/>
    </svg>
  ),
  isolation_protective: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm7 10c0 4.52-2.98 8.69-7 9.93-4.02-1.24-7-5.41-7-9.93V6.3l7-3.11 7 3.11V11zm-11.59.59L6 13l4 4 8-8-1.41-1.42L10 14.17z"/>
    </svg>
  ),

  // Code Status
  code_full: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM18 10c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zM8 18v-4.5H6L10 6v5h2l-4 7z"/>
    </svg>
  ),
  code_dnr: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
    </svg>
  ),
  code_dni: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
    </svg>
  ),
  code_dnr_dni: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-1-6h2v2h-2zm0-8h2v6h-2z"/>
    </svg>
  ),
  code_comfort: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  ),

  // Alerts
  allergy: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
  ),
  allergy_latex: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 7c0-1.1-.9-2-2-2h-2c0-1.1-.9-2-2-2s-2 .9-2 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7zm-2 0H8v-1h8v1zm-8 12V9h8v10H8zm2-8h4v2h-4v-2zm0 4h4v2h-4v-2z"/>
    </svg>
  ),
  difficult_airway: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.47 21h15.06c1.54 0 2.5-1.67 1.73-3L13.73 4.99c-.77-1.33-2.69-1.33-3.46 0L2.74 18c-.77 1.33.19 3 1.73 3zM12 14c-.55 0-1-.45-1-1v-2c0-.55.45-1 1-1s1 .45 1 1v2c0 .55-.45 1-1 1zm1 4h-2v-2h2v2z"/>
    </svg>
  ),
  limb_alert: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.56-.89-1.68-1.25-2.65-.84L6 8.3V13h2V9.6l1.8-.7"/>
    </svg>
  ),
  // Difficult IV Access - syringe with X
  difficult_iv: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.15 15.18l-2.73-2.73 2.2-2.2-1.41-1.41-2.2 2.2L4.88 8.9l.71-.71-.71-.71L3.47 8.9c-.39.39-.39 1.02 0 1.41l1.42 1.42-.71.71.71.71 1.41-1.41L8.44 14l-.71.71.71.71 2.12-2.12 2.73 2.73 1.41-1.41-3.55-3.55z"/>
      <path d="M19.78 9.24l-3.02-3.02 1.41-1.41-1.41-1.41-1.41 1.41-.71-.71-1.42 1.42.71.71-5.66 5.66.71.71-1.42 1.42.71.71 1.41-1.41 3.02 3.02c.39.39 1.02.39 1.41 0l5.66-5.66c.39-.39.39-1.03.01-1.42zm-3.54 4.95l-2.32-2.32 4.24-4.24 2.32 2.32-4.24 4.24z"/>
      <circle cx="18" cy="18" r="4" fill="#ef4444"/>
      <path d="M16.59 16.59L19.41 19.41M19.41 16.59L16.59 19.41" stroke="white" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
};

/**
 * Default icon for unknown badge types
 */
const DefaultBadgeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
  </svg>
);

/**
 * Individual badge component
 */
const StatusBadge: React.FC<{
  marker: PatientMarker;
  size: 'sm' | 'md' | 'lg';
  position: 'top' | 'left' | 'right';
  index: number;
  onClick?: (marker: PatientMarker) => void;
  count?: number;
}> = ({ marker, size, position, index, onClick, count }) => {
  const typeDef = getMarkerTypeDefinition(marker.marker_type);
  const Icon = typeDef?.badge_icon
    ? BadgeIcons[typeDef.badge_icon] || DefaultBadgeIcon
    : DefaultBadgeIcon;
  const color = typeDef?.badge_color || '#64748b';

  const sizeClasses = {
    sm: 'w-5 h-5 text-[8px]',
    md: 'w-6 h-6 text-[10px]',
    lg: 'w-8 h-8 text-xs',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  // Position offsets based on slot
  const getPositionStyle = (): React.CSSProperties => {
    const spacing = size === 'sm' ? 22 : size === 'md' ? 26 : 32;

    if (position === 'top') {
      return {
        top: -4,
        left: '50%',
        transform: `translateX(calc(-50% + ${(index - 0.5) * spacing}px))`,
      };
    } else if (position === 'left') {
      return {
        left: -4,
        top: 20 + index * spacing,
      };
    } else {
      return {
        right: -4,
        top: 20 + index * spacing,
      };
    }
  };

  const isPending = marker.status === 'pending_confirmation';

  return (
    <button
      className={cn(
        'absolute flex items-center justify-center rounded-full',
        'shadow-lg transition-transform hover:scale-110',
        'focus:outline-none focus:ring-2 focus:ring-white/50',
        isPending && 'animate-pulse ring-2 ring-dashed ring-white/50',
        sizeClasses[size]
      )}
      style={{
        backgroundColor: color,
        ...getPositionStyle(),
      }}
      onClick={() => onClick?.(marker)}
      title={marker.display_name}
      aria-label={marker.display_name}
    >
      <Icon className={cn('text-white', iconSizes[size])} />
      {count !== undefined && count > 0 && (
        <span className="absolute -top-1 -right-1 bg-white text-red-600 rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold text-[8px]">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
};

/**
 * StatusBadgeRing Component
 *
 * Displays status badges around the patient avatar perimeter.
 */
export const StatusBadgeRing: React.FC<StatusBadgeRingProps> = ({
  markers,
  size = 'md',
  allergyCount,
  onBadgeClick,
  className,
}) => {
  // Filter to only status badge markers
  const statusBadges = markers.filter((m) => {
    const typeDef = getMarkerTypeDefinition(m.marker_type);
    return typeDef?.is_status_badge && m.is_active && m.status !== 'rejected';
  });

  if (statusBadges.length === 0) {
    return null;
  }

  // Categorize badges by position
  const codeStatus = statusBadges.filter((m) =>
    m.marker_type.startsWith('code_')
  );
  const precautions = statusBadges.filter(
    (m) =>
      ['fall_risk', 'aspiration_risk', 'npo', 'seizure_precautions', 'bleeding_precautions', 'elopement_risk'].includes(m.marker_type)
  );
  const isolationAndAlerts = statusBadges.filter(
    (m) =>
      m.marker_type.startsWith('isolation_') ||
      m.marker_type.startsWith('allergy') ||
      m.marker_type === 'difficult_airway' ||
      m.marker_type === 'limb_alert'
  );

  return (
    <div className={cn('absolute inset-0 pointer-events-none', className)}>
      {/* Top - Code Status */}
      <div className="pointer-events-auto">
        {codeStatus.map((marker, idx) => (
          <StatusBadge
            key={marker.id}
            marker={marker}
            size={size}
            position="top"
            index={idx}
            onClick={onBadgeClick}
          />
        ))}
      </div>

      {/* Left - Precautions */}
      <div className="pointer-events-auto">
        {precautions.map((marker, idx) => (
          <StatusBadge
            key={marker.id}
            marker={marker}
            size={size}
            position="left"
            index={idx}
            onClick={onBadgeClick}
          />
        ))}
      </div>

      {/* Right - Isolation & Alerts */}
      <div className="pointer-events-auto">
        {isolationAndAlerts.map((marker, idx) => (
          <StatusBadge
            key={marker.id}
            marker={marker}
            size={size}
            position="right"
            index={idx}
            onClick={onBadgeClick}
            count={marker.marker_type === 'allergy_alert' ? allergyCount : undefined}
          />
        ))}
      </div>
    </div>
  );
};

StatusBadgeRing.displayName = 'StatusBadgeRing';

export default StatusBadgeRing;
