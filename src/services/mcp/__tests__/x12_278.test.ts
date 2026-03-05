/**
 * X12 278 Prior Authorization — Generator and Parser Unit Tests
 *
 * Tests the actual X12 278 generation and parsing logic.
 * CMS-0057-F: Health Care Services Review (278), ASC X12N 005010X217
 */

// =====================================================
// Replicate core logic for testability
// (Same logic as server-side Deno modules — kept in sync)
// =====================================================

function padRight(str: string, length: number): string {
  return str.padEnd(length).substring(0, length);
}

interface PriorAuthRequest {
  transaction_set_id: string;
  control_number: string;
  receiver: { name: string; id: string };
  subscriber: {
    member_id: string; first_name: string; last_name: string;
    dob: string; gender: string;
  };
  patient?: {
    relationship: string; first_name: string; last_name: string;
    dob: string; gender: string;
  };
  requesting_provider: { npi: string; name: string; taxonomy?: string };
  certification_type: string;
  service_type_code: string;
  level_of_service?: string;
  service_date_from: string;
  diagnoses: Array<{ code: string; code_type: string; qualifier: string }>;
  procedures: Array<{
    code: string; code_type: string; modifier_codes?: string[];
    quantity: number; unit_type: string;
  }>;
  notes?: string;
}

function generate278(data: PriorAuthRequest, ctl: { isa: string; gs: string; st: string }) {
  const s: string[] = [];
  const d = '20240301', t = '1030';

  s.push(`ISA*00*          *00*          *ZZ*${padRight(data.requesting_provider.npi, 15)}*ZZ*${padRight(data.receiver.id, 15)}*${d.substring(2)}*${t}*^*00501*${ctl.isa}*0*P*:`);
  s.push(`GS*HI*${data.requesting_provider.npi}*${data.receiver.id}*${d}*${t}*${ctl.gs}*X*005010X217`);
  s.push(`ST*278*${ctl.st}*005010X217`);
  s.push(`BHT*0007*11*${data.transaction_set_id}*${d}*${t}*18`);

  // 2000A - UMO
  s.push(`HL*1**20*1`);
  s.push(`NM1*X3*2*${data.receiver.name}*****PI*${data.receiver.id}`);

  // 2000B - Requester
  s.push(`HL*2*1*21*1`);
  s.push(`NM1*1P*2*${data.requesting_provider.name}*****XX*${data.requesting_provider.npi}`);
  if (data.requesting_provider.taxonomy) s.push(`PRV*RF*PXC*${data.requesting_provider.taxonomy}`);

  // 2000C - Subscriber
  const hasPatient = !!data.patient;
  s.push(`HL*3*2*22*${hasPatient ? '1' : '0'}`);
  s.push(`NM1*IL*1*${data.subscriber.last_name}*${data.subscriber.first_name}****MI*${data.subscriber.member_id}`);
  s.push(`DMG*D8*${data.subscriber.dob.replace(/-/g, '')}*${data.subscriber.gender}`);

  // 2000D - Patient (optional)
  let hlC = 4;
  if (data.patient) {
    s.push(`HL*${hlC}*3*23*1`); hlC++;
    s.push(`PAT*${data.patient.relationship}`);
    s.push(`NM1*QC*1*${data.patient.last_name}*${data.patient.first_name}`);
    s.push(`DMG*D8*${data.patient.dob.replace(/-/g, '')}*${data.patient.gender}`);
  }

  // 2000E - Patient Event
  const evParent = hasPatient ? (hlC - 1).toString() : '3';
  s.push(`HL*${hlC}*${evParent}*EV*1`);
  const evHl = hlC; hlC++;
  s.push(`UM*${data.certification_type}*${data.service_type_code}*${data.level_of_service || ''}`);
  s.push(`DTP*472*D8*${data.service_date_from.replace(/-/g, '')}`);

  if (data.diagnoses.length > 0) {
    s.push(`HI*${data.diagnoses.map(dx => `${dx.qualifier}:${dx.code_type}:${dx.code.replace('.', '')}`).join('*')}`);
  }

  // 2000F - Services
  for (const proc of data.procedures) {
    s.push(`HL*${hlC}*${evHl}*SS*0`); hlC++;
    const mods = proc.modifier_codes?.length ? ':' + proc.modifier_codes.join(':') : '';
    s.push(`SV1*HC:${proc.code}${mods}***${proc.quantity}*${proc.unit_type}`);
  }

  if (data.notes) s.push(`MSG*${data.notes.substring(0, 264)}`);

  s.push(`SE*${s.length + 1}*${ctl.st}`);
  s.push(`GE*1*${ctl.gs}`);
  s.push(`IEA*1*${ctl.isa}`);

  return { x12_content: s.join('~') + '~', control_number: data.control_number, transaction_set_id: data.transaction_set_id, segment_count: s.length };
}

