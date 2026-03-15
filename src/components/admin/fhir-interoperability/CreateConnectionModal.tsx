/**
 * CreateConnectionModal — Form for creating a new FHIR connection
 */

import React, { useState } from 'react';
import type { FHIRConnection } from '../../../services/fhirInteroperabilityIntegrator';
import type { EHRSystem } from './types';

interface CreateConnectionModalProps {
  onClose: () => void;
  onCreate: (data: Omit<FHIRConnection, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
}

export const CreateConnectionModal: React.FC<CreateConnectionModalProps> = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    fhirServerUrl: '',
    ehrSystem: 'EPIC' as EHRSystem,
    clientId: '',
    syncFrequency: 'manual' as FHIRConnection['syncFrequency'],
    syncDirection: 'pull' as FHIRConnection['syncDirection'],
    status: 'inactive' as FHIRConnection['status'],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onCreate(formData);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Create FHIR Connection</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="conn-name" className="block text-sm font-medium text-gray-700 mb-1">Connection Name</label>
            <input
              id="conn-name"
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label htmlFor="conn-url" className="block text-sm font-medium text-gray-700 mb-1">FHIR Server URL</label>
            <input
              id="conn-url"
              type="url"
              value={formData.fhirServerUrl}
              onChange={e => setFormData({ ...formData, fhirServerUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label htmlFor="conn-ehr" className="block text-sm font-medium text-gray-700 mb-1">EHR System</label>
            <select
              id="conn-ehr"
              value={formData.ehrSystem}
              onChange={e => setFormData({ ...formData, ehrSystem: e.target.value as EHRSystem })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="EPIC">Epic</option>
              <option value="CERNER">Cerner</option>
              <option value="ALLSCRIPTS">Allscripts</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div>
            <label htmlFor="conn-client-id" className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input
              id="conn-client-id"
              type="text"
              value={formData.clientId}
              onChange={e => setFormData({ ...formData, clientId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[var(--ea-primary)] text-white rounded-lg hover:bg-[var(--ea-primary-hover)]"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
