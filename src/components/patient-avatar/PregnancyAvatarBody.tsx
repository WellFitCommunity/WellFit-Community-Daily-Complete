/**
 * PregnancyAvatarBody - SVG Pregnant Body Component
 *
 * Renders a pregnancy-specific body outline with trimester-appropriate
 * abdominal growth. Uses same viewBox, skin tone system, and children
 * prop pattern as AvatarBody for full marker compatibility.
 */

import React from 'react';
import { cn } from '../../lib/utils';
import type { BodyView, SkinTone } from '../../types/patientAvatar';
import { SKIN_TONE_COLORS } from './constants/skinTones';

interface PregnancyAvatarBodyProps {
  skinTone: SkinTone;
  trimester: 1 | 2 | 3;
  view: BodyView;
  size?: 'thumbnail' | 'full';
  className?: string;
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent<SVGSVGElement>) => void;
}

/**
 * Get pregnancy-specific front view SVG paths by trimester
 *
 * T1 (weeks 0-13): Barely noticeable abdominal thickening
 * T2 (weeks 14-27): Visible rounded belly
 * T3 (weeks 28+): Full pregnant silhouette, fundus near sternum
 */
function getPregnancyFrontPaths(trimester: 1 | 2 | 3): string {
  // Head is the same across all trimesters
  const head = `
    M 50,5
    C 42,5 36,11 36,19
    C 36,27 42,33 50,33
    C 58,33 64,27 64,19
    C 64,11 58,5 50,5
    Z
    M 50,33
    L 50,37
  `;

  if (trimester === 1) {
    // T1: Slight thickening around abdomen, otherwise similar to female body
    return `${head}
      M 40,40
      C 40,38 45,37 50,37
      C 55,37 60,38 60,40
      L 65,40
      C 68,40 71,43 72,48
      L 72,58
      C 73,60 74,62 74,64
      L 80,75
      C 81,78 80,81 78,82
      L 76,84
      C 74,85 71,85 69,83
      L 67,80
      L 64,68
      L 62,68
      L 62,75
      C 62,78 60,80 58,80
      L 58,85
      C 59,86 60,88 60,90
      L 60,110
      L 62,135
      L 64,148
      C 64,150 63,152 61,153
      L 59,155
      C 57,156 54,156 52,155
      L 50,153
      L 48,155
      C 46,156 43,156 41,155
      L 39,153
      C 37,152 36,150 36,148
      L 38,135
      L 40,110
      L 40,90
      C 40,88 41,86 42,85
      L 42,80
      C 40,80 38,78 38,75
      L 38,68
      L 36,68
      L 33,80
      L 31,83
      C 29,85 26,85 24,84
      L 22,82
      C 20,81 19,78 20,75
      L 26,64
      C 26,62 27,60 28,58
      L 28,48
      C 29,43 32,40 35,40
      L 40,40
      Z
    `;
  }

  if (trimester === 2) {
    // T2: Visible rounded belly — abdomen curves outward
    return `${head}
      M 40,40
      C 40,38 45,37 50,37
      C 55,37 60,38 60,40
      L 65,40
      C 68,40 71,43 72,48
      L 72,56
      C 73,58 74,60 74,62
      L 80,75
      C 81,78 80,81 78,82
      L 76,84
      C 74,85 71,85 69,83
      L 67,80
      L 64,68
      L 63,68
      L 63,72
      C 63,76 64,80 64,84
      C 65,88 65,92 64,96
      L 62,110
      L 63,135
      L 64,148
      C 64,150 63,152 61,153
      L 59,155
      C 57,156 54,156 52,155
      L 50,153
      L 48,155
      C 46,156 43,156 41,155
      L 39,153
      C 37,152 36,150 36,148
      L 37,135
      L 38,110
      L 36,96
      C 35,92 35,88 36,84
      C 36,80 37,76 37,72
      L 37,68
      L 36,68
      L 33,80
      L 31,83
      C 29,85 26,85 24,84
      L 22,82
      C 20,81 19,78 20,75
      L 26,62
      C 26,60 27,58 28,56
      L 28,48
      C 29,43 32,40 35,40
      L 40,40
      Z
    `;
  }

  // T3: Full pregnant silhouette — large belly, fundus near sternum
  return `${head}
    M 40,40
    C 40,38 45,37 50,37
    C 55,37 60,38 60,40
    L 65,40
    C 68,40 71,43 72,48
    L 72,54
    C 73,56 74,58 74,60
    L 80,75
    C 81,78 80,81 78,82
    L 76,84
    C 74,85 71,85 69,83
    L 67,80
    L 64,66
    L 64,68
    C 64,72 66,78 67,84
    C 68,90 68,96 66,100
    L 63,112
    L 64,135
    L 65,148
    C 65,150 64,152 62,153
    L 59,155
    C 57,156 54,156 52,155
    L 50,153
    L 48,155
    C 46,156 43,156 41,155
    L 38,153
    C 36,152 35,150 35,148
    L 36,135
    L 37,112
    L 34,100
    C 32,96 32,90 33,84
    C 34,78 36,72 36,68
    L 36,66
    L 33,80
    L 31,83
    C 29,85 26,85 24,84
    L 22,82
    C 20,81 19,78 20,75
    L 26,60
    C 26,58 27,56 28,54
    L 28,48
    C 29,43 32,40 35,40
    L 40,40
    Z
  `;
}

/**
 * Get pregnancy-specific back view SVG paths by trimester
 * Back view shows slight lumbar curvature increase in T3
 */
