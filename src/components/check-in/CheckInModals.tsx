/**
 * CheckInModals — Pulse oximeter, crisis options, crisis message, and emergency overlay modals.
 */

import React from 'react';
import PulseOximeter from '../PulseOximeter';
import type { CheckInModalsProps } from './CheckIn.types';

export const CheckInModals: React.FC<CheckInModalsProps> = ({
  showPulseOximeter,
  showCrisisOptions,
  showCrisisMessage,
  selectedCrisisOption,
  showEmergencyModal,
  emergencyContactPhone,
  onPulseOximeterComplete,
  onClosePulseOximeter,
  onCrisisOption,
  onCloseCrisis,
}) => (
  <>
    {/* Pulse Oximeter Modal */}
    {showPulseOximeter && (
      <PulseOximeter
        onMeasurementComplete={onPulseOximeterComplete}
        onClose={onClosePulseOximeter}
      />
    )}

    {/* Crisis Options Modal */}
    {showCrisisOptions && (
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crisis-options-title"
      >
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full mx-4">
          <h3 id="crisis-options-title" className="text-xl font-bold mb-4 text-[#003865] text-center">
            How can we help you?
          </h3>
          <div className="space-y-4">
            <button
              onClick={() => onCrisisOption('speak_someone')}
              className="w-full py-6 px-6 text-2xl bg-[#8cc63f] text-white font-bold rounded-xl hover:bg-[#77aa36] hover:scale-105 transform transition shadow-2xl"
            >
              <span className="text-4xl mb-2 block">💬</span>
              <span className="block leading-relaxed">Would you like to speak to someone?</span>
            </button>
            <button
              onClick={() => onCrisisOption('fallen_injured')}
              className="w-full py-6 px-6 text-2xl bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 hover:scale-105 transform transition shadow-2xl"
            >
              <span className="text-4xl mb-2 block">🚑</span>
              <span className="block leading-relaxed">I have fallen and injured myself</span>
            </button>
            <button
              onClick={() => onCrisisOption('lost')}
              className="w-full py-6 px-6 text-2xl bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 hover:scale-105 transform transition shadow-2xl"
            >
              <span className="text-4xl mb-2 block">🧭</span>
              <span className="block leading-relaxed">I am lost</span>
            </button>
            <button
              onClick={onCloseCrisis}
              className="w-full py-4 px-6 text-xl bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition mt-6"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Crisis Message Display */}
    {showCrisisMessage && selectedCrisisOption && (
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full mx-4 text-center">
          {selectedCrisisOption === 'speak_someone' && (
            <>
              <h3 className="text-xl font-bold mb-4 text-[#003865]">Crisis Support Available</h3>
              <p className="text-lg mb-4">
                If you&apos;re in crisis or need emotional support, please call or text the 988 Suicide &amp; Crisis Lifeline:
              </p>
              <a
                href="tel:988"
                className="inline-block py-3 px-6 bg-[#8cc63f] text-white font-bold text-xl rounded-lg shadow-md hover:bg-[#77aa36] transition mb-2"
              >
                📞 Call or Text 988
              </a>
              <p className="text-sm text-gray-600 mt-2">Available 24/7 for free, confidential support</p>
            </>
          )}
          {selectedCrisisOption === 'fallen_injured' && (
            <>
              <h3 className="text-xl font-bold mb-4 text-red-600">🚨 Emergency - Call 911</h3>
              <p className="text-lg mb-4">
                If you&apos;ve fallen and are injured, please call 911 immediately for emergency medical assistance.
              </p>
              <a
                href="tel:911"
                className="inline-block py-3 px-6 bg-red-600 text-white font-bold text-xl rounded-lg shadow-md hover:bg-red-700 transition"
              >
                📞 Call 911
              </a>
            </>
          )}
          {selectedCrisisOption === 'lost' && (
            <>
              <h3 className="text-xl font-bold mb-4 text-orange-600">🧭 You&apos;re Lost - Contact Emergency Contact</h3>
              <p className="text-lg mb-4">
                Please contact your emergency contact for help with directions and assistance.
              </p>
              {emergencyContactPhone ? (
                <a
                  href={`tel:${emergencyContactPhone}`}
                  className="inline-block py-3 px-6 bg-orange-500 text-white font-bold text-xl rounded-lg shadow-md hover:bg-orange-600 transition"
                >
                  📞 Call Emergency Contact
                </a>
              ) : (
                <p className="text-red-600 font-semibold">
                  No emergency contact phone number on file. Please call 911 if you need immediate assistance.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    )}

    {/* Emergency Overlay (Legacy - kept for compatibility) */}
    {showEmergencyModal && (
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emergency-modal-title"
      >
        <div className="bg-red-600 text-white p-6 rounded-xl shadow-lg max-w-sm text-center animate-pulse">
          <h3 id="emergency-modal-title" className="text-xl font-bold mb-2">
            🚨 Emergency Alert Triggered
          </h3>
          <p className="mb-3">Your check-in indicated an emergency. We&apos;ve logged this.</p>
          <p>
            If you are in immediate danger or need urgent medical attention, please call{' '}
            <strong>911</strong> or your local emergency number now.
          </p>
        </div>
      </div>
    )}
  </>
);

export default CheckInModals;
