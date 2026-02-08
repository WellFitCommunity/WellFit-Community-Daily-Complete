/**
 * StarVisualization — Reusable star rating display (1-5)
 *
 * Supports half-star ratings (e.g., 3.5).
 */

import React from 'react';
import { Star } from 'lucide-react';

interface StarVisualizationProps {
  rating: number | null;
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  label?: string;
}

const STAR_SIZES = {
  sm: { iconSize: 16, className: 'w-4 h-4' },
  md: { iconSize: 24, className: 'w-6 h-6' },
  lg: { iconSize: 32, className: 'w-8 h-8' },
};

function getStarColor(rating: number | null): string {
  if (rating === null) return 'text-slate-500';
  if (rating >= 4.5) return 'text-green-400';
  if (rating >= 3.5) return 'text-emerald-400';
  if (rating >= 2.5) return 'text-yellow-400';
  if (rating >= 1.5) return 'text-orange-400';
  return 'text-red-400';
}

export const StarVisualization: React.FC<StarVisualizationProps> = ({
  rating,
  maxStars = 5,
  size = 'md',
  showValue = true,
  label,
}) => {
  const config = STAR_SIZES[size];
  const displayRating = rating ?? 0;

  const stars = Array.from({ length: maxStars }, (_, i) => {
    const starIndex = i + 1;
    if (displayRating >= starIndex) return 'full';
    if (displayRating >= starIndex - 0.5) return 'half';
    return 'empty';
  });

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <p className="text-slate-400 text-sm">{label}</p>
      )}
      <div className="flex items-center gap-0.5">
        {stars.map((type, i) => (
          <div key={i} className="relative">
            {type === 'full' && (
              <Star
                className={`${config.className} ${getStarColor(rating)} fill-current`}
              />
            )}
            {type === 'half' && (
              <div className="relative">
                <Star className={`${config.className} text-slate-600`} />
                <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                  <Star
                    className={`${config.className} ${getStarColor(rating)} fill-current`}
                  />
                </div>
              </div>
            )}
            {type === 'empty' && (
              <Star className={`${config.className} text-slate-600`} />
            )}
          </div>
        ))}
      </div>
      {showValue && (
        <p className={`font-bold ${getStarColor(rating)} ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>
          {rating !== null ? rating.toFixed(1) : 'N/A'}
        </p>
      )}
    </div>
  );
};
