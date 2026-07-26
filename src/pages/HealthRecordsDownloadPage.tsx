// src/pages/HealthRecordsDownloadPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useBranding } from '../BrandingContext';
import { supabase } from '../lib/supabaseClient';
import { auditLogger } from '../services/auditLogger';
import { logPhiAccess } from '../hooks/usePhiAccessLogging';

type RecordType =
  | 'all'
  | 'appointments'
  | 'vitals'
  | 'medications'
  | 'allergies'
  | 'conditions'
  | 'immunizations'
  | 'care_plans';

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const HealthRecordsDownloadPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [selectedRecords, setSelectedRecords] = useState<RecordType[]>(['all']);
  const [selectedFormat, setSelectedFormat] = useState<string>('pdf');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const recordTypes: { id: RecordType; label: string; icon: string }[] = [
    { id: 'all', label: 'All Records', icon: '📋' },
    { id: 'appointments', label: 'Appointments', icon: '📹' },
    { id: 'vitals', label: 'Vitals & Labs', icon: '📊' },
    { id: 'medications', label: 'Medications', icon: '💊' },
    { id: 'allergies', label: 'Allergies', icon: '⚠️' },
    { id: 'conditions', label: 'Conditions', icon: '🩺' },
    { id: 'immunizations', label: 'Immunizations', icon: '💉' },
    { id: 'care_plans', label: 'Care Plans', icon: '📋' },
  ];

  const exportFormats: ExportFormat[] = [
    {
      id: 'pdf',
      name: 'PDF Document',
      description: 'Best for printing and sharing with providers',
      icon: '📄',
    },
    {
      id: 'fhir',
      name: 'FHIR Bundle (JSON)',
      description: 'Standard healthcare format for data portability',
      icon: '🏥',
    },
    {
      id: 'ccda',
      name: 'C-CDA Document',
      description: 'Compatible with most EHR systems',
      icon: '📑',
    },
    {
      id: 'csv',
      name: 'CSV Spreadsheet',
      description: 'For analysis in Excel or Google Sheets',
      icon: '📊',
    },
  ];

  const handleRecordToggle = (recordType: RecordType) => {
    if (recordType === 'all') {
      setSelectedRecords(['all']);
    } else {
      const newSelection = selectedRecords.filter(r => r !== 'all');
      if (newSelection.includes(recordType)) {
        setSelectedRecords(newSelection.filter(r => r !== recordType));
      } else {
        setSelectedRecords([...newSelection, recordType]);
      }
    }
  };

  const triggerFileDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /** Flatten a FHIR bundle into simple CSV rows (resource type, date, name, value, status). */
  const bundleToCsv = (bundle: { entry?: Array<{ resource?: Record<string, unknown> }> }): string => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = ['Record Type,Date,Name,Value,Status'];
    for (const entry of bundle.entry ?? []) {
      const r = entry.resource;
      if (!r) continue;
      const code = r.code as { text?: string; coding?: Array<{ display?: string }> } | undefined;
      const name =
        code?.text ?? code?.coding?.[0]?.display ??
        (r.medicationCodeableConcept as { text?: string } | undefined)?.text ??
        (r.vaccineCode as { text?: string } | undefined)?.text ?? '';
      const quantity = r.valueQuantity as { value?: number; unit?: string } | undefined;
      const value = quantity ? `${quantity.value ?? ''} ${quantity.unit ?? ''}`.trim() : '';
      const date =
        (r.effectiveDateTime as string | undefined) ??
        (r.onsetDateTime as string | undefined) ??
        (r.occurrenceDateTime as string | undefined) ??
        (r.authoredOn as string | undefined) ?? '';
      rows.push(
        [esc(r.resourceType), esc(date), esc(name), esc(value), esc(r.status)].join(',')
      );
    }
    return rows.join('\n');
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadComplete(false);
    setDownloadError(null);
    const dateStamp = new Date().toISOString().split('T')[0];

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;
      await logPhiAccess({
        resourceType: 'health_records_export',
        resourceId: userId,
        action: 'EXPORT',
        metadata: { format: selectedFormat },
      });

      if (selectedFormat === 'pdf') {
        // Real generator: pdf-health-summary returns print-ready HTML
        const { data, error } = await supabase.functions.invoke('pdf-health-summary', {});
        if (error || !data?.html) throw new Error(error?.message ?? 'No document returned');

        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          printWindow.onload = () => printWindow.print();
        } else {
          triggerFileDownload(data.html, `my-health-summary-${dateStamp}.html`, 'text/html');
        }
      } else if (selectedFormat === 'ccda') {
        const { data, error } = await supabase.functions.invoke('ccda-export', {});
        if (error || !data?.xml) throw new Error(error?.message ?? 'No document returned');
        triggerFileDownload(data.xml, `my-health-record-${dateStamp}.xml`, 'application/xml');
      } else {
        // FHIR bundle (also the source for the CSV flattening)
        const { data, error } = await supabase.functions.invoke('enhanced-fhir-export', {
          body: { format: 'bundle' },
        });
        if (error || !data) throw new Error(error?.message ?? 'No bundle returned');

        if (selectedFormat === 'csv') {
          triggerFileDownload(bundleToCsv(data), `my-health-records-${dateStamp}.csv`, 'text/csv');
        } else {
          triggerFileDownload(
            JSON.stringify(data, null, 2),
            `my-health-records-fhir-${dateStamp}.json`,
            'application/json'
          );
        }
      }

      setDownloadComplete(true);
    } catch (err: unknown) {
      await auditLogger.error(
        'HEALTH_RECORDS_EXPORT_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { format: selectedFormat }
      );
      setDownloadError(
        'We could not prepare your records right now. Please try again, or contact support if this keeps happening.'
      );
    }
    setIsDownloading(false);
  };

  return (
    <div className="min-h-screen pb-20" style={{ background: branding.gradient }}>
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl sm:text-7xl mb-4">📥</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 drop-shadow-lg">
            Download My Records
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-xl mx-auto drop-shadow-sm">
            Export your health information to share with providers or keep for your records
          </p>
        </div>

        {/* Success Message */}
        {downloadComplete && (
          <div className="bg-green-100 border border-green-400 text-green-700 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <div className="font-semibold">Download Complete!</div>
              <div className="text-sm">Your health records have been downloaded.</div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {downloadError && (
          <div className="bg-red-100 border border-red-400 text-red-700 rounded-2xl p-4 mb-6 flex items-center gap-3" role="alert">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="font-semibold">Download Failed</div>
              <div className="text-sm">{downloadError}</div>
            </div>
          </div>
        )}

        {/* Record Selection */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4" style={{ color: branding.primaryColor }}>
            Select Records to Include
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {recordTypes.map(record => (
              <button
                key={record.id}
                onClick={() => handleRecordToggle(record.id)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedRecords.includes(record.id) ||
                  (record.id !== 'all' && selectedRecords.includes('all'))
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">{record.icon}</span>
                <span className="font-medium text-gray-700">{record.label}</span>
                {(selectedRecords.includes(record.id) ||
                  (record.id !== 'all' && selectedRecords.includes('all'))) && (
                  <span className="ml-auto text-blue-500">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Format Selection */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4" style={{ color: branding.primaryColor }}>
            Choose Export Format
          </h2>
          <div className="space-y-3">
            {exportFormats.map(format => (
              <button
                key={format.id}
                onClick={() => setSelectedFormat(format.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedFormat === format.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="text-3xl">{format.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold text-gray-800">{format.name}</div>
                  <div className="text-sm text-gray-500">{format.description}</div>
                </div>
                {selectedFormat === format.id && <span className="text-blue-500 text-xl">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="bg-yellow-50 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <span className="text-2xl">🔒</span>
          <div className="text-sm text-yellow-800">
            <div className="font-semibold mb-1">Privacy Notice</div>
            Your health records contain sensitive information. Only download and share with trusted
            healthcare providers. Files are encrypted during transfer.
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={isDownloading || selectedRecords.length === 0}
          className="w-full py-4 rounded-xl font-bold text-xl text-white transition-all duration-300 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          style={{ backgroundColor: branding.primaryColor }}
        >
          {isDownloading ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>Preparing Download...</span>
            </>
          ) : (
            <>
              <span>📥</span>
              <span>Download My Records</span>
            </>
          )}
        </button>

        {/* Additional Options */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mt-6">
          <h2 className="text-2xl font-bold mb-4" style={{ color: branding.primaryColor }}>
            Other Options
          </h2>
          <div className="space-y-4">
            <button
              onClick={() => navigate('/doctors-view')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
            >
              <span className="text-2xl">👨‍⚕️</span>
              <div className="text-left">
                <div className="font-semibold text-gray-800">Share with Provider</div>
                <div className="text-sm text-gray-500">
                  Generate a secure link for your healthcare provider
                </div>
              </div>
            </button>
            <button
              onClick={() => navigate('/consent-management')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
            >
              <span className="text-2xl">📝</span>
              <div className="text-left">
                <div className="font-semibold text-gray-800">Manage Consent</div>
                <div className="text-sm text-gray-500">Control who can access your health data</div>
              </div>
            </button>
          </div>
        </div>

        {/* Back Button */}
        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/my-health')}
            aria-label="Go back to My Health"
            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold text-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <span className="text-2xl" aria-hidden="true">
              ←
            </span>
            <span>Back to My Health</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HealthRecordsDownloadPage;
