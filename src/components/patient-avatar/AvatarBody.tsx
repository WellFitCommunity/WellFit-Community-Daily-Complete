/**
 * AvatarBody - SVG Human Body Component
 *
 * Renders a human body outline with configurable skin tone, gender, and view (front/back).
 * Clean, clinical aesthetic suitable for healthcare applications.
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { AvatarBodyProps, GenderPresentation, BodyView } from '../../types/patientAvatar';
import { SKIN_TONE_COLORS } from './constants/skinTones';

interface AvatarBodyComponentProps extends AvatarBodyProps {
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent<SVGSVGElement>) => void;
}

/**
 * Get SVG paths for body outline based on gender presentation
 */
function getBodyPaths(gender: GenderPresentation, view: BodyView): string {
  // Front view paths
  if (view === 'front') {
    if (gender === 'male') {
      return `
        M 50,5
        C 42,5 36,11 36,19
        C 36,27 42,33 50,33
        C 58,33 64,27 64,19
        C 64,11 58,5 50,5
        Z
        M 50,33
        L 50,37
        M 38,40
        C 38,38 44,37 50,37
        C 56,37 62,38 62,40
        L 68,40
        C 72,40 76,44 76,50
        L 76,55
        L 82,70
        C 83,73 82,76 80,78
        L 78,80
        C 76,82 73,82 71,80
        L 68,76
        L 65,62
        L 62,62
        L 62,90
        C 62,92 61,94 59,95
        L 58,115
        L 60,140
        C 60,142 59,144 57,145
        L 55,147
        C 53,148 50,148 48,147
        L 45,145
        C 43,144 42,142 42,140
        L 44,115
        L 43,95
        C 41,94 40,92 40,90
        L 40,62
        L 37,62
        L 34,76
        L 31,80
        C 29,82 26,82 24,80
        L 22,78
        C 20,76 19,73 20,70
        L 26,55
        L 26,50
        C 26,44 30,40 34,40
        L 38,40
        Z
      `;
    } else if (gender === 'female') {
      return `
        M 50,5
        C 42,5 36,11 36,19
        C 36,27 42,33 50,33
        C 58,33 64,27 64,19
        C 64,11 58,5 50,5
        Z
        M 50,33
        L 50,37
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
    } else {
      // Gender-neutral (androgynous)
      return `
        M 50,5
        C 42,5 37,11 37,19
        C 37,27 42,33 50,33
        C 58,33 63,27 63,19
        C 63,11 58,5 50,5
        Z
        M 50,33
        L 50,37
        M 39,40
        C 39,38 44,37 50,37
        C 56,37 61,38 61,40
        L 66,40
        C 70,40 73,43 74,48
        L 74,55
        L 80,72
        C 81,75 80,78 78,80
        L 76,82
        C 74,84 71,84 69,82
        L 66,78
        L 64,65
        L 61,65
        L 61,88
        C 61,90 60,92 58,93
        L 57,112
        L 59,138
        C 59,141 58,143 56,144
        L 54,146
        C 52,147 48,147 46,146
        L 44,144
        C 42,143 41,141 41,138
        L 43,112
        L 42,93
        C 40,92 39,90 39,88
        L 39,65
        L 36,65
        L 34,78
        L 31,82
        C 29,84 26,84 24,82
        L 22,80
        C 20,78 19,75 20,72
        L 26,55
        L 26,48
        C 27,43 30,40 34,40
        L 39,40
        Z
      `;
    }
  } else {
    // Back view paths
    if (gender === 'male') {
      return `
        M 50,5
        C 42,5 36,11 36,19
        C 36,27 42,33 50,33
        C 58,33 64,27 64,19
        C 64,11 58,5 50,5
        Z
        M 50,33
        L 50,37
        M 38,40
        C 38,38 44,37 50,37
        C 56,37 62,38 62,40
        L 68,40
        C 72,40 76,44 76,50
        L 76,55
        L 82,70
        C 83,73 82,76 80,78
        L 78,80
        C 76,82 73,82 71,80
        L 68,76
        L 65,62
        L 62,62
        L 62,88
        L 61,92
        L 62,95
        C 62,97 61,99 59,100
        L 58,115
        L 60,140
        C 60,142 59,144 57,145
        L 55,147
        C 53,148 50,148 48,147
        L 45,145
        C 43,144 42,142 42,140
        L 44,115
        L 43,100
        C 41,99 40,97 40,95
        L 41,92
        L 40,88
        L 40,62
        L 37,62
        L 34,76
        L 31,80
        C 29,82 26,82 24,80
        L 22,78
        C 20,76 19,73 20,70
        L 26,55
        L 26,50
        C 26,44 30,40 34,40
        L 38,40
        Z
        M 44,50 L 56,50 L 56,58 L 44,58 Z
      `;
    } else if (gender === 'female') {
      return `
        M 50,5
        C 42,5 36,11 36,19
        C 36,27 42,33 50,33
        C 58,33 64,27 64,19
        C 64,11 58,5 50,5
        Z
        M 50,33
        L 50,37
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
    } else {
      // Gender-neutral back view
      return `
        M 50,5
        C 42,5 37,11 37,19
        C 37,27 42,33 50,33
        C 58,33 63,27 63,19
        C 63,11 58,5 50,5
        Z
        M 50,33
        L 50,37
        M 39,40
        C 39,38 44,37 50,37
        C 56,37 61,38 61,40
        L 66,40
        C 70,40 73,43 74,48
        L 74,55
        L 80,72
        C 81,75 80,78 78,80
        L 76,82
        C 74,84 71,84 69,82
        L 66,78
        L 64,65
        L 61,65
        L 61,86
        L 60,90
        L 61,93
        C 61,95 60,97 58,98
        L 57,112
        L 59,138
        C 59,141 58,143 56,144
        L 54,146
        C 52,147 48,147 46,146
        L 44,144
        C 42,143 41,141 41,138
        L 43,112
        L 42,98
        C 40,97 39,95 39,93
        L 40,90
        L 39,86
        L 39,65
        L 36,65
        L 34,78
        L 31,82
        C 29,84 26,84 24,82
        L 22,80
        C 20,78 19,75 20,72
        L 26,55
        L 26,48
        C 27,43 30,40 34,40
        L 39,40
        Z
        M 44,49 L 56,49 L 56,57 L 44,57 Z
      `;
    }
  }
}

