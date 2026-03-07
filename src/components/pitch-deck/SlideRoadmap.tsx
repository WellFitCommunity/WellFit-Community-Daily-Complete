import React from 'react';
import type { SlideProps, TimelineItem } from './PitchDeckSlide.types';

const timeline: TimelineItem[] = [
  {
    quarter: 'Q4 2025',
    title: 'Foundation',
    description: 'Vite + React 19 migration, PostgreSQL 17, HIPAA audit trail, multi-tenant RLS',
    status: 'completed',
  },
  {
    quarter: 'Q1 2026',
    title: 'AI Platform & Zero Warnings',
    description: '40+ AI skills, 0 lint warnings (from 1,671), 10,893 tests, structured AI output',
    status: 'completed',
  },
  {
    quarter: 'Q2 2026',
    title: 'Hospital Pilot',
    description: 'First hospital deployment, FHIR R4 live interop, bed management in production',
    status: 'current',
  },
  {
    quarter: 'Q3 2026',
    title: 'RPM & Wearables',
    description: 'Remote patient monitoring, Apple Watch/Fitbit integration, CPT 99453-99458 billing',
    status: 'upcoming',
  },
  {
    quarter: 'Q4 2026',
    title: 'Scale & Certify',
    description: 'ONC certification, SOC 2 Type II audit, 50+ tenant deployments',
    status: 'upcoming',
  },
];

const statusStyles = {
  completed: {
    dot: 'bg-[#10B981]',
    ring: 'ring-[#10B981]/30',
    label: 'Completed',
    labelColor: 'text-[#10B981]',
    cardBorder: 'border-[#10B981]/40',
  },
  current: {
    dot: 'bg-[#C8E63D]',
    ring: 'ring-[#C8E63D]/30',
    label: 'In Progress',
    labelColor: 'text-[#C8E63D]',
    cardBorder: 'border-[#C8E63D]',
  },
  upcoming: {
    dot: 'bg-gray-500',
    ring: 'ring-gray-500/30',
    label: 'Planned',
    labelColor: 'text-gray-400',
    cardBorder: 'border-gray-700',
  },
};

const SlideRoadmap: React.FC<SlideProps> = ({ isActive, direction }) => {
  if (!isActive) return null;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center px-8 bg-[#111827] transition-all duration-500 ${
        direction !== 'none' ? 'animate-wf-slide-in' : 'animate-wf-fade-in'
      }`}
    >
      <div className="max-w-5xl w-full space-y-8">
        <div className="text-center">
          <span className="text-[#C8E63D] text-sm font-semibold uppercase tracking-widest">Roadmap</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mt-3">
            Where We&apos;re Going
          </h2>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#10B981] via-[#C8E63D] to-gray-700" />

          <div className="space-y-6">
            {timeline.map((item) => {
              const style = statusStyles[item.status];
              return (
                <div key={item.quarter} className="relative flex items-start gap-6 pl-2">
                  {/* Dot */}
                  <div className={`w-9 h-9 rounded-full ${style.dot} ring-4 ${style.ring} flex-shrink-0 flex items-center justify-center z-10`}>
                    {item.status === 'completed' && <span className="text-white text-sm">&#10003;</span>}
                    {item.status === 'current' && <span className="text-black text-xs font-bold">&#9679;</span>}
                  </div>

                  {/* Card */}
                  <div className={`flex-1 bg-white/5 border ${style.cardBorder} rounded-xl p-5 hover:bg-white/10 transition-colors`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-white font-bold">{item.quarter}</span>
                      <span className={`text-xs font-semibold ${style.labelColor} px-2 py-0.5 rounded-full bg-white/5`}>
                        {style.label}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold text-lg">{item.title}</h3>
                    <p className="text-gray-400 text-sm mt-1">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlideRoadmap;
