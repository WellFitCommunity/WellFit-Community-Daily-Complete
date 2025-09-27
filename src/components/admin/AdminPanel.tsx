import React from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import RequireAdminAuth from 'components/auth/RequireAdminAuth';

import UsersList from './UsersList';
import ReportsSection from './ReportsSection';
import ExportCheckIns from './ExportCheckIns';
import ApiKeyManager from './ApiKeyManager';
import ClaudeTestWidget from './ClaudeTestWidget';
import FhirAiDashboard from './FhirAiDashboard';

type AdminRole = 'admin' | 'super_admin';

interface EnrollmentError {
  message: string;
  field?: string;
}

interface EnrollmentFormData {
  first: string;
  last: string;
  phone: string;
  email: string;
  temp: string;
  caregiverEmail?: string;
  emergencyContactName?: string;
  notes?: string;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

// Enhanced Toast component with better styling and animation
function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  React.useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 5000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const styles = {
    success: 'bg-green-500 border-green-600',
    error: 'bg-red-500 border-red-600',
    info: 'bg-blue-500 border-blue-600',
    warning: 'bg-yellow-500 border-yellow-600 text-black'
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  return (
    <div className={`${styles[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg border-l-4 flex items-center justify-between min-w-[20rem] transform transition-all duration-300 ease-in-out animate-slide-in`}>
      <div className="flex items-center">
        <span className="mr-2 font-bold text-lg">{icons[toast.type]}</span>
        <span className="text-sm">{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-4 hover:opacity-75 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 rounded"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

// Enhanced Toast container with better positioning
function ToastContainer({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// Enhanced enrollment section with additional fields
function EnrollPatientSection() {
  const [formData, setFormData] = React.useState<EnrollmentFormData>({
    first: '',
    last: '',
    phone: '',
    email: '',
    temp: genTemp(),
    caregiverEmail: '',
    emergencyContactName: '',
    notes: ''
  });
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const [showAdvancedFields, setShowAdvancedFields] = React.useState(false);

  // Form field refs for accessibility
  const formRefs = React.useRef<Record<keyof EnrollmentFormData, HTMLInputElement | HTMLTextAreaElement | null>>({
    first: null,
    last: null,
    phone: null,
    email: null,
    temp: null,
    caregiverEmail: null,
    emergencyContactName: null,
    notes: null
  });

  const addToast = React.useCallback((type: ToastMessage['type'], message: string, duration?: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message, duration }]);
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Enhanced validation functions
  const validateField = (field: keyof EnrollmentFormData, value: string): string => {
    switch (field) {
      case 'first':
      case 'last':
        if (!value.trim()) return `${field === 'first' ? 'First' : 'Last'} name is required`;
        if (value.length < 2) return `${field === 'first' ? 'First' : 'Last'} name must be at least 2 characters`;
        if (!/^[a-zA-Z\s'-]+$/.test(value)) return 'Name contains invalid characters';
        return '';
      case 'phone':
        if (!value.trim()) return 'Phone number is required';
        if (!isE164(value)) return 'Phone must be in E.164 format (e.g., +15551234567)';
        return '';
      case 'email':
      case 'caregiverEmail':
        if (value.trim() && !isValidEmail(value)) return 'Please enter a valid email address';
        return '';
      case 'temp':
        if (!value.trim()) return 'Temporary password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
        }
        return '';
      case 'emergencyContactName':
        if (value.trim() && !/^[a-zA-Z\s'-]+$/.test(value)) return 'Contact name contains invalid characters';
        return '';
      case 'notes':
        if (value.length > 500) return 'Notes cannot exceed 500 characters';
        return '';
      default:
        return '';
    }
  };

  // FIXED: Return first invalid field for reliable focus management
  const validateForm = (): { valid: boolean; firstInvalid: keyof EnrollmentFormData | null } => {
    const newErrors: Record<string, string> = {};
    let firstInvalid: keyof EnrollmentFormData | null = null;
    
    (Object.entries(formData) as [keyof EnrollmentFormData, string][]).forEach(([field, value]) => {
      const error = validateField(field, value || '');
      if (error) {
        newErrors[field as string] = error;
        if (!firstInvalid) firstInvalid = field;
      }
    });

    // Additional cross-field validation
    if (formData.caregiverEmail && !formData.emergencyContactName) {
      newErrors.emergencyContactName = 'Emergency contact name is required when caregiver email is provided';
      if (!firstInvalid) firstInvalid = 'emergencyContactName';
    }

    setErrors(newErrors);
    return { valid: Object.keys(newErrors).length === 0, firstInvalid };
  };

  const handleFieldChange = (field: keyof EnrollmentFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // FIXED: Remove error key instead of setting empty string
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }

    // Real-time validation for critical fields
    if (['phone', 'email', 'caregiverEmail', 'temp'].includes(field) && value.trim()) {
      const error = validateField(field, value);
      if (error) {
        setErrors(prev => ({ ...prev, [field]: error }));
      }
    }
  };

  const resetForm = () => {
    setFormData({
      first: '',
      last: '',
      phone: '',
      email: '',
      temp: genTemp(),
      caregiverEmail: '',
      emergencyContactName: '',
      notes: ''
    });
    setErrors({});
    setShowAdvancedFields(false);
  };

  // FIXED: Check for actual error messages, not just error keys
  const canEnroll = React.useMemo(() => {
    const requiredFieldsFilled = !!(
      formData.first.trim() && 
      formData.last.trim() && 
      isE164(formData.phone) && 
      formData.temp.trim()
    );
    const hasErrors = Object.values(errors).some(msg => !!msg);
    return requiredFieldsFilled && !hasErrors;
  }, [formData, errors]);

  async function enroll() {
    // FIXED: Use returned firstInvalid field for reliable focus
    const { valid, firstInvalid } = validateForm();
    if (!valid) {
      addToast('error', 'Please fix the form errors before submitting');
      if (firstInvalid) {
        formRefs.current[firstInvalid]?.focus();
      }
      return;
    }

    setBusy(true);
    
    try {
      const enrollmentData = {
        phone: formData.phone,
        password: formData.temp,
        first_name: formData.first,
        last_name: formData.last,
        email: formData.email || undefined,
        caregiver_email: formData.caregiverEmail || undefined,
        emergency_contact_name: formData.emergencyContactName || undefined,
        notes: formData.notes || undefined,
      };

      const { data, error } = await supabase.functions.invoke('enrollClient', {
        body: enrollmentData,
      });

      if (error) {
        const errorMessage = error.message || 'Unknown error occurred';
        addToast('error', `Enrollment failed: ${errorMessage}`, 7000);
        return;
      }

      // Success with enhanced feedback
      const successMessage = `${formData.first} ${formData.last} enrolled successfully!`;
      addToast('success', successMessage, 6000);
      
      if (formData.temp) {
        // Copy temp password to clipboard if available
        if (navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(formData.temp);
            addToast('info', 'Temporary password copied to clipboard', 3000);
          } catch {
            addToast('info', `Temporary password: ${formData.temp}`, 8000);
          }
        } else {
          addToast('info', `Temporary password: ${formData.temp}`, 8000);
        }
      }

      resetForm();
      formRefs.current.first?.focus();
      
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      addToast('error', `Enrollment failed: ${errorMessage}`, 7000);
    } finally {
      setBusy(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && canEnroll && !busy) {
      enroll();
    }
  };

  const handleBulkEnroll = () => {
    // Placeholder for bulk enrollment feature
    addToast('info', 'Bulk enrollment feature coming soon!');
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <section className="mt-6 border rounded-xl p-6 bg-gradient-to-br from-white to-gray-50">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-blue-800">Enroll a Patient</h2>
          <div className="space-x-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFields(!showAdvancedFields)}
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              {showAdvancedFields ? 'Hide' : 'Show'} Advanced Options
            </button>
            <button
              type="button"
              onClick={handleBulkEnroll}
              className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              Bulk Enroll
            </button>
          </div>
        </div>

        <div className="grid gap-4 max-w-2xl">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                ref={el => formRefs.current.first = el}
                id="firstName"
                className={`border p-3 rounded-md w-full transition-colors ${
                  errors.first ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="First name"
                value={formData.first}
                onChange={handleFieldChange('first')}
                onKeyDown={handleKeyDown}
                aria-describedby={errors.first ? "firstName-error" : undefined}
                aria-invalid={!!errors.first}
              />
              {errors.first && <p id="firstName-error" className="text-red-500 text-xs mt-1">{errors.first}</p>}
            </div>
            
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                ref={el => formRefs.current.last = el}
                id="lastName"
                className={`border p-3 rounded-md w-full transition-colors ${
                  errors.last ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="Last name"
                value={formData.last}
                onChange={handleFieldChange('last')}
                onKeyDown={handleKeyDown}
                aria-describedby={errors.last ? "lastName-error" : undefined}
                aria-invalid={!!errors.last}
              />
              {errors.last && <p id="lastName-error" className="text-red-500 text-xs mt-1">{errors.last}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                ref={el => formRefs.current.phone = el}
                id="phone"
                className={`border p-3 rounded-md w-full transition-colors ${
                  errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="+15551234567"
                value={formData.phone}
                onChange={handleFieldChange('phone')}
                onKeyDown={handleKeyDown}
                type="tel"
                pattern="^\+[0-9]{10,15}$"
                aria-describedby={errors.phone ? "phone-error" : "phone-help"}
                aria-invalid={!!errors.phone}
              />
              {errors.phone ? (
                <p id="phone-error" className="text-red-500 text-xs mt-1">{errors.phone}</p>
              ) : (
                <p id="phone-help" className="text-gray-500 text-xs mt-1">Format: +countrycode followed by 10-15 digits</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email (Optional)
              </label>
              <input
                ref={el => formRefs.current.email = el}
                id="email"
                className={`border p-3 rounded-md w-full transition-colors ${
                  errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="patient@example.com"
                value={formData.email}
                onChange={handleFieldChange('email')}
                onKeyDown={handleKeyDown}
                type="email"
                aria-describedby={errors.email ? "email-error" : undefined}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p id="email-error" className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Advanced Fields */}
          {showAdvancedFields && (
            <div className="border-t pt-4 mt-4 space-y-4">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Emergency Contact Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="caregiverEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Caregiver Email
                  </label>
                  <input
                    ref={el => formRefs.current.caregiverEmail = el}
                    id="caregiverEmail"
                    className={`border p-3 rounded-md w-full transition-colors ${
                      errors.caregiverEmail ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder="caregiver@example.com"
                    value={formData.caregiverEmail}
                    onChange={handleFieldChange('caregiverEmail')}
                    type="email"
                    aria-describedby={errors.caregiverEmail ? "caregiverEmail-error" : "caregiverEmail-help"}
                    aria-invalid={!!errors.caregiverEmail}
                  />
                  {errors.caregiverEmail ? (
                    <p id="caregiverEmail-error" className="text-red-500 text-xs mt-1">{errors.caregiverEmail}</p>
                  ) : (
                    <p id="caregiverEmail-help" className="text-gray-500 text-xs mt-1">Will receive emergency alerts</p>
                  )}
                </div>

                <div>
                  <label htmlFor="emergencyContactName" className="block text-sm font-medium text-gray-700 mb-1">
                    Emergency Contact Name
                  </label>
                  <input
                    ref={el => formRefs.current.emergencyContactName = el}
                    id="emergencyContactName"
                    className={`border p-3 rounded-md w-full transition-colors ${
                      errors.emergencyContactName ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder="Contact name"
                    value={formData.emergencyContactName}
                    onChange={handleFieldChange('emergencyContactName')}
                    aria-describedby={errors.emergencyContactName ? "emergencyContactName-error" : undefined}
                    aria-invalid={!!errors.emergencyContactName}
                  />
                  {errors.emergencyContactName && (
                    <p id="emergencyContactName-error" className="text-red-500 text-xs mt-1">{errors.emergencyContactName}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  ref={el => formRefs.current.notes = el}
                  id="notes"
                  className={`border p-3 rounded-md w-full h-20 transition-colors resize-none ${
                    errors.notes ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                  } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="Any additional notes about the patient..."
                  value={formData.notes}
                  onChange={handleFieldChange('notes')}
                  maxLength={500}
                  aria-describedby={errors.notes ? "notes-error" : "notes-help"}
                  aria-invalid={!!errors.notes}
                />
                {errors.notes ? (
                  <p id="notes-error" className="text-red-500 text-xs mt-1">{errors.notes}</p>
                ) : (
                  <p id="notes-help" className="text-gray-500 text-xs mt-1">
                    {500 - (formData.notes?.length || 0)} characters remaining
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Password Generation */}
          <div>
            <label htmlFor="tempPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Temporary Password *
            </label>
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-start">
              <div className="w-full">
                <input
                  ref={el => formRefs.current.temp = el}
                  id="tempPassword"
                  className={`border p-3 rounded-md w-full transition-colors ${
                    errors.temp ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                  } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="Temporary password"
                  value={formData.temp}
                  onChange={handleFieldChange('temp')}
                  onKeyDown={handleKeyDown}
                  aria-describedby={errors.temp ? "tempPassword-error" : "tempPassword-help"}
                  aria-invalid={!!errors.temp}
                />
                {errors.temp ? (
                  <p id="tempPassword-error" className="text-red-500 text-xs mt-1">{errors.temp}</p>
                ) : (
                  <p id="tempPassword-help" className="text-gray-500 text-xs mt-1">Must contain uppercase, lowercase, number, and symbol. Patient must change on first login.</p>
                )}
              </div>
              <button
                type="button"
                className="border border-gray-300 rounded-md px-4 py-3 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent whitespace-nowrap transition-colors"
                onClick={() => setFormData(prev => ({ ...prev, temp: genTemp() }))}
                aria-label="Generate new temporary password"
              >
                Generate
              </button>
              <button
                type="button"
                className="border border-gray-300 rounded-md px-4 py-3 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent whitespace-nowrap transition-colors"
                onClick={() => navigator.clipboard?.writeText(formData.temp)}
                aria-label="Copy temporary password to clipboard"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t">
            <button
              type="button"
              className="bg-green-600 text-white rounded-md px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 font-medium"
              disabled={busy || !canEnroll}
              onClick={enroll}
              aria-describedby="enroll-button-help"
            >
              {busy ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Enrolling…
                </span>
              ) : (
                'Enroll Patient'
              )}
            </button>
            {!canEnroll && !busy && (
              <p id="enroll-button-help" className="text-gray-500 text-xs mt-2">
                Complete all required fields to enable enrollment. Use Ctrl+Enter to submit.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

// Enhanced helper functions
function isE164(s: string): boolean { 
  return /^\+\d{10,15}$/.test(s); 
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// FIXED: Cryptographically secure password generation
function genTemp(len: number = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers   = '0123456789';
  const symbols   = '!@#$%^&*';
  const all       = lowercase + uppercase + numbers + symbols;

  const pick = (pool: string) => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return pool[array[0] % pool.length];
  };

  // Ensure at least one character from each category
  const out = [pick(lowercase), pick(uppercase), pick(numbers), pick(symbols)];

  // Fill remaining length with random characters
  const buf = new Uint32Array(len - 4);
  crypto.getRandomValues(buf);
  for (let i = 0; i < buf.length; i++) {
    out.push(all[buf[i] % all.length]);
  }

  // Shuffle the array using crypto random values
  for (let i = out.length - 1; i > 0; i--) {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const j = randomArray[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out.join('');
}

const AdminPanel: React.FC = () => {
  const { adminRole, logoutAdmin } = useAdminAuth();

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
      <div className="p-6 max-w-7xl mx-auto bg-white rounded-lg shadow-lg space-y-6">
        <div className="flex justify-between items-center pb-4 border-b">
          <h1 className="text-3xl font-bold text-blue-900">
            Admin Panel
            <span className="text-sm font-normal text-gray-600 ml-3">
              {adminRole === 'super_admin' ? 'Super Administrator' : 'Administrator'}
            </span>
          </h1>
          <div className="flex gap-4">
            <a
              href="/admin-questions"
              target="_blank"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm font-medium"
              aria-label="Open Risk Assessment in new tab"
            >
              📋 Risk Assessment
            </a>
            <button
              onClick={logoutAdmin}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors text-sm font-medium"
              aria-label="Logout from admin panel"
            >
              Logout Admin
            </button>
          </div>
        </div>

        <section className="mt-6 border rounded-xl p-6 bg-gradient-to-br from-purple-50 to-blue-50">
          <h2 className="text-xl font-semibold text-purple-800 mb-4">AI-Enhanced FHIR Analytics</h2>
          <FhirAiDashboard
            supabaseUrl={process.env.REACT_APP_SUPABASE_URL || ''}
            supabaseKey={process.env.REACT_APP_SUPABASE_ANON_KEY || ''}
          />
        </section>

        <UsersList />
        <ReportsSection />
        <ExportCheckIns />
        <EnrollPatientSection />

        {adminRole === 'super_admin' && (
          <>
            <section className="mt-6 border rounded-xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
              <h2 className="text-xl font-semibold text-blue-800 mb-4">Super Admin Features</h2>
              <ApiKeyManager />
            </section>

            <section className="mt-6 border rounded-xl p-6 bg-gradient-to-br from-green-50 to-emerald-50">
              <h2 className="text-xl font-semibold text-green-800 mb-4">Claude AI Service Test</h2>
              <ClaudeTestWidget />
            </section>
          </>
        )}
      </div>
    </RequireAdminAuth>
  );
};

export default AdminPanel;