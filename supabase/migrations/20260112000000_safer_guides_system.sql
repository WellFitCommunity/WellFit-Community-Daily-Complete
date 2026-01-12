-- Migration: SAFER Guides Self-Assessment System
-- ONC Requirement: CMS Promoting Interoperability
-- Purpose: EHR safety self-assessment (9 guides required annually)

-- ============================================================================
-- SAFER Guide Definitions (the 9 required guides)
-- ============================================================================
CREATE TABLE IF NOT EXISTS safer_guide_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_number INTEGER NOT NULL UNIQUE,
    guide_name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    source_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Questions within each guide
-- ============================================================================
CREATE TABLE IF NOT EXISTS safer_guide_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_id UUID NOT NULL REFERENCES safer_guide_definitions(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    help_text TEXT,
    recommended_practice TEXT,
    response_type VARCHAR(20) DEFAULT 'yes_no_na',  -- 'yes_no_na', 'scale', 'text'
    is_required BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(guide_id, question_number)
);

-- ============================================================================
-- Assessment instances per tenant per year
-- ============================================================================
CREATE TABLE IF NOT EXISTS safer_guide_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assessment_year INTEGER NOT NULL,

    -- Status tracking
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'complete', 'attested')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    attested_at TIMESTAMPTZ,
    attested_by UUID REFERENCES auth.users(id),

    -- Scores
    guide_scores JSONB DEFAULT '{}',  -- { "1": 85, "2": 90, ... }
    overall_score DECIMAL(5,2),

    -- Export tracking
    attestation_pdf_path TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, assessment_year)
);