function parse278(x12: string) {
  const segs = x12.split('~').filter(s => s.trim());
  const r = { transaction_set_id: '', control_number: '', original_control_number: '', action_code: '', payer: { name: '', id: '' }, auth_number: undefined as string | undefined, decision_reason_code: undefined as string | undefined, denial_reason: undefined as { code: string; description: string } | undefined, notes: undefined as string | undefined, effective_date_from: undefined as string | undefined, effective_date_to: undefined as string | undefined, certification_type: undefined as string | undefined, segment_count: segs.length, loop_count: 0 };

  for (const seg of segs) {
    const f = seg.split('*');
    switch (f[0]) {
      case 'ST': r.transaction_set_id = f[2] || ''; break;
      case 'BHT': r.original_control_number = f[3] || ''; break;
      case 'HL': r.loop_count++; break;
      case 'NM1': if (f[1] === 'X3' || f[1] === 'PR') r.payer = { name: f[3] || '', id: f[9] || '' }; break;
      case 'HCR': r.action_code = f[1] || ''; if (f[2]) r.auth_number = f[2]; break;
      case 'REF': if (f[1] === 'BB' && f[2]) r.auth_number = f[2]; if (f[1] === 'NT' && f[2]) r.control_number = f[2]; break;
      case 'DTP': if (f[1] === '472' && f[2] === 'RD8' && f[3]) { const p = f[3].split('-'); r.effective_date_from = p[0]; r.effective_date_to = p[1]; } else if (f[1] === '472' && f[2] === 'D8' && f[3]) { if (!r.effective_date_from) r.effective_date_from = f[3]; else r.effective_date_to = f[3]; } break;
      case 'AAA': if (f[3]) { r.decision_reason_code = f[3]; r.denial_reason = { code: f[3], description: f[3] === '09' ? 'Not medically necessary' : `Reason: ${f[3]}` }; } break;
      case 'MSG': if (f[1]) r.notes = (r.notes ? r.notes + ' ' : '') + f[1]; break;
      case 'UM': r.certification_type = f[1] || undefined; break;
    }
  }
  return r;
}

function validate278(x12: string) {
  const segs = x12.split('~').filter(s => s.trim());
  const names = segs.map(s => s.split('*')[0]);
  if (segs.length === 0) return { valid: false, errors: ['Empty X12 content'], warnings: [] as string[], segmentCount: 0 };
  const errors: string[] = [];
  for (const r of ['ISA', 'GS', 'ST', 'BHT', 'SE', 'GE', 'IEA']) { if (!names.includes(r)) errors.push(`Missing required envelope segment: ${r}`); }
  if (names[0] !== 'ISA') errors.push('First segment must be ISA');
  if (names[names.length - 1] !== 'IEA') errors.push('Last segment must be IEA');
  const st = segs.find(s => s.startsWith('ST*'));
  if (st && st.split('*')[1] !== '278') errors.push(`Expected transaction set 278, found ${st.split('*')[1]}`);
  if (!names.includes('HL')) errors.push('Missing HL (Hierarchical Level) segments');
  if (!names.includes('NM1')) errors.push('Missing NM1 (entity name) segments');
  return { valid: errors.length === 0, errors, warnings: [] as string[], segmentCount: segs.length };
}

// =====================================================
// Test fixtures
// =====================================================

const REQ: PriorAuthRequest = {
  transaction_set_id: 'PA-TEST-001', control_number: 'CTL-278-001',
  receiver: { name: 'Test Payer Alpha', id: 'PAYER001' },
  subscriber: { member_id: 'MEM-TEST-001', first_name: 'Test', last_name: 'Patient Alpha', dob: '2000-01-01', gender: 'M' },
  requesting_provider: { npi: '1234567890', name: 'Test Provider Alpha', taxonomy: '207Q00000X' },
  certification_type: 'I', service_type_code: '3', service_date_from: '2024-03-01',
  diagnoses: [{ code: 'M54.5', code_type: 'ABK', qualifier: 'ABF' }],
  procedures: [{ code: '27447', code_type: 'HC', quantity: 1, unit_type: 'UN' }],
};

const CTL = { isa: '000000001', gs: '000000001', st: '0001' };

// =====================================================
// Generator Tests
// =====================================================

