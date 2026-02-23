-- ============================================================================
-- HTI-2 Readiness: Patient-Facing AI Skill Descriptions
-- ONC Health Data, Technology, and Interoperability (HTI-2) Final Rule
-- Requires algorithm transparency — patients must understand what AI does
-- ============================================================================

-- Add patient-facing description column
ALTER TABLE public.ai_skills
ADD COLUMN IF NOT EXISTS patient_description TEXT;

COMMENT ON COLUMN public.ai_skills.patient_description IS
  'Plain-language explanation of what this AI skill does, shown to patients. Required for HTI-2 Algorithm Transparency compliance.';

-- Populate patient descriptions for all 60 skills
-- These are draft descriptions — Akima (CCO) should review for clinical accuracy

-- Core / Billing
UPDATE public.ai_skills SET patient_description = 'Suggests the correct billing codes for your visit so your insurance is billed accurately.' WHERE skill_key = 'billing_suggester';
UPDATE public.ai_skills SET patient_description = 'Checks your risk of being readmitted to the hospital within 30 days so your care team can help prevent it.' WHERE skill_key = 'readmission_predictor';
UPDATE public.ai_skills SET patient_description = 'Identifies social factors like food access, housing, or transportation that may affect your health.' WHERE skill_key = 'sdoh_passive_detector';
UPDATE public.ai_skills SET patient_description = 'Personalizes your health dashboard to show the information most relevant to you.' WHERE skill_key = 'dashboard_personalization';
UPDATE public.ai_skills SET patient_description = 'Converts your doctor''s spoken notes into written medical records.' WHERE skill_key = 'medical_transcript';
UPDATE public.ai_skills SET patient_description = 'Checks if you qualify for Chronic Care Management, a Medicare program that provides extra care coordination.' WHERE skill_key = 'ccm_eligibility_scorer';
UPDATE public.ai_skills SET patient_description = 'Provides health guidance that respects your cultural background and preferences.' WHERE skill_key = 'cultural_health_coach';
UPDATE public.ai_skills SET patient_description = 'Helps hospitals assign beds efficiently so you get the right room faster.' WHERE skill_key = 'bed_optimizer';

-- Drug safety
UPDATE public.ai_skills SET patient_description = 'Checks if any of your medications could interact with each other and cause side effects.' WHERE skill_key = 'drug_interaction_checker';
UPDATE public.ai_skills SET patient_description = 'Reads text from your medication labels to help track what you are taking.' WHERE skill_key = 'patient_form_extraction';

-- Clinical AI
UPDATE public.ai_skills SET patient_description = 'Helps your doctor write clinical notes about your visit.' WHERE skill_key = 'riley_smart_scribe';
UPDATE public.ai_skills SET patient_description = 'Suggests wellness activities based on how you are feeling today.' WHERE skill_key = 'mood_suggestions';
UPDATE public.ai_skills SET patient_description = 'Creates personalized daily check-in questions based on your health history.' WHERE skill_key = 'smart_checkin_questions';
UPDATE public.ai_skills SET patient_description = 'Provides educational information about your health conditions in easy-to-understand language.' WHERE skill_key = 'patient_education';
UPDATE public.ai_skills SET patient_description = 'Provides detailed information about potential medication interactions using medical databases.' WHERE skill_key = 'enhanced_drug_interactions';
UPDATE public.ai_skills SET patient_description = 'Alerts your care team to unusual patterns in your health dashboard data.' WHERE skill_key = 'dashboard_anomaly';
UPDATE public.ai_skills SET patient_description = 'Creates a summary for your family caregiver about your recent health status and care needs.' WHERE skill_key = 'caregiver_briefing';

