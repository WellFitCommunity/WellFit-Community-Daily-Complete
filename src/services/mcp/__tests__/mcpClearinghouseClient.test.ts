/**
 * Tests for Clearinghouse MCP Client
 */

import {
  submitClaim,
  checkClaimStatus,
  verifyPatientEligibility,
  processRemittanceAdvice,
  submitPriorAuthorization,
  testClearinghouseConnection,
  searchPayers,
  getBillingStats,
  lookupRejectionReason,
  getRejectionsByCategory,
  SERVICE_TYPE_CODES,
  RELATIONSHIP_CODES,
  ADJUSTMENT_REASON_CODES,
  ClearinghouseMCPClient
} from '../mcpClearinghouseClient';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {
  'sb-xkybsjnvuohpqpbkikyn-auth-token': JSON.stringify({ access_token: 'test-token' })
};

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
  }
});

describe('ClearinghouseMCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Claim Operations', () => {
    describe('submitClaim', () => {
      it('should submit a claim successfully', async () => {
        const mockResult = {
          success: true,
          submission_id: 'SUB-123456',
          claim_id: 'CLM001',
          status: 'submitted',
          submitted_at: '2024-01-15T10:00:00Z',
          estimated_processing_time: '24-48 hours',
          next_steps: [
            'Claim has been submitted to clearinghouse',
            'Check claim status in 24-48 hours'
          ],
          tracking: {
            submission_id: 'SUB-123456',
            payer_id: 'AETNA001',
            total_charge: 150.00,
            claim_type: '837P'
          }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: mockResult }],
              metadata: { tool: 'submit_claim', executionTimeMs: 250 }
            }
          })
        });

        const result = await submitClaim({
          claim_id: 'CLM001',
          x12_content: 'ISA*00*...',
          claim_type: '837P',
          payer_id: 'AETNA001',
          patient_id: 'P12345',
          total_charge: 150.00
        });

        expect(result.success).toBe(true);
        expect(result.data?.submission_id).toBe('SUB-123456');
        expect(result.data?.claim_id).toBe('CLM001');
      });

      it('should handle submission errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                success: false,
                error: 'Clearinghouse not configured'
              }}]
            }
          })
        });

        const result = await submitClaim({
          claim_id: 'CLM001',
          x12_content: 'ISA*00*...',
          claim_type: '837P',
          payer_id: 'AETNA001',
          patient_id: 'P12345',
          total_charge: 150.00
        });

        expect(result.success).toBe(false);
      });
    });

    describe('checkClaimStatus', () => {
      it('should check claim status', async () => {
        const mockStatus = {
          status_response: {
            claim_id: 'CLM001',
            payer_id: 'AETNA001',
            status: 'paid',
            status_code: '277',
            status_date: '2024-01-20T10:00:00Z',
            status_category: 'F1',
            status_category_description: 'Claim has been paid',
            adjudication_date: '2024-01-20T10:00:00Z',
            payment_amount: 125.00,
            patient_responsibility: 25.00,
            remittance_trace_number: 'TRN-123456'
          }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: { success: true, ...mockStatus } }]
            }
          })
        });

        const result = await checkClaimStatus(
          'AETNA001',
          '1234567890',
          '2024-01-10',
          { claimId: 'CLM001' }
        );

        expect(result.success).toBe(true);
        expect(result.data?.status_response.status).toBe('paid');
        expect(result.data?.status_response.payment_amount).toBe(125.00);
      });
    });
  });

  describe('Eligibility Operations', () => {
    describe('verifyPatientEligibility', () => {
      it('should verify active eligibility', async () => {
        const mockEligibility = {
          eligibility: {
            active: true,
            subscriber: {
              id: 'SUB123',
              name: 'John Doe',
              dob: '1950-01-15'
            },
            payer: {
              id: 'AETNA001',
              name: 'Aetna'
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
              office_visit_copay: 25.00,
              specialist_copay: 50.00
            },
            pcp_required: false,
            prior_auth_required_services: ['MRI/CT scans', 'Outpatient surgery']
          }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: { success: true, ...mockEligibility } }]
            }
          })
        });

        const result = await verifyPatientEligibility(
          'AETNA001',
          'SUB123',
          'John',
          'Doe',
          '1950-01-15',
          '1234567890',
          '2024-01-15'
        );

        expect(result.success).toBe(true);
        expect(result.data?.eligibility.active).toBe(true);
        expect(result.data?.eligibility.coverage.office_visit_copay).toBe(25.00);
      });

      it('should handle dependent eligibility check', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                success: true,
                eligibility: {
                  active: true,
                  subscriber: { id: 'SUB123', name: 'John Doe', dob: '1950-01-15' },
                  payer: { id: 'AETNA001', name: 'Aetna' },
                  plan: { name: 'Family Plan', effective_date: '2024-01-01' },
                  coverage: {},
                  pcp_required: false
                }
              }}]
            }
          })
        });

        const result = await verifyPatientEligibility(
          'AETNA001',
          'SUB123',
          'John',
          'Doe',
          '1950-01-15',
          '1234567890',
          '2024-01-15',
          {
            dependent: {
              first_name: 'Jane',
              last_name: 'Doe',
              dob: '1980-05-20',
              relationship_code: '01' // Spouse
            }
          }
        );

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Remittance Operations', () => {
    describe('processRemittanceAdvice', () => {
      it('should process 835 remittance', async () => {
        const mockRemittance = {
          remittance: {
            control_number: '000000001',
            total_payment: 1250.00,
            payment_method: 'ACH',
            payment_date: '2024-01-20',
            claim_count: 3,
            claims: [
              {
                claim_id: 'CLM001',
                claim_status: 'Processed as Primary',
                charge_amount: 500.00,
                paid_amount: 425.00,
                patient_responsibility: 50.00,
                adjustments: [
                  { group_code: 'CO', reason_code: '45', amount: 25.00, reason_description: 'Charges exceed fee schedule' }
                ]
              }
            ],
            summary: {
              total_charges: 1500.00,
              total_paid: 1250.00,
              total_adjustments: 150.00,
              total_patient_responsibility: 100.00
            }
          }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: { success: true, ...mockRemittance } }]
            }
          })
        });

        const result = await processRemittanceAdvice('ISA*00*...*835*...');

        expect(result.success).toBe(true);
        expect(result.data?.remittance.total_payment).toBe(1250.00);
        expect(result.data?.remittance.claims).toHaveLength(1);
      });
    });
  });

  describe('Prior Authorization Operations', () => {
    describe('submitPriorAuthorization', () => {
      it('should submit prior auth request', async () => {
        const mockPriorAuth = {
          prior_auth: {
            auth_number: 'PA-123456',
            status: 'submitted',
            submitted_at: '2024-01-15T10:00:00Z',
            payer_id: 'AETNA001',
            patient_id: 'P12345',
            service_type: 'Outpatient Surgery',
            service_codes: ['29881', '29882'],
            urgency: 'routine',
            expected_response_time: '5-7 business days',
            tracking: {
              trace_number: 'PA-123456',
              submission_method: '278',
              can_check_status: true
            },
            next_steps: [
              'Prior authorization request submitted',
              'Expected response within 5-7 business days'
            ]
          }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: { success: true, ...mockPriorAuth } }]
            }
          })
        });

        const result = await submitPriorAuthorization(
          'AETNA001',
          'P12345',
          'SUB123',
          '1234567890',
          'Outpatient Surgery',
          ['29881', '29882'],
          ['M23.201', 'M23.211'],
          '2024-02-01',
          'routine',
          'Patient has failed conservative treatment'
        );

        expect(result.success).toBe(true);
        expect(result.data?.prior_auth.auth_number).toBe('PA-123456');
        expect(result.data?.prior_auth.urgency).toBe('routine');
      });

      it('should handle urgent prior auth', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                success: true,
                prior_auth: {
                  auth_number: 'PA-URGENT-001',
                  urgency: 'urgent',
                  expected_response_time: '24 hours'
                }
              }}]
            }
          })
        });

        const result = await submitPriorAuthorization(
          'AETNA001',
          'P12345',
          'SUB123',
          '1234567890',
          'Emergency Surgery',
          ['99285'],
          ['R10.9'],
          '2024-01-15',
          'urgent'
        );

        expect(result.success).toBe(true);
        expect(result.data?.prior_auth.expected_response_time).toBe('24 hours');
      });
    });
  });

  describe('Configuration Operations', () => {
    describe('testClearinghouseConnection', () => {
      it('should return success when connected', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                success: true,
                connected: true,
                provider: 'waystar',
                tested_at: '2024-01-15T10:00:00Z',
                capabilities: {
                  '837P_submission': true,
                  '837I_submission': true,
                  '270_271_eligibility': true,
                  '276_277_status': true,
                  '278_prior_auth': true,
                  '835_remittance': true
                }
              }}]
            }
          })
        });

        const result = await testClearinghouseConnection();

        expect(result.success).toBe(true);
        expect(result.data?.connected).toBe(true);
        expect(result.data?.provider).toBe('waystar');
      });

      it('should return guidance when not configured', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                success: false,
                connected: false,
                error: 'Clearinghouse not configured',
                guidance: {
                  step1: 'Go to Admin > Billing > Clearinghouse Config'
                },
                providers: [
                  { name: 'Waystar', description: 'Most popular', cost: '$500-1,200/month' }
                ]
              }}]
            }
          })
        });

        const result = await testClearinghouseConnection();

        expect(result.success).toBe(false);
        expect(result.data?.connected).toBe(false);
        expect(result.data?.providers).toBeDefined();
      });
    });

    describe('searchPayers', () => {
      it('should search payers by name', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                success: true,
                payers: [
                  { id: '00001', name: 'Aetna', type: 'commercial', states: ['ALL'] }
                ],
                total: 1
              }}]
            }
          })
        });

        const result = await searchPayers('Aetna');

        expect(result.success).toBe(true);
        expect(result.data?.payers).toHaveLength(1);
        expect(result.data?.payers[0].name).toBe('Aetna');
      });

      it('should filter payers by state', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                success: true,
                payers: [
                  { id: '00010', name: 'Kaiser Permanente', type: 'commercial', states: ['CA'] }
                ],
                total: 1
              }}]
            }
          })
        });

        const result = await searchPayers(undefined, 'CA');

        expect(result.success).toBe(true);
        expect(result.data?.payers[0].states).toContain('CA');
      });
    });
  });

  describe('Statistics Operations', () => {
    describe('getBillingStats', () => {
      it('should return submission statistics', async () => {
        const mockStats = {
          stats: {
            period: { from: '2024-01-01', to: '2024-01-31' },
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
              { code: '16', description: 'Claim lacks required information', count: 3 }
            ],
            by_payer: [
              { payer: 'UnitedHealthcare', submissions: 45, paid: 42, pending: 2, denied: 1 }
            ]
          }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: { success: true, ...mockStats } }]
            }
          })
        });

        const result = await getBillingStats('2024-01-01', '2024-01-31');

        expect(result.success).toBe(true);
        expect(result.data?.stats.submissions.total).toBe(156);
        expect(result.data?.stats.payments.collection_rate).toBe(81.02);
      });
    });
  });

  describe('Rejection Guidance Operations', () => {
    describe('lookupRejectionReason', () => {
      it('should look up specific rejection code', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                success: true,
                reasons: [
                  {
                    code: '197',
                    category: 'authorization',
                    description: 'Prior authorization required',
                    remediation: 'Obtain prior auth retroactively if possible, or appeal'
                  }
                ],
                total: 1,
                categories: ['authorization'],
                appeal_guidance: {
                  timeframe: 'Most payers allow appeals within 60-180 days',
                  process: ['Review denial reason', 'Gather documentation'],
                  tips: ['Reference denial code in appeals']
                }
              }}]
            }
          })
        });

        const result = await lookupRejectionReason('197');

        expect(result.success).toBe(true);
        expect(result.data?.reasons).toHaveLength(1);
        expect(result.data?.reasons[0].code).toBe('197');
        expect(result.data?.reasons[0].remediation).toContain('prior auth');
      });
    });

    describe('getRejectionsByCategory', () => {
      it('should get rejections by category', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'json', data: {
                success: true,
                reasons: [
                  { code: '4', category: 'coding', description: 'Procedure code inconsistent with modifier' },
                  { code: '5', category: 'coding', description: 'Procedure code inconsistent with diagnosis' }
                ],
                total: 2,
                categories: ['coding'],
                appeal_guidance: {}
              }}]
            }
          })
        });

        const result = await getRejectionsByCategory('coding');

        expect(result.success).toBe(true);
        expect(result.data?.reasons.every(r => r.category === 'coding')).toBe(true);
      });
    });
  });

  describe('Reference Constants', () => {
    it('should have service type codes', () => {
      expect(SERVICE_TYPE_CODES['30']).toBe('Health Benefit Plan Coverage');
      expect(SERVICE_TYPE_CODES['48']).toBe('Hospital - Inpatient');
      expect(SERVICE_TYPE_CODES['AE']).toBe('Physical Therapy');
    });

    it('should have relationship codes', () => {
      expect(RELATIONSHIP_CODES['18']).toBe('Self');
      expect(RELATIONSHIP_CODES['01']).toBe('Spouse');
      expect(RELATIONSHIP_CODES['19']).toBe('Child');
    });

    it('should have adjustment reason codes', () => {
      expect(ADJUSTMENT_REASON_CODES['PR-1']).toBe('Deductible');
      expect(ADJUSTMENT_REASON_CODES['PR-2']).toBe('Coinsurance');
      expect(ADJUSTMENT_REASON_CODES['CO-45']).toBe('Charges exceed fee schedule maximum');
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await testClearinghouseConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Unauthorized' } })
      });

      const result = await testClearinghouseConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should handle missing authentication', async () => {
      delete mockLocalStorage['sb-xkybsjnvuohpqpbkikyn-auth-token'];

      const client = new ClearinghouseMCPClient();
      const result = await client.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');

      // Restore
      mockLocalStorage['sb-xkybsjnvuohpqpbkikyn-auth-token'] = JSON.stringify({ access_token: 'test-token' });
    });
  });
});
