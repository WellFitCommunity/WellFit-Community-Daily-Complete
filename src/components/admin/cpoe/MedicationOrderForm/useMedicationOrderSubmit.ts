/**
 * useMedicationOrderSubmit — orchestrates the CPOE submit pipeline for
 * MedicationOrderForm.
 *
 * Pipeline (ONC 170.315(a)(1), (a)(9)):
 *   1. validate the form
 *   2. confirm useOrderingProvider has tenant + user identity (RLS gate)
 *   3. if RxNorm is provided AND no prior CDS acknowledgment, run
 *      checkDrugInteractions; if any contraindicated/high severity result
 *      surfaces, return the alerts so the caller can open the override modal
 *   4. otherwise call MedicationRequestService.create with the FHIR payload
 *
 * Extracted from MedicationOrderForm/index.tsx purely to keep the form
 * file under the 600-line god-file cap (Commandment #12).
 */

import { useCallback, useState } from 'react';
import { MedicationRequestService } from '../../../../services/fhir/MedicationRequestService';
import {
  checkDrugInteractions,
  type DrugInteraction,
} from '../../../../services/drugInteractionService';
import { auditLogger } from '../../../../services/auditLogger';
import { FREQUENCY_PRESETS } from '../../../../constants/cpoe';
import type { CreateMedicationRequest } from '../../../../types/fhir/medications';
import type { OrderingProvider } from '../../../../hooks/useOrderingProvider';
import type {
  MedicationOrderFormData,
  MedicationOrderSubmitError,
} from './MedicationOrderForm.types';

interface UseMedicationOrderSubmitArgs {
  formData: MedicationOrderFormData;
  patientId: string;
  encounterId?: string;
  provider: OrderingProvider;
  dosagePreview: string;
  validate: (data: MedicationOrderFormData) => Record<string, string>;
  onSubmitted?: (medicationRequestId: string) => void;
  setErrors: (errors: Record<string, string>) => void;
}

export interface UseMedicationOrderSubmitResult {
  submitting: boolean;
  cdsChecking: boolean;
  cdsAlerts: DrugInteraction[] | null;
  submitError: MedicationOrderSubmitError | null;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleCdsAcknowledge: (overrideReason: string) => Promise<void>;
  handleCdsCancel: () => void;
  /** Manual reset — used by tests / cancel flows */
  resetSubmitError: () => void;
}

