/**
 * StatusBadgeLearning - Badge Legend, Onboarding Tour, and Descriptions
 *
 * Extracted from StatusBadgeRing for file size compliance (600-line max).
 * Contains all learning/educational components for status badges.
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
  Baby,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================================================
// BADGE ICON MAP (shared with StatusBadgeRing)
// ============================================================================

export const BadgeIconMap: Record<string, LucideIcon> = {
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

  // Obstetric
  ob_risk: Baby,
  gbs_positive: AlertTriangle,
  membranes_ruptured: Droplets,
  fhr_category: Activity,
};

// ============================================================================
// BADGE DESCRIPTIONS
// ============================================================================

export const BADGE_DESCRIPTIONS: Record<string, { name: string; description: string; color: string }> = {
  // Precautions (Left side - Red/Yellow)
  fall: {
    name: 'Fall Risk',
    description: 'Patient at risk of falling. Use bed rails, assist with ambulation.',
    color: '#ef4444',
  },
  aspiration: {
    name: 'Aspiration Risk',
    description: 'Risk of food/liquid entering airway. Thickened liquids, upright positioning.',
    color: '#ef4444',
  },
  npo: {
    name: 'NPO (Nothing by Mouth)',
    description: 'No food or drink. May be pre-surgery or for diagnostic testing.',
    color: '#ef4444',
  },
  seizure: {
    name: 'Seizure Precautions',
    description: 'Padded rails, suction at bedside, O2 ready.',
    color: '#ef4444',
  },
  bleeding: {
    name: 'Bleeding Precautions',
    description: 'On anticoagulants or low platelets. Avoid IM injections, use soft toothbrush.',
    color: '#ef4444',
  },
  elopement: {
    name: 'Elopement Risk',
    description: 'Flight risk or wandering. May need 1:1 observation or alarm.',
    color: '#f97316',
  },

  // Isolation (Right side - Color-coded per hospital standard)
  isolation_contact: {
    name: 'Contact Isolation',
    description: 'MRSA, VRE, C.diff. Gown and gloves required.',
    color: '#eab308',
  },
  isolation_droplet: {
    name: 'Droplet Isolation',
    description: 'Flu, RSV, Pertussis. Surgical mask within 6 feet.',
    color: '#22c55e',
  },
  isolation_airborne: {
    name: 'Airborne Isolation',
    description: 'TB, Measles, COVID, Chickenpox. N95 required, negative pressure room.',
    color: '#3b82f6',
  },
  isolation_protective: {
    name: 'Protective/Reverse Isolation',
    description: 'Neutropenic, BMT patient. Protect patient FROM infection.',
    color: '#a855f7',
  },

  // Code Status (Top - varies)
  code_full: {
    name: 'Full Code',
    description: 'All resuscitative measures. CPR, intubation, defibrillation.',
    color: '#22c55e',
  },
  code_dnr: {
    name: 'DNR (Do Not Resuscitate)',
    description: 'No CPR if heart stops. May still receive other treatments.',
    color: '#ef4444',
  },
  code_dni: {
    name: 'DNI (Do Not Intubate)',
    description: 'No mechanical ventilation. May still receive CPR.',
    color: '#f97316',
  },
  code_dnr_dni: {
    name: 'DNR/DNI',
    description: 'No CPR and no intubation. Comfort-focused care.',
    color: '#ef4444',
  },
  code_comfort: {
    name: 'Comfort Care Only',
    description: 'Hospice/palliative. Focus on comfort, not life extension.',
    color: '#a855f7',
  },

  // Alerts (Right side - Red/Orange)
  allergy: {
    name: 'Allergies',
    description: 'Has documented allergies. Check MAR before giving meds.',
    color: '#ef4444',
  },
  allergy_latex: {
    name: 'Latex Allergy',
    description: 'Use non-latex gloves and equipment.',
    color: '#ef4444',
  },
  difficult_airway: {
    name: 'Difficult Airway',
    description: 'Hard to intubate. Video laryngoscope, call anesthesia early.',
    color: '#f97316',
  },
  limb_alert: {
    name: 'Limb Alert',
    description: 'No BP or blood draw on affected limb. May have fistula or lymphedema.',
    color: '#eab308',
  },
  difficult_iv: {
    name: 'Difficult IV Access',
    description: 'Hard stick. Bring ultrasound, consider vein finder, small gauge.',
    color: '#f97316',
  },

  // Obstetric
  ob_risk: {
    name: 'OB Risk Level',
    description: 'Obstetric risk classification. Check maternal risk factors and plan.',
    color: '#ec4899',
  },
  gbs_positive: {
    name: 'GBS Positive',
    description: 'Group B Strep positive. IV antibiotics required during labor.',
    color: '#f97316',
  },
  membranes_ruptured: {
    name: 'Membranes Ruptured',
    description: 'Amniotic membranes ruptured. Monitor for chorioamnionitis.',
    color: '#3b82f6',
  },
  fhr_category: {
    name: 'FHR Category',
    description: 'Fetal heart rate tracing category. I=reassuring, II=indeterminate, III=abnormal.',
    color: '#22c55e',
  },
};

// ============================================================================
// BADGE LEGEND COMPONENT
// ============================================================================

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
      badges: ['fall', 'aspiration', 'npo', 'seizure', 'bleeding', 'elopement'],
    },
    {
      title: 'Isolation',
      badges: ['isolation_contact', 'isolation_droplet', 'isolation_airborne', 'isolation_protective'],
    },
    {
      title: 'Code Status',
      badges: ['code_full', 'code_dnr', 'code_dni', 'code_dnr_dni', 'code_comfort'],
    },
    {
      title: 'Alerts',
      badges: ['allergy', 'difficult_airway', 'difficult_iv', 'limb_alert'],
    },
    {
      title: 'Obstetric',
      badges: ['ob_risk', 'gbs_positive', 'membranes_ruptured', 'fhr_category'],
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

// ============================================================================
// ONBOARDING TOUR COMPONENT
// ============================================================================

export const BadgeOnboardingTour: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
}> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Status Badges',
      description: 'Badges around the avatar show critical patient information at a glance.',
    },
    {
      title: 'Color = Meaning',
      description: 'Yellow = Contact, Green = Droplet, Blue = Airborne, Purple = Protective isolation. Pink = Obstetric.',
    },
    {
      title: 'Hover for Details',
      description: 'Hover over any badge to see what it means and care instructions.',
    },
    {
      title: 'Click for More',
      description: 'Click a badge to see full details and related orders.',
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

// ============================================================================
// ONBOARDING HOOK
// ============================================================================

export const useBadgeOnboarding = () => {
  const STORAGE_KEY = 'avatar_badge_tour_completed';
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
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