/**
 * AvatarBody Component
 *
 * Renders an SVG human body with configurable appearance.
 */
export const AvatarBody: React.FC<AvatarBodyComponentProps> = React.memo(({
  skinTone,
  genderPresentation,
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
      aria-label={`Patient avatar - ${genderPresentation} body, ${view} view`}
    >
      {/* Background */}
      <rect
        x="0"
        y="0"
        width="100"
        height="160"
        fill="transparent"
      />

      {/* Body Outline */}
      <g>
        {/* Main body fill */}
        <path
          d={getBodyPaths(genderPresentation, view)}
          fill={skinColor}
          stroke={outlineColor}
          strokeWidth="0.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Subtle shading for depth - left side shadow */}
        <path
          d={getBodyPaths(genderPresentation, view)}
          fill="url(#bodyShading)"
          opacity="0.15"
        />
      </g>

      {/* View indicator */}
      <text
        x="50"
        y="158"
        textAnchor="middle"
        fontSize="4"
        fill="#64748b"
        fontFamily="system-ui, sans-serif"
      >
        {view === 'front' ? 'FRONT' : 'BACK'}
      </text>

      {/* Gradient definitions for shading */}
      <defs>
        <linearGradient id="bodyShading" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Children (markers) are rendered on top */}
      {children}
    </svg>
  );
});

AvatarBody.displayName = 'AvatarBody';

export default AvatarBody;
