import * as React from 'react';

const WELLFIT_BLUE = '#003865';
const WELLFIT_GREEN = '#8cc63f';
const GRADIENT = `linear-gradient(180deg, ${WELLFIT_GREEN} 0%, ${WELLFIT_BLUE} 100%)`;
const LAST_UPDATED = 'August 24, 2025';

export default function PrivacyPolicy() {
  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="p-[1px] rounded-2xl" style={{ background: GRADIENT }}>
        <div className="bg-white rounded-[1rem] p-6 sm:p-8 shadow-md">
          <h1 className="text-3xl font-extrabold mb-2" style={{ color: WELLFIT_BLUE }}>
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500 mb-6">Last updated: {LAST_UPDATED}</p>

          <p className="mb-4">
            Welcome to WellFit Community, a program provided by WellFit Community, Inc., in
            partnership with Vital Edge Healthcare Consulting, LLC and Envision VirtualEdge Group,
            LLC. Your privacy is important to us. This Privacy Policy explains how we collect, use,
            protect, and share your personal information.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            What Information We Collect
          </h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>
              <strong>Personal Information:</strong> Name, date of birth, phone number, address,
              emergency contact, health status, and other details you provide during enrollment.
            </li>
            <li>
              <strong>Health and Wellness Data:</strong> Self-reported check-ins, meals, fitness
              activity, emotional well-being, and health metrics.
            </li>
            <li>
              <strong>Media:</strong> Photos, videos, or stories you share with the community (only
              with your explicit consent).
            </li>
            <li>
              <strong>Technical Data:</strong> Device information, log data, and usage analytics to
              improve our platform.
            </li>
          </ul>

          <h2 className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            How We Use Your Information
          </h2>
          <p className="mb-4">
            We use your data to provide, personalize, and improve our wellness services; contact you
            for wellness reminders, alerts, or program updates; compile anonymous, aggregated data
            for research and reporting (no personal identities shared); and share success stories,
            testimonials, or community highlights (only with your separate consent).
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            How We Protect Your Data
          </h2>
          <p className="mb-4">
            We store your information in secure, encrypted databases. Access is limited to
            authorized team members and partners with a need to know. We follow privacy best
            practices and industry-standard safeguards.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            How We Share Your Information
          </h2>
          <p className="mb-4">
            WellFit Community, Inc. does <strong>not</strong> share your personal information with
            third parties or affiliates for marketing or promotional purposes. We only share your
            information with contracted service providers or partners as necessary to deliver
            services you have requested (for example, sending SMS notifications or processing
            check-ins). These parties are <strong>not permitted</strong> to use your information for
            their own marketing or promotional activities.
          </p>
          <p className="mb-4">
            You may opt out of receiving SMS communications at any time by replying <strong>STOP</strong> to
            any message you receive from us.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            SMS Messaging Consent
          </h2>
          <p className="mb-4">
            By providing your phone number and checking the consent box on our registration form,
            you expressly agree to receive SMS notifications and alerts from WellFit Community, Inc.
            Message frequency varies. Message and data rates may apply. Reply STOP at any time to
            unsubscribe.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            Compliance and Data Use
          </h2>
          <p className="mb-4">
            We collect, store, and process your information only to support your participation in
            WellFit Community programs and to provide you with requested services. We do not sell or
            lease your information to marketers, advertisers, or any other third party.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            Your Rights
          </h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>You may request access, corrections, or deletion of your data at any time.</li>
            <li>You can withdraw consent for media use or participation at any time.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            Changes to This Policy
          </h2>
          <p className="mb-4">
            We may update this Privacy Policy from time to time. We will notify you of major changes
            by posting in the app or on our website.
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2" style={{ color: WELLFIT_BLUE }}>
            Contact Us
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
            By using WellFit Community, you agree to this Privacy Policy.
          </p>
        </div>
      </div>
    </main>
  );
}
