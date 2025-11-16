/**
 * Law Enforcement Landing Page
 *
 * Dedicated landing page for law enforcement agencies (Constable, Sheriff)
 * Displays "Are You OK?" senior welfare check program information
 * Simplified UI focused on welfare checks, not medical features
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../BrandingContext';

export const LawEnforcementLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.appName}
                className="h-12 w-auto"
              />
            ) : (
              <div className="text-2xl font-bold text-white">
                {branding.appName}
              </div>
            )}
            <div className="flex gap-4">
              <button
                onClick={() => navigate('/register')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
              >
                Senior Registration
              </button>
              <button
                onClick={() => navigate('/admin-login')}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-blue-900 font-semibold rounded-lg transition-colors"
              >
                Officer Login
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500 rounded-full mb-6">
            <svg
              className="w-12 h-12 text-blue-900"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Are You OK? Senior Welfare Check Program
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            Protecting our seniors through daily check-ins and rapid emergency response coordination
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {/* Daily Check-Ins */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
            <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Daily Check-Ins</h3>
            <p className="text-blue-100">
              Seniors complete a simple daily check-in to confirm they're safe and well.
              Automated reminders via SMS if check-in is missed.
            </p>
          </div>

          {/* Dispatch Dashboard */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
            <div className="w-16 h-16 bg-yellow-500 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-blue-900"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Officer Dispatch</h3>
            <p className="text-blue-100">
              Real-time dashboard shows which seniors need welfare checks, prioritized by
              urgency and medical needs.
            </p>
          </div>

          {/* Emergency Info */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
            <div className="w-16 h-16 bg-red-500 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Response Information</h3>
            <p className="text-blue-100">
              Complete access information: door codes, mobility status, medical equipment,
              neighbor contacts, and special instructions.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-12 border border-white/10 mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h4 className="font-semibold text-white mb-2">Senior Enrollment</h4>
              <p className="text-blue-100 text-sm">
                Senior signs up and provides emergency access information
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h4 className="font-semibold text-white mb-2">Daily Check-In</h4>
              <p className="text-blue-100 text-sm">
                Senior completes daily check-in via phone or web app
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-blue-900 text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h4 className="font-semibold text-white mb-2">Alert Generated</h4>
              <p className="text-blue-100 text-sm">
                If check-in missed, system alerts dispatch dashboard
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
                4
              </div>
              <h4 className="font-semibold text-white mb-2">Welfare Check</h4>
              <p className="text-blue-100 text-sm">
                Officer performs welfare check with full access information
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Get Started Today</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg text-lg transition-colors shadow-lg"
            >
              Register as Senior
            </button>
            <button
              onClick={() => navigate('/admin-login')}
              className="px-8 py-4 bg-yellow-500 hover:bg-yellow-600 text-blue-900 font-semibold rounded-lg text-lg transition-colors shadow-lg"
            >
              Officer Access
            </button>
          </div>
          <p className="text-blue-200 mt-6">
            Questions? Contact your program coordinator or call{' '}
            <a href="tel:+1-555-WELFARE" className="underline hover:text-white">
              1-555-WELFARE
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/5 backdrop-blur-sm border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-blue-200 text-sm">
            {branding.customFooter || '© 2025 WellFit Community. All rights reserved.'}
            <br />
            <span className="text-xs text-blue-300 mt-2 block">
              Protecting seniors through technology and community partnership
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LawEnforcementLandingPage;
