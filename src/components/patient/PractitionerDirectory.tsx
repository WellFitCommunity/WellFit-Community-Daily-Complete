import React, { useState, useEffect } from 'react';
import { PractitionerService } from '../../services/fhirResourceService';
import type { FHIRPractitioner } from '../../types/fhir';
import { MEDICAL_SPECIALTIES, NURSING_SPECIALTIES } from '../../types/fhir';

interface PractitionerDirectoryProps {
  onSelectPractitioner?: (practitioner: FHIRPractitioner) => void;
  readOnly?: boolean;
}

const PractitionerDirectory: React.FC<PractitionerDirectoryProps> = ({
  onSelectPractitioner,
  readOnly = false,
}) => {
  const [practitioners, setPractitioners] = useState<FHIRPractitioner[]>([]);
  const [filteredPractitioners, setFilteredPractitioners] = useState<FHIRPractitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [selectedPractitioner, setSelectedPractitioner] = useState<FHIRPractitioner | null>(null);

  const allSpecialties = [...Object.values(MEDICAL_SPECIALTIES), ...Object.values(NURSING_SPECIALTIES)];

  useEffect(() => {
    loadPractitioners();
  }, []);

  useEffect(() => {
    filterPractitioners();
  }, [searchTerm, selectedSpecialty, practitioners]);

  const loadPractitioners = async () => {
    setLoading(true);
    try {
      const data = await PractitionerService.getAll();
      setPractitioners(data);
    } catch (error) {

    }
    setLoading(false);
  };

  const filterPractitioners = () => {
    let filtered = practitioners;

    // Filter by specialty
    if (selectedSpecialty) {
      filtered = filtered.filter(p =>
        p.specialties?.includes(selectedSpecialty)
      );
    }

    // Filter by search term
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(p => {
        const fullName = PractitionerService.getFullName(p).toLowerCase();
        const npiMatch = p.npi?.includes(searchTerm);
        const specialtyMatch = p.specialties?.some(s => s.toLowerCase().includes(lowerSearch));
        return fullName.includes(lowerSearch) || npiMatch || specialtyMatch;
      });
    }

    setFilteredPractitioners(filtered);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    filterPractitioners();
  };

  const handleSelectPractitioner = (practitioner: FHIRPractitioner) => {
    setSelectedPractitioner(practitioner);
    if (onSelectPractitioner) {
      onSelectPractitioner(practitioner);
    }
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
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Provider Directory</h2>

      {/* Search and Filter Section */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, specialty, or NPI..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Search
          </button>
        </form>

        {/* Specialty Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Specialty
          </label>
          <select
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Specialties</option>
            {allSpecialties.map((specialty) => (
              <option key={specialty} value={specialty}>
                {specialty}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {filteredPractitioners.length} of {practitioners.length} providers
      </div>

      {/* Practitioners Grid */}
      {filteredPractitioners.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No providers found</p>
          <p className="text-sm mt-2">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPractitioners.map((practitioner) => (
            <div
              key={practitioner.id}
              onClick={() => handleSelectPractitioner(practitioner)}
              className={`border rounded-lg p-4 cursor-pointer transition ${
                selectedPractitioner?.id === practitioner.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
              }`}
            >
              {/* Photo and Name */}
              <div className="flex items-start gap-3 mb-3">
                {practitioner.photo_url ? (
                  <img
                    src={practitioner.photo_url}
                    alt={PractitionerService.getFullName(practitioner)}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-semibold text-xl">
                    {practitioner.family_name[0]}
                    {practitioner.given_names?.[0]?.[0]}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {PractitionerService.getFullName(practitioner)}
                  </h3>
                  {practitioner.suffix && practitioner.suffix.length > 0 && (
                    <p className="text-sm text-gray-600">{practitioner.suffix.join(', ')}</p>
                  )}
                </div>
              </div>

              {/* Specialties */}
              {practitioner.specialties && practitioner.specialties.length > 0 && (
                <div className="mb-3">
                  <div className="flex flex-wrap gap-1">
                    {practitioner.specialties.slice(0, 2).map((specialty, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {specialty}
                      </span>
                    ))}
                    {practitioner.specialties.length > 2 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        +{practitioner.specialties.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Info */}
              <div className="space-y-1 text-sm text-gray-600">
                {practitioner.phone && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Phone:</span>
                    <span>{practitioner.phone}</span>
                  </div>
                )}
                {practitioner.email && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Email:</span>
                    <span className="truncate">{practitioner.email}</span>
                  </div>
                )}
                {practitioner.npi && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">NPI:</span>
                    <span className="font-mono text-xs">{practitioner.npi}</span>
                  </div>
                )}
              </div>

              {/* Languages */}
              {practitioner.communication_languages && practitioner.communication_languages.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Languages: {practitioner.communication_languages.join(', ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PractitionerDirectory;
