import React from 'react';
import type { SlideProps } from './PitchDeckSlide.types';

const metrics = [
  { value: '10,893', label: 'Automated Tests', sub: '100% pass rate, 429 suites', icon: '&#9745;' },
  { value: '248', label: 'Database Tables', sub: 'PostgreSQL 17 with RLS', icon: '&#9883;' },
  { value: '144', label: 'Edge Functions', sub: 'Supabase Deno runtime', icon: '&#9889;' },
  { value: '40+', label: 'AI Skills', sub: 'Claude-powered, pinned versions', icon: '&#9733;' },
  { value: '0', label: 'Lint Warnings', sub: 'Down from 1,671 in Jan 2026', icon: '&#9888;' },
  { value: '503', label: 'Service Files', sub: 'Enterprise service architecture', icon: '&#9881;' },
];

const compliance = [
  { label: 'HIPAA', detail: 'Full PHI protection, audit logging, encryption at rest' },
  { label: 'SOC 2', detail: 'Type II controls, access management, monitoring' },
  { label: 'HTI-2', detail: 'AI transparency, patient-facing descriptions' },
  { label: 'Cures Act', detail: '21st Century Cures Act compliant patient access' },
  { label: 'FHIR R4', detail: 'ONC-certified interoperability standard' },
  { label: 'HL7 v2', detail: 'Legacy system integration support' },
];

const SlideMetrics: React.FC<SlideProps> = ({ isActive, direction }) => {
  if (!isActive) return null;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center px-8 transition-all duration-500 ${
        direction !== 'none' ? 'animate-wf-slide-in' : 'animate-wf-fade-in'
      }`}
      style={{
        background: 'linear-gradient(135deg, #1BA39C 0%, #158A84 100%)',
      }}
    >
      <div className="max-w-5xl w-full space-y-8">
        <div className="text-center">
          <span className="text-[#C8E63D] text-sm font-semibold uppercase tracking-widest">By The Numbers</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mt-3">
            Enterprise-Grade. Proven.
          </h2>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 text-center hover:bg-white/15 transition-colors"
            >
              <div
                className="text-3xl font-bold text-[#C8E63D] mb-1"
                dangerouslySetInnerHTML={{ __html: m.value }}
              />
              <div className="text-white font-semibold text-sm">{m.label}</div>
              <div className="text-white/60 text-xs mt-1">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Compliance Bar */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-white font-bold text-lg mb-4 text-center">Compliance & Interoperability</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {compliance.map((c) => (
              <div key={c.label} className="flex items-start gap-3">
                <span className="text-[#C8E63D] font-bold text-sm mt-0.5 flex-shrink-0 w-14">
                  {c.label}
                </span>
                <span className="text-white/70 text-xs">{c.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlideMetrics;
