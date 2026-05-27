// ============================================================================
// Team Huddle - Section List
// ============================================================================

import React from 'react';
import { SignalChips } from './SignalChips';
import type { HuddleProvider } from './types';

export type SectionTone = 'urgent' | 'watch' | 'good' | 'muted';

interface SectionProps {
  title: string;
  tone: SectionTone;
  items: HuddleProvider[];
  emptyMessage: string;
  onNudge: (p: HuddleProvider) => void;
  onSchedule: (p: HuddleProvider) => void;
  onDiscuss: (p: HuddleProvider) => void;
  hideDiscussButton?: boolean;
}

const toneStyles: Record<
  SectionTone,
  { header: string; badge: string; card: string }
> = {
  urgent: {
    header: 'text-red-800',
    badge: 'bg-red-100 text-red-800 border-red-300',
    card: 'border-l-4 border-red-500 bg-white',
  },
  watch: {
    header: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    card: 'border-l-4 border-amber-500 bg-white',
  },
  good: {
    header: 'text-green-800',
    badge: 'bg-green-100 text-green-800 border-green-300',
    card: 'border-l-4 border-green-500 bg-white',
  },
  muted: {
    header: 'text-gray-500',
    badge: 'bg-gray-100 text-gray-600 border-gray-300',
    card: 'border-l-4 border-gray-300 bg-gray-50 opacity-75',
  },
};

export const HuddleSection: React.FC<SectionProps> = ({
  title,
  tone,
  items,
  emptyMessage,
  onNudge,
  onSchedule,
  onDiscuss,
  hideDiscussButton = false,
}) => {
  const styles = toneStyles[tone];
  return (
    <section className="mb-8" aria-labelledby={`huddle-section-${tone}`}>
      <div className="flex items-baseline justify-between mb-3">
        <h2
          id={`huddle-section-${tone}`}
          className={`text-2xl font-bold ${styles.header}`}
        >
          {title}
        </h2>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${styles.badge}`}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        emptyMessage ? (
          <p className="text-base text-gray-600 italic px-4">{emptyMessage}</p>
        ) : null
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li
              key={p.userId}
              className={`rounded-lg p-4 shadow-xs ${styles.card}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-[220px]">
                  <p className="text-lg font-semibold text-gray-900">
                    {p.fullName}
                  </p>
                  <p className="text-base text-gray-600">{p.roleLabel}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {p.lastCheckinDate
                      ? `Last check-in: ${p.lastCheckinDate}`
                      : 'No check-in on record'}
                  </p>
                  <SignalChips provider={p} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onNudge(p)}
                    aria-label={`Send check-in nudge to ${p.fullName}`}
                    className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-indigo-600 text-white text-base font-medium hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
                  >
                    Send nudge
                  </button>
                  <button
                    type="button"
                    onClick={() => onSchedule(p)}
                    aria-label={`Schedule 1:1 with ${p.fullName}`}
                    className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-white border-2 border-indigo-600 text-indigo-700 text-base font-medium hover:bg-indigo-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
                  >
                    Schedule 1:1
                  </button>
                  {!hideDiscussButton && (
                    <button
                      type="button"
                      onClick={() => onDiscuss(p)}
                      aria-label={`Mark ${p.fullName} as discussed`}
                      className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-gray-200 text-gray-800 text-base font-medium hover:bg-gray-300 focus:outline-hidden focus:ring-2 focus:ring-gray-400"
                    >
                      Mark discussed
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default HuddleSection;
