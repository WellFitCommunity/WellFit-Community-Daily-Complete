import React, { useState, useEffect } from 'react';
import { getAllergies, addAllergy, updateAllergy, deleteAllergy, type AllergyIntolerance } from '../../api/allergies';

interface AllergyManagerProps {
  userId: string;
  readOnly?: boolean;
}

const AllergyManager: React.FC<AllergyManagerProps> = ({ userId, readOnly = false }) => {
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    allergen_type: 'medication' | 'food' | 'environment' | 'biologic';
    allergen_name: string;
    clinical_status: 'active' | 'inactive' | 'resolved';
    verification_status: 'unconfirmed' | 'confirmed' | 'refuted' | 'entered-in-error';
    criticality: 'low' | 'high' | 'unable-to-assess';
    severity: 'mild' | 'moderate' | 'severe';
    reaction_description: string;
    notes: string;
  }>({
    allergen_type: 'medication',
    allergen_name: '',
    clinical_status: 'active',
    verification_status: 'confirmed',
    criticality: 'high',
    severity: 'moderate',
    reaction_description: '',
    notes: '',
  });

  useEffect(() => {
    loadAllergies();
  }, [userId]);

  const loadAllergies = async () => {
    setLoading(true);
    const response = await getAllergies(userId);
    if (response.success && response.data) {
      setAllergies(response.data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const allergyData = {
      ...formData,
      user_id: userId,
      recorded_date: new Date().toISOString().split('T')[0],
    };

    if (editingId) {
      const response = await updateAllergy(editingId, allergyData);
      if (response.success) {
        await loadAllergies();
        resetForm();
      }
    } else {
      const response = await addAllergy(allergyData);
      if (response.success) {
        await loadAllergies();
        resetForm();
      }
    }
  };

  const handleEdit = (allergy: AllergyIntolerance) => {
    setFormData({
      allergen_type: allergy.allergen_type,
      allergen_name: allergy.allergen_name,
      clinical_status: allergy.clinical_status,
      verification_status: allergy.verification_status,
      criticality: allergy.criticality || 'high',
      severity: allergy.severity || 'moderate',
      reaction_description: allergy.reaction_description || '',
      notes: allergy.notes || '',
    });
    setEditingId(allergy.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this allergy?')) {
      await deleteAllergy(id);
      await loadAllergies();
    }
  };

  const resetForm = () => {
    setFormData({
      allergen_type: 'medication',
      allergen_name: '',
      clinical_status: 'active',
      verification_status: 'confirmed',
      criticality: 'high',
      severity: 'moderate',
      reaction_description: '',
      notes: '',
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const getCriticalityColor = (criticality?: string) => {
    switch (criticality) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading allergies...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Allergy & Intolerance Management</h2>
          <p className="text-sm text-gray-600 mt-1">Critical for medication safety</p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
          >
            {showAddForm ? 'Cancel' : '+ Add Allergy'}
          </button>
        )}
      </div>

      {showAddForm && !readOnly && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Allergy' : 'Add New Allergy'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.allergen_type}
                onChange={(e) =>
                  setFormData({ ...formData, allergen_type: e.target.value as any })
                }
                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
              >
                <option value="medication">Medication</option>
                <option value="food">Food</option>
                <option value="environment">Environmental</option>
                <option value="biologic">Biologic</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allergen Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.allergen_name}
                onChange={(e) => setFormData({ ...formData, allergen_name: e.target.value })}
                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="e.g., Penicillin, Peanuts"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Criticality</label>
              <select
                value={formData.criticality}
                onChange={(e) =>
                  setFormData({ ...formData, criticality: e.target.value as any })
                }
                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="low">Low</option>
                <option value="high">High</option>
                <option value="unable-to-assess">Unable to Assess</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reaction Description
              </label>
              <textarea
                value={formData.reaction_description}
                onChange={(e) =>
                  setFormData({ ...formData, reaction_description: e.target.value })
                }
                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                rows={2}
                placeholder="Describe the reaction (e.g., hives, difficulty breathing)"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                rows={2}
                placeholder="Additional notes"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
            >
              {editingId ? 'Update' : 'Add'} Allergy
            </button>
          </div>
        </form>
      )}

      {allergies.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg font-medium">No Known Allergies</p>
          <p className="text-sm mt-1">Patient has no recorded allergies or intolerances</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allergies.map((allergy) => (
            <div
              key={allergy.id}
              className={`border rounded-lg p-4 ${getCriticalityColor(allergy.criticality)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="font-semibold text-gray-900">{allergy.allergen_name}</h3>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white border">
                      {allergy.allergen_type}
                    </span>
                    {allergy.criticality === 'high' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-600 text-white">
                        ⚠️ HIGH RISK
                      </span>
                    )}
                  </div>

                  {allergy.reaction_description && (
                    <p className="text-sm mt-2">
                      <span className="font-medium">Reaction:</span> {allergy.reaction_description}
                    </p>
                  )}

                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600">
                    <span>
                      Status: <span className="font-medium">{allergy.clinical_status}</span>
                    </span>
                    {allergy.severity && (
                      <span>
                        Severity: <span className="font-medium">{allergy.severity}</span>
                      </span>
                    )}
                    {allergy.recorded_date && (
                      <span>Recorded: {new Date(allergy.recorded_date).toLocaleDateString()}</span>
                    )}
                  </div>

                  {allergy.notes && (
                    <p className="text-sm text-gray-700 mt-2 italic">{allergy.notes}</p>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleEdit(allergy)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(allergy.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AllergyManager;
