/**
 * Patient Selector Component
 * Patient search and selection for physician panel
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Users } from 'lucide-react';
import { useSupabaseClient } from '../../../contexts/AuthContext';
import type { PatientListItem } from './types';

interface PatientSelectorProps {
  onSelectPatient: (patient: PatientListItem) => void;
  selectedPatient: PatientListItem | null;
}

export const PatientSelector: React.FC<PatientSelectorProps> = ({ onSelectPatient, selectedPatient }) => {
  const supabase = useSupabaseClient();
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadPatients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, dob, phone, email')
        .in('role', ['senior', 'patient'])
        .order('last_name', { ascending: true })
        .limit(100);

      if (error) throw error;
      // Map to PatientListItem with id field
      const mapped = (data || []).map(p => ({ ...p, id: p.user_id }));
      setPatients(mapped);
    } catch (error) {
      // Silent fail - error handling done upstream
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name} ${p.phone || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-4">
      <div className="flex items-center gap-3 mb-3">
        <Users className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Select Patient</h3>
      </div>

      <input
        type="text"
        placeholder="Search by name or phone..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading patients...</div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-2">
          {filteredPatients.map((patient) => (
            <button
              key={patient.user_id}
              onClick={() => onSelectPatient(patient)}
              className={`w-full text-left px-3 py-2 rounded border transition-all ${
                selectedPatient?.user_id === patient.user_id
                  ? 'bg-blue-100 border-blue-600 shadow-sm'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="font-medium text-gray-900">
                {patient.last_name}, {patient.first_name}
              </div>
              <div className="text-xs text-gray-600">
                DOB: {new Date(patient.dob).toLocaleDateString()} • {patient.phone}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