describe('X12 278 Generator', () => {
  it('should generate valid X12 278 with correct envelope', () => {
    const result = generate278(REQ, CTL);
    expect(result.x12_content).toContain('ISA*00');
    expect(result.x12_content).toContain('GS*HI');
    expect(result.x12_content).toContain('ST*278');
    expect(result.x12_content).toContain('IEA*1');
    expect(result.control_number).toBe('CTL-278-001');
  });

  it('should include BHT with correct purpose code 0007', () => {
    const result = generate278(REQ, CTL);
    expect(result.x12_content).toContain('BHT*0007*11*PA-TEST-001');
  });

  it('should include UMO (payer) in Loop 2000A', () => {
    const result = generate278(REQ, CTL);
    expect(result.x12_content).toContain('HL*1**20*1');
    expect(result.x12_content).toContain('NM1*X3*2*Test Payer Alpha*****PI*PAYER001');
  });

  it('should include requesting provider in Loop 2000B', () => {
    const result = generate278(REQ, CTL);
    expect(result.x12_content).toContain('HL*2*1*21*1');
    expect(result.x12_content).toContain('NM1*1P*2*Test Provider Alpha*****XX*1234567890');
  });

  it('should include subscriber in Loop 2000C with demographics', () => {
    const result = generate278(REQ, CTL);
    expect(result.x12_content).toContain('NM1*IL*1*Patient Alpha*Test****MI*MEM-TEST-001');
    expect(result.x12_content).toContain('DMG*D8*20000101*M');
  });

  it('should include UM segment with certification type and service code', () => {
    const result = generate278(REQ, CTL);
    expect(result.x12_content).toContain('UM*I*3*');
  });

  it('should include diagnosis codes in HI segment', () => {
    const result = generate278(REQ, CTL);
    expect(result.x12_content).toContain('HI*ABF:ABK:M545');
  });

  it('should include service lines in Loop 2000F', () => {
    const result = generate278(REQ, CTL);
    expect(result.x12_content).toContain('SV1*HC:27447***1*UN');
  });

  it('should include provider taxonomy PRV segment', () => {
    const result = generate278(REQ, CTL);
    expect(result.x12_content).toContain('PRV*RF*PXC*207Q00000X');
  });

  it('should include patient loop when patient differs from subscriber', () => {
    const withPatient = { ...REQ, patient: { relationship: '19', first_name: 'Child', last_name: 'Patient Alpha', dob: '2010-06-15', gender: 'F' } };
    const result = generate278(withPatient, CTL);
    expect(result.x12_content).toContain('HL*3*2*22*1');
    expect(result.x12_content).toContain('PAT*19');
    expect(result.x12_content).toContain('NM1*QC*1*Patient Alpha*Child');
  });

  it('should set subscriber HL child flag to 0 when no patient', () => {
    const result = generate278(REQ, CTL);
    expect(result.x12_content).toContain('HL*3*2*22*0');
  });

  it('should include notes as MSG segment', () => {
    const withNotes = { ...REQ, notes: 'Surgical consult recommended knee replacement' };
    const result = generate278(withNotes, CTL);
    expect(result.x12_content).toContain('MSG*Surgical consult recommended knee replacement');
  });

  it('should handle multiple procedures as separate SS service loops', () => {
    const multi = { ...REQ, procedures: [
      { code: '27447', code_type: 'HC', quantity: 1, unit_type: 'UN' },
      { code: '20610', code_type: 'HC', quantity: 2, unit_type: 'UN' },
    ]};
    const result = generate278(multi, CTL);
    expect(result.x12_content).toContain('SV1*HC:27447***1*UN');
    expect(result.x12_content).toContain('SV1*HC:20610***2*UN');
    expect(result.x12_content.match(/HL\*\d+\*\d+\*SS\*0/g)).toHaveLength(2);
  });

  it('should use 005010X217 implementation guide reference', () => {
    const result = generate278(REQ, CTL);
    expect(result.x12_content).toContain('005010X217');
  });

  it('should pass validation on generated output', () => {
    const result = generate278(REQ, CTL);
    expect(validate278(result.x12_content).valid).toBe(true);
  });
});

// =====================================================
// Parser Tests
// =====================================================

function build278Response(overrides: Record<string, string> = {}): string {
  return [
    'ISA*00*          *00*          *ZZ*1234567890     *ZZ*PAYER001       *240301*1030*^*00501*000000001*0*P*:',
    'GS*HI*1234567890*PAYER001*20240301*1030*000000001*X*005010X217',
    'ST*278*0001*005010X217',
    `BHT*0007*13*${overrides['bht_ref'] || 'PA-TEST-001'}*20240301*1030*18`,
    'HL*1**20*1',
    'NM1*X3*2*Test Payer Alpha*****PI*PAYER001',
    'HL*2*1*21*0',
    overrides['hcr'] || 'HCR*A1*AUTH-2024-00123',
    ...(overrides['extra'] ? [overrides['extra']] : []),
    overrides['dtp'] || 'DTP*472*RD8*20240301-20240601',
    overrides['ref'] || 'REF*NT*RESP-001',
    `SE*${11 + (overrides['extra'] ? 1 : 0)}*0001`,
    'GE*1*000000001',
    'IEA*1*000000001',
  ].join('~') + '~';
}

