/**
 * StatusBadgeRing - Displays status badges around the patient avatar
 *
 * Badges are positioned around the perimeter of the avatar:
 * - Top: Code Status (DNR, DNI, Full Code, Comfort Care)
 * - Left: Precautions (Fall Risk, Aspiration, NPO, etc.)
 * - Right: Isolation & Alerts (Contact, Droplet, Airborne, Allergies)
 *
 * Learning mechanisms:
 * 1. Hover tooltips - show display name on hover
 * 2. BadgeLegend component - collapsible legend explaining all badges
 * 3. First-time tour - localStorage-based onboarding
 */

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Ban,
  Zap,
  Droplets,
  Footprints,
  Hand,
  Wind,
  ShieldCheck,
  Heart,
  HeartOff,
  Minus,
  CircleSlash,
  Flower2,
  AlertCircle,
  Syringe,
  Stethoscope,
  Activity,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  X,
  type LucideIcon,
} from 'lucide-react';
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
  /** Show the legend below the avatar */
  showLegend?: boolean;
  /** Show first-time onboarding tour */
  showOnboarding?: boolean;
  className?: string;
}

/**
 * Badge icon mapping using Lucide icons
 */
const BadgeIconMap: Record<string, LucideIcon> = {
  // Precautions
  fall: AlertTriangle,
  aspiration: Stethoscope,
  npo: Ban,
  seizure: Zap,
  bleeding: Droplets,
  elopement: Footprints,

  // Isolation
  isolation_contact: Hand,
  isolation_droplet: Droplets,
  isolation_airborne: Wind,
  isolation_protective: ShieldCheck,

  // Code Status
  code_full: Heart,
  code_dnr: HeartOff,
  code_dni: Minus,
  code_dnr_dni: CircleSlash,
  code_comfort: Flower2,

  // Alerts
  allergy: AlertCircle,
  allergy_latex: AlertCircle,
  difficult_airway: Activity,
  limb_alert: AlertTriangle,
  difficult_iv: Syringe,
};

/**
 * Badge descriptions for learning
 */
export const BADGE_DESCRIPTIONS: Record<string, { name: string; description: string; color: string }> = {
  // Precautions (Left side - Red/Yellow)
  fall: {
    name: 'Fall Risk',
    description: 'Patient at risk of falling. Use bed rails, assist with ambulation.',
    color: '#ef4444'
  },
  aspiration: {
    name: 'Aspiration Risk',
    description: 'Risk of food/liquid entering airway. Thickened liquids, upright positioning.',
    color: '#ef4444'
  },
  npo: {
    name: 'NPO (Nothing by Mouth)',
    description: 'No food or drink. May be pre-surgery or for diagnostic testing.',
    color: '#ef4444'
  },
  seizure: {
    name: 'Seizure Precautions',
    description: 'Padded rails, suction at bedside, O2 ready.',
    color: '#ef4444'
  },
  bleeding: {
    name: 'Bleeding Precautions',
    description: 'On anticoagulants or low platelets. Avoid IM injections, use soft toothbrush.',
    color: '#ef4444'
  },
  elopement: {
    name: 'Elopement Risk',
    description: 'Flight risk or wandering. May need 1:1 observation or alarm.',
    color: '#f97316'
  },

  // Isolation (Right side - Color-coded per hospital standard)
  isolation_contact: {
    name: 'Contact Isolation',
    description: 'MRSA, VRE, C.diff. Gown and gloves required.',
    color: '#eab308' // Yellow - hospital standard
  },
  isolation_droplet: {
    name: 'Droplet Isolation',
    description: 'Flu, RSV, Pertussis. Surgical mask within 6 feet.',
    color: '#22c55e' // Green - hospital standard
  },
  isolation_airborne: {
    name: 'Airborne Isolation',
    description: 'TB, Measles, COVID, Chickenpox. N95 required, negative pressure room.',
    color: '#3b82f6' // Blue - hospital standard
  },
  isolation_protective: {
    name: 'Protective/Reverse Isolation',
    description: 'Neutropenic, BMT patient. Protect patient FROM infection.',
    color: '#a855f7' // Purple - hospital standard
  },

  // Code Status (Top - varies)
  code_full: {
    name: 'Full Code',
    description: 'All resuscitative measures. CPR, intubation, defibrillation.',
    color: '#22c55e'
  },
  code_dnr: {
    name: 'DNR (Do Not Resuscitate)',
    description: 'No CPR if heart stops. May still receive other treatments.',
    color: '#ef4444'
  },
  code_dni: {
    name: 'DNI (Do Not Intubate)',
    description: 'No mechanical ventilation. May still receive CPR.',
    color: '#f97316'
  },
  code_dnr_dni: {
    name: 'DNR/DNI',
    description: 'No CPR and no intubation. Comfort-focused care.',
    color: '#ef4444'
  },
  code_comfort: {
    name: 'Comfort Care Only',
    description: 'Hospice/palliative. Focus on comfort, not life extension.',
    color: '#a855f7'
  },

  // Alerts (Right side - Red/Orange)
  allergy: {
    name: 'Allergies',
    description: 'Has documented allergies. Check MAR before giving meds.',
    color: '#ef4444'
  },
  allergy_latex: {
    name: 'Latex Allergy',
    description: 'Use non-latex gloves and equipment.',
    color: '#ef4444'
  },
  difficult_airway: {
    name: 'Difficult Airway',
    description: 'Hard to intubate. Video laryngoscope, call anesthesia early.',
    color: '#f97316'
  },
  limb_alert: {
    name: 'Limb Alert',
    description: 'No BP or blood draw on affected limb. May have fistula or lymphedema.',
    color: '#eab308'
  },
  difficult_iv: {
    name: 'Difficult IV Access',
    description: 'Hard stick. Bring ultrasound, consider vein finder, small gauge.',
    color: '#f97316'
  },
};

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
  const Icon = BadgeIconMap[iconKey] || HelpCircle;
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
 * Badge Legend Component - Collapsible legend explaining all badge types
 */
