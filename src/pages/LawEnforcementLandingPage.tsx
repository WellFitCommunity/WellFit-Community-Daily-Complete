/**
 * Law Enforcement Landing Page
 *
 * Dedicated landing page for law enforcement agencies (Constable, Sheriff)
 * Displays The SHIELD Program (Senior & Health-Impaired Emergency Liaison Dispatch)
 * Design: Envision Atlus Clinical Design System
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../BrandingContext';
import { Shield, CheckCircle, LayoutDashboard, AlertTriangle, Users, Phone, ChevronRight } from 'lucide-react';

export const LawEnforcementLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-xs border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#00857a]/20 rounded-lg">
                <Shield className="h-8 w-8 text-[#00857a]" />
              </div>
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.appName}
                  className="h-10 w-auto"
                />
              ) : (
                <span className="text-xl font-bold text-white">
                  {branding.appName}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/register')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-700"
              >
                Senior Registration
              </button>
              <button
                onClick={() => navigate('/admin-login')}
                className="px-4 py-2 bg-[#00857a] hover:bg-[#006b63] text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                Officer Login
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-linear-to-br from-[#00857a] to-[#33bfb7] rounded-2xl mb-8 shadow-lg shadow-[#00857a]/20">
            <Shield className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-6">
            The SHIELD Program
          </h1>
          <p className="text-2xl text-[#33bfb7] mb-4">Senior & Health-Impaired Emergency Liaison Dispatch</p>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            Protecting our seniors through daily check-ins and rapid emergency response coordination
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {/* Daily Check-Ins */}
          <div className="bg-slate-800/50 backdrop-blur-xs rounded-xl p-8 border border-slate-700 hover:border-[#00857a]/50 transition-colors group">
            <div className="w-14 h-14 bg-[#00857a]/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#00857a]/30 transition-colors">
              <CheckCircle className="w-7 h-7 text-[#00857a]" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Daily Check-Ins</h3>
            <p className="text-slate-400">
              Seniors complete a simple daily check-in to confirm they're safe and well.
              Automated reminders via SMS if check-in is missed.
            </p>
          </div>

          {/* Dispatch Dashboard */}
          <div className="bg-slate-800/50 backdrop-blur-xs rounded-xl p-8 border border-slate-700 hover:border-[#00857a]/50 transition-colors group">
            <div className="w-14 h-14 bg-amber-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-amber-500/30 transition-colors">
              <LayoutDashboard className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Officer Dispatch</h3>
            <p className="text-slate-400">
              Real-time dashboard shows which seniors need welfare checks, prioritized by
              urgency and medical needs.
            </p>
          </div>

          {/* Emergency Info */}
          <div className="bg-slate-800/50 backdrop-blur-xs rounded-xl p-8 border border-slate-700 hover:border-[#00857a]/50 transition-colors group">
            <div className="w-14 h-14 bg-red-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-red-500/30 transition-colors">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Response Information</h3>
            <p className="text-slate-400">
              Complete access information: door codes, mobility status, medical equipment,
              neighbor contacts, and special instructions.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-slate-800/30 backdrop-blur-xs rounded-2xl p-12 border border-slate-700 mb-16">
          <h2 className="text-3xl font-bold text-white mb-10 text-center">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center relative">
              <div className="w-14 h-14 bg-linear-to-br from-[#00857a] to-[#33bfb7] rounded-xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-4 shadow-lg shadow-[#00857a]/20">
                1
              </div>
              <h4 className="font-semibold text-white mb-2">Senior Enrollment</h4>
              <p className="text-slate-400 text-sm">
                Senior signs up and provides emergency access information
              </p>
              <div className="hidden md:block absolute top-7 left-[60%] w-[80%] h-0.5 bg-linear-to-r from-[#00857a] to-transparent" />
            </div>
            <div className="text-center relative">
              <div className="w-14 h-14 bg-linear-to-br from-[#00857a] to-[#33bfb7] rounded-xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-4 shadow-lg shadow-[#00857a]/20">
                2
              </div>
              <h4 className="font-semibold text-white mb-2">Daily Check-In</h4>
              <p className="text-slate-400 text-sm">
                Senior completes daily check-in via phone or web app
              </p>
              <div className="hidden md:block absolute top-7 left-[60%] w-[80%] h-0.5 bg-linear-to-r from-[#00857a] to-transparent" />
            </div>
            <div className="text-center relative">
              <div className="w-14 h-14 bg-linear-to-br from-amber-500 to-amber-400 rounded-xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-4 shadow-lg shadow-amber-500/20">
                3
              </div>
              <h4 className="font-semibold text-white mb-2">Alert Generated</h4>
              <p className="text-slate-400 text-sm">
                If check-in missed, system alerts dispatch dashboard
              </p>
              <div className="hidden md:block absolute top-7 left-[60%] w-[80%] h-0.5 bg-linear-to-r from-amber-500 to-transparent" />
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-linear-to-br from-red-500 to-red-400 rounded-xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-4 shadow-lg shadow-red-500/20">
                4
              </div>
              <h4 className="font-semibold text-white mb-2">Welfare Check</h4>
              <p className="text-slate-400 text-sm">
                Officer performs welfare check with full access information
              </p>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
            <div className="text-4xl font-bold text-[#33bfb7] mb-2">24/7</div>
            <p className="text-slate-400">Monitoring Available</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
            <div className="text-4xl font-bold text-[#33bfb7] mb-2">&lt;2hr</div>
            <p className="text-slate-400">Response Time Goal</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
            <div className="text-4xl font-bold text-[#33bfb7] mb-2">100%</div>
            <p className="text-slate-400">HIPAA Compliant</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-linear-to-r from-[#00857a]/20 via-slate-800/50 to-[#00857a]/20 rounded-2xl p-12 border border-[#00857a]/30">
          <h2 className="text-3xl font-bold text-white mb-6">Get Started Today</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl text-lg transition-colors flex items-center justify-center gap-2 border border-slate-600"
            >
              <Users className="h-5 w-5" />
              Register as Senior
            </button>
            <button
              onClick={() => navigate('/admin-login')}
              className="px-8 py-4 bg-[#00857a] hover:bg-[#006b63] text-white font-semibold rounded-xl text-lg transition-colors shadow-lg shadow-[#00857a]/20 flex items-center justify-center gap-2"
            >
              <Shield className="h-5 w-5" />
              Officer Access
            </button>
          </div>
          <p className="text-slate-400">
            Questions? Contact your program coordinator or call{' '}
            <a href="tel:+1-555-WELFARE" className="text-[#33bfb7] hover:text-white transition-colors font-medium flex items-center justify-center gap-2 mt-2">
              <Phone className="h-4 w-4" />
              1-555-WELFARE
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 backdrop-blur-xs border-t border-slate-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-slate-500 text-sm">
              {branding.customFooter || '© 2025 WellFit Community. All rights reserved.'}
            </p>
            <p className="text-xs text-slate-600 mt-2">
              Envision Atlus Clinical Platform • Powered by Envision VirtualEdge Group
            </p>
            <p className="text-xs text-[#00857a] mt-1">
              Protecting seniors and vulnerable populations through technology and community partnership
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LawEnforcementLandingPage;
