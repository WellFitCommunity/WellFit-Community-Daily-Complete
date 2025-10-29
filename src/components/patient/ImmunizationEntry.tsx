import React, { useState } from 'react';
import FHIRService from '../../services/fhirResourceService';
import type { FHIRImmunization } from '../../types/fhir';
import {
  SENIOR_VACCINE_CODES,
  VACCINE_NAMES,
  IMMUNIZATION_ROUTES,
  IMMUNIZATION_SITES
} from '../../types/fhir';

interface ImmunizationEntryProps {
  userId: string;
  onSave: () => void;
  onCancel: () => void;
}

type CategoryType = 'common' | 'all' | 'custom';

interface VaccineTemplate {
  code: string;
  display: string;
  route?: string;
  site?: string;
  doseValue?: number;
  doseUnit?: string;
  icon: string;
}

const COMMON_VACCINES: VaccineTemplate[] = [
  {
    code: SENIOR_VACCINE_CODES.FLU,
    display: VACCINE_NAMES[SENIOR_VACCINE_CODES.FLU],
    route: 'IM',
    site: 'LA',
    doseValue: 0.5,
    doseUnit: 'mL',
    icon: '💉'
  },
  {
    code: SENIOR_VACCINE_CODES.COVID,
    display: VACCINE_NAMES[SENIOR_VACCINE_CODES.COVID],
    route: 'IM',
    site: 'LA',
    doseValue: 0.3,
    doseUnit: 'mL',
    icon: '🦠'
  },
  {
    code: SENIOR_VACCINE_CODES.SHINGLES,
    display: VACCINE_NAMES[SENIOR_VACCINE_CODES.SHINGLES],
    route: 'IM',
    site: 'LD',
    doseValue: 0.5,
    doseUnit: 'mL',
    icon: '🛡️'
  },
  {
    code: SENIOR_VACCINE_CODES.PCV13,
    display: VACCINE_NAMES[SENIOR_VACCINE_CODES.PCV13],
    route: 'IM',
    site: 'LD',
    doseValue: 0.5,
    doseUnit: 'mL',
    icon: '🫁'
  },
  {
    code: SENIOR_VACCINE_CODES.PPSV23,
    display: VACCINE_NAMES[SENIOR_VACCINE_CODES.PPSV23],
    route: 'IM',
    site: 'LD',
    doseValue: 0.5,
    doseUnit: 'mL',
    icon: '🫁'
  },
  {
    code: SENIOR_VACCINE_CODES.TDAP,
    display: VACCINE_NAMES[SENIOR_VACCINE_CODES.TDAP],
    route: 'IM',
    site: 'LD',
    doseValue: 0.5,
    doseUnit: 'mL',
    icon: '💪'
  },
];

const ALL_VACCINES: VaccineTemplate[] = Object.entries(VACCINE_NAMES).map(([code, display]) => ({
  code,
  display,
  route: 'IM',
  site: 'LA',
  doseValue: 0.5,
  doseUnit: 'mL',
  icon: '💉'
}));

