/**
 * Business Logic Hook for LiteSenderPortal
 * Handles all state management and API operations for patient transfer forms
 */

import { useState } from 'react';
import { toast } from 'react-toastify';
import HandoffService from '../../../services/handoffService';
import type {
  CompleteHandoffFormData,
  UrgencyLevel,
  VitalSigns,
  Medication,
  Allergy,
  CreateHandoffPacketRequest,
} from '../../../types/handoff';

export interface UseLiteSenderLogicProps {
  facilityName?: string;
  onPacketCreated?: (packet: any, accessUrl: string) => void;
}

export interface UseLiteSenderLogicReturn {
  // State
  currentStep: number;
  isSubmitting: boolean;
  completedPacket: { packetNumber: string; accessUrl: string } | null;
  formData: CompleteHandoffFormData;
  medicationsGiven: Medication[];
  medicationsPrescribed: Medication[];
  medicationsCurrent: Medication[];
  allergies: Allergy[];
  labs: any[];
  attachments: File[];
  isLookingUpPatient: boolean;

  // Navigation
  setCurrentStep: (step: number | ((prev: number) => number)) => void;
  handleNext: () => void;
  handlePrevious: () => void;

  // Form updates
  setFormData: (data: CompleteHandoffFormData | ((prev: CompleteHandoffFormData) => CompleteHandoffFormData)) => void;

  // Patient lookup
  handlePatientLookup: (mrn: string) => Promise<void>;

  // Submission
  handleSubmit: () => Promise<void>;
  validateStep: (step: number) => boolean;

  // Medication management - Given
  addMedicationGiven: () => void;
  updateMedicationGiven: (index: number, field: keyof Medication, value: string) => void;
  removeMedicationGiven: (index: number) => void;

  // Medication management - Prescribed
  addMedicationPrescribed: () => void;
  updateMedicationPrescribed: (index: number, field: keyof Medication, value: string) => void;
  removeMedicationPrescribed: (index: number) => void;

  // Medication management - Current
  addMedicationCurrent: () => void;
  updateMedicationCurrent: (index: number, field: keyof Medication, value: string) => void;
  removeMedicationCurrent: (index: number) => void;

  // Allergy management
  addAllergy: () => void;
  updateAllergy: (index: number, field: keyof Allergy, value: string) => void;
  removeAllergy: (index: number) => void;

  // Lab management
  addLab: () => void;
  updateLab: (index: number, field: string, value: any) => void;
  removeLab: (index: number) => void;

  // File handling
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeAttachment: (index: number) => void;
}

export function useLiteSenderLogic({
  facilityName,
  onPacketCreated,
}: UseLiteSenderLogicProps): UseLiteSenderLogicReturn {
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

  return {
    // State
    currentStep,
    isSubmitting,
    completedPacket,
    formData,
    medicationsGiven,
    medicationsPrescribed,
    medicationsCurrent,
    allergies,
    labs,
    attachments,
    isLookingUpPatient,

    // Navigation
    setCurrentStep,
    handleNext,
    handlePrevious,

    // Form updates
    setFormData,

    // Patient lookup
    handlePatientLookup,

    // Submission
    handleSubmit,
    validateStep,

    // Medication management - Given
    addMedicationGiven,
    updateMedicationGiven,
    removeMedicationGiven,

    // Medication management - Prescribed
    addMedicationPrescribed,
    updateMedicationPrescribed,
    removeMedicationPrescribed,

    // Medication management - Current
    addMedicationCurrent,
    updateMedicationCurrent,
    removeMedicationCurrent,

    // Allergy management
    addAllergy,
    updateAllergy,
    removeAllergy,

    // Lab management
    addLab,
    updateLab,
    removeLab,

    // File handling
    handleFileSelect,
    removeAttachment,
  };
}