function getPregnancyBackPaths(trimester: 1 | 2 | 3): string {
  const head = `
    M 50,5
    C 42,5 36,11 36,19
    C 36,27 42,33 50,33
    C 58,33 64,27 64,19
    C 64,11 58,5 50,5
    Z
    M 50,33
    L 50,37
  `;

  if (trimester <= 2) {
    // T1-T2 back: minimal visible change
    return `${head}
      M 40,40
      C 40,38 45,37 50,37
      C 55,37 60,38 60,40
      L 65,40
      C 68,40 71,43 72,48
      L 72,58
      C 73,60 74,62 74,64
      L 80,75
      C 81,78 80,81 78,82
      L 76,84
      C 74,85 71,85 69,83
      L 67,80
      L 64,68
      L 62,68
      L 62,75
      L 61,88
      C 62,90 62,92 61,94
      L 60,110
      L 62,135
      L 64,148
      C 64,150 63,152 61,153
      L 59,155
      C 57,156 54,156 52,155
      L 50,153
      L 48,155
      C 46,156 43,156 41,155
      L 39,153
      C 37,152 36,150 36,148
      L 38,135
      L 40,110
      L 39,94
      C 38,92 38,90 39,88
      L 38,75
      L 38,68
      L 36,68
      L 33,80
      L 31,83
      C 29,85 26,85 24,84
      L 22,82
      C 20,81 19,78 20,75
      L 26,64
      C 26,62 27,60 28,58
      L 28,48
      C 29,43 32,40 35,40
      L 40,40
      Z
      M 44,48 L 56,48 L 56,56 L 44,56 Z
    `;
  }

  // T3 back: pronounced lumbar lordosis (lower back curve)
  return `${head}
    M 40,40
    C 40,38 45,37 50,37
    C 55,37 60,38 60,40
    L 65,40
    C 68,40 71,43 72,48
    L 72,58
    C 73,60 74,62 74,64
    L 80,75
    C 81,78 80,81 78,82
    L 76,84
    C 74,85 71,85 69,83
    L 67,80
    L 64,68
    L 62,68
    L 62,74
    L 62,84
    C 63,88 63,92 62,96
    L 60,112
    L 62,135
    L 64,148
    C 64,150 63,152 61,153
    L 59,155
    C 57,156 54,156 52,155
    L 50,153
    L 48,155
    C 46,156 43,156 41,155
    L 39,153
    C 37,152 36,150 36,148
    L 38,135
    L 40,112
    L 38,96
    C 37,92 37,88 38,84
    L 38,74
    L 38,68
    L 36,68
    L 33,80
    L 31,83
    C 29,85 26,85 24,84
    L 22,82
    C 20,81 19,78 20,75
    L 26,64
    C 26,62 27,60 28,58
    L 28,48
    C 29,43 32,40 35,40
    L 40,40
    Z
    M 44,48 L 56,48 L 56,56 L 44,56 Z
  `;
}

/**
 * Get fundal height reference Y position by trimester
 * Dashed line showing approximate fundal height on the body
 */
function getFundalHeightY(trimester: 1 | 2 | 3): number | null {
  switch (trimester) {
    case 1: return null; // Not clinically relevant
    case 2: return 48;   // At or near umbilicus
    case 3: return 40;   // Near sternum/xiphoid
  }
}

/**
 * PregnancyAvatarBody Component
 *
 * Renders a pregnancy-specific SVG body with trimester-appropriate shape.
 * Drop-in replacement for AvatarBody when patient is pregnant.
 */
export const PregnancyAvatarBody: React.FC<PregnancyAvatarBodyProps> = React.memo(({
  skinTone,
  trimester,
  view,
  size = 'full',
  className,
  children,
  onClick,
}) => {
  const skinColor = SKIN_TONE_COLORS[skinTone];
  const outlineColor = '#475569'; // slate-600

  const sizeClasses = size === 'thumbnail'
    ? 'w-[100px] h-[160px]'
    : 'w-full h-full max-w-[300px] max-h-[480px]';

  const bodyPath = view === 'front'
    ? getPregnancyFrontPaths(trimester)
    : getPregnancyBackPaths(trimester);

  const fundalY = view === 'front' ? getFundalHeightY(trimester) : null;

  return (
    <svg
      viewBox="0 0 100 160"
      className={cn(
        sizeClasses,
        'select-none',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      role="img"
      aria-label={`Pregnant patient avatar - trimester ${trimester}, ${view} view`}
    >
      {/* Background */}
      <rect x="0" y="0" width="100" height="160" fill="transparent" />

      {/* Body Outline */}
      <g>
        <path
          d={bodyPath}
          fill={skinColor}
          stroke={outlineColor}
          strokeWidth="0.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Subtle shading for depth */}
        <path
          d={bodyPath}
          fill="url(#pregnancyBodyShading)"
          opacity="0.15"
        />
      </g>

      {/* Fundal height reference line (front view, T2/T3 only) */}
      {fundalY !== null && (
        <line
          x1="36"
          y1={fundalY}
          x2="64"
          y2={fundalY}
          stroke="#ec4899"
          strokeWidth="0.4"
          strokeDasharray="1.5 1"
          opacity="0.6"
        />
      )}

      {/* Trimester indicator */}
      <text
        x="50"
        y="158"
        textAnchor="middle"
        fontSize="4"
        fill="#64748b"
        fontFamily="system-ui, sans-serif"
      >
        {view === 'front' ? 'FRONT' : 'BACK'} | T{trimester}
      </text>

      {/* Gradient definitions */}
      <defs>
        <linearGradient id="pregnancyBodyShading" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Children (markers) rendered on top */}
      {children}
    </svg>
  );
});

PregnancyAvatarBody.displayName = 'PregnancyAvatarBody';

export default PregnancyAvatarBody;
