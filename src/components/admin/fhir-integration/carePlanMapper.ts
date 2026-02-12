// FHIR Integration Service — CarePlan Resource Mapper
// Maps WellFit care plan database rows to FHIR R4 CarePlan resources

import type { FHIRCarePlan, CarePlanActivity, CarePlanDbRow } from './types';

/**
 * Map a database care plan row to a FHIR R4 CarePlan resource.
 */
export function mapCarePlanToFHIR(plan: CarePlanDbRow): FHIRCarePlan {
  return {
    resourceType: 'CarePlan',
    id: plan.id,
    status: plan.status,
    intent: plan.intent,
    category: plan.category ? plan.category.map((cat: string) => ({
      coding: [{
        system: 'http://hl7.org/fhir/us/core/CodeSystem/careplan-category',
        code: cat,
        display: cat
      }]
    })) : undefined,
    title: plan.title,
    description: plan.description,
    subject: {
      reference: `Patient/${plan.patient_id}`
    },
    period: {
      start: plan.period_start,
      end: plan.period_end
    },
    created: plan.created || plan.created_at,
    author: plan.author_display ? {
      display: plan.author_display
    } : undefined,
    careTeam: plan.care_team_reference ? [{
      reference: plan.care_team_reference,
      display: plan.care_team_display
    }] : undefined,
    addresses: plan.addresses_condition_references ? plan.addresses_condition_references.map((ref: string, idx: number) => ({
      reference: ref,
      display: plan.addresses_condition_displays?.[idx]
    })) : undefined,
    goal: plan.goal_displays ? plan.goal_displays.map((g: string) => ({
      display: g
    })) : undefined,
    activity: plan.activities ? (Array.isArray(plan.activities) ? plan.activities : []).map((a: CarePlanActivity) => ({
      detail: {
        kind: a.kind || 'Task',
        status: a.status,
        description: a.detail || a.description,
        scheduledTiming: a.scheduled_start ? {
          repeat: {
            boundsPeriod: {
              start: a.scheduled_start,
              end: a.scheduled_end
            }
          }
        } : undefined
      }
    })) : undefined,
    note: plan.note ? [{
      text: plan.note
    }] : undefined
  };
}
