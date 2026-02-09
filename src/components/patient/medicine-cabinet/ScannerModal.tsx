/**
 * ScannerModal — Quick-scan modal overlay
 *
 * Lightweight modal for scanning a medication label from the header button.
 * Uses the same upload + progress pattern as ScannerView without the review step.
 */

import React from 'react';
import {
  Camera,
  Upload,
  Sparkles
} from 'lucide-react';
import { ScannerModalProps } from './MedicineCabinet.types';

export const ScannerModal: React.FC<ScannerModalProps> = ({
  onClose,
  onScan,
  processing,
  uploadProgress
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onScan(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Camera className="w-6 h-6 text-blue-600" />
          Scan Medication Label
        </h2>

        {!processing ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">Take a clear photo of the medication label</p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="medication-image"
              />
              <label
                htmlFor="medication-image"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg cursor-pointer inline-block hover:bg-blue-700 transition-colors"
              >
                Choose Image
              </label>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="py-8">
            <div className="flex items-center justify-center mb-4">
              <Sparkles className="w-12 h-12 text-blue-600 animate-pulse" />
            </div>
            <p className="text-center text-gray-700 mb-4">AI is reading the label...</p>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-linear-to-r from-blue-600 to-purple-600 h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">{uploadProgress}%</p>
          </div>
        )}
      </div>
    </div>
  );
};
