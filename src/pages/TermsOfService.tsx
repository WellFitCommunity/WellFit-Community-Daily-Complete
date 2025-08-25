import * as React from 'react';

const WELLFIT_BLUE = '#003865';
const WELLFIT_GREEN = '#8cc63f';
const GRADIENT = `linear-gradient(180deg, ${WELLFIT_GREEN} 0%, ${WELLFIT_BLUE} 100%)`;
const LAST_UPDATED = 'August 24, 2025';

export default function TermsOfService() {
  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="p-[1px] rounded-2xl" style={{ background: GRADIENT }}>
        <div className="bg-white rounded-[1rem] p-6 sm:p-8 shadow-md">
          <h1 className="text-3xl font-extrabold mb-2" style={{ color: WELLFIT_BLUE }}>
            Terms of Service
          </h1>
          <p className="text-sm text-gray-500 mb-6">Last updated: {LAST_UPDATED}</p>

          <p className="mb-4">
            Welcome to WellFit Community, operated by WellFit Community, Inc. These Terms of Service
            govern your participation in our wellness programs, events, and digital platform.
          </p>

          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: WELLFIT_BLUE }}>
            1. Acceptance of Terms
          </h2>
          <p className="mb-4">
            By registering for, or participating in, WellFit Community, you agree to be bound by
            these terms.
          </p>

          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: WELLFIT_BLUE }}>
            2. Eligibility
          </h2>
          <p className="mb-4">
            Our programs are intended for adults and caregivers seeking wellness support.
            Participants must provide accurate and truthful information.
          </p>

          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: WELLFIT_BLUE }}>
            3. Appropriate Use
          </h2>
          <ul className="list-disc ml-6 space-y-1 mb-4">
            <li>Use the WellFit platform for lawful, positive purposes.</li>
            <li>Do not post offensive, abusive, or misleading content.</li>
            <li>Respect other community members’ privacy and dignity.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: WELLFIT_BLUE }}>
            4. Health Information
          </h2>
          <p className="mb-4">
            WellFit Community provides wellness tools, not medical advice. Always consult your
            healthcare provider for clinical concerns. Emergency contacts and self-reports are for
            support, not urgent medical care.
          </p>

          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: WELLFIT_BLUE }}>
            5. Media and Story Release
          </h2>
          <p className="mb-4">
            Photos, videos, or stories shared on the platform may be used in community newsletters,
            grant reports, or promotions only with your written consent. You may withdraw this
            consent at any time by contacting our team.
          </p>

          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: WELLFIT_BLUE }}>
            6. Privacy
          </h2>
          <p className="mb-4">
            See our{' '}
            <a href="/privacy" className="underline text-blue-700">
              Privacy Policy
            </a>{' '}
            for details on how your information is handled.
          </p>

          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: WELLFIT_BLUE }}>
            7. Account Security
          </h2>
          <p className="mb-4">
            You are responsible for safeguarding your login information. Notify us immediately of
            unauthorized use.
          </p>

          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: WELLFIT_BLUE }}>
            8. Changes to Terms
          </h2>
          <p className="mb-4">
            We may update these terms at any time. Significant changes will be posted in-app or on
            our website.
          </p>

          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: WELLFIT_BLUE }}>
            9. Limitation of Liability
          </h2>
          <p className="mb-4">
            To the maximum extent permitted by law, WellFit Community is not liable for indirect,
            incidental, or consequential damages related to participation.
          </p>

          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: WELLFIT_BLUE }}>
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

