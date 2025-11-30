/**
 * Facility Management Panel
 *
 * Admin interface for managing healthcare facilities within the tenant.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Phone,
  Mail,
  Star,
  StarOff,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Hospital,
  Stethoscope,
  Activity,
} from 'lucide-react';
import { FacilityService } from '../../services/facilityService';
import { supabase } from '../../lib/supabaseClient';
import type {
  Facility,
  CreateFacility,
  UpdateFacility,
  FacilityType,
} from '../../types/facility';
import { getFacilityTypeLabel } from '../../types/facility';

// Facility type icons
const facilityTypeIcons: Record<FacilityType, React.ElementType> = {
  hospital: Hospital,
  clinic: Stethoscope,
  urgent_care: Activity,
  emergency: Activity,
  rehabilitation: Activity,
  nursing_facility: Building2,
  home_health: Building2,
  telehealth: Building2,
  other: Building2,
};

interface FacilityFormData {
  name: string;
  facility_code: string;
  facility_type: FacilityType;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  fax: string;
  email: string;
  npi: string;
  tax_id: string;
  place_of_service_code: string;
  is_primary: boolean;
  bed_count: string;
}

const emptyFormData: FacilityFormData = {
  name: '',
  facility_code: '',
  facility_type: 'clinic',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  zip_code: '',
  phone: '',
  fax: '',
  email: '',
  npi: '',
  tax_id: '',
  place_of_service_code: '11',
  is_primary: false,
  bed_count: '',
};

const FacilityManagementPanel: React.FC = () => {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [formData, setFormData] = useState<FacilityFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);

  // Load tenant_id from current user's profile
  useEffect(() => {
    const loadTenantId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (profile?.tenant_id) {
        setTenantId(profile.tenant_id);
      }
    };

    loadTenantId();
  }, []);

  const loadFacilities = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = showInactive
      ? await FacilityService.getAllFacilities()
      : await FacilityService.getFacilities();

    if (result.success) {
      setFacilities(result.data);
    } else {
      setError(result.error.message);
    }

    setLoading(false);
  }, [showInactive]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  const filteredFacilities = facilities.filter((f) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      f.name.toLowerCase().includes(query) ||
      f.facility_code?.toLowerCase().includes(query) ||
      f.city?.toLowerCase().includes(query)
    );
  });

  const handleOpenModal = (facility?: Facility) => {
    if (facility) {
      setEditingFacility(facility);
      setFormData({
        name: facility.name,
        facility_code: facility.facility_code || '',
        facility_type: facility.facility_type,
        address_line1: facility.address_line1 || '',
        address_line2: facility.address_line2 || '',
        city: facility.city || '',
        state: facility.state || '',
        zip_code: facility.zip_code || '',
        phone: facility.phone || '',
        fax: facility.fax || '',
        email: facility.email || '',
        npi: facility.npi || '',
        tax_id: facility.tax_id || '',
        place_of_service_code: facility.place_of_service_code || '11',
        is_primary: facility.is_primary,
        bed_count: facility.bed_count?.toString() || '',
      });
    } else {
      setEditingFacility(null);
      setFormData(emptyFormData);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingFacility(null);
    setFormData(emptyFormData);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Facility name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingFacility) {
        const updates: UpdateFacility = {
          name: formData.name,
          facility_code: formData.facility_code || undefined,
          facility_type: formData.facility_type,
          address_line1: formData.address_line1 || undefined,
          address_line2: formData.address_line2 || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          zip_code: formData.zip_code || undefined,
          phone: formData.phone || undefined,
          fax: formData.fax || undefined,
          email: formData.email || undefined,
          npi: formData.npi || undefined,
          tax_id: formData.tax_id || undefined,
          place_of_service_code: formData.place_of_service_code as any,
          is_primary: formData.is_primary,
          bed_count: formData.bed_count ? parseInt(formData.bed_count) : undefined,
        };

        const result = await FacilityService.updateFacility(editingFacility.id, updates);
        if (!result.success) {
          setError(result.error.message);
          return;
        }
      } else {
        if (!tenantId) {
          setError('No tenant context');
          return;
        }

        const newFacility: CreateFacility = {
          tenant_id: tenantId,
          name: formData.name,
          facility_code: formData.facility_code || undefined,
          facility_type: formData.facility_type,
          address_line1: formData.address_line1 || undefined,
          address_line2: formData.address_line2 || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          zip_code: formData.zip_code || undefined,
          phone: formData.phone || undefined,
          fax: formData.fax || undefined,
          email: formData.email || undefined,
          npi: formData.npi || undefined,
          tax_id: formData.tax_id || undefined,
          place_of_service_code: formData.place_of_service_code as any,
          is_primary: formData.is_primary,
          bed_count: formData.bed_count ? parseInt(formData.bed_count) : undefined,
        };

        const result = await FacilityService.createFacility(newFacility);
        if (!result.success) {
          setError(result.error.message);
          return;
        }
      }

      handleCloseModal();
      await loadFacilities();
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (facility: Facility) => {
    if (!window.confirm(`Deactivate "${facility.name}"? This will hide it from selection lists.`)) {
      return;
    }

    const result = await FacilityService.deactivateFacility(facility.id);
    if (result.success) {
      await loadFacilities();
    } else {
      setError(result.error.message);
    }
  };

  const handleReactivate = async (facility: Facility) => {
    const result = await FacilityService.reactivateFacility(facility.id);
    if (result.success) {
      await loadFacilities();
    } else {
      setError(result.error.message);
    }
  };

  const handleSetPrimary = async (facility: Facility) => {
    const result = await FacilityService.updateFacility(facility.id, { is_primary: true });
    if (result.success) {
      await loadFacilities();
    } else {
      setError(result.error.message);
    }
  };

  if (loading && facilities.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Facilities</h2>
          <p className="text-sm text-gray-600">
            Manage hospitals, clinics, and other healthcare locations
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Facility
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="float-right">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search facilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
          />
          Show inactive
        </label>
        <button
          onClick={loadFacilities}
          className="p-2 text-gray-500 hover:text-gray-700"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Facilities List */}
      <div className="grid gap-4">
        {filteredFacilities.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No facilities found</p>
            <button
              onClick={() => handleOpenModal()}
              className="mt-4 text-teal-600 hover:text-teal-700"
            >
              Add your first facility
            </button>
          </div>
        ) : (
          filteredFacilities.map((facility) => {
            const Icon = facilityTypeIcons[facility.facility_type] || Building2;
            return (
              <div
                key={facility.id}
                className={`bg-white border rounded-lg p-4 ${
                  !facility.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-lg ${
                        facility.is_primary ? 'bg-teal-100' : 'bg-gray-100'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          facility.is_primary ? 'text-teal-600' : 'text-gray-600'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{facility.name}</h3>
                        {facility.is_primary && (
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full">
                            Primary
                          </span>
                        )}
                        {!facility.is_active && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {getFacilityTypeLabel(facility.facility_type)}
                        {facility.facility_code && ` • ${facility.facility_code}`}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        {(facility.city || facility.state) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {[facility.city, facility.state].filter(Boolean).join(', ')}
                          </span>
                        )}
                        {facility.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {facility.phone}
                          </span>
                        )}
                        {facility.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {facility.email}
                          </span>
                        )}
                        {facility.npi && <span className="text-xs">NPI: {facility.npi}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!facility.is_primary && facility.is_active && (
                      <button
                        onClick={() => handleSetPrimary(facility)}
                        className="p-2 text-gray-400 hover:text-teal-600"
                        title="Set as primary"
                      >
                        <StarOff className="w-4 h-4" />
                      </button>
                    )}
                    {facility.is_primary && (
                      <span className="p-2 text-teal-600" title="Primary facility">
                        <Star className="w-4 h-4 fill-current" />
                      </span>
                    )}
                    <button
                      onClick={() => handleOpenModal(facility)}
                      className="p-2 text-gray-400 hover:text-blue-600"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {facility.is_active ? (
                      <button
                        onClick={() => handleDeactivate(facility)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title="Deactivate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(facility)}
                        className="p-2 text-gray-400 hover:text-green-600"
                        title="Reactivate"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingFacility ? 'Edit Facility' : 'Add Facility'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Facility Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Houston Methodist Sugar Land"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Facility Code
                  </label>
                  <input
                    type="text"
                    value={formData.facility_code}
                    onChange={(e) => setFormData({ ...formData, facility_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="METH-SL"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Facility Type
                  </label>
                  <select
                    value={formData.facility_type}
                    onChange={(e) =>
                      setFormData({ ...formData, facility_type: e.target.value as FacilityType })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="hospital">Hospital</option>
                    <option value="clinic">Clinic</option>
                    <option value="urgent_care">Urgent Care</option>
                    <option value="emergency">Emergency Room</option>
                    <option value="rehabilitation">Rehabilitation</option>
                    <option value="nursing_facility">Nursing Facility</option>
                    <option value="home_health">Home Health</option>
                    <option value="telehealth">Telehealth</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Address</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={formData.address_line1}
                      onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Street Address"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={formData.address_line2}
                      onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Suite, Floor, etc."
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="City"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="State"
                      maxLength={2}
                    />
                    <input
                      type="text"
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="ZIP"
                    />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Contact</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Phone"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      value={formData.fax}
                      onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Fax"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Email"
                    />
                  </div>
                </div>
              </div>

              {/* Billing IDs */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Billing Identifiers</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">NPI</label>
                    <input
                      type="text"
                      value={formData.npi}
                      onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="10-digit NPI"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tax ID (EIN)</label>
                    <input
                      type="text"
                      value={formData.tax_id}
                      onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="XX-XXXXXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Place of Service</label>
                    <select
                      value={formData.place_of_service_code}
                      onChange={(e) =>
                        setFormData({ ...formData, place_of_service_code: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="11">11 - Office</option>
                      <option value="21">21 - Inpatient Hospital</option>
                      <option value="22">22 - Outpatient Hospital</option>
                      <option value="23">23 - Emergency Room</option>
                      <option value="20">20 - Urgent Care</option>
                      <option value="31">31 - Skilled Nursing</option>
                      <option value="02">02 - Telehealth (Home)</option>
                      <option value="12">12 - Home</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_primary}
                      onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Primary facility</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Bed count:</label>
                    <input
                      type="number"
                      value={formData.bed_count}
                      onChange={(e) => setFormData({ ...formData, bed_count: e.target.value })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingFacility ? 'Update Facility' : 'Create Facility'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilityManagementPanel;
