/**
 * SOAP Note Service Tests
 * Tests for clinical SOAP note generation, storage, and retrieval
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  generateSOAPNote,
  saveSOAPNote,
  getSOAPNote,
  updateSOAPNote,
  fetchClinicalDataForEncounter
} from '../soapNoteService';
import { supabase } from '../../lib/supabaseClient';
import type { ClinicalData, SOAPNoteData } from '../soapNoteService';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn()
  }
}));

// Mock auditLogger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    phi: vi.fn().mockResolvedValue(undefined),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

const mockSupabase = supabase as unknown as {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
};

describe('SOAPNoteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockClinicalData: ClinicalData = {
    chiefComplaint: 'Chest pain, shortness of breath',
    vitals: {
      temperature: 98.6,
      blood_pressure_systolic: 130,
      blood_pressure_diastolic: 85,
      heart_rate: 88,
      respiratory_rate: 18,
      oxygen_saturation: 96
    },
    diagnoses: [
      { code: 'I10', display: 'Essential hypertension', clinical_status: 'active' },
      { code: 'E11.9', display: 'Type 2 diabetes mellitus', clinical_status: 'active' }
    ],
    medications: [
      { medication_name: 'Metformin', dosage: '500mg', frequency: 'twice daily' },
      { medication_name: 'Lisinopril', dosage: '10mg', frequency: 'once daily' }
    ],
    labResults: [
      { test_name: 'HbA1c', value: '7.2', unit: '%', interpretation: 'above target' },
      { test_name: 'Creatinine', value: '1.1', unit: 'mg/dL' }
    ],
    reviewOfSystems: {
      Constitutional: 'No fever, chills, or weight loss',
      Cardiovascular: 'Chest pain with exertion',
      Respiratory: 'Mild dyspnea on exertion'
    }
  };

  describe('generateSOAPNote', () => {
    it('should generate complete SOAP note from clinical data', async () => {
      const result = await generateSOAPNote('encounter-123', mockClinicalData);

      expect(result.subjective).toContain('Chief Complaint');
      expect(result.subjective).toContain('Chest pain');
      expect(result.objective).toContain('Vitals');
      expect(result.objective).toContain('BP: 130/85');
      expect(result.assessment).toContain('Essential hypertension');
      expect(result.plan).toContain('Metformin');
    });

    it('should throw error when encounter ID is missing', async () => {
      await expect(
        generateSOAPNote('', mockClinicalData)
      ).rejects.toThrow('Encounter ID is required');
    });

    it('should generate HPI section when chief complaint provided', async () => {
      const result = await generateSOAPNote('encounter-123', mockClinicalData);

      expect(result.hpi).toBeDefined();
      expect(result.hpi).toContain('Patient presents with');
      expect(result.hpi).toContain('Chest pain');
    });

    it('should generate ROS section when review of systems provided', async () => {
      const result = await generateSOAPNote('encounter-123', mockClinicalData);

      expect(result.ros).toBeDefined();
      expect(result.ros).toContain('Constitutional');
      expect(result.ros).toContain('Cardiovascular');
    });

    it('should handle missing optional data gracefully', async () => {
      const minimalData: ClinicalData = {};
      const result = await generateSOAPNote('encounter-123', minimalData);

      expect(result.subjective).toBe('No subjective data documented.');
      expect(result.objective).toBe('No objective findings documented.');
      expect(result.assessment).toBe('Assessment pending further evaluation.');
    });

    it('should include lab results in objective section', async () => {
      const result = await generateSOAPNote('encounter-123', mockClinicalData);

      expect(result.objective).toContain('Laboratory Results');
      expect(result.objective).toContain('HbA1c');
      expect(result.objective).toContain('7.2');
    });

    it('should list all diagnoses in assessment section', async () => {
      const result = await generateSOAPNote('encounter-123', mockClinicalData);

      expect(result.assessment).toContain('1. Essential hypertension (I10)');
      expect(result.assessment).toContain('2. Type 2 diabetes mellitus (E11.9)');
    });

    it('should list medications in plan section', async () => {
      const result = await generateSOAPNote('encounter-123', mockClinicalData);

      expect(result.plan).toContain('Medications:');
      expect(result.plan).toContain('Metformin 500mg twice daily');
      expect(result.plan).toContain('Lisinopril 10mg once daily');
    });
  });

  describe('saveSOAPNote', () => {
    it('should save SOAP note components to database', async () => {
      const soapNoteData: SOAPNoteData = {
        encounter_id: 'encounter-123',
        author_id: 'author-456',
        patient_id: 'patient-789',
        subjective: 'Chief Complaint: Chest pain',
        objective: 'Vitals: BP 130/85',
        assessment: '1. Hypertension',
        plan: 'Continue medications',
        hpi: 'Patient presents with chest pain',
        ros: 'Constitutional: No fever'
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'encounters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-123', patient_id: 'patient-789' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'clinical_notes') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: [
                  { id: 'note-1' },
                  { id: 'note-2' },
                  { id: 'note-3' },
                  { id: 'note-4' },
                  { id: 'note-5' },
                  { id: 'note-6' }
                ],
                error: null
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await saveSOAPNote(soapNoteData);

      expect(result.success).toBe(true);
      expect(result.note_ids).toHaveLength(6);
    });

    it('should throw error when encounter ID is missing', async () => {
      const invalidData: SOAPNoteData = {
        encounter_id: '',
        author_id: 'author-456',
        patient_id: 'patient-789',
        subjective: 'Test',
        objective: 'Test',
        assessment: 'Test',
        plan: 'Test'
      };

      await expect(saveSOAPNote(invalidData)).rejects.toThrow('required');
    });

    it('should throw error when encounter not found', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      } as any));

      const soapNoteData: SOAPNoteData = {
        encounter_id: 'non-existent',
        author_id: 'author-456',
        patient_id: 'patient-789',
        subjective: 'Test',
        objective: 'Test',
        assessment: 'Test',
        plan: 'Test'
      };

      await expect(saveSOAPNote(soapNoteData)).rejects.toThrow('Encounter not found');
    });

    it('should throw error when database insert fails', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'encounters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-123', patient_id: 'patient-789' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'clinical_notes') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Insert failed' }
              })
            })
          } as any;
        }
        return {} as any;
      });

      const soapNoteData: SOAPNoteData = {
        encounter_id: 'encounter-123',
        author_id: 'author-456',
        patient_id: 'patient-789',
        subjective: 'Test',
        objective: 'Test',
        assessment: 'Test',
        plan: 'Test'
      };

      await expect(saveSOAPNote(soapNoteData)).rejects.toThrow('Failed to save');
    });
  });

  describe('getSOAPNote', () => {
    it('should retrieve complete SOAP note for encounter', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      const mockNotes = [
        { type: 'subjective', content: 'Chief Complaint: Chest pain' },
        { type: 'objective', content: 'Vitals: BP 130/85' },
        { type: 'assessment', content: '1. Hypertension' },
        { type: 'plan', content: 'Continue medications' },
        { type: 'hpi', content: 'Patient presents with chest pain' },
        { type: 'ros', content: 'Constitutional: No fever' }
      ];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: mockNotes,
              error: null
            })
          })
        })
      } as any));

      const result = await getSOAPNote('encounter-123');

      expect(result).not.toBeNull();
      expect(result?.subjective).toBe('Chief Complaint: Chest pain');
      expect(result?.objective).toBe('Vitals: BP 130/85');
      expect(result?.assessment).toBe('1. Hypertension');
      expect(result?.plan).toBe('Continue medications');
      expect(result?.hpi).toBe('Patient presents with chest pain');
      expect(result?.ros).toBe('Constitutional: No fever');
    });

    it('should return null when no SOAP note exists', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      } as any));

      const result = await getSOAPNote('encounter-no-notes');

      expect(result).toBeNull();
    });

    it('should throw error when fetch fails', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Fetch failed' }
            })
          })
        })
      } as any));

      await expect(getSOAPNote('encounter-123')).rejects.toThrow('Failed to fetch');
    });
  });

  describe('updateSOAPNote', () => {
    it('should update specified SOAP note components', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      mockSupabase.from.mockImplementation(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        })
      } as any));

      const result = await updateSOAPNote('encounter-123', {
        assessment: 'Updated assessment',
        plan: 'Updated plan'
      });

      expect(result.success).toBe(true);
    });

    it('should throw error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      } as any);

      await expect(
        updateSOAPNote('encounter-123', { assessment: 'Updated' })
      ).rejects.toThrow('not authenticated');
    });

    it('should throw error when update fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      mockSupabase.from.mockImplementation(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { message: 'Update failed' }
            })
          })
        })
      } as any));

      await expect(
        updateSOAPNote('encounter-123', { assessment: 'Updated' })
      ).rejects.toThrow('Failed to update');
    });

    it('should only update valid SOAP component types', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      } as any);

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      });

      mockSupabase.from.mockImplementation(() => ({
        update: mockUpdate
      } as any));

      await updateSOAPNote('encounter-123', {
        subjective: 'Updated subjective',
        objective: 'Updated objective'
      });

      // Should be called twice - once for subjective, once for objective
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchClinicalDataForEncounter', () => {
    it('should fetch clinical data from FHIR resources', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'encounters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'encounter-123',
                    patient_id: 'patient-456',
                    chief_complaint: 'Chest pain'
                  },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'fhir_observations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        code: { coding: [{ code: '8310-5' }] },
                        value_quantity_value: 98.6
                      },
                      {
                        code: { coding: [{ code: '8480-6' }] },
                        value_quantity_value: 130
                      },
                      {
                        code: { coding: [{ code: '8867-4' }] },
                        value_quantity_value: 88
                      }
                    ],
                    error: null
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'fhir_conditions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          code: { coding: [{ code: 'I10', display: 'Hypertension' }] },
                          clinical_status: 'active'
                        }
                      ],
                      error: null
                    })
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'fhir_medication_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          medication_codeable_concept: {
                            coding: [{ display: 'Lisinopril' }]
                          },
                          dosage_instruction: [{
                            dose_and_rate: [{ dose_quantity: { value: '10mg' } }],
                            timing: { code: { text: 'once daily' } }
                          }]
                        }
                      ],
                      error: null
                    })
                  })
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await fetchClinicalDataForEncounter('encounter-123');

      expect(result.chiefComplaint).toBe('Chest pain');
      expect(result.vitals?.temperature).toBe(98.6);
      expect(result.vitals?.blood_pressure_systolic).toBe(130);
      expect(result.diagnoses).toHaveLength(1);
      expect(result.diagnoses?.[0].display).toBe('Hypertension');
      expect(result.medications).toHaveLength(1);
      expect(result.medications?.[0].medication_name).toBe('Lisinopril');
    });

    it('should throw error when encounter not found', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      } as any));

      await expect(
        fetchClinicalDataForEncounter('non-existent')
      ).rejects.toThrow('Encounter not found');
    });

    it('should return empty arrays when no FHIR data exists', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'encounters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-123', patient_id: 'patient-456' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'fhir_observations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'fhir_conditions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [],
                      error: null
                    })
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'fhir_medication_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [],
                      error: null
                    })
                  })
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await fetchClinicalDataForEncounter('encounter-123');

      expect(result.diagnoses).toEqual([]);
      expect(result.medications).toEqual([]);
    });
  });

  describe('vitals parsing', () => {
    it('should parse all vital sign LOINC codes correctly', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'encounters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-123', patient_id: 'patient-456' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'fhir_observations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      { code: { coding: [{ code: '8310-5' }] }, value_quantity_value: 98.6 }, // temp
                      { code: { coding: [{ code: '8480-6' }] }, value_quantity_value: 120 }, // systolic
                      { code: { coding: [{ code: '8462-4' }] }, value_quantity_value: 80 }, // diastolic
                      { code: { coding: [{ code: '8867-4' }] }, value_quantity_value: 72 }, // heart rate
                      { code: { coding: [{ code: '9279-1' }] }, value_quantity_value: 16 }, // respiratory rate
                      { code: { coding: [{ code: '59408-5' }] }, value_quantity_value: 98 }, // O2 sat
                      { code: { coding: [{ code: '29463-7' }] }, value_quantity_value: 70 }, // weight
                      { code: { coding: [{ code: '8302-2' }] }, value_quantity_value: 170 } // height
                    ],
                    error: null
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'fhir_conditions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null })
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'fhir_medication_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null })
                  })
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await fetchClinicalDataForEncounter('encounter-123');

      expect(result.vitals?.temperature).toBe(98.6);
      expect(result.vitals?.blood_pressure_systolic).toBe(120);
      expect(result.vitals?.blood_pressure_diastolic).toBe(80);
      expect(result.vitals?.heart_rate).toBe(72);
      expect(result.vitals?.respiratory_rate).toBe(16);
      expect(result.vitals?.oxygen_saturation).toBe(98);
      expect(result.vitals?.weight).toBe(70);
      expect(result.vitals?.height).toBe(170);
    });
  });

  describe('PHI audit logging', () => {
    it('should log PHI access when fetching clinical data', async () => {
      const { auditLogger } = await import('../auditLogger');

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'encounters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-123', patient_id: 'patient-456' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'fhir_observations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null })
                })
              })
            })
          } as any;
        }
        if (table === 'fhir_conditions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null })
                  })
                })
              })
            })
          } as any;
        }
        if (table === 'fhir_medication_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null })
                  })
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      await fetchClinicalDataForEncounter('encounter-123');

      expect(auditLogger.phi).toHaveBeenCalledWith(
        'SOAP_NOTE_CLINICAL_DATA_READ',
        'patient-456',
        expect.objectContaining({
          resourceType: 'clinical_data_bundle',
          action: 'READ',
          encounterId: 'encounter-123',
          purpose: 'soap_note_generation'
        })
      );
    });

    it('should log PHI access when saving SOAP note', async () => {
      const { auditLogger } = await import('../auditLogger');

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'encounters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'encounter-123', patient_id: 'patient-456' },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'clinical_notes') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: [{ id: 'note-1' }],
                error: null
              })
            })
          } as any;
        }
        return {} as any;
      });

      const soapNoteData: SOAPNoteData = {
        encounter_id: 'encounter-123',
        author_id: 'author-456',
        patient_id: 'patient-789',
        subjective: 'Test',
        objective: 'Test',
        assessment: 'Test',
        plan: 'Test'
      };

      await saveSOAPNote(soapNoteData);

      expect(auditLogger.phi).toHaveBeenCalledWith(
        'SOAP_NOTE_CREATE',
        'encounter-123',
        expect.objectContaining({
          resourceType: 'clinical_note',
          action: 'CREATE'
        })
      );
    });
  });
});
