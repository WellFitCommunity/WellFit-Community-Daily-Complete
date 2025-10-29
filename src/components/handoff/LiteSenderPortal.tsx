// Lite Sender Portal - No Login Required
// Web-based patient handoff form with tokenized access
// 5-section smart form for patient transfers

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import HandoffService from '../../services/handoffService';
import type {
  CompleteHandoffFormData,
  UrgencyLevel,
  VitalSigns,
  Medication,
  Allergy,
  CreateHandoffPacketRequest,
  LiteSenderPortalProps,
} from '../../types/handoff';

const LiteSenderPortal: React.FC<LiteSenderPortalProps> = ({
  facilityName,
  onPacketCreated,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedPacket, setCompletedPacket] = useState<{
    packetNumber: string;
    accessUrl: string;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState<CompleteHandoffFormData>({
    // Step 1: Demographics
    patient_name: '',
    patient_dob: '',
    patient_mrn: '',
    patient_gender: undefined,
    sending_facility: facilityName || '',

    // Step 2: Transfer Reason
    reason_for_transfer: '',
    urgency_level: 'routine' as UrgencyLevel,

    // Step 3: Clinical Snapshot
    vitals: {} as VitalSigns,
    medications_given: [],
    medications_prescribed: [],
    medications_current: [],
    allergies: [],
    labs: [],
    notes: '',

    // Step 4: Sender Info
    sender_provider_name: '',
    sender_callback_number: '',
    sender_notes: '',

    // Step 5: Attachments
    receiving_facility: '',
    attachments: [],
  });

  const [medicationsGiven, setMedicationsGiven] = useState<Medication[]>([]);
  const [medicationsPrescribed, setMedicationsPrescribed] = useState<Medication[]>([]);
  const [medicationsCurrent, setMedicationsCurrent] = useState<Medication[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isLookingUpPatient, setIsLookingUpPatient] = useState(false);

  // Patient lookup by MRN - auto-populate demographics and vitals if found
  const handlePatientLookup = async (mrn: string) => {
    if (!mrn.trim()) return;

    setIsLookingUpPatient(true);
    try {
      // Use HandoffService to query for existing patient data
      const packets = await HandoffService.listPackets({
        search: mrn,
      });

      if (packets && packets.length > 0) {
        // Get the most recent packet for this MRN
        const recentPacket = packets.find(p => p.patient_mrn === mrn);

        if (recentPacket) {
          // Decrypt PHI if found
          const decryptedName = await HandoffService.decryptPHI(recentPacket.patient_name_encrypted || '');
          const decryptedDOB = await HandoffService.decryptPHI(recentPacket.patient_dob_encrypted || '');

          // Auto-populate form
          setFormData({
            ...formData,
            patient_name: decryptedName,
            patient_dob: decryptedDOB,
            patient_gender: recentPacket.patient_gender,
            vitals: recentPacket.clinical_data?.vitals || {},
          });

          // Auto-populate medications if available
          if (recentPacket.clinical_data?.medications_prescribed) {
            setMedicationsPrescribed(recentPacket.clinical_data.medications_prescribed);
          }
          if (recentPacket.clinical_data?.medications_current) {
            setMedicationsCurrent(recentPacket.clinical_data.medications_current);
          }

          // Auto-populate allergies
          if (recentPacket.clinical_data?.allergies) {
            setAllergies(recentPacket.clinical_data.allergies);
          }

          toast.success('Patient information loaded from previous transfer!');
        } else {
          toast.info('No previous transfer found for this MRN. Please enter patient information.');
        }
      } else {
        toast.info('No previous transfer found for this MRN. Please enter patient information.');
      }
    } catch (error) {

      toast.info('No previous transfer found. Please enter patient information.');
    } finally {
      setIsLookingUpPatient(false);
    }
  };

  const steps = [
    { number: 1, title: 'Patient Demographics', icon: '👤' },
    { number: 2, title: 'Reason for Transfer', icon: '🚑' },
    { number: 3, title: 'Clinical Snapshot', icon: '💊' },
    { number: 4, title: 'Sender Info', icon: '📞' },
    { number: 5, title: 'Attachments', icon: '📎' },
  ];

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.patient_name.trim()) {
          toast.error('Patient name is required');
          return false;
        }
        if (!formData.patient_dob) {
          toast.error('Date of birth is required');
          return false;
        }
        if (!formData.sending_facility.trim()) {
          toast.error('Sending facility is required');
          return false;
        }
        return true;

      case 2:
        if (!formData.reason_for_transfer.trim()) {
          toast.error('Reason for transfer is required');
          return false;
        }
        if (!formData.urgency_level) {
          toast.error('Urgency level is required');
          return false;
        }
        return true;

      case 4:
        if (!formData.sender_provider_name.trim()) {
          toast.error('Provider name is required');
          return false;
        }
        if (!formData.sender_callback_number.trim()) {
          toast.error('Callback number is required');
          return false;
        }
        return true;

      case 5:
        if (!formData.receiving_facility.trim()) {
          toast.error('Receiving facility is required');
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;

    setIsSubmitting(true);

    try {
      // Prepare clinical data
      const clinicalData = {
        vitals: formData.vitals,
        medications_given: medicationsGiven,
        medications_prescribed: medicationsPrescribed,
        medications_current: medicationsCurrent,
        allergies,
        labs,
        notes: formData.notes,
      };

      // Create packet
      const request: CreateHandoffPacketRequest = {
        patient_name: formData.patient_name,
        patient_dob: formData.patient_dob,
        patient_mrn: formData.patient_mrn,
        patient_gender: formData.patient_gender,
        sending_facility: formData.sending_facility,
        receiving_facility: formData.receiving_facility,
        urgency_level: formData.urgency_level,
        reason_for_transfer: formData.reason_for_transfer,
        clinical_data: clinicalData,
        sender_provider_name: formData.sender_provider_name,
        sender_callback_number: formData.sender_callback_number,
        sender_notes: formData.sender_notes,
      };

      const { packet, access_url } = await HandoffService.createPacket(request);

      // Upload attachments
      if (attachments.length > 0) {
        toast.info(`Uploading ${attachments.length} attachment(s)...`);
        for (const file of attachments) {
          await HandoffService.uploadAttachment({
            file,
            handoff_packet_id: packet.id,
          });
        }
      }

      // Send the packet
      await HandoffService.sendPacket({
        packet_id: packet.id,
      });

      setCompletedPacket({
        packetNumber: packet.packet_number,
        accessUrl: access_url,
      });

      toast.success('Transfer packet sent successfully!');

      if (onPacketCreated) {
        onPacketCreated(packet, access_url);
      }
    } catch (error: any) {

      toast.error(`Failed to submit: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Medication management - Given during visit
  const addMedicationGiven = () => {
    setMedicationsGiven([
      ...medicationsGiven,
      { name: '', dosage: '', route: '', frequency: '', category: 'given' },
    ]);
  };

  const updateMedicationGiven = (index: number, field: keyof Medication, value: string) => {
    const updated = [...medicationsGiven];
    updated[index] = { ...updated[index], [field]: value };
    setMedicationsGiven(updated);
  };

  const removeMedicationGiven = (index: number) => {
    setMedicationsGiven(medicationsGiven.filter((_, i) => i !== index));
  };

  // Medication management - Currently prescribed
  const addMedicationPrescribed = () => {
    setMedicationsPrescribed([
      ...medicationsPrescribed,
      { name: '', dosage: '', route: '', frequency: '', category: 'prescribed' },
    ]);
  };

  const updateMedicationPrescribed = (index: number, field: keyof Medication, value: string) => {
    const updated = [...medicationsPrescribed];
    updated[index] = { ...updated[index], [field]: value };
    setMedicationsPrescribed(updated);
  };

  const removeMedicationPrescribed = (index: number) => {
    setMedicationsPrescribed(medicationsPrescribed.filter((_, i) => i !== index));
  };

  // Medication management - Currently taking (including OTC)
  const addMedicationCurrent = () => {
    setMedicationsCurrent([
      ...medicationsCurrent,
      { name: '', dosage: '', route: '', frequency: '', category: 'current' },
    ]);
  };

  const updateMedicationCurrent = (index: number, field: keyof Medication, value: string) => {
    const updated = [...medicationsCurrent];
    updated[index] = { ...updated[index], [field]: value };
    setMedicationsCurrent(updated);
  };

  const removeMedicationCurrent = (index: number) => {
    setMedicationsCurrent(medicationsCurrent.filter((_, i) => i !== index));
  };

  const addAllergy = () => {
    setAllergies([...allergies, { allergen: '', reaction: '', severity: 'mild' }]);
  };

  const updateAllergy = (index: number, field: keyof Allergy, value: string) => {
    const updated = [...allergies];
    updated[index] = { ...updated[index], [field]: value };
    setAllergies(updated);
  };

  const removeAllergy = (index: number) => {
    setAllergies(allergies.filter((_, i) => i !== index));
  };

  // Lab management
  const addLab = () => {
    setLabs([
      ...labs,
      { test_name: '', value: '', unit: '', reference_range: '', abnormal: false },
    ]);
  };

  const updateLab = (index: number, field: string, value: any) => {
    const updated = [...labs];
    updated[index] = { ...updated[index], [field]: value };
    setLabs(updated);
  };

  const removeLab = (index: number) => {
    setLabs(labs.filter((_, i) => i !== index));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter((file) => {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 50MB limit`);
          return false;
        }
        return true;
      });
      setAttachments([...attachments, ...validFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Show confirmation screen after submission
  if (completedPacket) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-600 mb-4">
            Transfer Packet Sent Successfully!
          </h2>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">Packet Number</p>
            <p className="text-xl font-mono font-bold text-green-700">
              {completedPacket.packetNumber}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">Secure Access Link</p>
            <p className="text-xs font-mono text-blue-700 break-all">
              {completedPacket.accessUrl}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(completedPacket.accessUrl);
                toast.success('Link copied to clipboard!');
              }}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              📋 Copy Link
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            Share this secure link with the receiving facility. It expires in 72 hours.
          </p>

          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Send Another Transfer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🏥 Patient Transfer - Lite Sender Portal
        </h1>
        <p className="text-gray-600">Secure patient handoff - No login required</p>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-between mb-8">
        {steps.map((step) => (
          <div
            key={step.number}
            className={`flex flex-col items-center ${
              step.number === currentStep
                ? 'text-blue-600'
                : step.number < currentStep
                ? 'text-green-600'
                : 'text-gray-400'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 ${
                step.number === currentStep
                  ? 'bg-blue-100 border-2 border-blue-600'
                  : step.number < currentStep
                  ? 'bg-green-100 border-2 border-green-600'
                  : 'bg-gray-100 border-2 border-gray-300'
              }`}
            >
              {step.icon}
            </div>
            <p className="text-xs font-medium text-center">{step.title}</p>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px] mb-6">
        {/* Step 1: Patient Demographics */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              👤 Patient Demographics
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient Name *
              </label>
              <input
                type="text"
                value={formData.patient_name}
                onChange={(e) =>
                  setFormData({ ...formData, patient_name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth *
              </label>
              <input
                type="date"
                value={formData.patient_dob}
                onChange={(e) =>
                  setFormData({ ...formData, patient_dob: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  MRN (Optional - Auto-fills if found)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.patient_mrn}
                    onChange={(e) =>
                      setFormData({ ...formData, patient_mrn: e.target.value })
                    }
                    onBlur={(e) => handlePatientLookup(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="123456"
                  />
                  <button
                    type="button"
                    onClick={() => handlePatientLookup(formData.patient_mrn || '')}
                    disabled={isLookingUpPatient || !formData.patient_mrn}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                  >
                    {isLookingUpPatient ? '🔍' : '🔍 Lookup'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Auto-populates patient data from previous transfers</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  value={formData.patient_gender || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      patient_gender: e.target.value as 'M' | 'F' | 'X' | 'U',
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="X">Non-binary</option>
                  <option value="U">Unknown</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sending Facility *
              </label>
              <input
                type="text"
                value={formData.sending_facility}
                onChange={(e) =>
                  setFormData({ ...formData, sending_facility: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Community Hospital - ER"
              />
            </div>
          </div>
        )}

        {/* Step 2: Reason for Transfer */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              🚑 Reason for Transfer
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chief Complaint / Reason *
              </label>
              <textarea
                value={formData.reason_for_transfer}
                onChange={(e) =>
                  setFormData({ ...formData, reason_for_transfer: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Patient presenting with chest pain, needs cardiac catheterization..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Urgency Level *
              </label>
              <div className="grid grid-cols-4 gap-3">
                {(['routine', 'urgent', 'emergent', 'critical'] as UrgencyLevel[]).map(
                  (level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency_level: level })}
                      className={`px-4 py-3 border-2 rounded-lg font-medium transition-all ${
                        formData.urgency_level === level
                          ? level === 'routine'
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : level === 'urgent'
                            ? 'border-yellow-600 bg-yellow-50 text-yellow-700'
                            : level === 'emergent'
                            ? 'border-orange-600 bg-orange-50 text-orange-700'
                            : 'border-red-600 bg-red-50 text-red-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Clinical Snapshot */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">💊 Clinical Snapshot</h2>

            {/* Vitals */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-700 mb-3">Last Vitals</h3>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="BP Systolic"
                  value={formData.vitals?.blood_pressure_systolic || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vitals: {
                        ...formData.vitals,
                        blood_pressure_systolic: parseInt(e.target.value) || undefined,
                      },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="BP Diastolic"
                  value={formData.vitals?.blood_pressure_diastolic || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vitals: {
                        ...formData.vitals,
                        blood_pressure_diastolic: parseInt(e.target.value) || undefined,
                      },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Heart Rate"
                  value={formData.vitals?.heart_rate || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vitals: {
                        ...formData.vitals,
                        heart_rate: parseInt(e.target.value) || undefined,
                      },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Temp (°F)"
                  value={formData.vitals?.temperature || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vitals: {
                        ...formData.vitals,
                        temperature: parseFloat(e.target.value) || undefined,
                        temperature_unit: 'F',
                      },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="O2 Sat %"
                  value={formData.vitals?.oxygen_saturation || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vitals: {
                        ...formData.vitals,
                        oxygen_saturation: parseInt(e.target.value) || undefined,
                      },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Resp Rate"
                  value={formData.vitals?.respiratory_rate || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vitals: {
                        ...formData.vitals,
                        respiratory_rate: parseInt(e.target.value) || undefined,
                      },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Medications Given During Visit */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-blue-800">💉 Medications Given During Visit</h3>
                <button
                  type="button"
                  onClick={addMedicationGiven}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  + Add Med
                </button>
              </div>
              {medicationsGiven.map((med, index) => (
                <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Medication"
                    value={med.name}
                    onChange={(e) => updateMedicationGiven(index, 'name', e.target.value)}
                    className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Dosage"
                    value={med.dosage}
                    onChange={(e) => updateMedicationGiven(index, 'dosage', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Route"
                    value={med.route || ''}
                    onChange={(e) => updateMedicationGiven(index, 'route', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeMedicationGiven(index)}
                    className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Currently Prescribed Medications */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-purple-800">📋 Currently Prescribed Medications</h3>
                <button
                  type="button"
                  onClick={addMedicationPrescribed}
                  className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                >
                  + Add Med
                </button>
              </div>
              {medicationsPrescribed.map((med, index) => (
                <div key={index} className="grid grid-cols-6 gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Medication"
                    value={med.name}
                    onChange={(e) => updateMedicationPrescribed(index, 'name', e.target.value)}
                    className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Dosage"
                    value={med.dosage}
                    onChange={(e) => updateMedicationPrescribed(index, 'dosage', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Route"
                    value={med.route || ''}
                    onChange={(e) => updateMedicationPrescribed(index, 'route', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Frequency"
                    value={med.frequency || ''}
                    onChange={(e) => updateMedicationPrescribed(index, 'frequency', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeMedicationPrescribed(index)}
                    className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Medications Currently Taking (Including OTC) */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-green-800">💊 Currently Taking (Including OTC)</h3>
                <button
                  type="button"
                  onClick={addMedicationCurrent}
                  className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                >
                  + Add Med
                </button>
              </div>
              {medicationsCurrent.map((med, index) => (
                <div key={index} className="grid grid-cols-6 gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Medication/Supplement"
                    value={med.name}
                    onChange={(e) => updateMedicationCurrent(index, 'name', e.target.value)}
                    className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Dosage"
                    value={med.dosage}
                    onChange={(e) => updateMedicationCurrent(index, 'dosage', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Route"
                    value={med.route || ''}
                    onChange={(e) => updateMedicationCurrent(index, 'route', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Frequency"
                    value={med.frequency || ''}
                    onChange={(e) => updateMedicationCurrent(index, 'frequency', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeMedicationCurrent(index)}
                    className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Allergies */}
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-red-800">⚠️ Allergies</h3>
                <button
                  type="button"
                  onClick={addAllergy}
                  className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                >
                  + Add Allergy
                </button>
              </div>
              {allergies.map((allergy, index) => (
                <div key={index} className="grid grid-cols-4 gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Allergen"
                    value={allergy.allergen}
                    onChange={(e) => updateAllergy(index, 'allergen', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Reaction"
                    value={allergy.reaction}
                    onChange={(e) => updateAllergy(index, 'reaction', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <select
                    value={allergy.severity || 'mild'}
                    onChange={(e) =>
                      updateAllergy(
                        index,
                        'severity',
                        e.target.value as 'mild' | 'moderate' | 'severe' | 'life-threatening'
                      )
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                    <option value="life-threatening">Life-threatening</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeAllergy(index)}
                    className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Lab Results - Structured for Analytics */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-yellow-800">🔬 Lab Results (Optional - for analytics)</h3>
                <button
                  type="button"
                  onClick={addLab}
                  className="px-3 py-1 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700"
                >
                  + Add Lab
                </button>
              </div>
              <p className="text-xs text-yellow-700 mb-2">Enter key lab values for analytics. Attach full lab reports in Step 5.</p>
              {labs.map((lab, index) => (
                <div key={index} className="grid grid-cols-6 gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Test Name"
                    value={lab.test_name}
                    onChange={(e) => updateLab(index, 'test_name', e.target.value)}
                    className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={lab.value}
                    onChange={(e) => updateLab(index, 'value', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={lab.unit || ''}
                    onChange={(e) => updateLab(index, 'unit', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <div className="flex items-center px-3">
                    <label className="flex items-center text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lab.abnormal || false}
                        onChange={(e) => updateLab(index, 'abnormal', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-gray-700">Abnormal</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLab(index)}
                    className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Clinical Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Clinical Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Any additional clinical information..."
              />
            </div>
          </div>
        )}

        {/* Step 4: Sender Info */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📞 Sender Information</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider Name *
              </label>
              <input
                type="text"
                value={formData.sender_provider_name}
                onChange={(e) =>
                  setFormData({ ...formData, sender_provider_name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Dr. Jane Smith, MD"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Callback Number *
              </label>
              <input
                type="tel"
                value={formData.sender_callback_number}
                onChange={(e) =>
                  setFormData({ ...formData, sender_callback_number: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                value={formData.sender_notes}
                onChange={(e) =>
                  setFormData({ ...formData, sender_notes: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Special instructions, follow-up needed, etc..."
              />
            </div>
          </div>
        )}

        {/* Step 5: Attachments */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📎 Attachments</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Receiving Facility *
              </label>
              <input
                type="text"
                value={formData.receiving_facility}
                onChange={(e) =>
                  setFormData({ ...formData, receiving_facility: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="University Medical Center - Cardiology"
              />
            </div>

            <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
              <label className="block text-center cursor-pointer">
                <div className="text-4xl mb-2">📁</div>
                <p className="text-gray-700 font-medium mb-1">
                  Upload Labs, EKG, Imaging
                </p>
                <p className="text-sm text-gray-500 mb-3">
                  PDF, JPG, PNG (max 50MB each)
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <span className="px-4 py-2 bg-blue-600 text-white rounded-lg inline-block hover:bg-blue-700">
                  Select Files
                </span>
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  {attachments.length} file(s) selected:
                </p>
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">📄</span>
                      <div>
                        <p className="font-medium text-sm">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6 border-t border-gray-200">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            currentStep === 1
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          ← Previous
        </button>

        {currentStep < 5 ? (
          <button
            onClick={handleNext}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              isSubmitting
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isSubmitting ? 'Sending...' : '📤 Send Secure Packet'}
          </button>
        )}
      </div>
    </div>
  );
};

export default LiteSenderPortal;
