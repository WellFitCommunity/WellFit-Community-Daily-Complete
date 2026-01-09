import React, { useState, useEffect } from 'react';
import { PractitionerService, PractitionerRoleService } from '../../services/fhirResourceService';
import type { FHIRPractitioner, FHIRPractitionerRole, FHIRAddress, FHIRPractitionerQualification } from '../../types/fhir';

// Type for availability hours entries
interface AvailabilityHours {
  start: string;
  end: string;
}

interface PractitionerProfileProps {
  practitionerId: string;
  onEdit?: () => void;
  readOnly?: boolean;
}

const PractitionerProfile: React.FC<PractitionerProfileProps> = ({
  practitionerId,
  onEdit,
  readOnly = false,
}) => {
  const [practitioner, setPractitioner] = useState<FHIRPractitioner | null>(null);
  const [roles, setRoles] = useState<FHIRPractitionerRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPractitionerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Function is stable, practitionerId captures trigger
  }, [practitionerId]);

  const loadPractitionerData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [practitionerData, rolesData] = await Promise.all([
        PractitionerService.getById(practitionerId),
        PractitionerRoleService.getByPractitioner(practitionerId),
      ]);

      setPractitioner(practitionerData);
      setRoles(rolesData);
    } catch (err) {

      setError('Failed to load practitioner profile');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !practitioner) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Practitioner not found'}</p>
      </div>
    );
  }

  const fullName = PractitionerService.getFullName(practitioner);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header with Photo and Name */}
      <div className="bg-linear-to-r from-blue-600 to-blue-800 p-6 text-white">
        <div className="flex items-start gap-4">
          {practitioner.photo_url ? (
            <img
              src={practitioner.photo_url}
              alt={fullName}
              className="w-24 h-24 rounded-full border-4 border-white object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white text-blue-600 flex items-center justify-center text-3xl font-bold border-4 border-white">
              {practitioner.family_name[0]}
              {practitioner.given_names?.[0]?.[0]}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{fullName}</h1>
            {practitioner.specialties && practitioner.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {practitioner.specialties.map((specialty, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 text-sm">
              {practitioner.active ? (
                <span className="px-3 py-1 bg-green-500 text-white rounded-full">Active</span>
              ) : (
                <span className="px-3 py-1 bg-gray-500 text-white rounded-full">Inactive</span>
              )}
              {practitioner.npi && (
                <span className="font-mono">NPI: {practitioner.npi}</span>
              )}
            </div>
          </div>
          {!readOnly && onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-white text-blue-600 rounded-md hover:bg-blue-50 transition"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Biography */}
        {practitioner.bio && (
          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">About</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{practitioner.bio}</p>
          </section>
        )}

        {/* Contact Information */}
        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-800">Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {practitioner.email && (
              <div>
                <p className="text-sm font-medium text-gray-600">Email</p>
                <a
                  href={`mailto:${practitioner.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {practitioner.email}
                </a>
              </div>
            )}
            {practitioner.phone && (
              <div>
                <p className="text-sm font-medium text-gray-600">Phone</p>
                <a
                  href={`tel:${practitioner.phone}`}
                  className="text-blue-600 hover:underline"
                >
                  {practitioner.phone}
                </a>
              </div>
            )}
          </div>

          {/* Addresses */}
          {practitioner.addresses && practitioner.addresses.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-600 mb-2">Addresses</p>
              <div className="space-y-2">
                {(practitioner.addresses as FHIRAddress[]).map((address, idx) => (
                  <div key={idx} className="bg-gray-50 p-3 rounded-md">
                    {address.use && (
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        {address.use}
                      </span>
                    )}
                    {address.line && address.line.map((line: string, i: number) => (
                      <p key={i} className="text-gray-700">{line}</p>
                    ))}
                    <p className="text-gray-700">
                      {address.city}, {address.state} {address.postalCode}
                    </p>
                    {address.country && <p className="text-gray-700">{address.country}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Credentials and Qualifications */}
        {practitioner.qualifications && practitioner.qualifications.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">Credentials & Qualifications</h2>
            <div className="space-y-3">
              {(practitioner.qualifications as FHIRPractitionerQualification[]).map((qual, idx) => (
                <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                  <p className="font-medium text-gray-900">
                    {qual.code?.text || qual.identifier?.value}
                  </p>
                  {qual.issuer && (
                    <p className="text-sm text-gray-600">Issued by: {qual.issuer}</p>
                  )}
                  {qual.period && (
                    <p className="text-xs text-gray-500">
                      {qual.period.start && `From: ${new Date(qual.period.start).toLocaleDateString()}`}
                      {qual.period.end && ` - To: ${new Date(qual.period.end).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Identifiers */}
        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-800">Professional Identifiers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {practitioner.npi && (
              <div>
                <p className="text-sm font-medium text-gray-600">National Provider Identifier (NPI)</p>
                <p className="font-mono text-gray-900">{practitioner.npi}</p>
              </div>
            )}
            {practitioner.state_license_number && (
              <div>
                <p className="text-sm font-medium text-gray-600">State License Number</p>
                <p className="font-mono text-gray-900">{practitioner.state_license_number}</p>
              </div>
            )}
            {practitioner.dea_number && (
              <div>
                <p className="text-sm font-medium text-gray-600">DEA Number</p>
                <p className="font-mono text-gray-900">{practitioner.dea_number}</p>
              </div>
            )}
            {practitioner.taxonomy_code && (
              <div>
                <p className="text-sm font-medium text-gray-600">Taxonomy Code</p>
                <p className="font-mono text-gray-900">{practitioner.taxonomy_code}</p>
              </div>
            )}
          </div>
        </section>

        {/* Languages */}
        {practitioner.communication_languages && practitioner.communication_languages.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">Languages Spoken</h2>
            <div className="flex flex-wrap gap-2">
              {practitioner.communication_languages.map((lang, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                >
                  {lang.toUpperCase()}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Current Roles */}
        {roles && roles.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">Current Roles</h2>
            <div className="space-y-3">
              {roles.map((role, idx) => (
                <div
                  key={role.id || idx}
                  className={`border rounded-lg p-4 ${
                    role.active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {role.code_display?.join(', ') || role.code.join(', ')}
                      </p>
                      {role.specialty && role.specialty.length > 0 && (
                        <p className="text-sm text-gray-600 mt-1">
                          Specialty: {role.specialty_display?.join(', ') || role.specialty.join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(role.period_start).toLocaleDateString()} -{' '}
                        {role.period_end ? new Date(role.period_end).toLocaleDateString() : 'Present'}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        role.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {role.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Availability Hours */}
        {practitioner.availability_hours && (
          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">Office Hours</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(practitioner.availability_hours).map(([day, hours]: [string, AvailabilityHours]) => (
                <div key={day} className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700 capitalize">{day}</span>
                  <span className="text-gray-600">
                    {hours.start} - {hours.end}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default PractitionerProfile;
