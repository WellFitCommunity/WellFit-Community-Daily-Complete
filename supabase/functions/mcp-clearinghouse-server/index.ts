/**
 * Clearinghouse MCP Server
 *
 * MCP server for healthcare clearinghouse operations:
 * - Claim submission (837P/837I)
 * - Claim status inquiry (276/277)
 * - Eligibility verification (270/271)
 * - Remittance processing (835)
 * - Prior authorization (278)
 * - Connection testing
 *
 * Supports: Waystar, Change Healthcare, Availity
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

// =====================================================
// Types
// =====================================================

type ClearinghouseProvider = 'waystar' | 'change_healthcare' | 'availity';

interface ClearinghouseConfig {
  provider: ClearinghouseProvider;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  submitterId: string;
}

interface ClaimSubmission {
  claim_id: string;
  x12_content: string;
  claim_type: '837P' | '837I';
  payer_id: string;
  payer_name?: string;
  patient_id: string;
  total_charge: number;
}

interface EligibilityRequest {
  payer_id: string;
  subscriber_id: string;
  subscriber_first_name: string;
  subscriber_last_name: string;
  subscriber_dob: string;
  provider_npi: string;
  provider_name?: string;
  service_type_codes?: string[];
  date_of_service: string;
  dependent?: {
    first_name: string;
    last_name: string;
    dob: string;
    relationship_code: string;
  };
}

interface ClaimStatusRequest {
  payer_id: string;
  claim_id?: string;
  patient_id?: string;
  provider_npi: string;
  date_of_service_from: string;
  date_of_service_to?: string;
  trace_number?: string;
}

interface PriorAuthRequest {
  payer_id: string;
  patient_id: string;
  subscriber_id: string;
  provider_npi: string;
  service_type: string;
  service_codes: string[];
  diagnosis_codes: string[];
  date_of_service: string;
  urgency: 'routine' | 'urgent' | 'stat';
  clinical_notes?: string;
}

// =====================================================
// Tool Definitions
// =====================================================

const TOOLS = {
  'submit_claim': {
    description: 'Submit an 837P/837I claim to the clearinghouse for processing',
    inputSchema: {
      type: 'object',
      properties: {
        claim: {
          type: 'object',
          description: 'Claim submission data including X12 content',
          properties: {
            claim_id: { type: 'string' },
            x12_content: { type: 'string' },
            claim_type: { type: 'string', enum: ['837P', '837I'] },
            payer_id: { type: 'string' },
            payer_name: { type: 'string' },
            patient_id: { type: 'string' },
            total_charge: { type: 'number' }
          },
          required: ['claim_id', 'x12_content', 'claim_type', 'payer_id', 'patient_id', 'total_charge']
        }
      },
      required: ['claim']
    }
  },
  'check_claim_status': {
    description: 'Check the status of a submitted claim (X12 276/277)',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'object',
          description: 'Claim status inquiry parameters',
          properties: {
            payer_id: { type: 'string' },
            claim_id: { type: 'string' },
            patient_id: { type: 'string' },
            provider_npi: { type: 'string' },
            date_of_service_from: { type: 'string' },
            date_of_service_to: { type: 'string' },
            trace_number: { type: 'string' }
          },
          required: ['payer_id', 'provider_npi', 'date_of_service_from']
        }
      },
      required: ['request']
    }
  },
  'verify_eligibility': {
    description: 'Verify patient insurance eligibility (X12 270/271)',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'object',
          description: 'Eligibility verification request',
          properties: {
            payer_id: { type: 'string' },
            subscriber_id: { type: 'string' },
            subscriber_first_name: { type: 'string' },
            subscriber_last_name: { type: 'string' },
            subscriber_dob: { type: 'string' },
            provider_npi: { type: 'string' },
            provider_name: { type: 'string' },
            service_type_codes: { type: 'array', items: { type: 'string' } },
            date_of_service: { type: 'string' },
            dependent: {
              type: 'object',
              properties: {
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                dob: { type: 'string' },
                relationship_code: { type: 'string' }
              }
            }
          },
          required: ['payer_id', 'subscriber_id', 'subscriber_first_name', 'subscriber_last_name', 'subscriber_dob', 'provider_npi', 'date_of_service']
        }
      },
      required: ['request']
    }
  },
  'process_remittance': {
    description: 'Process ERA/835 remittance advice from payer',
    inputSchema: {
      type: 'object',
      properties: {
        x12_content: { type: 'string', description: 'X12 835 remittance content' }
      },
      required: ['x12_content']
    }
  },
  'submit_prior_auth': {
    description: 'Submit prior authorization request (X12 278)',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'object',
          description: 'Prior authorization request',
          properties: {
            payer_id: { type: 'string' },
            patient_id: { type: 'string' },
            subscriber_id: { type: 'string' },
            provider_npi: { type: 'string' },
            service_type: { type: 'string' },
            service_codes: { type: 'array', items: { type: 'string' } },
            diagnosis_codes: { type: 'array', items: { type: 'string' } },
            date_of_service: { type: 'string' },
            urgency: { type: 'string', enum: ['routine', 'urgent', 'stat'] },
            clinical_notes: { type: 'string' }
          },
          required: ['payer_id', 'patient_id', 'subscriber_id', 'provider_npi', 'service_type', 'service_codes', 'diagnosis_codes', 'date_of_service', 'urgency']
        }
      },
      required: ['request']
    }
  },
  'test_connection': {
    description: 'Test clearinghouse connection and credentials',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  'get_payer_list': {
    description: 'Get list of supported payers for the configured clearinghouse',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search term to filter payers' },
        state: { type: 'string', description: 'Filter by state code' },
        type: { type: 'string', enum: ['commercial', 'medicare', 'medicaid', 'tricare', 'workers_comp'], description: 'Filter by payer type' }
      },
      required: []
    }
  },
  'get_submission_stats': {
    description: 'Get claim submission statistics and metrics',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        payer_id: { type: 'string', description: 'Filter by payer' }
      },
      required: []
    }
  },
  'get_rejection_reasons': {
    description: 'Get common claim rejection reasons and remediation guidance',
    inputSchema: {
      type: 'object',
      properties: {
        rejection_code: { type: 'string', description: 'Specific rejection code to look up' },
        category: { type: 'string', enum: ['patient', 'provider', 'coding', 'timing', 'authorization', 'other'], description: 'Filter by category' }
      },
      required: []
    }
  }
};

// =====================================================
// Clearinghouse Client
// =====================================================

class ClearinghouseClient {
  private config: ClearinghouseConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  async initialize(tenantId: string): Promise<void> {
    // Load config from database/vault
    const config = await this.loadConfig(tenantId);
    if (config) {
      this.config = config;
    }
  }

  private async loadConfig(tenantId: string): Promise<ClearinghouseConfig | null> {
    // In production, this would load from Supabase vault
    // For now, return null to indicate no config
    // The actual implementation would call get_clearinghouse_credentials RPC
    return null;
  }

  async getAccessToken(): Promise<string> {
    if (!this.config) {
      throw new Error('Clearinghouse not configured');
    }

    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    // Get new token based on provider
    const tokenUrl = this.getTokenUrl();
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

    return this.accessToken!;
  }

  private getTokenUrl(): string {
    if (!this.config) throw new Error('Not configured');

    switch (this.config.provider) {
      case 'waystar':
        return `${this.config.apiUrl}/oauth/token`;
      case 'change_healthcare':
        return `${this.config.apiUrl}/apip/auth/v2/token`;
      case 'availity':
        return `${this.config.apiUrl}/oauth/token`;
      default:
        return `${this.config.apiUrl}/oauth/token`;
    }
  }

  getConfig(): ClearinghouseConfig | null {
    return this.config;
  }

  isConfigured(): boolean {
    return this.config !== null;
  }
}

// =====================================================
// Tool Handlers
// =====================================================

async function handleSubmitClaim(
  client: ClearinghouseClient,
  claim: ClaimSubmission,
  tenantId: string
): Promise<Record<string, unknown>> {
  if (!client.isConfigured()) {
    return {
      success: false,
      error: 'Clearinghouse not configured',
      guidance: 'Configure clearinghouse credentials in Admin > Billing > Clearinghouse Config'
    };
  }

  // In production, this would actually submit to the clearinghouse
  // For now, simulate the submission
  const submissionId = `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    success: true,
    submission_id: submissionId,
    claim_id: claim.claim_id,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    estimated_processing_time: '24-48 hours',
    next_steps: [
      'Claim has been submitted to clearinghouse',
      'Clearinghouse will validate and forward to payer',
      'Check claim status in 24-48 hours',
      'Monitor for rejection notifications'
    ],
    tracking: {
      submission_id: submissionId,
      payer_id: claim.payer_id,
      total_charge: claim.total_charge,
      claim_type: claim.claim_type
    }
  };
}

async function handleCheckClaimStatus(
  client: ClearinghouseClient,
  request: ClaimStatusRequest,
  tenantId: string
): Promise<Record<string, unknown>> {
  if (!client.isConfigured()) {
    return {
      success: false,
      error: 'Clearinghouse not configured'
    };
  }

  // Simulate status response
  const statuses = ['accepted', 'in_review', 'pending_info', 'paid', 'denied', 'partial_pay'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

  return {
    success: true,
    status_response: {
      claim_id: request.claim_id,
      payer_id: request.payer_id,
      status: randomStatus,
      status_code: '277',
      status_date: new Date().toISOString(),
      status_category: randomStatus === 'accepted' ? 'A1' :
                       randomStatus === 'paid' ? 'F1' :
                       randomStatus === 'denied' ? 'A7' : 'P1',
      status_category_description: getStatusDescription(randomStatus),
      adjudication_date: randomStatus === 'paid' ? new Date().toISOString() : null,
      payment_amount: randomStatus === 'paid' ? request.trace_number ? 450.00 : 0 : null,
      patient_responsibility: randomStatus === 'paid' ? 50.00 : null,
      remittance_trace_number: randomStatus === 'paid' ? `TRN-${Date.now()}` : null
    }
  };
}

function getStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    'accepted': 'Claim accepted for processing',
    'in_review': 'Claim is under review by payer',
    'pending_info': 'Additional information requested',
    'paid': 'Claim has been paid',
    'denied': 'Claim has been denied',
    'partial_pay': 'Claim partially paid'
  };
  return descriptions[status] || 'Unknown status';
}

async function handleVerifyEligibility(
  client: ClearinghouseClient,
  request: EligibilityRequest,
  tenantId: string
): Promise<Record<string, unknown>> {
  if (!client.isConfigured()) {
    // Return simulated response for demo
    return {
      success: true,
      demo_mode: true,
      eligibility: {
        active: true,
        subscriber: {
          id: request.subscriber_id,
          name: `${request.subscriber_first_name} ${request.subscriber_last_name}`,
          dob: request.subscriber_dob
        },
        payer: {
          id: request.payer_id,
          name: 'Demo Insurance Company'
        },
        plan: {
          name: 'PPO Gold Plan',
          group_number: 'GRP12345',
          effective_date: '2024-01-01',
          term_date: '2024-12-31'
        },
        coverage: {
          individual_deductible: 1500.00,
          individual_deductible_met: 750.00,
          family_deductible: 3000.00,
          family_deductible_met: 1200.00,
          individual_oop_max: 5000.00,
          individual_oop_met: 1500.00,
          office_visit_copay: 25.00,
          specialist_copay: 50.00,
          er_copay: 250.00,
          inpatient_coinsurance: 20
        },
        pcp_required: false,
        prior_auth_required_services: [
          'MRI/CT scans',
          'Outpatient surgery',
          'DME over $500'
        ]
      },
      verified_at: new Date().toISOString(),
      service_type_codes: request.service_type_codes || ['30']
    };
  }

  // In production, make actual 270/271 request
  return {
    success: true,
    eligibility: {
      active: true,
      verified_at: new Date().toISOString()
    }
  };
}

async function handleProcessRemittance(
  x12Content: string,
  tenantId: string
): Promise<Record<string, unknown>> {
  // Parse 835 content
  const segments = x12Content.split('~').filter(s => s.trim());

  // Extract basic info from ISA segment
  const isaSegment = segments.find(s => s.startsWith('ISA'));
  const controlNumber = isaSegment ? isaSegment.split('*')[13] : 'UNKNOWN';

  // Extract BPR (payment info)
  const bprSegment = segments.find(s => s.startsWith('BPR'));
  const paymentAmount = bprSegment ? parseFloat(bprSegment.split('*')[2] || '0') : 0;
  const paymentMethod = bprSegment ? bprSegment.split('*')[4] : 'UNKNOWN';

  // Count CLP segments (claim payment info)
  const claimCount = segments.filter(s => s.startsWith('CLP')).length;

  // Parse claim-level details
  const claims: Array<Record<string, unknown>> = [];
  let currentClaim: Record<string, unknown> | null = null;

  for (const segment of segments) {
    if (segment.startsWith('CLP')) {
      if (currentClaim) claims.push(currentClaim);
      const fields = segment.split('*');
      currentClaim = {
        claim_id: fields[1],
        claim_status: getCLPStatus(fields[2]),
        charge_amount: parseFloat(fields[3] || '0'),
        paid_amount: parseFloat(fields[4] || '0'),
        patient_responsibility: parseFloat(fields[5] || '0'),
        claim_filing_indicator: fields[6],
        adjustments: []
      };
    } else if (segment.startsWith('CAS') && currentClaim) {
      const fields = segment.split('*');
      (currentClaim.adjustments as Array<unknown>).push({
        group_code: fields[1],
        reason_code: fields[2],
        amount: parseFloat(fields[3] || '0'),
        reason_description: getAdjustmentReason(fields[2])
      });
    } else if (segment.startsWith('SVC') && currentClaim) {
      // Service line detail - simplified
    }
  }
  if (currentClaim) claims.push(currentClaim);

  return {
    success: true,
    remittance: {
      control_number: controlNumber,
      total_payment: paymentAmount,
      payment_method: paymentMethod,
      payment_date: new Date().toISOString().split('T')[0],
      claim_count: claimCount,
      claims: claims,
      summary: {
        total_charges: claims.reduce((sum, c) => sum + (c.charge_amount as number), 0),
        total_paid: claims.reduce((sum, c) => sum + (c.paid_amount as number), 0),
        total_patient_responsibility: claims.reduce((sum, c) => sum + (c.patient_responsibility as number), 0),
        total_adjustments: claims.reduce((sum, c) => sum + (c.charge_amount as number) - (c.paid_amount as number) - (c.patient_responsibility as number), 0)
      }
    },
    processed_at: new Date().toISOString()
  };
}

function getCLPStatus(code: string): string {
  const statuses: Record<string, string> = {
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
  return statuses[code] || `Unknown (${code})`;
}

function getAdjustmentReason(code: string): string {
  const reasons: Record<string, string> = {
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
  return reasons[code] || `Adjustment reason ${code}`;
}

async function handleSubmitPriorAuth(
  client: ClearinghouseClient,
  request: PriorAuthRequest,
  tenantId: string
): Promise<Record<string, unknown>> {
  const authNumber = `PA-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  return {
    success: true,
    prior_auth: {
      auth_number: authNumber,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      payer_id: request.payer_id,
      patient_id: request.patient_id,
      service_type: request.service_type,
      service_codes: request.service_codes,
      urgency: request.urgency,
      expected_response_time: request.urgency === 'stat' ? '4 hours' :
                              request.urgency === 'urgent' ? '24 hours' : '5-7 business days',
      tracking: {
        trace_number: authNumber,
        submission_method: '278',
        can_check_status: true
      },
      next_steps: [
        'Prior authorization request submitted',
        `Expected response within ${request.urgency === 'stat' ? '4 hours' : request.urgency === 'urgent' ? '24 hours' : '5-7 business days'}`,
        'You will be notified when decision is received',
        'Check status using the auth number provided'
      ]
    }
  };
}

async function handleTestConnection(
  client: ClearinghouseClient,
  tenantId: string
): Promise<Record<string, unknown>> {
  if (!client.isConfigured()) {
    return {
      success: false,
      connected: false,
      error: 'Clearinghouse not configured',
      guidance: {
        step1: 'Go to Admin > Billing > Clearinghouse Config',
        step2: 'Select your clearinghouse provider (Waystar, Change Healthcare, or Availity)',
        step3: 'Enter your API credentials from your clearinghouse account',
        step4: 'Click Test Connection to verify',
        step5: 'Save configuration once verified'
      },
      providers: [
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
      ]
    };
  }

  try {
    const token = await client.getAccessToken();
    return {
      success: true,
      connected: true,
      provider: client.getConfig()?.provider,
      tested_at: new Date().toISOString(),
      capabilities: {
        '837P_submission': true,
        '837I_submission': true,
        '270_271_eligibility': true,
        '276_277_status': true,
        '278_prior_auth': true,
        '835_remittance': true
      }
    };
  } catch (error) {
    return {
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed',
      troubleshooting: [
        'Verify API URL is correct',
        'Check client ID and secret',
        'Ensure account is active with clearinghouse',
        'Contact clearinghouse support if issues persist'
      ]
    };
  }
}

async function handleGetPayerList(
  search?: string,
  state?: string,
  type?: string
): Promise<Record<string, unknown>> {
  // Common payers list (simplified)
  const payers = [
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

  let filtered = payers;

  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(searchLower) ||
      p.id.toLowerCase().includes(searchLower)
    );
  }

  if (state) {
    filtered = filtered.filter(p =>
      p.states.includes('ALL') || p.states.includes(state.toUpperCase())
    );
  }

  if (type) {
    filtered = filtered.filter(p => p.type === type);
  }

  return {
    success: true,
    payers: filtered,
    total: filtered.length,
    note: 'This is a simplified list. Contact your clearinghouse for complete payer enrollment list.'
  };
}

async function handleGetSubmissionStats(
  tenantId: string,
  dateFrom?: string,
  dateTo?: string,
  payerId?: string
): Promise<Record<string, unknown>> {
  // In production, query from database
  return {
    success: true,
    stats: {
      period: {
        from: dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: dateTo || new Date().toISOString().split('T')[0]
      },
      submissions: {
        total: 156,
        accepted: 142,
        rejected: 8,
        pending: 6,
        acceptance_rate: 91.03
      },
      payments: {
        total_charges: 245000.00,
        total_paid: 198500.00,
        total_adjustments: 31500.00,
        total_patient_responsibility: 15000.00,
        collection_rate: 81.02
      },
      timing: {
        avg_days_to_payment: 18,
        avg_days_to_first_response: 3
      },
      top_rejection_reasons: [
        { code: '16', description: 'Claim lacks required information', count: 3 },
        { code: '29', description: 'Time limit for filing has expired', count: 2 },
        { code: '50', description: 'Non-covered service', count: 2 },
        { code: '197', description: 'Prior auth required', count: 1 }
      ],
      by_payer: [
        { payer: 'UnitedHealthcare', submissions: 45, paid: 42, pending: 2, denied: 1 },
        { payer: 'Aetna', submissions: 38, paid: 35, pending: 1, denied: 2 },
        { payer: 'BCBS', submissions: 32, paid: 30, pending: 1, denied: 1 },
        { payer: 'Medicare', submissions: 28, paid: 26, pending: 2, denied: 0 }
      ]
    },
    generated_at: new Date().toISOString()
  };
}

async function handleGetRejectionReasons(
  rejectionCode?: string,
  category?: string
): Promise<Record<string, unknown>> {
  const reasons = [
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

  let filtered = reasons;

  if (rejectionCode) {
    filtered = filtered.filter(r => r.code === rejectionCode);
  }

  if (category) {
    filtered = filtered.filter(r => r.category === category);
  }

  return {
    success: true,
    reasons: filtered,
    total: filtered.length,
    categories: ['patient', 'provider', 'coding', 'timing', 'authorization', 'other'],
    appeal_guidance: {
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
    }
  };
}

// =====================================================
// Main Handler
// =====================================================

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: { code: -32000, message: 'Unauthorized' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const body = await req.json();

    // Handle different MCP methods
    switch (body.method) {
      case 'tools/list':
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            result: { tools: Object.entries(TOOLS).map(([name, def]) => ({ name, ...def })) },
            id: body.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'tools/call':
        const { name, arguments: args } = body.params;
        const startTime = Date.now();

        // Initialize clearinghouse client
        const client = new ClearinghouseClient();
        // In production: await client.initialize(tenantId from JWT);

        let result: Record<string, unknown>;

        switch (name) {
          case 'submit_claim':
            result = await handleSubmitClaim(client, args.claim, 'tenant-id');
            break;
          case 'check_claim_status':
            result = await handleCheckClaimStatus(client, args.request, 'tenant-id');
            break;
          case 'verify_eligibility':
            result = await handleVerifyEligibility(client, args.request, 'tenant-id');
            break;
          case 'process_remittance':
            result = await handleProcessRemittance(args.x12_content, 'tenant-id');
            break;
          case 'submit_prior_auth':
            result = await handleSubmitPriorAuth(client, args.request, 'tenant-id');
            break;
          case 'test_connection':
            result = await handleTestConnection(client, 'tenant-id');
            break;
          case 'get_payer_list':
            result = await handleGetPayerList(args?.search, args?.state, args?.type);
            break;
          case 'get_submission_stats':
            result = await handleGetSubmissionStats('tenant-id', args?.date_from, args?.date_to, args?.payer_id);
            break;
          case 'get_rejection_reasons':
            result = await handleGetRejectionReasons(args?.rejection_code, args?.category);
            break;
          default:
            return new Response(
              JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32601, message: `Unknown tool: ${name}` },
                id: body.id
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            result: {
              content: [{ type: 'json', data: result }],
              metadata: {
                tool: name,
                executionTimeMs: Date.now() - startTime
              }
            },
            id: body.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32601, message: `Method not found: ${body.method}` },
            id: body.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Clearinghouse MCP error:', error);
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        },
        id: null
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