-- Clinical documentation
UPDATE public.ai_skills SET patient_description = 'Writes a structured medical note about your visit for your health record.' WHERE skill_key = 'soap_note_generator';
UPDATE public.ai_skills SET patient_description = 'Creates a summary of your hospital stay when you are ready to go home.' WHERE skill_key = 'discharge_summary';
UPDATE public.ai_skills SET patient_description = 'Helps your care team create a plan for managing your health conditions.' WHERE skill_key = 'care_plan_generator';
UPDATE public.ai_skills SET patient_description = 'Summarizes your recent health progress from multiple clinical notes.' WHERE skill_key = 'progress_note_synthesizer';
UPDATE public.ai_skills SET patient_description = 'Writes a referral letter when your doctor needs to send you to a specialist.' WHERE skill_key = 'referral_letter';
UPDATE public.ai_skills SET patient_description = 'Suggests the best treatment approach based on clinical guidelines for your condition.' WHERE skill_key = 'treatment_pathway';
UPDATE public.ai_skills SET patient_description = 'Checks if your treatment follows current medical guidelines.' WHERE skill_key = 'clinical_guideline_matcher';
UPDATE public.ai_skills SET patient_description = 'Checks your medications for potentially dangerous combinations before you take them.' WHERE skill_key = 'contraindication_detector';
UPDATE public.ai_skills SET patient_description = 'Reviews all your medications together to make sure nothing is missing or duplicated.' WHERE skill_key = 'medication_reconciliation';
UPDATE public.ai_skills SET patient_description = 'Prepares a summary of what to expect before your upcoming appointment.' WHERE skill_key = 'appointment_prep';
UPDATE public.ai_skills SET patient_description = 'Alerts your care team when you miss daily check-ins so they can make sure you are okay.' WHERE skill_key = 'missed_checkin_escalation';
UPDATE public.ai_skills SET patient_description = 'Creates simple instructions for how to take your medications.' WHERE skill_key = 'medication_instructions';

-- Risk predictors
UPDATE public.ai_skills SET patient_description = 'Assesses your risk of falling so your care team can take steps to keep you safe.' WHERE skill_key = 'fall_risk_predictor';
UPDATE public.ai_skills SET patient_description = 'Checks how well you are taking your medications and suggests ways to stay on track.' WHERE skill_key = 'medication_adherence_predictor';
UPDATE public.ai_skills SET patient_description = 'Evaluates your overall care needs to prioritize the most important health concerns.' WHERE skill_key = 'care_escalation_scorer';
UPDATE public.ai_skills SET patient_description = 'Monitors for signs of infection risk during your hospital stay.' WHERE skill_key = 'infection_risk_predictor';
UPDATE public.ai_skills SET patient_description = 'Checks your risk of being readmitted to the hospital within one year.' WHERE skill_key = 'readmission_predictor_1year';

-- Infrastructure / operations
UPDATE public.ai_skills SET patient_description = 'Helps your care team schedule appointments at the best times for everyone.' WHERE skill_key = 'schedule_optimizer';
UPDATE public.ai_skills SET patient_description = 'Generates compliance reports for healthcare auditors (does not involve your personal data).' WHERE skill_key = 'audit_report_generator';
UPDATE public.ai_skills SET patient_description = 'Lets you use voice commands to navigate the health app hands-free.' WHERE skill_key = 'enhanced_voice_commands';
UPDATE public.ai_skills SET patient_description = 'Dispatches a wellness check when you may need help.' WHERE skill_key = 'welfare_check_dispatcher';
UPDATE public.ai_skills SET patient_description = 'Provides emergency responders with critical health information to help you quickly.' WHERE skill_key = 'emergency_intelligence';
UPDATE public.ai_skills SET patient_description = 'Helps transfer your health records between different hospital computer systems.' WHERE skill_key = 'fhir_semantic_mapper';
UPDATE public.ai_skills SET patient_description = 'Translates messages between different hospital computer systems.' WHERE skill_key = 'hl7_v2_interpreter';

-- Security / compliance
UPDATE public.ai_skills SET patient_description = 'Monitors for unusual activity to protect your health information from unauthorized access.' WHERE skill_key = 'security_anomaly_detector';
UPDATE public.ai_skills SET patient_description = 'Checks that your personal health information is properly protected.' WHERE skill_key = 'phi_exposure_risk_scorer';
UPDATE public.ai_skills SET patient_description = 'Helps ensure your health information is handled according to privacy laws.' WHERE skill_key = 'hipaa_violation_predictor';

-- Patient-facing
UPDATE public.ai_skills SET patient_description = 'Answers your health questions in a conversational way, like chatting with a knowledgeable friend.' WHERE skill_key = 'patient_qa_bot';
UPDATE public.ai_skills SET patient_description = 'Helps your healthcare provider quickly find information and answer clinical questions.' WHERE skill_key = 'provider_assistant';

-- Shift handoff
UPDATE public.ai_skills SET patient_description = 'Creates a summary for nurses changing shifts so your care continues smoothly.' WHERE skill_key = 'handoff_synthesizer';
UPDATE public.ai_skills SET patient_description = 'Summarizes care team discussions so important decisions are not lost.' WHERE skill_key = 'care_team_chat_summarizer';

-- Coding / billing
UPDATE public.ai_skills SET patient_description = 'Suggests the most accurate medical codes for social factors affecting your health.' WHERE skill_key = 'sdoh_coding_suggester';
UPDATE public.ai_skills SET patient_description = 'Suggests accurate medical codes for your diagnoses and procedures.' WHERE skill_key = 'coding_suggester';