const ImmunizationEntry: React.FC<ImmunizationEntryProps> = ({ userId, onSave, onCancel }) => {
  const [category, setCategory] = useState<CategoryType>('common');
  const [selectedTemplate, setSelectedTemplate] = useState<VaccineTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    status: 'completed' as 'completed' | 'not-done' | 'entered-in-error',
    vaccineCode: '',
    vaccineDisplay: '',
    occurrenceDate: new Date().toISOString().split('T')[0],
    occurrenceTime: new Date().toTimeString().slice(0, 5),
    primarySource: true,
    lotNumber: '',
    expirationDate: '',
    manufacturer: '',
    siteCode: '',
    siteDisplay: '',
    routeCode: '',
    routeDisplay: '',
    doseValue: '',
    doseUnit: '',
    performerName: '',
    location: '',
    doseNumber: '',
    seriesTotal: '',
    note: '',
  });

  const handleTemplateSelect = (template: VaccineTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      ...formData,
      vaccineCode: template.code,
      vaccineDisplay: template.display,
      routeCode: template.route || '',
      routeDisplay: template.route ? IMMUNIZATION_ROUTES[template.route as keyof typeof IMMUNIZATION_ROUTES]?.display || '' : '',
      siteCode: template.site || '',
      siteDisplay: template.site ? IMMUNIZATION_SITES[template.site as keyof typeof IMMUNIZATION_SITES]?.display || '' : '',
      doseValue: template.doseValue?.toString() || '',
      doseUnit: template.doseUnit || '',
    });
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleRouteChange = (routeCode: string) => {
    const route = IMMUNIZATION_ROUTES[routeCode as keyof typeof IMMUNIZATION_ROUTES];
    setFormData({
      ...formData,
      routeCode,
      routeDisplay: route?.display || ''
    });
  };

  const handleSiteChange = (siteCode: string) => {
    const site = IMMUNIZATION_SITES[siteCode as keyof typeof IMMUNIZATION_SITES];
    setFormData({
      ...formData,
      siteCode,
      siteDisplay: site?.display || ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.vaccineCode || !formData.vaccineDisplay) {
      setError('Please select a vaccine');
      return;
    }

    setLoading(true);

    try {
      const occurrenceDatetime = `${formData.occurrenceDate}T${formData.occurrenceTime}:00`;

      const immunization: Partial<FHIRImmunization> = {
        patient_id: userId,
        status: formData.status,
        vaccine_code: formData.vaccineCode,
        vaccine_display: formData.vaccineDisplay,
        occurrence_datetime: occurrenceDatetime,
        primary_source: formData.primarySource,
      };

      // Optional fields
      if (formData.lotNumber) immunization.lot_number = formData.lotNumber;
      if (formData.expirationDate) immunization.expiration_date = formData.expirationDate;
      if (formData.manufacturer) immunization.manufacturer = formData.manufacturer;
      if (formData.siteCode) immunization.site_code = formData.siteCode;
      if (formData.siteDisplay) immunization.site_display = formData.siteDisplay;
      if (formData.routeCode) immunization.route_code = formData.routeCode;
      if (formData.routeDisplay) immunization.route_display = formData.routeDisplay;
      if (formData.doseValue) immunization.dose_quantity_value = parseFloat(formData.doseValue);
      if (formData.doseUnit) immunization.dose_quantity_unit = formData.doseUnit;
      if (formData.performerName) immunization.performer_actor_display = formData.performerName;
      if (formData.location) immunization.location_display = formData.location;
      if (formData.doseNumber) immunization.protocol_dose_number_positive_int = parseInt(formData.doseNumber);
      if (formData.seriesTotal) immunization.protocol_series_doses_positive_int = parseInt(formData.seriesTotal);
      if (formData.note) immunization.note = formData.note;

      await FHIRService.Immunization.create(immunization);
      onSave();
    } catch (err) {

      setError('Failed to save immunization. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const vaccines = category === 'common' ? COMMON_VACCINES : ALL_VACCINES;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold mb-1">💉 Record Immunization</h2>
              <p className="text-purple-100">Add a new vaccine to your health record</p>
            </div>
            <button
              onClick={onCancel}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Category Tabs */}
          <div className="mb-6">
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setCategory('common')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  category === 'common'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Common Vaccines
              </button>
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  category === 'all'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Vaccines
              </button>
              <button
                type="button"
                onClick={() => setCategory('custom')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  category === 'custom'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Custom Entry
              </button>
            </div>
          </div>

          {/* Vaccine Selection */}
          {category !== 'custom' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Vaccine <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {vaccines.map((vaccine) => (
                  <button
                    key={vaccine.code}
                    type="button"
                    onClick={() => handleTemplateSelect(vaccine)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedTemplate?.code === vaccine.code
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{vaccine.icon}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{vaccine.display}</div>
                        <div className="text-xs text-gray-600">CVX: {vaccine.code}</div>
                      </div>
                      {selectedTemplate?.code === vaccine.code && (
                        <span className="text-purple-600">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Entry Fields */}
          {category === 'custom' && (
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vaccine Code (CVX) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.vaccineCode}
                  onChange={(e) => handleInputChange('vaccineCode', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., 141"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vaccine Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.vaccineDisplay}
                  onChange={(e) => handleInputChange('vaccineDisplay', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Influenza, seasonal, injectable"
                  required
                />
              </div>
            </div>
          )}

          {/* Form Fields */}
          {(selectedTemplate || category === 'custom') && (
            <div className="space-y-6">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="completed">Completed</option>
                  <option value="not-done">Not Done</option>
                  <option value="entered-in-error">Entered in Error</option>
                </select>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.occurrenceDate}
                    onChange={(e) => handleInputChange('occurrenceDate', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.occurrenceTime}
                    onChange={(e) => handleInputChange('occurrenceTime', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Lot Number and Expiration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lot Number
                  </label>
                  <input
                    type="text"
                    value={formData.lotNumber}
                    onChange={(e) => handleInputChange('lotNumber', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., LOT123456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    value={formData.expirationDate}
                    onChange={(e) => handleInputChange('expirationDate', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Manufacturer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manufacturer
                </label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Pfizer, Moderna, GSK"
                />
              </div>

              {/* Site and Route */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Administration Site
                  </label>
                  <select
                    value={formData.siteCode}
                    onChange={(e) => handleSiteChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select site...</option>
                    {Object.entries(IMMUNIZATION_SITES).map(([code, site]) => (
                      <option key={code} value={code}>
                        {site.display}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Route
                  </label>
                  <select
                    value={formData.routeCode}
                    onChange={(e) => handleRouteChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select route...</option>
                    {Object.entries(IMMUNIZATION_ROUTES).map(([code, route]) => (
                      <option key={code} value={code}>
                        {route.display}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dose */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dose Quantity
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.doseValue}
                    onChange={(e) => handleInputChange('doseValue', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 0.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={formData.doseUnit}
                    onChange={(e) => handleInputChange('doseUnit', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., mL"
                  />
                </div>
              </div>

              {/* Series Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dose Number (in series)
                  </label>
                  <input
                    type="number"
                    value={formData.doseNumber}
                    onChange={(e) => handleInputChange('doseNumber', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Doses in Series
                  </label>
                  <input
                    type="number"
                    value={formData.seriesTotal}
                    onChange={(e) => handleInputChange('seriesTotal', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 2"
                  />
                </div>
              </div>

              {/* Performer and Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Administered By
                  </label>
                  <input
                    type="text"
                    value={formData.performerName}
                    onChange={(e) => handleInputChange('performerName', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Jane Smith, RN"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., WellFit Health Center"
                  />
                </div>
              </div>

              {/* Primary Source */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.primarySource}
                    onChange={(e) => handleInputChange('primarySource', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Primary source (vaccine was directly observed)
                  </span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => handleInputChange('note', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Additional notes about this vaccination..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Save Immunization'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ImmunizationEntry;