export function useMedicationOrderSubmit({
  formData,
  patientId,
  encounterId,
  provider,
  dosagePreview,
  validate,
  onSubmitted,
  setErrors,
}: UseMedicationOrderSubmitArgs): UseMedicationOrderSubmitResult {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<MedicationOrderSubmitError | null>(null);
  const [cdsAlerts, setCdsAlerts] = useState<DrugInteraction[] | null>(null);
  const [cdsChecking, setCdsChecking] = useState(false);
  const [cdsAcknowledged, setCdsAcknowledged] = useState(false);

  const persistOrder = useCallback(
    async (overrideReason?: string) => {
      if (!provider.tenant_id || !provider.user_id) return;

      // Note: NDC is captured on the form solely to drive the ONC (a)(10)
      // formulary lookup. fhir_medication_requests has no ndc_code column —
      // the canonical FHIR medication code is medication_code +
      // medication_code_system (RxNorm by default). The form's ndc_code
      // is intentionally NOT persisted on the MedicationRequest.
      const preset = FREQUENCY_PRESETS.find((p) => p.label === formData.frequency_preset);
      const request: CreateMedicationRequest = {
        patient_id: patientId,
        status: 'active',
        intent: 'order',
        medication_code: formData.medication_code || formData.medication_display,
        medication_code_system: formData.medication_code_system,
        medication_display: formData.medication_display.trim(),
        dosage_text: dosagePreview,
        dosage_dose_quantity: Number(formData.dose_quantity),
        dosage_dose_unit: formData.dose_unit,
        dosage_route_code: formData.route_code,
        dosage_route_display: formData.route_display,
        dosage_route: formData.route_display,
        dosage_timing_frequency: preset?.frequency,
        dosage_timing_period: preset?.period,
        dosage_timing_period_unit: preset?.periodUnit,
        dosage_patient_instruction: formData.patient_instruction.trim() || undefined,
        reason_code: [formData.indication.trim()],
        priority: formData.priority,
        note: formData.note.trim() || undefined,
        authored_on: new Date().toISOString(),
        encounter_id: encounterId,
        tenant_id: provider.tenant_id,
        requester_id: provider.user_id,
        requester_display: provider.display_name ?? undefined,
        requester_practitioner_id: provider.practitioner_id ?? undefined,
      };

      // If the prescriber overrode a CDS alert, prepend the reason to the note
      // so the override is preserved on the FHIR resource itself.
      if (overrideReason) {
        request.note = [
          `CDS override (ONC 170.315(a)(9)): ${overrideReason}`,
          request.note,
        ].filter(Boolean).join('\n\n');
      }

      setSubmitting(true);
      try {
        const result = await MedicationRequestService.create(request);
        if (!result.success || !result.data) {
          const message = result.error || 'Could not create the medication order.';
          setSubmitError({
            message,
            isAllergyAlert: message.toUpperCase().startsWith('ALLERGY ALERT'),
          });
          return;
        }
        if (overrideReason && cdsAlerts) {
          await auditLogger.phi('CDS_INTERACTION_OVERRIDE', patientId, {
            resourceType: 'MedicationRequest',
            resourceId: result.data.id,
            medication: formData.medication_display,
            interactionCount: cdsAlerts.length,
            blockingSeverities: cdsAlerts
              .filter((i) => i.severity === 'contraindicated' || i.severity === 'high')
              .map((i) => i.severity),
            overrideReason,
          });
        }
        onSubmitted?.(result.data.id ?? '');
      } catch (err: unknown) {
        await auditLogger.error(
          'MEDICATION_ORDER_FORM_SUBMIT_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { patientId, medication: formData.medication_display }
        );
        setSubmitError({
          message: 'An unexpected error occurred. Please try again.',
          isAllergyAlert: false,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [formData, patientId, encounterId, dosagePreview, onSubmitted, provider, cdsAlerts]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      const validationErrors = validate(formData);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      if (!provider.tenant_id || !provider.user_id) {
        setSubmitError({
          message:
            provider.error ??
            'Cannot place order — ordering-provider identity is not loaded yet. Try again in a moment.',
          isAllergyAlert: false,
        });
        return;
      }

      const rxnorm = formData.medication_code.trim();
      if (rxnorm && !cdsAcknowledged) {
        setCdsChecking(true);
        try {
          const result = await checkDrugInteractions(
            rxnorm,
            patientId,
            formData.medication_display.trim()
          );
          if (result.has_interactions) {
            const blocking = result.interactions.filter(
              (i) => i.severity === 'contraindicated' || i.severity === 'high'
            );
            if (blocking.length > 0) {
              setCdsAlerts(result.interactions);
              return;
            }
          }
        } catch {
          // Soft fail — service already logged. Allow submit so a CDS
          // infrastructure outage doesn't block care.
        } finally {
          setCdsChecking(false);
        }
      }

      await persistOrder();
    },
    [formData, patientId, provider, cdsAcknowledged, persistOrder, validate, setErrors]
  );

  const handleCdsAcknowledge = useCallback(
    async (overrideReason: string) => {
      setCdsAlerts(null);
      setCdsAcknowledged(true);
      await persistOrder(overrideReason);
    },
    [persistOrder]
  );

  const handleCdsCancel = useCallback(() => {
    setCdsAlerts(null);
  }, []);

  return {
    submitting,
    cdsChecking,
    cdsAlerts,
    submitError,
    handleSubmit,
    handleCdsAcknowledge,
    handleCdsCancel,
    resetSubmitError: () => setSubmitError(null),
  };
}
