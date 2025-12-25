// src/pages/TermsOfService.tsx
import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const WELLFIT_BLUE = '#003865';
const WELLFIT_GREEN = '#8cc63f';
const GRADIENT = `linear-gradient(180deg, ${WELLFIT_GREEN} 0%, ${WELLFIT_BLUE} 100%)`;

type TermsProps = {
  lastUpdated?: string; // e.g., "September 2, 2025"
};

export default function TermsOfService({ lastUpdated = 'August 24, 2025' }: TermsProps) {
  const navigate = useNavigate();

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors no-print"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Print styles */}
      <style>{`
        @page { size: auto; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          .card { box-shadow: none !important; border: none !important; }
          a[href]:after { content: ''; }
        }
      `}</style>

      <div className="p-px rounded-2xl" style={{ background: GRADIENT }}>
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-md card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold mb-2" style={{ color: WELLFIT_BLUE }}>
                Terms of Service
              </h1>
              <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print text-sm px-3 py-2 rounded-sm bg-gray-100 border hover:bg-gray-200"
              aria-label="Print Terms of Service"
              title="Print"
            >
              Print
            </button>
          </div>

          {/* Table of contents for easy navigation */}
          <nav aria-label="Table of contents" className="no-print mt-4 mb-6">
            <ul className="list-disc ml-6 space-y-1 text-sm">
              <li><a href="#acceptance" className="underline text-blue-700">1. Acceptance of Terms</a></li>
              <li><a href="#eligibility" className="underline text-blue-700">2. Eligibility</a></li>
              <li><a href="#appropriate-use" className="underline text-blue-700">3. Appropriate Use</a></li>
              <li><a href="#health-info" className="underline text-blue-700">4. Health Information</a></li>
              <li><a href="#media-release" className="underline text-blue-700">5. Media and Story Release</a></li>
              <li><a href="#privacy" className="underline text-blue-700">6. Privacy</a></li>
              <li><a href="#security" className="underline text-blue-700">7. Account Security</a></li>
              <li><a href="#changes" className="underline text-blue-700">8. Changes to Terms</a></li>
              <li><a href="#liability" className="underline text-blue-700">9. Limitation of Liability</a></li>
              <li><a href="#contact" className="underline text-blue-700">10. Contact</a></li>
            </ul>
          </nav>

          <p className="mb-4">
            Welcome to WellFit Community, operated by WellFit Community, Inc. These Terms of Service
            govern your participation in our wellness programs, events, and digital platform.
          </p>

          <h2 id="acceptance" className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            1. Acceptance of Terms
          </h2>
          <p className="mb-4">
            By registering for, or participating in, WellFit Community, you agree to be bound by
            these terms.
          </p>

          <h2 id="eligibility" className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            2. Eligibility
          </h2>
          <p className="mb-4">
            Our programs are intended for adults and caregivers seeking wellness support.
            Participants must provide accurate and truthful information.
          </p>

          <h2 id="appropriate-use" className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            3. Appropriate Use
          </h2>
          <ul className="list-disc ml-6 space-y-1 mb-4">
            <li>Use the WellFit platform for lawful, positive purposes.</li>
            <li>Do not post offensive, abusive, or misleading content.</li>
            <li>Respect other community members’ privacy and dignity.</li>
          </ul>

          <h2 id="health-info" className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            4. Health Information
          </h2>
          <p className="mb-4">
            WellFit Community provides wellness tools, not medical advice. Always consult your
            healthcare provider for clinical concerns. Emergency contacts and self-reports are for
            support, not urgent medical care.
          </p>

          <h2 id="media-release" className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            5. Media and Story Release
          </h2>
          <p className="mb-4">
            Photos, videos, or stories shared on the platform may be used in community newsletters,
            grant reports, or promotions only with your written consent. You may withdraw this
            consent at any time by contacting our team.
          </p>

          <h2 id="privacy" className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            6. Privacy
          </h2>
          <p className="mb-4">
            See our{' '}
            <Link to="/privacy" className="underline text-blue-700">
              Privacy Policy
            </Link>{' '}
            for details on how your information is handled.
          </p>

          <h2 id="security" className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            7. Account Security
          </h2>
          <p className="mb-4">
            You are responsible for safeguarding your login information. Notify us immediately of
            unauthorized use.
          </p>

          <h2 id="changes" className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            8. Changes to Terms
          </h2>
          <p className="mb-4">
            We may update these terms at any time. Significant changes will be posted in-app or on
            our website.
          </p>

          <h2 id="liability" className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            9. Limitation of Liability
          </h2>
          <p className="mb-4">
            To the maximum extent permitted by law, WellFit Community is not liable for indirect,
            incidental, or consequential damages related to participation.
          </p>

          <h2 id="contact" className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            10. Contact
          </h2>
          <p>
            <strong>WellFit Community, Inc.</strong><br />
            <a href="mailto:info@thewellfitcommunity.org" className="underline text-blue-700">
              info@thewellfitcommunity.org
            </a>
            {' '}·{' '}
            <a href="tel:+18323155110" className="underline text-blue-700">
              (832) 315-5110
            </a>
          </p>

          <p className="mt-6">
            By continuing to use WellFit Community, you agree to these Terms of Service.
          </p>
        </div>
      </div>
    </main>
  );
}