export const BadgeLegend: React.FC<{
  expanded?: boolean;
  onToggle?: () => void;
  className?: string;
}> = ({ expanded = false, onToggle, className }) => {
  const [isExpanded, setIsExpanded] = useState(expanded);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onToggle?.();
  };

  const categories = [
    {
      title: 'Precautions',
      badges: ['fall', 'aspiration', 'npo', 'seizure', 'bleeding', 'elopement']
    },
    {
      title: 'Isolation',
      badges: ['isolation_contact', 'isolation_droplet', 'isolation_airborne', 'isolation_protective']
    },
    {
      title: 'Code Status',
      badges: ['code_full', 'code_dnr', 'code_dni', 'code_dnr_dni', 'code_comfort']
    },
    {
      title: 'Alerts',
      badges: ['allergy', 'difficult_airway', 'difficult_iv', 'limb_alert']
    },
  ];

  return (
    <div className={cn('mt-2', className)}>
      <button
        onClick={handleToggle}
        className={cn(
          'flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300',
          'transition-colors'
        )}
      >
        <HelpCircle className="w-3 h-3" />
        <span>What do these badges mean?</span>
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {isExpanded && (
        <div className={cn(
          'mt-2 p-3 bg-slate-800/80 rounded-lg border border-slate-700',
          'text-xs space-y-3 max-h-64 overflow-y-auto'
        )}>
          {categories.map((cat) => (
            <div key={cat.title}>
              <h4 className="font-semibold text-slate-300 mb-1">{cat.title}</h4>
              <div className="space-y-1">
                {cat.badges.map((badgeKey) => {
                  const info = BADGE_DESCRIPTIONS[badgeKey];
                  const Icon = BadgeIconMap[badgeKey] || HelpCircle;
                  if (!info) return null;
                  return (
                    <div key={badgeKey} className="flex items-start gap-2">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: info.color }}
                      >
                        <Icon className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
                      </div>
                      <div>
                        <span className="font-medium text-slate-200">{info.name}</span>
                        <span className="text-slate-400 ml-1">- {info.description}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * First-time onboarding tour component
 */
export const BadgeOnboardingTour: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
}> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Status Badges',
      description: 'Badges around the avatar show critical patient information at a glance.',
      highlight: 'all',
    },
    {
      title: 'Color = Meaning',
      description: 'Yellow = Contact, Green = Droplet, Blue = Airborne, Purple = Protective isolation.',
      highlight: 'isolation',
    },
    {
      title: 'Hover for Details',
      description: 'Hover over any badge to see what it means and care instructions.',
      highlight: 'hover',
    },
    {
      title: 'Click for More',
      description: 'Click a badge to see full details and related orders.',
      highlight: 'click',
    },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#00857a] flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white">{currentStep.title}</h3>
          </div>
          <button
            onClick={onSkip}
            className="text-slate-400 hover:text-white p-1"
            aria-label="Skip tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-300 mb-6">{currentStep.description}</p>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                i === step ? 'bg-[#00857a]' : 'bg-slate-600'
              )}
            />
          ))}
        </div>

        <div className="flex justify-between">
          <button
            onClick={onSkip}
            className="text-slate-400 hover:text-white text-sm"
          >
            Skip tour
          </button>
          <button
            onClick={() => {
              if (isLastStep) {
                onComplete();
              } else {
                setStep(step + 1);
              }
            }}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-sm',
              'bg-[#00857a] hover:bg-[#006b62] text-white',
              'transition-colors'
            )}
          >
            {isLastStep ? 'Got it!' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to manage onboarding tour state
 */
export const useBadgeOnboarding = () => {
  const STORAGE_KEY = 'avatar_badge_tour_completed';
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Delay showing tour slightly for better UX
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const completeTour = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShowTour(false);
  };

  const skipTour = () => {
    localStorage.setItem(STORAGE_KEY, 'skipped');
    setShowTour(false);
  };

  const resetTour = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShowTour(true);
  };

  return { showTour, completeTour, skipTour, resetTour };
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

      // Categorize by marker type
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
        // Precautions go on left
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
        case 'top':
          // Spread across top, centered
          const topSpacing = 20;
          const topStart = 50 - ((badges.length - 1) * topSpacing) / 2;
          x = topStart + index * topSpacing;
          y = -5;
          break;
        case 'left':
          // Stack vertically on left
          x = -5;
          y = 20 + index * 18;
          break;
        case 'right':
          // Stack vertically on right
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
