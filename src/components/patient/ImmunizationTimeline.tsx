import React, { useState, useEffect, useCallback } from 'react';
import FHIRService from '../../services/fhirResourceService';
import type { FHIRImmunization } from '../../types/fhir';
import { VACCINE_NAMES, SENIOR_VACCINE_CODES } from '../../types/fhir';

interface ImmunizationTimelineProps {
  userId: string;
  onBack: () => void;
}

interface TimelineEvent {
  date: string;
  immunizations: FHIRImmunization[];
}

const ImmunizationTimeline: React.FC<ImmunizationTimelineProps> = ({ userId, onBack }) => {
  const [immunizations, setImmunizations] = useState<FHIRImmunization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVaccine, setSelectedVaccine] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<number>(365); // days

  const loadImmunizations = useCallback(async () => {
    setLoading(true);
    try {
      const result = await FHIRService.Immunization.getHistory(userId, timeRange);
      if (result.success && result.data) {
        setImmunizations(result.data as unknown as FHIRImmunization[]);
      }
    } catch (error) {

    }
    setLoading(false);
  }, [userId, timeRange]);

  useEffect(() => {
    loadImmunizations();
  }, [loadImmunizations]);

  const getVaccineIcon = (vaccineCode: string) => {
    if (vaccineCode === SENIOR_VACCINE_CODES.FLU) return '💉';
    if (vaccineCode === SENIOR_VACCINE_CODES.COVID) return '🦠';
    if (vaccineCode === SENIOR_VACCINE_CODES.SHINGLES) return '🛡️';
    if (vaccineCode === SENIOR_VACCINE_CODES.PCV13 || vaccineCode === SENIOR_VACCINE_CODES.PPSV23) return '🫁';
    if (vaccineCode === SENIOR_VACCINE_CODES.TDAP || vaccineCode === SENIOR_VACCINE_CODES.TD) return '💪';
    return '💉';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Group immunizations by vaccine type
  const vaccineGroups = immunizations.reduce((acc, imm) => {
    const code = imm.vaccine_code;
    if (!acc[code]) {
      acc[code] = [];
    }
    acc[code].push(imm);
    return acc;
  }, {} as Record<string, FHIRImmunization[]>);

  // Group immunizations by date for timeline view
  const timelineEvents: TimelineEvent[] = [];
  const dateMap = new Map<string, FHIRImmunization[]>();

  immunizations.forEach(imm => {
    if (!imm.occurrence_datetime) return;
    const dateKey = imm.occurrence_datetime.split('T')[0];
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, []);
    }
    dateMap.get(dateKey)?.push(imm);
  });

  dateMap.forEach((imms, date) => {
    timelineEvents.push({ date, immunizations: imms });
  });

  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter by selected vaccine
  const filteredEvents = selectedVaccine
    ? timelineEvents.map(event => ({
        ...event,
        immunizations: event.immunizations.filter(imm => imm.vaccine_code === selectedVaccine)
      })).filter(event => event.immunizations.length > 0)
    : timelineEvents;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="bg-linear-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-8 mb-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <button
              onClick={onBack}
              className="text-white hover:bg-white/20 rounded-lg px-3 py-1 mb-3 transition-colors inline-flex items-center gap-2"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold mb-2">📊 Immunization Timeline</h1>
            <p className="text-purple-100">Visualize your vaccination history over time</p>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="mt-6 flex gap-2">
          {[
            { label: '6 Months', days: 180 },
            { label: '1 Year', days: 365 },
            { label: '2 Years', days: 730 },
            { label: 'All Time', days: 3650 }
          ].map(range => (
            <button
              key={range.days}
              onClick={() => setTimeRange(range.days)}
              className={`px-4 py-2 rounded-lg transition-all ${
                timeRange === range.days
                  ? 'bg-white text-purple-600 font-semibold'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vaccine Type Filter */}
      <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Filter by Vaccine Type</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedVaccine(null)}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedVaccine === null
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Vaccines ({immunizations.length})
          </button>
          {Object.entries(vaccineGroups).map(([code, imms]) => (
            <button
              key={code}
              onClick={() => setSelectedVaccine(code)}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                selectedVaccine === code
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{getVaccineIcon(code)}</span>
              <span>{VACCINE_NAMES[code] || code}</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {imms.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Timeline View */}
      <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">📅</span>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Immunizations Found
            </h3>
            <p className="text-gray-600">
              {selectedVaccine
                ? 'No records for this vaccine in the selected time range.'
                : 'No immunization records in the selected time range.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredEvents.map((event, eventIndex) => (
              <div key={eventIndex} className="relative">
                {/* Timeline Line */}
                {eventIndex < filteredEvents.length - 1 && (
                  <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-linear-to-b from-purple-400 to-purple-200" />
                )}

                {/* Date Circle */}
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-linear-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg z-10">
                    {new Date(event.date).getDate()}
                  </div>

                  {/* Event Content */}
                  <div className="flex-1 pb-6">
                    <div className="bg-linear-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {formatDate(event.date)}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {event.immunizations.length} vaccine{event.immunizations.length > 1 ? 's' : ''} administered
                      </p>

                      {/* Immunizations for this date */}
                      <div className="space-y-2">
                        {event.immunizations.map((imm) => (
                          <div
                            key={imm.id}
                            className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">{getVaccineIcon(imm.vaccine_code)}</span>
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">
                                  {imm.vaccine_display}
                                </h4>
                                <div className="mt-2 space-y-1">
                                  {imm.lot_number && (
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Lot:</span> {imm.lot_number}
                                    </p>
                                  )}
                                  {imm.performer_actor_display && (
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">By:</span> {imm.performer_actor_display}
                                    </p>
                                  )}
                                  {imm.location_display && (
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Location:</span> {imm.location_display}
                                    </p>
                                  )}
                                  {imm.protocol_dose_number_positive_int && imm.protocol_series_doses_positive_int && (
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Dose:</span>{' '}
                                      {imm.protocol_dose_number_positive_int} of{' '}
                                      {imm.protocol_series_doses_positive_int}
                                    </p>
                                  )}
                                  {imm.site_display && (
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Site:</span> {imm.site_display}
                                      {imm.route_display && ` (${imm.route_display})`}
                                    </p>
                                  )}
                                </div>
                                <div className="mt-2">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    imm.status === 'completed'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {imm.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vaccine History Table */}
      {selectedVaccine && vaccineGroups[selectedVaccine] && (
        <div className="mt-6 bg-white rounded-lg shadow-xs border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {getVaccineIcon(selectedVaccine)} {VACCINE_NAMES[selectedVaccine] || selectedVaccine} History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Lot Number</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Administered By</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Dose</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {vaccineGroups[selectedVaccine]
                  .sort((a, b) => {
                    const dateA = a.occurrence_datetime ? new Date(a.occurrence_datetime).getTime() : 0;
                    const dateB = b.occurrence_datetime ? new Date(b.occurrence_datetime).getTime() : 0;
                    return dateB - dateA;
                  })
                  .map((imm) => (
                    <tr key={imm.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">{formatShortDate(imm.occurrence_datetime || '')}</td>
                      <td className="py-3 px-4">{imm.lot_number || '-'}</td>
                      <td className="py-3 px-4">{imm.location_display || '-'}</td>
                      <td className="py-3 px-4">{imm.performer_actor_display || '-'}</td>
                      <td className="py-3 px-4">
                        {imm.protocol_dose_number_positive_int && imm.protocol_series_doses_positive_int
                          ? `${imm.protocol_dose_number_positive_int}/${imm.protocol_series_doses_positive_int}`
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          imm.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {imm.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-linear-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
          <div className="text-3xl font-bold text-purple-900 mb-1">
            {Object.keys(vaccineGroups).length}
          </div>
          <div className="text-sm text-purple-700">Different Vaccine Types</div>
        </div>
        <div className="bg-linear-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-6">
          <div className="text-3xl font-bold text-blue-900 mb-1">
            {immunizations.length}
          </div>
          <div className="text-sm text-blue-700">Total Doses Administered</div>
        </div>
        <div className="bg-linear-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
          <div className="text-3xl font-bold text-green-900 mb-1">
            {immunizations.filter(i => {
              if (!i.occurrence_datetime) return false;
              const date = new Date(i.occurrence_datetime);
              const oneYearAgo = new Date();
              oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
              return date >= oneYearAgo;
            }).length}
          </div>
          <div className="text-sm text-green-700">Vaccines in Last Year</div>
        </div>
      </div>
    </div>
  );
};

export default ImmunizationTimeline;