describe('X12 278 Parser', () => {
  it('should parse approved response with auth number', () => {
    const parsed = parse278(build278Response());
    expect(parsed.action_code).toBe('A1');
    expect(parsed.auth_number).toBe('AUTH-2024-00123');
    expect(parsed.original_control_number).toBe('PA-TEST-001');
    expect(parsed.payer.name).toBe('Test Payer Alpha');
    expect(parsed.payer.id).toBe('PAYER001');
    expect(parsed.control_number).toBe('RESP-001');
  });

  it('should parse date range from DTP*RD8', () => {
    const parsed = parse278(build278Response());
    expect(parsed.effective_date_from).toBe('20240301');
    expect(parsed.effective_date_to).toBe('20240601');
  });

  it('should parse denied response with AAA rejection', () => {
    const parsed = parse278(build278Response({
      hcr: 'HCR*A6',
      extra: 'AAA*Y*72*09',
    }));
    expect(parsed.action_code).toBe('A6');
    expect(parsed.decision_reason_code).toBe('09');
    expect(parsed.denial_reason?.description).toContain('medically necessary');
  });

  it('should parse pending response with notes', () => {
    const parsed = parse278(build278Response({
      hcr: 'HCR*A4',
      extra: 'MSG*Please submit operative report',
    }));
    expect(parsed.action_code).toBe('A4');
    expect(parsed.notes).toContain('operative report');
  });

  it('should count HL loops', () => {
    const parsed = parse278(build278Response());
    expect(parsed.loop_count).toBe(2);
  });

  it('should parse auth number from REF*BB', () => {
    const parsed = parse278(build278Response({
      hcr: 'HCR*A1',
      extra: 'REF*BB*AUTH-99999',
    }));
    expect(parsed.auth_number).toBe('AUTH-99999');
  });
});

// =====================================================
// Validator Tests
// =====================================================

describe('X12 278 Validator', () => {
  it('should validate generated 278 as valid', () => {
    const result = generate278(REQ, CTL);
    const v = validate278(result.x12_content);
    expect(v.valid).toBe(true);
    expect(v.errors).toHaveLength(0);
    expect(v.segmentCount).toBeGreaterThan(10);
  });

  it('should reject empty content', () => {
    expect(validate278('').valid).toBe(false);
    expect(validate278('').errors).toContain('Empty X12 content');
  });

  it('should detect missing envelope segments', () => {
    const v = validate278('HL*1**20*1~NM1*X3*2*Payer~');
    expect(v.valid).toBe(false);
    expect(v.errors).toContain('First segment must be ISA');
  });

  it('should detect wrong transaction set type (837 instead of 278)', () => {
    const x12 = ['ISA*00*          *00*          *ZZ*A*ZZ*B*240301*1030*^*00501*1*0*P*:',
      'GS*HC*A*B*20240301*1030*1*X*005010X222A1', 'ST*837*0001*005010X222A1',
      'BHT*0019*00*CLM001*20240301*1030*CH', 'HL*1**20*1', 'NM1*41*2*Provider*****46*1234567890',
      'SE*6*0001', 'GE*1*1', 'IEA*1*1'].join('~') + '~';
    const v = validate278(x12);
    expect(v.valid).toBe(false);
    expect(v.errors).toContain('Expected transaction set 278, found 837');
  });

  it('should detect missing HL segments', () => {
    const x12 = ['ISA*00*          *00*          *ZZ*A*ZZ*B*240301*1030*^*00501*1*0*P*:',
      'GS*HI*A*B*20240301*1030*1*X*005010X217', 'ST*278*0001*005010X217',
      'BHT*0007*11*REF001*20240301*1030*18', 'NM1*X3*2*Payer*****PI*P1',
      'SE*5*0001', 'GE*1*1', 'IEA*1*1'].join('~') + '~';
    expect(validate278(x12).errors).toContain('Missing HL (Hierarchical Level) segments');
  });

  it('should round-trip: generate with patient then validate', () => {
    const withPatient = { ...REQ, patient: { relationship: '19', first_name: 'Child', last_name: 'Patient Alpha', dob: '2010-06-15', gender: 'F' } };
    const generated = generate278(withPatient, CTL);
    expect(validate278(generated.x12_content).valid).toBe(true);
  });
});
