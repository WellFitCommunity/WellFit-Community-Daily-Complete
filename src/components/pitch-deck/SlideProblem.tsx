import React from 'react';
import type { SlideProps } from './PitchDeckSlide.types';

const problems = [
  {
    stat: '$52B',
    label: 'Annual cost of preventable readmissions',
    detail: 'Medicare penalizes hospitals up to 3% of reimbursements for excess readmissions.',
  },
  {
    stat: '27%',
    label: 'Of seniors discharged without follow-up',
    detail: 'Patients fall through the cracks between hospital discharge and community recovery.',
  },
  {
    stat: '68%',
    label: 'Of caregivers report burnout',
    detail: 'Family caregivers lack tools, visibility, and support from the care team.',
  },
  {
    stat: '3.2M',
    label: 'Seniors living in isolation',
    detail: 'Social isolation doubles the risk of hospital readmission within 30 days.',
  },
];

const SlideProblem: React.FC<SlideProps> = ({ isActive, direction }) => {
  if (!isActive) return null;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center px-8 bg-[#111827] transition-all duration-500 ${
        direction !== 'none' ? 'animate-wf-slide-in' : 'animate-wf-fade-in'
      }`}
    >
      <div className="max-w-5xl w-full space-y-8">
        <div className="text-center mb-10">
          <span className="text-[#EF4444] text-sm font-semibold uppercase tracking-widest">The Problem</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mt-3">
            The Gap Between Hospital & Home
          </h2>
          <p className="text-gray-400 text-lg mt-4 max-w-2xl mx-auto">
            Healthcare stops at the hospital door. Patients return home with no monitoring,
            no community support, and no connection to their care team.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {problems.map((item, i) => (
            <div
              key={item.stat}
              className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="text-4xl font-bold text-[#EF4444] mb-2">{item.stat}</div>
              <div className="text-white font-semibold text-lg mb-2">{item.label}</div>
              <div className="text-gray-400 text-sm">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SlideProblem;
