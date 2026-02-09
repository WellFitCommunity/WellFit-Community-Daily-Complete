/**
 * ScannerView — AI medication label scanner
 *
 * Full-page scanner view for the "Scan Label" tab.
 * Handles file upload, processing progress, and scanned data review.
 */

import React from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  Info,
  CheckCircle
} from 'lucide-react';
import { ScannerViewProps } from './MedicineCabinet.types';

export const ScannerView: React.FC<ScannerViewProps> = ({
  processing,
  uploadProgress,
  scannedData,
  onScan,
  onConfirm
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onScan(file);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-8">
      {!scannedData ? (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Camera className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Scan Medication Label</h2>
            <p className="text-gray-600">AI will automatically extract all medication information</p>
          </div>

          {!processing ? (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-6">Take a clear photo of the prescription label</p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="scan-image"
              />
              <label
                htmlFor="scan-image"
                className="bg-linear-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl cursor-pointer inline-block hover:shadow-lg transition-all transform hover:scale-105"
              >
                <Camera className="w-5 h-5 inline mr-2" />
                Take Photo
              </label>
            </div>
          ) : (
            <div className="py-12">
              <div className="flex items-center justify-center mb-6">
                <Sparkles className="w-16 h-16 text-blue-600 animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold text-center text-gray-700 mb-4">
                AI is reading your medication label...
              </h3>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
                <div
                  className="bg-linear-to-r from-blue-600 to-purple-600 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-center text-gray-500">{uploadProgress}% complete</p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            Review Scanned Information
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">AI Confidence: {Math.round((scannedData.medication?.confidence || 0) * 100)}%</span>
            </div>
            <p className="text-sm text-blue-700">
              {scannedData.medication?.extractionNotes || 'Information extracted successfully'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name</label>
              <input
                type="text"
                defaultValue={scannedData.medication?.medicationName}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Strength/Dosage</label>
              <input
                type="text"
                defaultValue={scannedData.medication?.strength || scannedData.medication?.dosage}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <button
            onClick={() => scannedData.medication && onConfirm(scannedData.medication)}
            disabled={!scannedData.medication}
            className="w-full bg-linear-to-r from-green-600 to-blue-600 text-white py-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle className="w-5 h-5" />
            Confirm & Add to Cabinet
          </button>
        </div>
      )}
    </div>
  );
};
