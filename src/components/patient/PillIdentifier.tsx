/**
 * Pill Identifier Component
 *
 * AI-powered pill identification to help seniors verify medications
 * Prevents dangerous mix-ups when pills get mixed between bottles
 */

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import {
  Camera,
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pill,
  Info,
  Shield,
  Eye,
  Search
} from 'lucide-react';
import medicationAPI from '../../api/medications';
import { Medication } from '../../api/medications';
import {
  PillIdentification,
  PillLabelComparison,
  formatPillDescription,
  getSeverityColor
} from '../../services/pillIdentifierService';

interface PillIdentifierProps {
  userId: string;
  medications: Medication[];
  mode: 'identify' | 'verify';
  selectedMedication?: Medication;
  onComplete?: () => void;
}

export function PillIdentifier({
  userId,
  medications,
  mode,
  selectedMedication,
  onComplete
}: PillIdentifierProps) {
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [identificationResult, setIdentificationResult] = useState<PillIdentification | null>(null);
  const [comparisonResult, setComparisonResult] = useState<PillLabelComparison | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Identify pill (standalone mode)
  const handleIdentifyPill = async () => {
    if (!selectedFile) {
      toast.error('Please select a pill image first');
      return;
    }

    setProcessing(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      const result = await medicationAPI.identifyPill(userId, selectedFile);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success && result.data?.identification.identification) {
        setIdentificationResult(result.data.identification.identification);
        toast.success('Pill identified successfully!', {
          icon: <Sparkles className="w-5 h-5" />
        });
      } else {
        toast.error(result.error || 'Failed to identify pill');
      }
    } catch (error) {
      toast.error('Error identifying pill');
    } finally {
      setProcessing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  // Verify pill matches label
  const handleVerifyPill = async (medicationId: string) => {
    if (!selectedFile) {
      toast.error('Please select a pill image first');
      return;
    }

    setProcessing(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      const result = await medicationAPI.comparePillWithLabel(userId, selectedFile, medicationId);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success && result.data?.comparison) {
        setComparisonResult(result.data.comparison);

        if (result.data.comparison.match) {
          toast.success('Pill matches label - Safe to take!', {
            icon: <CheckCircle className="w-5 h-5" />
          });
        } else if (result.data.comparison.requiresPharmacistReview) {
          toast.error('ALERT: Pill may not match label!', {
            icon: <AlertTriangle className="w-5 h-5" />
          });
        } else {
          toast.warning('Verification confidence is moderate - please review', {
            icon: <Info className="w-5 h-5" />
          });
        }
      } else {
        toast.error(result.error || 'Failed to verify pill');
      }
    } catch (error) {
      toast.error('Error verifying pill');
    } finally {
      setProcessing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  // Reset state
  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setIdentificationResult(null);
    setComparisonResult(null);
    setUploadProgress(0);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
          {mode === 'identify' ? (
            <>
              <Search className="w-6 h-6 text-blue-600" />
              Identify Unknown Pill
            </>
          ) : (
            <>
              <Shield className="w-6 h-6 text-green-600" />
              Verify Pill Matches Label
            </>
          )}
        </h2>
        <p className="text-gray-600">
          {mode === 'identify'
            ? 'Take a photo of a pill to identify what medication it is'
            : 'Verify the pill in your hand matches the medication label on the bottle'}
        </p>
      </div>

      {/* Safety Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Safety Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Take a clear, well-lit photo of the pill</li>
              <li>Ensure any text or numbers on the pill are visible</li>
              <li>If the pill doesn't match the label, DO NOT take it</li>
              <li>Contact your pharmacist if you have any doubts</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Image Upload Section */}
      {!selectedFile && !identificationResult && !comparisonResult && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
          <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-6 text-lg">
            Take a photo of the pill you want to {mode === 'identify' ? 'identify' : 'verify'}
          </p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            id="pill-image"
          />
          <label
            htmlFor="pill-image"
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl cursor-pointer inline-flex items-center gap-2 hover:shadow-lg transition-all transform hover:scale-105"
          >
            <Camera className="w-5 h-5" />
            Take Photo
          </label>
        </div>
      )}

      {/* Image Preview & Processing */}
      {selectedFile && !identificationResult && !comparisonResult && (
        <div className="space-y-6">
          {/* Preview */}
          <div className="relative">
            <img
              src={previewUrl || ''}
              alt="Pill preview"
              className="w-full max-w-md mx-auto rounded-lg shadow-md"
            />
            <button
              onClick={handleReset}
              className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Processing State */}
          {processing ? (
            <div className="py-8">
              <div className="flex items-center justify-center mb-6">
                <Sparkles className="w-16 h-16 text-blue-600 animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold text-center text-gray-700 mb-4">
                AI is analyzing the pill...
              </h3>
              <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
                <div
                  className="bg-gradient-to-r from-blue-600 to-purple-600 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-center text-gray-500">{uploadProgress}% complete</p>
            </div>
          ) : (
            <div className="space-y-4">
              {mode === 'identify' ? (
                <button
                  onClick={handleIdentifyPill}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 text-lg font-semibold"
                >
                  <Search className="w-6 h-6" />
                  Identify This Pill
                </button>
              ) : (
                <>
                  {selectedMedication ? (
                    <button
                      onClick={() => handleVerifyPill(selectedMedication.id)}
                      className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-4 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 text-lg font-semibold"
                    >
                      <Shield className="w-6 h-6" />
                      Verify Against: {selectedMedication.medication_name}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-gray-700 font-medium">Select medication to verify against:</p>
                      <div className="grid gap-2 max-h-64 overflow-y-auto">
                        {medications.map(med => (
                          <button
                            key={med.id}
                            onClick={() => handleVerifyPill(med.id)}
                            className="text-left bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-3 transition-all"
                          >
                            <p className="font-semibold text-gray-900">{med.medication_name}</p>
                            {med.strength && (
                              <p className="text-sm text-gray-600">{med.strength}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                onClick={handleReset}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Take Different Photo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Identification Results */}
      {identificationResult && (
        <IdentificationResults
          identification={identificationResult}
          onReset={handleReset}
          onComplete={onComplete}
        />
      )}

      {/* Comparison Results */}
      {comparisonResult && (
        <ComparisonResults
          comparison={comparisonResult}
          onReset={handleReset}
          onComplete={onComplete}
        />
      )}
    </div>
  );
}

// Identification Results Component
function IdentificationResults({
  identification,
  onReset,
  onComplete
}: {
  identification: PillIdentification;
  onReset: () => void;
  onComplete?: () => void;
}) {
  const confidenceColor =
    identification.confidence >= 0.85 ? 'green' :
    identification.confidence >= 0.70 ? 'yellow' : 'red';

  return (
    <div className="space-y-6">
      {/* Confidence Score */}
      <div className={`bg-${confidenceColor}-50 border border-${confidenceColor}-200 rounded-lg p-4`}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-gray-900">Identification Confidence:</span>
          <span className={`text-${confidenceColor}-700 font-bold text-lg`}>
            {Math.round(identification.confidence * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`bg-${confidenceColor}-500 h-full transition-all`}
            style={{ width: `${identification.confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Medication Info */}
      {identification.medicationName ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Pill className="w-6 h-6 text-blue-600" />
            Identified Medication
          </h3>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">Medication Name:</span>
              <p className="text-lg font-semibold text-gray-900">{identification.medicationName}</p>
            </div>
            {identification.genericName && (
              <div>
                <span className="text-sm text-gray-600">Generic Name:</span>
                <p className="font-medium text-gray-800">{identification.genericName}</p>
              </div>
            )}
            {identification.strength && (
              <div>
                <span className="text-sm text-gray-600">Strength:</span>
                <p className="font-medium text-gray-800">{identification.strength}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-900 mb-2">Unable to Identify Medication</p>
              <p className="text-sm text-yellow-800">
                The pill image quality or characteristics were not sufficient for identification.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pill Characteristics */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Eye className="w-5 h-5 text-gray-600" />
          Observed Characteristics
        </h4>
        <p className="text-gray-700">{formatPillDescription(identification.characteristics)}</p>
        {identification.characteristics.imprint && (
          <div className="mt-3 p-3 bg-white rounded border border-gray-200">
            <span className="text-sm text-gray-600">Imprint Code:</span>
            <p className="font-mono font-bold text-lg text-gray-900">
              {identification.characteristics.imprint}
            </p>
          </div>
        )}
      </div>

      {/* Alternative Matches */}
      {identification.alternativeMatches && identification.alternativeMatches.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-3">Other Possible Matches:</h4>
          <div className="space-y-2">
            {identification.alternativeMatches.map((match, idx) => (
              <div key={idx} className="bg-white rounded p-3 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{match.medicationName}</p>
                    {match.strength && (
                      <p className="text-sm text-gray-600">{match.strength}</p>
                    )}
                  </div>
                  <span className="text-sm text-blue-600 font-medium">
                    {Math.round(match.confidence * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {identification.warnings && identification.warnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              {identification.warnings.map((warning, idx) => (
                <p key={idx} className="text-sm text-red-800">{warning}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onReset}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          Identify Another Pill
        </button>
        {onComplete && (
          <button
            onClick={onComplete}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

// Comparison Results Component
function ComparisonResults({
  comparison,
  onReset,
  onComplete
}: {
  comparison: PillLabelComparison;
  onReset: () => void;
  onComplete?: () => void;
}) {
  const matchColor = comparison.match ? 'green' :
                     comparison.requiresPharmacistReview ? 'red' : 'yellow';

  return (
    <div className="space-y-6">
      {/* Overall Result */}
      <div className={`bg-${matchColor}-50 border-2 border-${matchColor}-300 rounded-xl p-6`}>
        <div className="flex items-start gap-4">
          {comparison.match ? (
            <CheckCircle className={`w-12 h-12 text-${matchColor}-600 flex-shrink-0`} />
          ) : (
            <XCircle className={`w-12 h-12 text-${matchColor}-600 flex-shrink-0`} />
          )}
          <div className="flex-1">
            <h3 className={`text-2xl font-bold text-${matchColor}-900 mb-2`}>
              {comparison.match ? 'VERIFIED: Pill Matches Label' : 'ALERT: Possible Mismatch'}
            </h3>
            <p className={`text-${matchColor}-800 text-lg`}>
              {comparison.safetyRecommendation}
            </p>
            <div className="mt-3">
              <span className="text-sm text-gray-600">Match Confidence:</span>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
                  <div
                    className={`bg-${matchColor}-500 h-full transition-all`}
                    style={{ width: `${comparison.matchConfidence * 100}%` }}
                  />
                </div>
                <span className="font-bold text-gray-900">
                  {Math.round(comparison.matchConfidence * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Discrepancies */}
      {comparison.discrepancies.length > 0 && (
        <div className="bg-white border border-red-200 rounded-lg p-6">
          <h4 className="font-bold text-red-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Discrepancies Found
          </h4>
          <div className="space-y-3">
            {comparison.discrepancies.map((disc, idx) => (
              <div
                key={idx}
                className={`border-l-4 border-${getSeverityColor(disc.severity)}-500 bg-${getSeverityColor(disc.severity)}-50 p-4 rounded`}
              >
                <p className="font-semibold text-gray-900 mb-1">
                  {disc.field.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Pill shows:</span>
                    <p className="font-medium text-gray-900">{disc.pillValue}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Label shows:</span>
                    <p className="font-medium text-gray-900">{disc.labelValue}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pharmacist Review Notice */}
      {comparison.requiresPharmacistReview && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Shield className="w-8 h-8 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-red-900 text-lg mb-2">
                Pharmacist Review Required
              </p>
              <p className="text-red-800 mb-3">
                Do not take this medication until you have confirmed with your pharmacist that it is safe.
                This could be a different medication or the wrong dosage.
              </p>
              <p className="text-sm text-red-700 font-medium">
                Contact your pharmacy immediately to verify this medication.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pill Details */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h5 className="font-semibold text-gray-900 mb-3">Pill Identification:</h5>
          {comparison.pillIdentification.medicationName ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Name:</span>
                <p className="font-medium">{comparison.pillIdentification.medicationName}</p>
              </div>
              {comparison.pillIdentification.strength && (
                <div>
                  <span className="text-gray-600">Strength:</span>
                  <p className="font-medium">{comparison.pillIdentification.strength}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Could not identify pill</p>
          )}
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h5 className="font-semibold text-gray-900 mb-3">Label Information:</h5>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Name:</span>
              <p className="font-medium">{comparison.labelInformation.medicationName}</p>
            </div>
            {comparison.labelInformation.strength && (
              <div>
                <span className="text-gray-600">Strength:</span>
                <p className="font-medium">{comparison.labelInformation.strength}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onReset}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          Verify Another Pill
        </button>
        {onComplete && (
          <button
            onClick={onComplete}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

export default PillIdentifier;
