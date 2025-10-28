-- ============================================================================
-- Seed Administrative Task Templates
-- ============================================================================
-- Purpose: Pre-populate role-specific templates for immediate use
-- Coverage: Physician, Nurse, Case Manager, Social Worker tasks
-- ============================================================================

-- ============================================================================
-- PHYSICIAN TEMPLATES
-- ============================================================================

INSERT INTO public.claude_admin_task_templates (
  role, task_type, template_name, description,
  prompt_template, required_fields, optional_fields, output_format,
  estimated_tokens, preferred_model
)
VALUES
-- Prior Authorization
('physician', 'prior_authorization', 'Prior Authorization Request - Standard',
 'Generate comprehensive prior authorization documentation for insurance approval',
 'You are a medical documentation expert helping physicians with prior authorization requests.

TASK: Generate a prior authorization request letter for insurance approval.

PROCEDURE: {procedure_name}
CPT CODE: {cpt_code}

PATIENT INFORMATION:
{patient_info}

CLINICAL JUSTIFICATION:
{clinical_rationale}

INSURANCE CRITERIA:
{insurance_criteria}

PREVIOUS TREATMENTS TRIED:
{previous_treatments}

GENERATE a formal prior authorization letter that includes:
1. Patient demographics and diagnosis
2. Medical necessity justification with clinical evidence
3. Why alternative treatments are inappropriate
4. Expected outcomes and timeline
5. Reference to insurance medical policy criteria

Format as a professional business letter ready to submit.',
 '{"procedure_name": "string", "cpt_code": "string", "patient_info": "object", "clinical_rationale": "string", "insurance_criteria": "string", "previous_treatments": "array"}'::jsonb,
 '{"supporting_studies": "array", "specialist_consultation": "string"}'::jsonb,
 'letter', 800, 'sonnet-4.5'),

-- Insurance Appeal
('physician', 'insurance_appeal', 'Insurance Denial Appeal Letter',
 'Generate persuasive appeal letters for denied insurance claims',
 'You are a medical documentation expert specializing in insurance appeals.

TASK: Generate a compelling appeal letter for a denied insurance claim.

CLAIM NUMBER: {claim_number}
DENIAL DATE: {denial_date}
DENIAL REASON: {denial_reason}

CLINICAL EVIDENCE:
{clinical_evidence}

GUIDELINES/LITERATURE SUPPORT:
{supporting_literature}

PATIENT IMPACT:
{patient_impact_statement}

GENERATE a formal appeal letter that:
1. References the specific denial and policy
2. Systematically rebuts each denial reason with clinical evidence
3. Cites relevant medical guidelines (NCCN, AHA, etc.)
4. Emphasizes medical necessity and patient safety
5. Requests expedited review if clinically appropriate

Format as a professional business letter with clear sections.',
 '{"claim_number": "string", "denial_date": "string", "denial_reason": "string", "clinical_evidence": "object", "supporting_literature": "array", "patient_impact_statement": "string"}'::jsonb,
 '{"peer_reviewed_studies": "array", "expert_opinion": "string"}'::jsonb,
 'letter', 1000, 'sonnet-4.5'),

-- Peer Review Prep
('physician', 'peer_review_prep', 'Peer Review Documentation',
 'Prepare comprehensive documentation for peer review',
 'You are assisting a physician in preparing for peer review.

TASK: Create comprehensive peer review documentation.

CASE ID: {case_id}
REVIEW DATE: {review_date}

CLINICAL TIMELINE:
{clinical_timeline}

KEY CLINICAL DECISIONS:
{clinical_decisions}

QUESTIONS TO ADDRESS:
{review_questions}

OUTCOMES:
{patient_outcomes}

GENERATE peer review documentation that:
1. Chronologically summarizes the clinical case
2. Explains the rationale for each key clinical decision
3. Addresses each review question with evidence
4. References applicable standards of care
5. Discusses outcomes and lessons learned

Format as a structured narrative report.',
 '{"case_id": "string", "review_date": "string", "clinical_timeline": "array", "clinical_decisions": "object", "review_questions": "array", "patient_outcomes": "string"}'::jsonb,
 '{"contributing_factors": "array", "quality_improvement": "string"}'::jsonb,
 'narrative', 1200, 'sonnet-4.5');

-- ============================================================================
-- NURSE TEMPLATES
-- ============================================================================

INSERT INTO public.claude_admin_task_templates (
  role, task_type, template_name, description,
  prompt_template, required_fields, optional_fields, output_format,
  estimated_tokens, preferred_model
)
VALUES
-- Supply Justification
('nurse', 'supply_justification', 'Medical Supply Justification Form',
 'Generate justification for medical supplies and equipment',
 'You are assisting a nurse with supply justification documentation.

TASK: Generate medical supply justification.

SUPPLIES REQUESTED:
{supplies_list}

PATIENT ID: {patient_id}
DIAGNOSIS: {patient_diagnosis}

CLINICAL NEED:
{clinical_rationale}

EXPECTED USAGE:
{usage_plan}

ALTERNATIVE OPTIONS CONSIDERED:
{alternatives_considered}

GENERATE a supply justification that includes:
1. Specific items requested with quantities
2. Clear clinical rationale for each item
3. Expected duration and frequency of use
4. Why alternatives are insufficient
5. Cost-benefit analysis if applicable

Format as a structured form ready for approval.',
 '{"supplies_list": "array", "patient_id": "string", "patient_diagnosis": "string", "clinical_rationale": "string", "usage_plan": "string", "alternatives_considered": "array"}'::jsonb,
 '{"cost_comparison": "object", "vendor_info": "string"}'::jsonb,
 'form', 500, 'haiku-4.5'),

-- Incident Report
('nurse', 'incident_report', 'Incident Report - Standard Form',
 'Generate formal incident report documentation',
 'You are assisting a nurse with incident report documentation.

TASK: Generate a comprehensive incident report.

INCIDENT DATE/TIME: {incident_timestamp}
LOCATION: {location}

EVENT DESCRIPTION:
{event_description}

INVOLVED PARTIES:
{involved_parties}

IMMEDIATE ACTIONS TAKEN:
{immediate_actions}

PATIENT STATUS POST-INCIDENT:
{patient_status}

NOTIFICATIONS MADE:
{notifications}

FOLLOW-UP NEEDED:
{follow_up_plan}

GENERATE an incident report that:
1. Objectively describes what happened without blame
2. Documents timeline of events
3. Lists all involved parties and witnesses
4. Details immediate response and patient assessment
5. Specifies notifications made (physician, family, manager)
6. Outlines follow-up and preventive measures

Format as a formal incident report form.',
 '{"incident_timestamp": "string", "location": "string", "event_description": "string", "involved_parties": "array", "immediate_actions": "array", "patient_status": "string", "notifications": "array", "follow_up_plan": "string"}'::jsonb,
 '{"contributing_factors": "array", "equipment_involved": "array"}'::jsonb,
 'form', 700, 'haiku-4.5'),

-- Handoff Notes
('nurse', 'handoff_notes', 'Enhanced SBAR Handoff Notes',
 'Generate structured handoff notes for shift change',
 'You are assisting a nurse with shift handoff notes.

TASK: Generate comprehensive handoff notes for {patient_count} patients.

PATIENTS:
{patients_data}

GENERATE handoff notes in SBAR format (Situation, Background, Assessment, Recommendation) for each patient:

1. SITUATION: Current status, vital signs, recent changes
2. BACKGROUND: Diagnosis, relevant history, allergies
3. ASSESSMENT: Current concerns, trending data
4. RECOMMENDATION: Pending tasks, watch-for items, scheduled procedures

Format for quick verbal handoff and reference. Prioritize by acuity.',
 '{"patient_count": "integer", "patients_data": "array"}'::jsonb,
 '{"shift_events": "string", "unit_status": "string"}'::jsonb,
 'narrative', 600, 'haiku-4.5');

-- ============================================================================
-- CASE MANAGER TEMPLATES
-- ============================================================================

INSERT INTO public.claude_admin_task_templates (
  role, task_type, template_name, description,
  prompt_template, required_fields, optional_fields, output_format,
  estimated_tokens, preferred_model
)
VALUES
-- Insurance Verification
('case_manager', 'insurance_verification', 'Insurance Benefits Verification Summary',
 'Generate comprehensive insurance verification documentation',
 'You are assisting a case manager with insurance benefits verification.

TASK: Create insurance verification summary.

PATIENT: {patient_name}
DOB: {date_of_birth}

INSURANCE INFORMATION:
{insurance_policy_info}

COVERAGE DETAILS:
{coverage_details}

AUTHORIZATION REQUIREMENTS:
{authorization_requirements}

PATIENT COST RESPONSIBILITY:
{patient_financial_responsibility}

GENERATE a verification summary that includes:
1. Insurance policy details and eligibility confirmation
2. Covered services and limitations
3. Prior authorization requirements
4. Patient out-of-pocket costs (deductible, copay, coinsurance)
5. Network status and referral requirements

Format as a structured verification form.',
 '{"patient_name": "string", "date_of_birth": "string", "insurance_policy_info": "object", "coverage_details": "object", "authorization_requirements": "array", "patient_financial_responsibility": "object"}'::jsonb,
 '{"secondary_insurance": "object", "special_programs": "array"}'::jsonb,
 'form', 600, 'sonnet-4.5'),

-- Discharge Planning
('case_manager', 'discharge_planning', 'Comprehensive Discharge Plan',
 'Generate detailed discharge planning documentation',
 'You are assisting a case manager with discharge planning.

TASK: Create comprehensive discharge plan.

PATIENT: {patient_name}
DIAGNOSIS: {primary_diagnosis}

DISCHARGE DESTINATION: {discharge_destination}

HOME HEALTH NEEDS:
{home_health_services}

DURABLE MEDICAL EQUIPMENT:
{dme_requirements}

MEDICATIONS:
{discharge_medications}

FOLLOW-UP APPOINTMENTS:
{follow_up_schedule}

BARRIERS TO DISCHARGE:
{identified_barriers}

SOCIAL SUPPORT:
{support_system}

GENERATE a discharge plan that:
1. Summarizes patient status and discharge readiness
2. Details all post-discharge services (home health, PT, wound care)
3. Lists DME with justification and vendor arrangements
4. Confirms medication reconciliation and education
5. Schedules follow-up appointments
6. Addresses barriers with mitigation strategies
7. Documents family education and understanding

Format as a comprehensive discharge planning document.',
 '{"patient_name": "string", "primary_diagnosis": "string", "discharge_destination": "string", "home_health_services": "array", "dme_requirements": "array", "discharge_medications": "array", "follow_up_schedule": "array", "identified_barriers": "array", "support_system": "object"}'::jsonb,
 '{"transportation": "string", "financial_assistance": "string", "community_resources": "array"}'::jsonb,
 'narrative', 1000, 'sonnet-4.5'),

-- Resource Coordination
('case_manager', 'resource_coordination', 'Community Resource Coordination Plan',
 'Coordinate community resources and referrals',
 'You are assisting a case manager with community resource coordination.

TASK: Create resource coordination documentation.

PATIENT: {patient_name}

IDENTIFIED NEEDS:
{patient_needs}

AVAILABLE RESOURCES:
{available_resources}

REFERRALS MADE:
{referrals}

ELIGIBILITY/BARRIERS:
{eligibility_barriers}

FOLLOW-UP PLAN:
{follow_up_coordination}

GENERATE a resource coordination plan that:
1. Lists all identified patient needs (social, medical, financial)
2. Matches needs to specific community resources
3. Documents referrals made with contact information
4. Notes eligibility requirements and application status
5. Identifies barriers and workarounds
6. Creates follow-up timeline to ensure connection

Format as a structured coordination plan.',
 '{"patient_name": "string", "patient_needs": "array", "available_resources": "array", "referrals": "array", "eligibility_barriers": "array", "follow_up_coordination": "string"}'::jsonb,
 '{"cultural_considerations": "string", "language_needs": "string"}'::jsonb,
 'narrative', 700, 'haiku-4.5');

-- ============================================================================
-- SOCIAL WORKER TEMPLATES
-- ============================================================================

INSERT INTO public.claude_admin_task_templates (
  role, task_type, template_name, description,
  prompt_template, required_fields, optional_fields, output_format,
  estimated_tokens, preferred_model
)
VALUES
-- Psychosocial Assessment
('social_worker', 'psychosocial_assessment', 'Comprehensive Psychosocial Assessment',
 'Generate thorough psychosocial assessment documentation',
 'You are assisting a social worker with psychosocial assessment.

TASK: Create comprehensive psychosocial assessment.

PATIENT: {patient_name}
AGE: {patient_age}

LIVING SITUATION:
{living_situation}

SUPPORT SYSTEM:
{support_system_assessment}

FINANCIAL SITUATION:
{financial_assessment}

BEHAVIORAL HEALTH:
{behavioral_health_history}

SUBSTANCE USE:
{substance_use_history}

SOCIAL DETERMINANTS OF HEALTH:
{sdoh_factors}

STRENGTHS:
{patient_strengths}

CONCERNS:
{identified_concerns}

GENERATE a psychosocial assessment that:
1. Describes current living situation and safety
2. Evaluates support system and relationships
3. Assesses financial stability and resources
4. Reviews behavioral health history and current status
5. Documents SDOH factors impacting health
6. Identifies patient strengths and coping mechanisms
7. Lists concerns and recommended interventions

Format as a clinical psychosocial assessment.',
 '{"patient_name": "string", "patient_age": "integer", "living_situation": "string", "support_system_assessment": "object", "financial_assessment": "object", "behavioral_health_history": "string", "substance_use_history": "string", "sdoh_factors": "object", "patient_strengths": "array", "identified_concerns": "array"}'::jsonb,
 '{"cultural_background": "string", "trauma_history": "string", "legal_issues": "string"}'::jsonb,
 'narrative', 1000, 'sonnet-4.5'),

-- Crisis Intervention
('social_worker', 'crisis_intervention', 'Crisis Intervention Documentation',
 'Document crisis intervention and safety planning',
 'You are assisting a social worker with crisis intervention documentation.

TASK: Document crisis intervention.

PATIENT: {patient_name}

PRESENTING CRISIS:
{crisis_description}

RISK ASSESSMENT:
{risk_assessment}

INTERVENTIONS PROVIDED:
{interventions}

SAFETY PLAN DEVELOPED:
{safety_plan}

RESOURCES PROVIDED:
{resources_given}

FOLLOW-UP PLAN:
{follow_up_plan}

COLLATERAL CONTACTS:
{collateral_contacts}

GENERATE crisis intervention documentation that:
1. Describes the presenting crisis objectively
2. Documents comprehensive risk assessment
3. Details interventions provided during crisis
4. Outlines safety plan with specific steps
5. Lists resources and referrals provided
6. Specifies follow-up timeline and responsible parties
7. Notes any collateral contacts made (family, police, etc.)

Format as formal crisis intervention documentation.',
 '{"patient_name": "string", "crisis_description": "string", "risk_assessment": "object", "interventions": "array", "safety_plan": "object", "resources_given": "array", "follow_up_plan": "string", "collateral_contacts": "array"}'::jsonb,
 '{"psychiatric_consultation": "string", "legal_holds": "string"}'::jsonb,
 'narrative', 900, 'sonnet-4.5'),

-- Safety Plan
('social_worker', 'safety_plan', 'Mental Health Safety Plan',
 'Create personalized mental health safety plan',
 'You are assisting a social worker in creating a safety plan.

TASK: Create personalized mental health safety plan.

PATIENT: {patient_name}

WARNING SIGNS:
{warning_signs}

INTERNAL COPING STRATEGIES:
{coping_strategies}

SOCIAL SUPPORTS:
{support_contacts}

PROFESSIONAL RESOURCES:
{professional_contacts}

MAKING ENVIRONMENT SAFE:
{environmental_safety}

REASONS FOR LIVING:
{reasons_for_living}

GENERATE a safety plan that:
1. Lists personalized warning signs
2. Identifies internal coping strategies patient can use alone
3. Lists people and social settings for distraction
4. Provides professional contacts (therapist, crisis line, doctor)
5. Outlines steps to make environment safer
6. Reinforces reasons for living and hope

Format as a clear, simple safety plan the patient can use independently.',
 '{"patient_name": "string", "warning_signs": "array", "coping_strategies": "array", "support_contacts": "array", "professional_contacts": "array", "environmental_safety": "array", "reasons_for_living": "array"}'::jsonb,
 '{"crisis_hotlines": "array", "emergency_contacts": "array"}'::jsonb,
 'structured', 600, 'sonnet-4.5');

-- ============================================================================
-- UNIVERSAL TEMPLATES (All Roles)
-- ============================================================================

INSERT INTO public.claude_admin_task_templates (
  role, task_type, template_name, description,
  prompt_template, required_fields, optional_fields, output_format,
  estimated_tokens, preferred_model
)
VALUES
-- Meeting Notes
('admin', 'meeting_notes', 'Meeting Notes - Structured',
 'Generate structured meeting notes from transcription',
 'You are assisting with meeting documentation.

TASK: Create structured meeting notes.

MEETING TOPIC: {meeting_topic}
DATE: {meeting_date}
ATTENDEES: {attendees}

TRANSCRIPTION/NOTES:
{meeting_content}

GENERATE structured meeting notes that include:
1. Meeting metadata (topic, date, attendees)
2. Key discussion points organized by topic
3. Decisions made
4. Action items with owners and due dates
5. Follow-up items for next meeting

Format as professional meeting minutes.',
 '{"meeting_topic": "string", "meeting_date": "string", "attendees": "array", "meeting_content": "string"}'::jsonb,
 '{"previous_action_items": "array"}'::jsonb,
 'structured', 500, 'haiku-4.5');

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
DECLARE
  template_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count FROM public.claude_admin_task_templates;

  RAISE NOTICE '✅ Admin task templates seeded successfully!';
  RAISE NOTICE '📋 Total templates created: %', template_count;
  RAISE NOTICE '👨‍⚕️ Physician templates: Prior auth, insurance appeals, peer review';
  RAISE NOTICE '👩‍⚕️ Nurse templates: Supply justification, incident reports, handoff notes';
  RAISE NOTICE '📊 Case Manager templates: Insurance verification, discharge planning, resource coordination';
  RAISE NOTICE '🤝 Social Worker templates: Psychosocial assessment, crisis intervention, safety plans';
  RAISE NOTICE '💡 Templates are ready for immediate use in Claude Care Assistant!';
END $$;
