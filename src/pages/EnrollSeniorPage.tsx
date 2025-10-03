import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import AdminHeader from '../components/admin/AdminHeader';
import RequireAdminAuth from '../components/auth/RequireAdminAuth';

const EnrollSeniorPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string>('');

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isTestPatient, setIsTestPatient] = useState(false);
  const [testTag, setTestTag] = useState('');

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

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all required fields (First Name, Last Name, Phone)' });
      return;
    }

    // Validate phone format
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(phone)) {
      setMessage({ type: 'error', text: 'Phone must be in E.164 format (e.g., +15551234567)' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const tempPassword = generateSecurePassword();

      const enrollmentBody: any = {
        phone,
        password: tempPassword,
        first_name: firstName,
        last_name: lastName,
        email: email || undefined,
        caregiver_email: caregiverEmail || undefined,
        emergency_contact_name: emergencyContact || undefined,
        emergency_contact_phone: emergencyPhone || undefined,
        date_of_birth: dateOfBirth || undefined,
        notes: notes || undefined
      };

      // If test patient, use test_users function
      if (isTestPatient) {
        const { data, error } = await supabase.functions.invoke('test-users/create', {
          body: {
            phone,
            password: tempPassword,
            full_name: `${firstName} ${lastName}`,
            email: email || undefined,
            test_tag: testTag || undefined
          }
        });

        if (error) throw error;

        setMessage({
          type: 'success',
          text: `Test patient ${firstName} ${lastName} enrolled successfully!`
        });
      } else {
        // Regular enrollment
        const { data, error } = await supabase.functions.invoke('enrollClient', {
          body: enrollmentBody
        });

        if (error) throw error;

        setMessage({
          type: 'success',
          text: `${firstName} ${lastName} enrolled successfully!`
        });
      }

      setGeneratedPassword(tempPassword);

      // Reset form
      setTimeout(() => {
        setFirstName('');
        setLastName('');
        setPhone('');
        setEmail('');
        setDateOfBirth('');
        setEmergencyContact('');
        setEmergencyPhone('');
        setCaregiverEmail('');
        setNotes('');
        setTestTag('');
        setGeneratedPassword('');
      }, 10000); // Clear after 10 seconds
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: `Enrollment failed: ${error.message || 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="Enroll Senior Patient" showRiskAssessment={false} />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Back Button */}
          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center px-4 py-2 mb-6 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Admin
          </button>

          {/* Header Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center">
              <span className="text-4xl mr-4">➕</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Enroll Senior Patient</h1>
                <p className="text-gray-600 mt-1">Register a new senior patient into the WellFit system</p>
              </div>
            </div>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'
            }`}>
              <div className="flex items-start">
                <span className={`mr-2 text-xl ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {message.type === 'success' ? '✅' : '❌'}
                </span>
                <div className="flex-1">
                  <p className={`font-medium ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                    {message.text}
                  </p>
                  {generatedPassword && message.type === 'success' && (
                    <div className="mt-3 p-3 bg-white rounded border border-green-300">
                      <p className="text-sm font-medium text-gray-700 mb-1">Generated Password (save this!):</p>
                      <div className="flex items-center justify-between">
                        <code className="text-lg font-mono text-blue-600 bg-blue-50 px-3 py-2 rounded">
                          {generatedPassword}
                        </code>
                        <button
                          onClick={() => copyToClipboard(generatedPassword)}
                          className="ml-3 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Enrollment Form */}
          <form onSubmit={handleEnroll} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Patient Information</h2>

            {/* Required Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+15551234567"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Format: +1 followed by 10 digits</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="john.doe@email.com"
                />
              </div>
            </div>

            {/* Optional Fields */}
            <h3 className="text-md font-semibold text-gray-900 mb-3 mt-6">Additional Information (Optional)</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caregiver Email</label>
                <input
                  type="email"
                  value={caregiverEmail}
                  onChange={(e) => setCaregiverEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="caregiver@email.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+15559876543"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any additional notes or special instructions..."
              />
            </div>

            {/* Test Patient Section */}
            <div className="border-t border-gray-200 pt-4 mt-6">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="isTestPatient"
                  checked={isTestPatient}
                  onChange={(e) => setIsTestPatient(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isTestPatient" className="ml-2 block text-sm font-medium text-gray-700">
                  Mark as Test Patient (can be easily deleted later)
                </label>
              </div>

              {isTestPatient && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 mb-3">
                    ⚠️ Test patients can be bulk-deleted using the purge function. Add a test tag for easy identification.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Test Tag (Optional)</label>
                    <input
                      type="text"
                      value={testTag}
                      onChange={(e) => setTestTag(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., demo-2025, training-batch-1"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enrolling...
                  </>
                ) : (
                  <>
                    <span className="mr-2">✓</span>
                    Enroll Patient
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <div className="flex items-start">
              <span className="text-blue-600 mr-2 text-xl">🔒</span>
              <div className="text-sm">
                <p className="font-medium text-blue-800">Security & Compliance</p>
                <p className="text-blue-700 mt-1">
                  All enrollments generate secure temporary passwords. Patient data is encrypted and handled according to HIPAA requirements.
                  Make sure to securely share the generated password with the patient.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RequireAdminAuth>
  );
};

export default EnrollSeniorPage;