-- ============================================================================
-- Individual question responses
-- ============================================================================
CREATE TABLE IF NOT EXISTS safer_guide_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES safer_guide_assessments(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES safer_guide_questions(id) ON DELETE CASCADE,

    response VARCHAR(20) CHECK (response IN ('yes', 'no', 'na', 'partial')),
    notes TEXT,
    action_plan TEXT,  -- For 'no' responses, what's the remediation plan?

    responded_at TIMESTAMPTZ DEFAULT NOW(),
    responded_by UUID REFERENCES auth.users(id),

    UNIQUE(assessment_id, question_id)
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_safer_assessments_tenant_year
    ON safer_guide_assessments(tenant_id, assessment_year);
CREATE INDEX IF NOT EXISTS idx_safer_responses_assessment
    ON safer_guide_responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_safer_questions_guide
    ON safer_guide_questions(guide_id, display_order);

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE safer_guide_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE safer_guide_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE safer_guide_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE safer_guide_responses ENABLE ROW LEVEL SECURITY;

-- Guide definitions are public (read-only reference data)
CREATE POLICY "safer_guide_definitions_read_all" ON safer_guide_definitions
    FOR SELECT USING (true);

-- Questions are public (read-only reference data)
CREATE POLICY "safer_guide_questions_read_all" ON safer_guide_questions
    FOR SELECT USING (true);

-- Assessments are tenant-scoped
CREATE POLICY "safer_assessments_tenant_isolation" ON safer_guide_assessments
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Responses inherit from assessment tenant scope
CREATE POLICY "safer_responses_tenant_isolation" ON safer_guide_responses
    FOR ALL USING (
        assessment_id IN (
            SELECT id FROM safer_guide_assessments
            WHERE tenant_id IN (
                SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
            )
        )
    );

-- ============================================================================
-- Seed the 9 SAFER Guides
-- Source: https://www.healthit.gov/topic/safety/safer-guides
-- ============================================================================
INSERT INTO safer_guide_definitions (guide_number, guide_name, description, category, source_url) VALUES
(1, 'High Priority Practices',
   'Recommended practices for optimizing the safety of electronic health record (EHR) use that are considered essential and should be the starting point for assessment.',
   'Foundation',
   'https://www.healthit.gov/sites/default/files/safer/guides/safer_highprioritypractices.pdf'),

(2, 'Organizational Responsibilities',
   'Recommended practices related to EHR governance, policies, and organizational commitment to patient safety.',
   'Governance',
   'https://www.healthit.gov/sites/default/files/safer/guides/safer_organizationalresponsibilities.pdf'),

(3, 'Contingency Planning',
   'Recommended practices for managing EHR unavailability, including planned and unplanned downtime procedures.',
   'Operations',
   'https://www.healthit.gov/sites/default/files/safer/guides/safer_contingencyplanning.pdf'),

(4, 'System Configuration',
   'Recommended practices for safely configuring and customizing EHR systems.',
   'Technical',
   'https://www.healthit.gov/sites/default/files/safer/guides/safer_systemconfiguration.pdf'),

(5, 'System Interfaces',
   'Recommended practices for safely managing interfaces between the EHR and other health IT systems.',
   'Technical',
   'https://www.healthit.gov/sites/default/files/safer/guides/safer_systeminterfaces.pdf'),

(6, 'Patient Identification',
   'Recommended practices for accurately identifying patients in electronic health records.',
   'Clinical',
   'https://www.healthit.gov/sites/default/files/safer/guides/safer_patientidentification.pdf'),

(7, 'Computerized Provider Order Entry with Decision Support',
   'Recommended practices for safely using CPOE and clinical decision support systems.',
   'Clinical',
   'https://www.healthit.gov/sites/default/files/safer/guides/safer_cpoe.pdf'),

(8, 'Test Results Reporting and Follow-up',
   'Recommended practices for safely managing the communication and follow-up of test results.',
   'Clinical',
   'https://www.healthit.gov/sites/default/files/safer/guides/safer_testresults.pdf'),

(9, 'Clinician Communication',
   'Recommended practices for safe electronic communication among clinicians using the EHR.',
   'Clinical',
   'https://www.healthit.gov/sites/default/files/safer/guides/safer_cliniciancommunication.pdf')
ON CONFLICT (guide_number) DO UPDATE SET
    guide_name = EXCLUDED.guide_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    source_url = EXCLUDED.source_url,
    updated_at = NOW();

-- ============================================================================
-- Seed Guide 1: High Priority Practices (10 questions)
-- ============================================================================
INSERT INTO safer_guide_questions (guide_id, question_number, question_text, help_text, recommended_practice, display_order)
SELECT id, q.num, q.text, q.help, q.practice, q.num
FROM safer_guide_definitions,
LATERAL (VALUES
    (1, 'Is there a process to rapidly communicate critical patient safety issues related to the EHR to all relevant stakeholders?',
        'This includes urgent alerts about system issues that could affect patient safety.',
        'Establish a rapid communication protocol for EHR-related safety issues.'),
    (2, 'Is there a designated individual or team responsible for overall EHR safety?',
        'This could be a patient safety officer, EHR safety committee, or CMIO.',
        'Assign clear ownership for EHR safety monitoring and improvement.'),
    (3, 'Does the organization track and analyze EHR-related safety events?',
        'Including near-misses, adverse events, and user-reported issues.',
        'Implement systematic tracking and root cause analysis of EHR safety events.'),
    (4, 'Are EHR safety issues included in the organization''s quality improvement program?',
        'Regular review, trending, and action planning based on safety data.',
        'Integrate EHR safety into existing QI infrastructure.'),
    (5, 'Are there documented procedures for EHR downtime?',
        'Including both planned maintenance and unplanned outages.',
        'Develop and regularly test comprehensive downtime procedures.'),
    (6, 'Is there a process for users to report EHR-related safety concerns?',
        'Easy-to-use reporting mechanism with follow-up communication.',
        'Create accessible reporting channels and feedback loops.'),
    (7, 'Are critical EHR alerts (e.g., drug allergies) tested to ensure they function correctly?',
        'Regular validation that safety alerts fire appropriately.',
        'Implement regular testing protocols for critical clinical alerts.'),
    (8, 'Is there a process to verify that interfaces between systems are transmitting data accurately?',
        'Checking that lab results, medications, and other data transfer correctly.',
        'Monitor interface accuracy with automated and manual checks.'),
    (9, 'Are there safeguards to prevent wrong-patient errors?',
        'Photo verification, multiple identifiers, alerts when switching patients.',
        'Implement technical and workflow safeguards for patient identification.'),
    (10, 'Is EHR-related safety training provided to all clinical users?',
        'Initial training and ongoing education about safe EHR use.',
        'Require comprehensive EHR safety training for all users.')
) AS q(num, text, help, practice)
WHERE guide_number = 1
ON CONFLICT (guide_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    help_text = EXCLUDED.help_text,
    recommended_practice = EXCLUDED.recommended_practice;

-- ============================================================================
-- Seed Guide 2: Organizational Responsibilities (8 questions)
-- ============================================================================
INSERT INTO safer_guide_questions (guide_id, question_number, question_text, help_text, recommended_practice, display_order)
SELECT id, q.num, q.text, q.help, q.practice, q.num
FROM safer_guide_definitions,
LATERAL (VALUES
    (1, 'Is there executive leadership commitment to EHR safety?',
        'Board/C-suite awareness and resource allocation for EHR safety.',
        'Ensure executive sponsorship and accountability for EHR safety.'),
    (2, 'Is there a governance structure for EHR-related decisions?',
        'Committee or process for approving EHR changes and configurations.',
        'Establish clear governance with clinical and IT representation.'),
    (3, 'Are EHR safety policies documented and accessible?',
        'Written policies covering safe EHR use, access, and modification.',
        'Maintain up-to-date, accessible EHR safety policies.'),
    (4, 'Is there a process for managing EHR change requests safely?',
        'Testing and approval workflow for configuration changes.',
        'Implement change management with safety review requirements.'),
    (5, 'Are adequate resources allocated for EHR safety activities?',
        'Staff time, tools, and budget for safety monitoring and improvement.',
        'Budget appropriately for ongoing EHR safety activities.'),
    (6, 'Is there a process for staying current with EHR vendor safety communications?',
        'Reviewing and acting on vendor alerts and updates.',
        'Monitor vendor communications and implement relevant updates.'),
    (7, 'Are contracts with EHR vendors reviewed for safety-related provisions?',
        'Uptime guarantees, support response times, safety reporting.',
        'Include safety requirements in vendor contracts and SLAs.'),
    (8, 'Is there periodic review of EHR safety performance?',
        'Regular assessment of safety metrics and improvement opportunities.',
        'Conduct quarterly or annual EHR safety performance reviews.')
) AS q(num, text, help, practice)
WHERE guide_number = 2
ON CONFLICT (guide_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    help_text = EXCLUDED.help_text,
    recommended_practice = EXCLUDED.recommended_practice;

-- ============================================================================
-- Seed Guide 3: Contingency Planning (8 questions)
-- ============================================================================
INSERT INTO safer_guide_questions (guide_id, question_number, question_text, help_text, recommended_practice, display_order)
SELECT id, q.num, q.text, q.help, q.practice, q.num
FROM safer_guide_definitions,
LATERAL (VALUES
    (1, 'Are there documented downtime procedures for each clinical area?',
        'Department-specific instructions for working without the EHR.',
        'Create area-specific downtime procedures and keep them accessible.'),
    (2, 'Are downtime forms and materials readily available?',
        'Paper forms, reference sheets, and supplies for manual documentation.',
        'Maintain stocked downtime kits in all clinical areas.'),
    (3, 'Is there a process for communicating EHR downtime to staff?',
        'Notification system for planned and unplanned outages.',
        'Establish multiple communication channels for downtime alerts.'),
    (4, 'Are downtime procedures tested regularly?',
        'Drills or exercises to verify staff readiness.',
        'Conduct downtime drills at least annually.'),
    (5, 'Is there a process for data recovery after unplanned downtime?',
        'Entering paper documentation into the EHR after system restoration.',
        'Define clear data reconciliation procedures post-downtime.'),
    (6, 'Are backup systems available for critical functions?',
        'Read-only access, cached data, or redundant systems.',
        'Implement appropriate backup capabilities for critical functions.'),
    (7, 'Is there a defined recovery time objective (RTO) for EHR restoration?',
        'Maximum acceptable downtime before restoration.',
        'Set and communicate RTO targets with contingency plans.'),
    (8, 'Are lessons learned from downtime events documented and acted upon?',
        'Post-incident review and improvement process.',
        'Conduct post-downtime reviews and implement improvements.')
) AS q(num, text, help, practice)
WHERE guide_number = 3
ON CONFLICT (guide_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    help_text = EXCLUDED.help_text,
    recommended_practice = EXCLUDED.recommended_practice;

-- ============================================================================
-- Seed Guide 4: System Configuration (8 questions)
-- ============================================================================
INSERT INTO safer_guide_questions (guide_id, question_number, question_text, help_text, recommended_practice, display_order)
SELECT id, q.num, q.text, q.help, q.practice, q.num
FROM safer_guide_definitions,
LATERAL (VALUES
    (1, 'Is there a formal process for testing configuration changes before deployment?',
        'Testing environment and approval workflow for changes.',
        'Require testing in non-production environment before deployment.'),
    (2, 'Are default configurations reviewed for appropriateness?',
        'Vendor defaults may not suit your organization''s workflows.',
        'Review and customize default settings for your context.'),
    (3, 'Is there a process for managing order sets and clinical content?',
        'Review, approval, and maintenance of clinical decision support content.',
        'Establish governance for clinical content management.'),
    (4, 'Are clinical alerts reviewed for effectiveness and appropriateness?',
        'Monitoring alert fatigue and alert override rates.',
        'Regularly review alert metrics and optimize alert configurations.'),
    (5, 'Is there version control for configuration changes?',
        'Ability to track what changed, when, and by whom.',
        'Maintain audit trail of all configuration changes.'),
    (6, 'Are configurations backed up and recoverable?',
        'Ability to restore previous configurations if needed.',
        'Implement regular configuration backups with tested recovery.'),
    (7, 'Is there a process for reviewing the impact of vendor updates on configurations?',
        'Assessing how upgrades affect existing customizations.',
        'Review upgrade impact on customizations before applying updates.'),
    (8, 'Are user access and role configurations reviewed periodically?',
        'Ensuring appropriate access levels and role assignments.',
        'Conduct periodic access reviews and role audits.')
) AS q(num, text, help, practice)
WHERE guide_number = 4
ON CONFLICT (guide_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    help_text = EXCLUDED.help_text,
    recommended_practice = EXCLUDED.recommended_practice;

-- ============================================================================
-- Seed Guide 5: System Interfaces (8 questions)
-- ============================================================================
INSERT INTO safer_guide_questions (guide_id, question_number, question_text, help_text, recommended_practice, display_order)
SELECT id, q.num, q.text, q.help, q.practice, q.num
FROM safer_guide_definitions,
LATERAL (VALUES
    (1, 'Is there an inventory of all EHR interfaces?',
        'Documentation of all systems that exchange data with the EHR.',
        'Maintain a complete, current interface inventory.'),
    (2, 'Are interfaces monitored for failures and data quality issues?',
        'Automated alerting for interface errors or data anomalies.',
        'Implement proactive interface monitoring and alerting.'),
    (3, 'Is there a process for testing interfaces after changes?',
        'Verifying data exchange accuracy after modifications.',
        'Require interface testing after any system changes.'),
    (4, 'Are interface specifications documented?',
        'Technical documentation of data formats and mappings.',
        'Maintain current interface specifications and data dictionaries.'),
    (5, 'Is there a process for managing interface-related incidents?',
        'Defined escalation and resolution procedures.',
        'Establish clear incident management for interface issues.'),
    (6, 'Are there safeguards against duplicate or missing data from interfaces?',
        'Detection and handling of data transmission issues.',
        'Implement validation checks for interface data integrity.'),
    (7, 'Is there a process for validating that critical data (labs, medications) transmits correctly?',
        'Periodic reconciliation of data between systems.',
        'Conduct regular data validation audits for critical interfaces.'),
    (8, 'Are interfaces secured against unauthorized access?',
        'Authentication, encryption, and access controls for data exchange.',
        'Implement security controls for all interface connections.')
) AS q(num, text, help, practice)
WHERE guide_number = 5
ON CONFLICT (guide_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    help_text = EXCLUDED.help_text,
    recommended_practice = EXCLUDED.recommended_practice;

-- ============================================================================
-- Seed Guide 6: Patient Identification (8 questions)
-- ============================================================================
INSERT INTO safer_guide_questions (guide_id, question_number, question_text, help_text, recommended_practice, display_order)
SELECT id, q.num, q.text, q.help, q.practice, q.num
FROM safer_guide_definitions,
LATERAL (VALUES
    (1, 'Are at least two patient identifiers used to verify patient identity?',
        'Name + DOB, MRN, or other unique identifiers.',
        'Require two-identifier verification for all patient interactions.'),
    (2, 'Is patient photo displayed in the EHR to help verify identity?',
        'Photo visible on patient banner or during order entry.',
        'Display patient photos prominently in the EHR interface.'),
    (3, 'Are there alerts when switching between patient records?',
        'Visual or audible warning when navigating to a different patient.',
        'Implement clear patient-switching alerts.'),
    (4, 'Is there a process for managing patients with similar names?',
        'Flags or alerts for patients with matching or similar demographics.',
        'Implement similar-name detection and flagging.'),
    (5, 'Are there safeguards against selecting the wrong patient from a list?',
        'Sufficient distinguishing information displayed in search results.',
        'Display adequate identifying information in patient lists.'),
    (6, 'Is there a process for merging duplicate patient records?',
        'Detection and resolution of duplicate registrations.',
        'Establish duplicate detection and merge procedures.'),
    (7, 'Are patient identification errors tracked and analyzed?',
        'Monitoring wrong-patient events and near-misses.',
        'Track and trend patient identification errors.'),
    (8, 'Is training provided on patient identification best practices?',
        'Education on verification procedures and common errors.',
        'Include patient identification in EHR training programs.')
) AS q(num, text, help, practice)
WHERE guide_number = 6
ON CONFLICT (guide_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    help_text = EXCLUDED.help_text,
    recommended_practice = EXCLUDED.recommended_practice;

-- ============================================================================
-- Seed Guide 7: CPOE with Decision Support (10 questions)
-- ============================================================================
INSERT INTO safer_guide_questions (guide_id, question_number, question_text, help_text, recommended_practice, display_order)
SELECT id, q.num, q.text, q.help, q.practice, q.num
FROM safer_guide_definitions,
LATERAL (VALUES
    (1, 'Are drug-drug interaction alerts active and tested?',
        'Alerts fire appropriately for significant interactions.',
        'Implement and regularly test drug interaction checking.'),
    (2, 'Are drug-allergy alerts active and tested?',
        'Alerts fire when ordering drugs patient is allergic to.',
        'Ensure allergy alerts are functional and appropriately configured.'),
    (3, 'Is there a process for managing alert fatigue?',
        'Monitoring override rates and optimizing alert configurations.',
        'Regularly review and optimize alert configurations.'),
    (4, 'Are dose range checking alerts configured appropriately?',
        'Alerts for doses outside normal ranges.',
        'Implement dose checking with appropriate thresholds.'),
    (5, 'Is there a process for reviewing and updating order sets?',
        'Regular review of clinical content for accuracy and currency.',
        'Establish governance for order set maintenance.'),
    (6, 'Are verbal/telephone orders minimized and documented safely?',
        'Read-back verification and timely EHR documentation.',
        'Implement protocols for safe verbal order handling.'),
    (7, 'Is there a process for managing orders during EHR transitions (admission, transfer, discharge)?',
        'Order reconciliation at transitions of care.',
        'Define order management procedures for care transitions.'),
    (8, 'Are there safeguards against ordering for the wrong patient?',
        'Verification prompts, photo display during ordering.',
        'Implement verification safeguards in ordering workflow.'),
    (9, 'Is there monitoring for orders that are placed but not completed?',
        'Detection of orders that may have been missed or delayed.',
        'Track order completion and follow-up on incomplete orders.'),
    (10, 'Are clinical decision support recommendations evidence-based and current?',
        'CDS content reflects current guidelines and best practices.',
        'Maintain evidence-based, regularly updated CDS content.')
) AS q(num, text, help, practice)
WHERE guide_number = 7
ON CONFLICT (guide_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    help_text = EXCLUDED.help_text,
    recommended_practice = EXCLUDED.recommended_practice;

-- ============================================================================
-- Seed Guide 8: Test Results Reporting and Follow-up (8 questions)
-- ============================================================================
INSERT INTO safer_guide_questions (guide_id, question_number, question_text, help_text, recommended_practice, display_order)
SELECT id, q.num, q.text, q.help, q.practice, q.num
FROM safer_guide_definitions,
LATERAL (VALUES
    (1, 'Is there a reliable process for routing test results to the ordering provider?',
        'Results consistently reach the responsible clinician.',
        'Implement reliable result routing with backup coverage.'),
    (2, 'Are critical/abnormal results flagged for immediate attention?',
        'Visual differentiation and alerting for urgent results.',
        'Configure prominent flagging for critical values.'),
    (3, 'Is there a process for acknowledging receipt of test results?',
        'Documentation that results were reviewed.',
        'Require acknowledgment of result review.'),
    (4, 'Is there tracking for results that have not been reviewed?',
        'Monitoring for results that may have been missed.',
        'Implement unacknowledged result tracking and escalation.'),
    (5, 'Is there a process for communicating results to patients?',
        'Timely notification of results with appropriate context.',
        'Define patient result communication procedures.'),
    (6, 'Are there safeguards for results that arrive when the ordering provider is unavailable?',
        'Coverage arrangements and delegation.',
        'Establish coverage procedures for result management.'),
    (7, 'Is there a process for managing amended or corrected results?',
        'Notification and documentation of result corrections.',
        'Implement amended result notification and tracking.'),
    (8, 'Are result notification preferences configurable by clinicians?',
        'Ability to customize how and when results are delivered.',
        'Provide flexible result notification options.')
) AS q(num, text, help, practice)
WHERE guide_number = 8
ON CONFLICT (guide_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    help_text = EXCLUDED.help_text,
    recommended_practice = EXCLUDED.recommended_practice;

-- ============================================================================
-- Seed Guide 9: Clinician Communication (8 questions)
-- ============================================================================
INSERT INTO safer_guide_questions (guide_id, question_number, question_text, help_text, recommended_practice, display_order)
SELECT id, q.num, q.text, q.help, q.practice, q.num
FROM safer_guide_definitions,
LATERAL (VALUES
    (1, 'Is there a reliable in-EHR messaging system for clinical communication?',
        'Secure messaging integrated with patient context.',
        'Implement secure clinical messaging within the EHR.'),
    (2, 'Are urgent messages differentiated from routine messages?',
        'Priority flagging and escalation for time-sensitive communications.',
        'Enable message priority levels and urgent message handling.'),
    (3, 'Is there a process for managing messages when a clinician is unavailable?',
        'Coverage, forwarding, or escalation procedures.',
        'Define message coverage and escalation procedures.'),
    (4, 'Are there expectations for message response times?',
        'Guidelines for how quickly messages should be addressed.',
        'Establish and communicate response time expectations.'),
    (5, 'Is there tracking for unread or unacknowledged messages?',
        'Monitoring for messages that may have been missed.',
        'Implement unread message tracking and reminders.'),
    (6, 'Are messages linked to the patient record when appropriate?',
        'Integration of messaging with clinical documentation.',
        'Enable linking messages to patient charts.'),
    (7, 'Is there guidance on when to use EHR messaging vs. other communication methods?',
        'Appropriate use policies for different scenarios.',
        'Provide communication method selection guidance.'),
    (8, 'Are clinicians trained on safe use of EHR communication tools?',
        'Education on messaging best practices and pitfalls.',
        'Include communication tools in EHR training.')
) AS q(num, text, help, practice)
WHERE guide_number = 9
ON CONFLICT (guide_id, question_number) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    help_text = EXCLUDED.help_text,
    recommended_practice = EXCLUDED.recommended_practice;

-- ============================================================================
-- Update question counts in guide definitions
-- ============================================================================
UPDATE safer_guide_definitions sgd
SET updated_at = NOW()
WHERE EXISTS (SELECT 1 FROM safer_guide_questions WHERE guide_id = sgd.id);

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT SELECT ON safer_guide_definitions TO authenticated;
GRANT SELECT ON safer_guide_questions TO authenticated;
GRANT ALL ON safer_guide_assessments TO authenticated;
GRANT ALL ON safer_guide_responses TO authenticated;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE safer_guide_definitions IS 'ONC SAFER Guides - 9 required self-assessment guides for EHR safety';
COMMENT ON TABLE safer_guide_questions IS 'Individual questions within each SAFER Guide';
COMMENT ON TABLE safer_guide_assessments IS 'Annual SAFER Guide assessments per tenant';
COMMENT ON TABLE safer_guide_responses IS 'Individual responses to SAFER Guide questions';
