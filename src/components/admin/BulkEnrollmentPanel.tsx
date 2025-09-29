import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

interface EnrollmentRecord {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  notes?: string;
  caregiverEmail?: string;
  row: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  error?: string;
  userId?: string;
}

interface BulkEnrollmentJob {
  id: string;
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  failedCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  records: EnrollmentRecord[];
}

const BulkEnrollmentPanel: React.FC = () => {
  const { adminRole } = useAdminAuth();
  const [enrollmentJob, setEnrollmentJob] = useState<BulkEnrollmentJob | null>(null);
  const [csvData, setCsvData] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [previewRecords, setPreviewRecords] = useState<EnrollmentRecord[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const csvTemplate = `First Name,Last Name,Phone,Email,Date of Birth,Emergency Contact,Emergency Phone,Notes,Caregiver Email
John,Doe,+15551234567,john.doe@email.com,1945-03-15,Jane Doe,+15559876543,Regular checkups needed,jane.doe@email.com
Mary,Smith,+15551234568,mary.smith@email.com,1938-07-22,Bob Smith,+15559876544,Diabetes management,bob.smith@email.com`;

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bulk_enrollment_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
      alert('Please upload a CSV file only.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvData(content);
      parseAndValidateCsv(content);
    };
    reader.readAsText(file);
  };

  const parseAndValidateCsv = (csvContent: string) => {
    const lines = csvContent.trim().split('\n');
    const errors: string[] = [];
    const records: EnrollmentRecord[] = [];

    if (lines.length < 2) {
      errors.push('CSV file must contain at least a header row and one data row.');
      setValidationErrors(errors);
      return;
    }

    // Validate header
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const requiredHeaders = ['first name', 'last name', 'phone'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      errors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));

      if (row.length < 3) {
        errors.push(`Row ${i + 1}: Insufficient data (minimum: first name, last name, phone)`);
        continue;
      }

      const record: EnrollmentRecord = {
        firstName: row[0] || '',
        lastName: row[1] || '',
        phone: row[2] || '',
        email: row[3] || undefined,
        dateOfBirth: row[4] || undefined,
        emergencyContact: row[5] || undefined,
        emergencyPhone: row[6] || undefined,
        notes: row[7] || undefined,
        caregiverEmail: row[8] || undefined,
        row: i + 1,
        status: 'pending'
      };

      // Validate individual record
      const recordErrors = validateRecord(record);
      if (recordErrors.length > 0) {
        errors.push(`Row ${i + 1}: ${recordErrors.join(', ')}`);
      } else {
        records.push(record);
      }
    }

    setValidationErrors(errors);
    setPreviewRecords(records);
    setShowPreview(records.length > 0);
  };

  const validateRecord = (record: EnrollmentRecord): string[] => {
    const errors: string[] = [];

    if (!record.firstName.trim()) errors.push('First name is required');
    if (!record.lastName.trim()) errors.push('Last name is required');

    // Validate phone format (E.164)
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(record.phone)) {
      errors.push('Phone must be in E.164 format (+15551234567)');
    }

    // Validate email if provided
    if (record.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(record.email)) {
        errors.push('Invalid email format');
      }
    }

    // Validate caregiver email if provided
    if (record.caregiverEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(record.caregiverEmail)) {
        errors.push('Invalid caregiver email format');
      }
    }

    // Validate date of birth if provided
    if (record.dateOfBirth) {
      const date = new Date(record.dateOfBirth);
      if (isNaN(date.getTime()) || date > new Date()) {
        errors.push('Invalid date of birth');
      }
    }

    return errors;
  };

  const startBulkEnrollment = async () => {
    if (previewRecords.length === 0) {
      alert('No valid records to enroll');
      return;
    }

    const jobId = `enrollment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: BulkEnrollmentJob = {
      id: jobId,
      totalRecords: previewRecords.length,
      processedRecords: 0,
      successCount: 0,
      failedCount: 0,
      status: 'processing',
      startedAt: new Date(),
      records: [...previewRecords]
    };

    setEnrollmentJob(job);
    setShowPreview(false);

    // Process enrollments
    await processBulkEnrollment(job);
  };

  const processBulkEnrollment = async (job: BulkEnrollmentJob) => {
    const batchSize = 5; // Process 5 at a time to avoid overwhelming the system

    for (let i = 0; i < job.records.length; i += batchSize) {
      const batch = job.records.slice(i, i + batchSize);

      const promises = batch.map(async (record, batchIndex) => {
        const recordIndex = i + batchIndex;

        try {
          // Update record status to processing
          setEnrollmentJob(prev => prev ? {
            ...prev,
            records: prev.records.map((r, idx) =>
              idx === recordIndex ? { ...r, status: 'processing' } : r
            )
          } : null);

          // Generate secure password
          const tempPassword = generateSecurePassword();

          // Call enrollment function
          const { data, error } = await supabase.functions.invoke('enrollClient', {
            body: {
              phone: record.phone,
              password: tempPassword,
              first_name: record.firstName,
              last_name: record.lastName,
              email: record.email,
              caregiver_email: record.caregiverEmail,
              emergency_contact_name: record.emergencyContact,
              emergency_contact_phone: record.emergencyPhone,
              date_of_birth: record.dateOfBirth,
              notes: record.notes
            }
          });

          if (error) throw error;

          // Update record as successful
          setEnrollmentJob(prev => prev ? {
            ...prev,
            processedRecords: prev.processedRecords + 1,
            successCount: prev.successCount + 1,
            records: prev.records.map((r, idx) =>
              idx === recordIndex ? {
                ...r,
                status: 'success',
                userId: data?.user?.id
              } : r
            )
          } : null);

        } catch (error) {
          // Update record as failed
          setEnrollmentJob(prev => prev ? {
            ...prev,
            processedRecords: prev.processedRecords + 1,
            failedCount: prev.failedCount + 1,
            records: prev.records.map((r, idx) =>
              idx === recordIndex ? {
                ...r,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error'
              } : r
            )
          } : null);
        }
      });

      await Promise.all(promises);

      // Small delay between batches
      if (i + batchSize < job.records.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Mark job as completed
    setEnrollmentJob(prev => prev ? {
      ...prev,
      status: 'completed',
      completedAt: new Date()
    } : null);
  };

  const generateSecurePassword = (): string => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const all = lowercase + uppercase + numbers + symbols;

    const pick = (pool: string) => {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return pool[array[0] % pool.length];
    };

    // Ensure at least one character from each category
    const password = [
      pick(lowercase),
      pick(uppercase),
      pick(numbers),
      pick(symbols)
    ];

    // Fill remaining length with random characters
    for (let i = 4; i < 12; i++) {
      password.push(pick(all));
    }

    // Shuffle array
    for (let i = password.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [password[i], password[j]] = [password[j], password[i]];
    }

    return password.join('');
  };

  const resetEnrollment = () => {
    setEnrollmentJob(null);
    setCsvData('');
    setPreviewRecords([]);
    setShowPreview(false);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const exportResults = () => {
    if (!enrollmentJob) return;

    const csvContent = [
      'Row,First Name,Last Name,Phone,Status,Error,User ID',
      ...enrollmentJob.records.map(record =>
        `${record.row},"${record.firstName}","${record.lastName}","${record.phone}","${record.status}","${record.error || ''}","${record.userId || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `enrollment_results_${enrollmentJob.startedAt.toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: EnrollmentRecord['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="mr-3">👥</span>
              Bulk Patient Enrollment
            </h1>
            <p className="text-gray-600 mt-1">Upload CSV file to enroll multiple patients at once</p>
          </div>
          {enrollmentJob && (
            <button
              onClick={resetEnrollment}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
            >
              Start New Enrollment
            </button>
          )}
        </div>
      </div>

      {!enrollmentJob && (
        <>
          {/* Upload Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Upload CSV File</h2>
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                📥 Download Template
              </button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <div className="text-4xl mb-4">📄</div>
                <div className="text-lg font-medium text-gray-900 mb-2">
                  Choose CSV file or drag and drop
                </div>
                <div className="text-sm text-gray-500">
                  Maximum 1000 records per upload
                </div>
              </label>
            </div>

            {validationErrors.length > 0 && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-medium text-red-800 mb-2">Validation Errors:</h3>
                <ul className="text-sm text-red-700 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Preview Section */}
          {showPreview && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Preview ({previewRecords.length} valid records)
                </h2>
                <button
                  onClick={startBulkEnrollment}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  Start Enrollment
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emergency</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewRecords.slice(0, 10).map((record, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.row}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {record.firstName} {record.lastName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.phone}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.email || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {record.emergencyContact || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRecords.length > 10 && (
                  <div className="text-center py-4 text-sm text-gray-500">
                    ... and {previewRecords.length - 10} more records
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Enrollment Progress */}
      {enrollmentJob && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Enrollment Progress</h2>
            {enrollmentJob.status === 'completed' && (
              <button
                onClick={exportResults}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                📊 Export Results
              </button>
            )}
          </div>

          {/* Progress Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{enrollmentJob.totalRecords}</div>
              <div className="text-sm text-gray-600">Total Records</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{enrollmentJob.processedRecords}</div>
              <div className="text-sm text-gray-600">Processed</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{enrollmentJob.successCount}</div>
              <div className="text-sm text-gray-600">Successful</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{enrollmentJob.failedCount}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>

          {/* Progress Bar */}
          {enrollmentJob.status === 'processing' && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Processing...</span>
                <span>{Math.round((enrollmentJob.processedRecords / enrollmentJob.totalRecords) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(enrollmentJob.processedRecords / enrollmentJob.totalRecords) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {enrollmentJob.records.map((record, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-gray-900">{record.row}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {record.firstName} {record.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{record.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600">{record.error || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <span className="text-blue-600 mr-2">🔒</span>
          <div className="text-sm">
            <p className="font-medium text-blue-800">Security & Compliance</p>
            <p className="text-blue-700 mt-1">
              All enrollments generate secure temporary passwords and are logged for audit purposes.
              Patient data is encrypted and handled according to HIPAA requirements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkEnrollmentPanel;