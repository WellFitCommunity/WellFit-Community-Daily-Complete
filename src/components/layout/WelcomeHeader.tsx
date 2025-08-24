import React from 'react';

const WELLFIT_BLUE = '#003865';
const WELLFIT_GREEN = '#8cc63f';

// Green → subtle white glint → Blue
const GRADIENT = `linear-gradient(90deg, ${WELLFIT_GREEN} 0%, rgba(255,255,255,0.12) 48%, ${WELLFIT_BLUE} 100%)`;

export default function WelcomeHeader() {
  return (
    <header className="shadow-md" style={{ background: GRADIENT }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex flex-col">
            <span className="text-white text-2xl sm:text-3xl font-semibold tracking-tight">
              WellFit Community
            </span>
            <span className="text-white/80 text-sm sm:text-base">
              Move • Nourish • Connect
            </span>
          </div>
          <a
            href="https://www.TheWellFitCommunity.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium shadow hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ backgroundColor: WELLFIT_GREEN, color: '#fff' }}
          >
            Visit Website
          </a>
        </div>
      </div>
    </header>
  );
}
