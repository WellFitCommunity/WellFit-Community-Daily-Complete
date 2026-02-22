// =====================================================
// Static Reference Data
// Purpose: Payer lists, status descriptions, adjustment
//          reason codes, and rejection reasons
// =====================================================

/** Claim status descriptions keyed by status name */
export const STATUS_DESCRIPTIONS: Record<string, string> = {
  'accepted': 'Claim accepted for processing',
  'in_review': 'Claim is under review by payer',
  'pending_info': 'Additional information requested',
  'paid': 'Claim has been paid',
  'denied': 'Claim has been denied',
  'partial_pay': 'Claim partially paid'
};

/** CLP (Claim Payment) status codes from X12 835 */
export const CLP_STATUSES: Record<string, string> = {
  '1': 'Processed as Primary',
  '2': 'Processed as Secondary',
  '3': 'Processed as Tertiary',
  '4': 'Denied',
  '19': 'Processed as Primary, Forwarded to Additional Payer',
  '20': 'Processed as Secondary, Forwarded to Additional Payer',
  '21': 'Processed as Tertiary, Forwarded to Additional Payer',
  '22': 'Reversal of Previous Payment',
  '23': 'Not Our Claim, Forwarded to Additional Payer'
};

/** CAS (Claim Adjustment Segment) reason codes from X12 835 */
export const ADJUSTMENT_REASONS: Record<string, string> = {
  '1': 'Deductible',
  '2': 'Coinsurance',
  '3': 'Copayment',
  '4': 'Procedure code inconsistent with modifier',
  '5': 'Procedure code inconsistent with diagnosis',
  '6': 'Procedure/revenue code inconsistent with patient age',
  '16': 'Claim lacks required information',
  '18': 'Exact duplicate claim',
  '22': 'Coordination of benefits',
  '23': 'Payment adjusted due to prior payer payment',
  '24': 'Charges covered under capitation',
  '29': 'Time limit for filing has expired',
  '31': 'Patient not eligible',
  '32': 'Our contract provision prohibits payment',
  '45': 'Charges exceed fee schedule maximum',
  '50': 'Non-covered service',
  '96': 'Non-covered charge(s)',
  '97': 'Payment for this service adjusted',
  '109': 'Claim not covered by this payer',
  '125': 'Payment adjusted due to medical policy',
  '140': 'Patient/Insured health identification number not found',
  '197': 'Precertification/authorization/notification absent'
};

/** Payer entry in the reference payer list */
interface PayerEntry {
  id: string;
  name: string;
  type: string;
  states: string[];
}

/** Common payers list (simplified reference data) */
export const PAYER_LIST: PayerEntry[] = [
  { id: '00001', name: 'Aetna', type: 'commercial', states: ['ALL'] },
  { id: '00002', name: 'Blue Cross Blue Shield', type: 'commercial', states: ['ALL'] },
  { id: '00003', name: 'Cigna', type: 'commercial', states: ['ALL'] },
  { id: '00004', name: 'UnitedHealthcare', type: 'commercial', states: ['ALL'] },
  { id: '00005', name: 'Humana', type: 'commercial', states: ['ALL'] },
  { id: 'CMS', name: 'Medicare', type: 'medicare', states: ['ALL'] },
  { id: '00010', name: 'Kaiser Permanente', type: 'commercial', states: ['CA', 'CO', 'GA', 'HI', 'MD', 'OR', 'VA', 'WA'] },
  { id: 'TRICARE', name: 'TRICARE', type: 'tricare', states: ['ALL'] },
  { id: '00020', name: 'Anthem', type: 'commercial', states: ['ALL'] },
  { id: '00021', name: 'Centene', type: 'medicaid', states: ['ALL'] }
];

/** Rejection reason with remediation guidance */
interface RejectionReason {
  code: string;
  category: string;
  description: string;
  remediation: string;
}

/** Common claim rejection reasons with remediation guidance */
export const REJECTION_REASONS: RejectionReason[] = [
  { code: '1', category: 'patient', description: 'Deductible amount', remediation: 'Bill patient for deductible portion' },
  { code: '2', category: 'patient', description: 'Coinsurance amount', remediation: 'Bill patient for coinsurance portion' },
  { code: '3', category: 'patient', description: 'Copay amount', remediation: 'Collect copay from patient' },
  { code: '4', category: 'coding', description: 'Procedure code inconsistent with modifier', remediation: 'Review modifier usage, correct and resubmit' },
  { code: '5', category: 'coding', description: 'Procedure code inconsistent with diagnosis', remediation: 'Verify medical necessity, update diagnosis codes' },
  { code: '16', category: 'other', description: 'Claim lacks required information', remediation: 'Review claim for missing fields, complete and resubmit' },
  { code: '18', category: 'timing', description: 'Duplicate claim', remediation: 'Do not resubmit - check status of original claim' },
  { code: '29', category: 'timing', description: 'Time limit for filing expired', remediation: 'File timely filing appeal if valid excuse exists' },
  { code: '31', category: 'patient', description: 'Patient not eligible', remediation: 'Verify eligibility, check coverage dates, correct subscriber info' },
  { code: '45', category: 'coding', description: 'Charges exceed fee schedule', remediation: 'Expected - adjust to contracted rate' },
  { code: '50', category: 'coding', description: 'Non-covered service', remediation: 'Bill patient as ABN if obtained, or write off' },
  { code: '96', category: 'coding', description: 'Non-covered charge', remediation: 'Check plan benefits, consider appeal if medically necessary' },
  { code: '109', category: 'other', description: 'Not covered by this payer', remediation: 'Verify correct payer, check coordination of benefits' },
  { code: '140', category: 'patient', description: 'Member ID not found', remediation: 'Verify member ID with patient, correct and resubmit' },
  { code: '197', category: 'authorization', description: 'Prior authorization required', remediation: 'Obtain prior auth retroactively if possible, or appeal' },
  { code: 'N30', category: 'provider', description: 'Provider not on file', remediation: 'Complete provider enrollment with payer' },
  { code: 'N95', category: 'other', description: 'Non-covered service', remediation: 'Check medical policy, consider peer-to-peer appeal' }
];

/** Clearinghouse provider info for the test_connection guidance */
export const PROVIDER_INFO = [
  {
    name: 'Waystar',
    description: 'Most popular, comprehensive features',
    cost: '$500-1,200/month',
    contact: 'waystar.com or 1-888-639-2666'
  },
  {
    name: 'Change Healthcare',
    description: 'Largest payer network',
    cost: '$400-1,000/month',
    contact: 'changehealthcare.com/contact'
  },
  {
    name: 'Availity',
    description: 'Free portal, affordable API',
    cost: 'Free portal, $100-300/month for API',
    contact: 'availity.com'
  }
];

/** Appeal guidance returned with rejection reasons */
export const APPEAL_GUIDANCE = {
  timeframe: 'Most payers allow appeals within 60-180 days',
  process: [
    '1. Review denial reason carefully',
    '2. Gather supporting documentation',
    '3. Write appeal letter citing medical necessity',
    '4. Include relevant clinical notes and test results',
    '5. Submit via payer portal or certified mail',
    '6. Track appeal status and follow up'
  ],
  tips: [
    'Always reference the specific denial code in appeals',
    'Include peer-reviewed literature for medical necessity',
    'Request peer-to-peer review for complex cases',
    'Document all communications with payer'
  ]
};
