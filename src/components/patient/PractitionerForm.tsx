import React, { useState, useEffect } from 'react';
import { PractitionerService } from '../../services/fhirResourceService';
import type { FHIRPractitioner } from '../../types/fhir';
import { MEDICAL_SPECIALTIES, NURSING_SPECIALTIES } from '../../types/fhir';

interface PractitionerFormProps {
  practitionerId?: string;
  onSave?: (practitioner: FHIRPractitioner) => void;
  onCancel?: () => void;
}

const PractitionerForm: React.FC<PractitionerFormProps> = ({
  practitionerId,
  onSave,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [familyName, setFamilyName] = useState('');
  const [givenNames, setGivenNames] = useState('');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [npi, setNpi] = useState('');
  const [stateLicense, setStateLicense] = useState('');
  const [deaNumber, setDeaNumber] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'unknown'>('unknown');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [active, setActive] = useState(true);

  const allSpecialties = [...Object.values(MEDICAL_SPECIALTIES), ...Object.values(NURSING_SPECIALTIES)];

  useEffect(() => {
    if (practitionerId) {
      loadPractitioner();
    }
  }, [practitionerId]);

  const loadPractitioner = async () => {
    if (!practitionerId) return;

    setLoading(true);
    try {
      const data = await PractitionerService.getById(practitionerId);
      if (data) {
        setFamilyName(data.family_name);
        setGivenNames(data.given_names?.join(' ') || '');
        setPrefix(data.prefix?.join(' ') || '');
        setSuffix(data.suffix?.join(', ') || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setNpi(data.npi || '');
        setStateLicense(data.state_license_number || '');
        setDeaNumber(data.dea_number || '');
        setGender(data.gender || 'unknown');
        setSpecialties(data.specialties || []);
        setLanguages(data.communication_languages || []);
        setBio(data.bio || '');
        setActive(data.active);
      }
    } catch {

      setError('Failed to load practitioner data');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!familyName || !givenNames) {
      setError('Family name and given names are required');
      return;
    }

    // Validate NPI if provided
    if (npi && !PractitionerService.validateNPI(npi)) {
      setError('NPI must be exactly 10 digits');
      return;
    }

    setSaving(true);
    try {
      const practitionerData: Partial<FHIRPractitioner> = {
        family_name: familyName,
        given_names: givenNames.split(' ').filter(n => n.trim()),
        prefix: prefix ? prefix.split(' ').filter(p => p.trim()) : undefined,
        suffix: suffix ? suffix.split(',').map(s => s.trim()).filter(s => s) : undefined,
        email: email || undefined,
        phone: phone || undefined,
        npi: npi || undefined,
        state_license_number: stateLicense || undefined,
        dea_number: deaNumber || undefined,
        gender,
        specialties: specialties.length > 0 ? specialties : undefined,
        communication_languages: languages.length > 0 ? languages : undefined,
        bio: bio || undefined,
        active,
      };

      let result: FHIRPractitioner;
      if (practitionerId) {
        result = await PractitionerService.update(practitionerId, practitionerData);
      } else {
        result = await PractitionerService.create(practitionerData);
      }

      if (onSave) {
        onSave(result);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save practitioner');
    }
    setSaving(false);
  };

  const handleAddSpecialty = (specialty: string) => {
    if (specialty && !specialties.includes(specialty)) {
      setSpecialties([...specialties, specialty]);
    }
  };

  const handleRemoveSpecialty = (specialty: string) => {
    setSpecialties(specialties.filter(s => s !== specialty));
  };

  const handleAddLanguage = () => {
    const lang = prompt('Enter language code (e.g., en, es, fr):');
    if (lang && !languages.includes(lang.toLowerCase())) {
      setLanguages([...languages, lang.toLowerCase()]);
    }
  };

  const handleRemoveLanguage = (lang: string) => {
    setLanguages(languages.filter(l => l !== lang));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        {practitionerId ? 'Edit Practitioner' : 'Add New Practitioner'}
      </h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name Section */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <h3 className="font-semibold text-gray-800">Name</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prefix (e.g., Dr., Prof.)
              </label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="Dr."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Given Names <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={givenNames}
                onChange={(e) => setGivenNames(e.target.value)}
                placeholder="John Michael"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Family Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Smith"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Suffix (e.g., MD, PhD, RN)
              </label>
              <input
                type="text"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="MD, FACP"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <h3 className="font-semibold text-gray-800">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Professional Identifiers */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <h3 className="font-semibold text-gray-800">Professional Identifiers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NPI (10 digits)
              </label>
              <input
                type="text"
                value={npi}
                onChange={(e) => setNpi(e.target.value)}
                placeholder="1234567890"
                pattern="\d{10}"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State License Number
              </label>
              <input
                type="text"
                value={stateLicense}
                onChange={(e) => setStateLicense(e.target.value)}
                placeholder="ABC123456"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                DEA Number
              </label>
              <input
                type="text"
                value={deaNumber}
                onChange={(e) => setDeaNumber(e.target.value)}
                placeholder="AB1234563"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
        </div>

        {/* Specialties */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <h3 className="font-semibold text-gray-800">Specialties</h3>
          <div>
            <select
              onChange={(e) => {
                handleAddSpecialty(e.target.value);
                e.target.value = '';
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Add a specialty...</option>
              {allSpecialties.map((specialty) => (
                <option key={specialty} value={specialty}>
                  {specialty}
                </option>
              ))}
            </select>
          </div>
          {specialties.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2"
                >
                  {specialty}
                  <button
                    type="button"
                    onClick={() => handleRemoveSpecialty(specialty)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Languages */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Languages</h3>
            <button
              type="button"
              onClick={handleAddLanguage}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Add Language
            </button>
          </div>
          {languages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {languages.map((lang) => (
                <span
                  key={lang}
                  className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm flex items-center gap-2"
                >
                  {lang.toUpperCase()}
                  <button
                    type="button"
                    onClick={() => handleRemoveLanguage(lang)}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Biography */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <h3 className="font-semibold text-gray-800">Biography</h3>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Professional biography..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Active Status */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="active" className="text-sm font-medium text-gray-700">
            Active Practitioner
          </label>
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Saving...' : practitionerId ? 'Update Practitioner' : 'Create Practitioner'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default PractitionerForm;
