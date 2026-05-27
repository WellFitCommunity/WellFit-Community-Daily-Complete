// ============================================================================
// Team Huddle - Signal Chips
// ============================================================================

import React from 'react';
import {
  ENERGY_URGENT,
  ENERGY_WATCH_HIGH,
  MOOD_URGENT,
  MOOD_WATCH_HIGH,
  STRESS_URGENT,
  STRESS_WATCH_LOW,
  type HuddleProvider,
} from './types';

type ChipTone = 'red' | 'amber' | 'gray';

const toneClass = (t: ChipTone): string =>
  t === 'red'
    ? 'bg-red-100 text-red-800 border-red-300'
    : t === 'amber'
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-gray-100 text-gray-700 border-gray-300';

export const SignalChips: React.FC<{ provider: HuddleProvider }> = ({
  provider,
}) => {
  const s = provider.signals;
  if (!s) {
    return <p className="mt-2 text-sm text-gray-600">No signals on file.</p>;
  }

  const chips: { label: string; tone: ChipTone }[] = [];

  if (s.stress_level != null) {
    chips.push({
      label: `Stress ${s.stress_level}`,
      tone:
        s.stress_level >= STRESS_URGENT
          ? 'red'
          : s.stress_level >= STRESS_WATCH_LOW
          ? 'amber'
          : 'gray',
    });
  }
  if (s.energy_level != null) {
    chips.push({
      label: `Energy ${s.energy_level}`,
      tone:
        s.energy_level <= ENERGY_URGENT
          ? 'red'
          : s.energy_level <= ENERGY_WATCH_HIGH
          ? 'amber'
          : 'gray',
    });
  }
  if (s.mood_rating != null) {
    chips.push({
      label: `Mood ${s.mood_rating}`,
      tone:
        s.mood_rating <= MOOD_URGENT
          ? 'red'
          : s.mood_rating <= MOOD_WATCH_HIGH
          ? 'amber'
          : 'gray',
    });
  }
  if (s.unsafe_staffing) chips.push({ label: 'Unsafe staffing', tone: 'red' });
  if (s.felt_overwhelmed) chips.push({ label: 'Overwhelmed', tone: 'red' });
  if (s.missed_break) chips.push({ label: 'Missed break', tone: 'amber' });

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <span
          key={`${c.label}-${i}`}
          className={`inline-flex items-center px-2 py-0.5 rounded-sm text-sm font-medium border ${toneClass(
            c.tone
          )}`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
};

export default SignalChips;
