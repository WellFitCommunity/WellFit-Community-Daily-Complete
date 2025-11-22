/**
 * Confirmation Screen Component for LiteSenderPortal
 * Lazy-loaded component shown after successful packet submission
 */

import React from 'react';
import { toast } from 'react-toastify';

interface LiteSenderConfirmationProps {
  packetNumber: string;
  accessUrl: string;
}

const LiteSenderConfirmation: React.FC<LiteSenderConfirmationProps> = ({
  packetNumber,
  accessUrl,
}) => {
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-green-600 mb-4">
          Transfer Packet Sent Successfully!
        </h2>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-2">Packet Number</p>
          <p className="text-xl font-mono font-bold text-green-700">
            {packetNumber}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-2">Secure Access Link</p>
          <p className="text-xs font-mono text-blue-700 break-all">
            {accessUrl}
          </p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(accessUrl);
              toast.success('Link copied to clipboard!');
            }}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            📋 Copy Link
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Share this secure link with the receiving facility. It expires in 72 hours.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Send Another Transfer
        </button>
      </div>
    </div>
  );
};

export default LiteSenderConfirmation;
