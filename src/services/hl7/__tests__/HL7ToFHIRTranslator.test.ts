/**
 * HL7 to FHIR Translator Tests
 *
 * Tests for translating HL7 v2.x messages to FHIR R4 resources
 * Uses ServiceResult<T> pattern for consistent error handling
 */

import { HL7ToFHIRTranslator, createHL7ToFHIRTranslator } from '../HL7ToFHIRTranslator';
import { HL7Parser } from '../HL7Parser';
import { ADTMessage, ORUMessage, ORMMessage } from '../../../types/hl7v2';

// Mock audit logger
jest.mock('../../auditLogger', () => ({
  auditLogger: {
    log: jest.fn(),
    logSecurityEvent: jest.fn(),
  },
}));

describe('HL7ToFHIRTranslator', () => {
  const tenantId = 'test-tenant-123';
  let translator: HL7ToFHIRTranslator;
  let parser: HL7Parser;

  beforeEach(() => {
    translator = new HL7ToFHIRTranslator(tenantId);
    parser = new HL7Parser();
    jest.clearAllMocks();
  });

  describe('Factory Function', () => {
    it('should create translator with factory function', () => {
      const factoryTranslator = createHL7ToFHIRTranslator('tenant-456', 'CustomSystem');
      expect(factoryTranslator).toBeInstanceOf(HL7ToFHIRTranslator);
    });
  });

  describe('ADT Message Translation', () => {
    const adtA01Message = [
      'MSH|^~\\&|ADT|HOSPITAL|WELLFIT|CLINIC|20231201120000||ADT^A01^ADT_A01|MSG12345|P|2.5.1',
      'EVN|A01|20231201120000',
      'PID|1||12345^^^HOSPITAL^MR~555-12-3456^^^SSA^SS||Doe^John^William^Jr^Dr||19800115|M|||123 Main St^Apt 4^Houston^TX^77001^USA^H||713-555-1234^PRN^PH|713-555-5678^WPN^CP|EN|M|CHR|987654|||N|||||20231201',
      'PV1|1|I|ICU^101^A^HOSPITAL||||1234^Smith^Jane^M^Dr^MD|5678^Johnson^Robert^L^Dr^MD||MED|||Y||9|1234^Smith^Jane^M^Dr^MD||||S||||||||||||||||ACUTE||||||20231201100000',
      'DG1|1|I10|E11.9^Type 2 diabetes mellitus without complications^I10||20231201|A||||||||||1234^Smith^Jane^M^Dr^MD',
      'AL1|1|DA|00000-0000-001^Penicillin^NDC|SV|Anaphylaxis|20200101',
      'IN1|1|BCBS001^Blue Cross Blue Shield|BCBS|Blue Cross Blue Shield of Texas^TX123|123 Insurance Way^Suite 100^Dallas^TX^75001|||GRP12345|General Motors|||20230101|20231231|||||SEL|Doe^John|01|19800115',
    ].join('\r');

    it('should translate ADT A01 message successfully', () => {
      const parseResult = parser.parseADT(adtA01Message);
      expect(parseResult.success).toBe(true);

      const translateResult = translator.translate(parseResult.data!.message);

      expect(translateResult.success).toBe(true);
      expect(translateResult.data).toBeDefined();
      expect(translateResult.data!.bundle).toBeDefined();
      expect(translateResult.data!.bundle.resourceType).toBe('Bundle');
      expect(translateResult.data!.resources.length).toBeGreaterThan(0);
    });

    it('should create Patient resource from PID segment', () => {
      const parseResult = parser.parseADT(adtA01Message);
      const translateResult = translator.translate(parseResult.data!.message);

      expect(translateResult.success).toBe(true);
      const patient = translateResult.data!.resources.find((r) => r.resourceType === 'Patient');

      expect(patient).toBeDefined();
      expect(patient!.resourceType).toBe('Patient');
      expect((patient as any).name).toBeDefined();
      expect((patient as any).name[0].family).toBe('Doe');
      expect((patient as any).name[0].given).toContain('John');
      expect((patient as any).birthDate).toBe('1980-01-15');
      expect((patient as any).gender).toBe('male');
    });

    it('should create Patient identifiers (MRN, SSN)', () => {
      const parseResult = parser.parseADT(adtA01Message);
      const translateResult = translator.translate(parseResult.data!.message);

      const patient = translateResult.data!.resources.find((r) => r.resourceType === 'Patient');
      const identifiers = (patient as any).identifier;

      expect(identifiers).toBeDefined();
      expect(identifiers.length).toBe(2);

      // Check MRN
      const mrn = identifiers.find((id: any) => id.type?.coding?.[0]?.code === 'MR');
      expect(mrn).toBeDefined();
      expect(mrn.value).toBe('12345');

      // Check SSN
      const ssn = identifiers.find((id: any) => id.type?.coding?.[0]?.code === 'SS');
      expect(ssn).toBeDefined();
      expect(ssn.value).toBe('555-12-3456');
    });

    it('should create Encounter resource from PV1 segment', () => {
      const parseResult = parser.parseADT(adtA01Message);
      const translateResult = translator.translate(parseResult.data!.message);

      const encounter = translateResult.data!.resources.find((r) => r.resourceType === 'Encounter');

      expect(encounter).toBeDefined();
      expect(encounter!.resourceType).toBe('Encounter');
      expect((encounter as any).status).toBe('in-progress');
      expect((encounter as any).class.code).toBe('IMP'); // Inpatient
    });

    it('should create Condition resource from DG1 segment', () => {
      const parseResult = parser.parseADT(adtA01Message);
      const translateResult = translator.translate(parseResult.data!.message);

      const condition = translateResult.data!.resources.find((r) => r.resourceType === 'Condition');

      expect(condition).toBeDefined();
      expect(condition!.resourceType).toBe('Condition');
      expect((condition as any).code?.coding?.[0]?.code).toBe('E11.9');
    });

    it('should create AllergyIntolerance resource from AL1 segment', () => {
      const parseResult = parser.parseADT(adtA01Message);
      const translateResult = translator.translate(parseResult.data!.message);

      const allergy = translateResult.data!.resources.find(
        (r) => r.resourceType === 'AllergyIntolerance'
      );

      expect(allergy).toBeDefined();
      expect(allergy!.resourceType).toBe('AllergyIntolerance');
      expect((allergy as any).code?.coding?.[0]?.display).toBe('Penicillin');
      expect((allergy as any).criticality).toBe('high'); // SV -> high
    });

    it('should create Coverage resource from IN1 segment', () => {
      const parseResult = parser.parseADT(adtA01Message);
      const translateResult = translator.translate(parseResult.data!.message);

      const coverage = translateResult.data!.resources.find((r) => r.resourceType === 'Coverage');

      expect(coverage).toBeDefined();
      expect(coverage!.resourceType).toBe('Coverage');
      expect((coverage as any).class?.[0]?.value).toBe('GRP12345');
    });

    it('should include source message info in result', () => {
      const parseResult = parser.parseADT(adtA01Message);
      const translateResult = translator.translate(parseResult.data!.message);

      expect(translateResult.data!.sourceMessageId).toBe('MSG12345');
      expect(translateResult.data!.sourceMessageType).toBe('ADT^A01');
    });
  });

  describe('ORU Message Translation (Lab Results)', () => {
    const oruR01Message = [
      'MSH|^~\\&|LAB|HOSPITAL|WELLFIT|CLINIC|20231201140000||ORU^R01^ORU_R01|LAB67890|P|2.5.1',
      'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M',
      'ORC|RE|ORD001|FIL001||CM||||20231201130000|||1234^Smith^Jane',
      'OBR|1|ORD001|FIL001|80053^Comprehensive Metabolic Panel^CPT|||20231201130000|||||||20231201130500||1234^Smith^Jane||||||20231201140000|||F',
      'OBX|1|NM|2345-7^Glucose^LN||95|mg/dL|70-100||||F|||20231201133000',
      'OBX|2|NM|2160-0^Creatinine^LN||1.1|mg/dL|0.7-1.3||||F|||20231201133000',
      'OBX|3|NM|3094-0^BUN^LN||18|mg/dL|7-20||||F|||20231201133000',
      'NTE|1|L|Normal metabolic panel results.',
    ].join('\r');

    it('should translate ORU R01 message successfully', () => {
      const parseResult = parser.parseORU(oruR01Message);
      expect(parseResult.success).toBe(true);

      const translateResult = translator.translate(parseResult.data!.message);

      expect(translateResult.success).toBe(true);
      expect(translateResult.data!.resources.length).toBeGreaterThan(0);
      expect(translateResult.data!.sourceMessageType).toBe('ORU^R01');
    });

    it('should create DiagnosticReport resource from OBR', () => {
      const parseResult = parser.parseORU(oruR01Message);
      const translateResult = translator.translate(parseResult.data!.message);

      const report = translateResult.data!.resources.find(
        (r) => r.resourceType === 'DiagnosticReport'
      );

      expect(report).toBeDefined();
      expect((report as any).code?.coding?.[0]?.code).toBe('80053');
      expect((report as any).code?.coding?.[0]?.display).toBe('Comprehensive Metabolic Panel');
      expect((report as any).status).toBe('final');
    });

    it('should create Observation resources from OBX segments', () => {
      const parseResult = parser.parseORU(oruR01Message);
      const translateResult = translator.translate(parseResult.data!.message);

      const observations = translateResult.data!.resources.filter(
        (r) => r.resourceType === 'Observation'
      );

      expect(observations.length).toBe(3);

      // Check glucose observation
      const glucose = observations.find(
        (o) => (o as any).code?.coding?.[0]?.code === '2345-7'
      );
      expect(glucose).toBeDefined();
      expect((glucose as any).valueQuantity?.value).toBe(95);
      expect((glucose as any).valueQuantity?.unit).toBe('mg/dL');
      expect((glucose as any).referenceRange?.[0]?.text).toBe('70-100');
    });

    it('should link observations to diagnostic report', () => {
      const parseResult = parser.parseORU(oruR01Message);
      const translateResult = translator.translate(parseResult.data!.message);

      const report = translateResult.data!.resources.find(
        (r) => r.resourceType === 'DiagnosticReport'
      );

      expect((report as any).result).toBeDefined();
      expect((report as any).result.length).toBe(3);
    });

    it('should translate abnormal flags', () => {
      const abnormalMessage = [
        'MSH|^~\\&|LAB|HOSPITAL|WELLFIT|CLINIC|20231201140000||ORU^R01|LAB001|P|2.5.1',
        'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M',
        'OBR|1|ORD001|FIL001|80053^CMP^CPT|||20231201130000||||||||||||F',
        'OBX|1|NM|2345-7^Glucose^LN||250|mg/dL|70-100|H|||F|||20231201133000',
      ].join('\r');

      const parseResult = parser.parseORU(abnormalMessage);
      const translateResult = translator.translate(parseResult.data!.message);

      const observation = translateResult.data!.resources.find(
        (r) => r.resourceType === 'Observation'
      );

      expect((observation as any).interpretation).toBeDefined();
      expect((observation as any).interpretation[0]?.coding?.[0]?.code).toBe('H');
    });
  });

  describe('ORM Message Translation (Orders)', () => {
    const ormO01Message = [
      'MSH|^~\\&|CPOE|HOSPITAL|LAB|HOSPITAL|20231201100000||ORM^O01^ORM_O01|ORD99999|P|2.5.1',
      'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M',
      'PV1|1|O|OUTPATIENT||||1234^Smith^Jane^M^Dr^MD',
      'ORC|NW|ORD001||GRP001|SC||1^Once||20231201100000|USER123|||||INTERNAL_MED',
      'OBR|1|ORD001||80053^Comprehensive Metabolic Panel^CPT|R||20231201100000|||NURSE001||||Blood|||1234^Smith^Jane^M^Dr^MD',
      'ORC|NW|ORD002||GRP001|SC||1^Once||20231201100000|USER123',
      'OBR|2|ORD002||85025^CBC with Differential^CPT|R||20231201100000|||NURSE001||||Blood|||1234^Smith^Jane^M^Dr^MD',
    ].join('\r');

    it('should translate ORM O01 message successfully', () => {
      const parseResult = parser.parseORM(ormO01Message);
      expect(parseResult.success).toBe(true);

      const translateResult = translator.translate(parseResult.data!.message);

      expect(translateResult.success).toBe(true);
      expect(translateResult.data!.resources.length).toBeGreaterThan(0);
      expect(translateResult.data!.sourceMessageType).toBe('ORM^O01');
    });

    it('should create ServiceRequest resources from ORC/OBR', () => {
      const parseResult = parser.parseORM(ormO01Message);
      const translateResult = translator.translate(parseResult.data!.message);

      const serviceRequests = translateResult.data!.resources.filter(
        (r) => r.resourceType === 'ServiceRequest'
      );

      expect(serviceRequests.length).toBe(2);

      // Check first order
      const order1 = serviceRequests[0];
      expect((order1 as any).code?.coding?.[0]?.code).toBe('80053');
      expect((order1 as any).intent).toBe('order');
      expect((order1 as any).priority).toBe('routine');
    });

    it('should include order identifiers', () => {
      const parseResult = parser.parseORM(ormO01Message);
      const translateResult = translator.translate(parseResult.data!.message);

      const serviceRequest = translateResult.data!.resources.find(
        (r) => r.resourceType === 'ServiceRequest'
      );

      const identifiers = (serviceRequest as any).identifier;
      expect(identifiers).toBeDefined();

      const placerOrder = identifiers.find((id: any) => id.type?.text === 'Placer Order Number');
      expect(placerOrder).toBeDefined();
      expect(placerOrder.value).toBe('ORD001');
    });
  });

  describe('FHIR Bundle Structure', () => {
    it('should create valid Bundle with collection type', () => {
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\r' +
        'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M\r';

      const parseResult = parser.parse(message);
      const translateResult = translator.translate(parseResult.data!.message);

      expect(translateResult.data!.bundle.resourceType).toBe('Bundle');
      expect(translateResult.data!.bundle.type).toBe('collection');
      expect(translateResult.data!.bundle.timestamp).toBeDefined();
    });

    it('should include fullUrl for each entry', () => {
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\r' +
        'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M\r';

      const parseResult = parser.parse(message);
      const translateResult = translator.translate(parseResult.data!.message);

      expect(translateResult.data!.bundle.entry).toBeDefined();
      for (const entry of translateResult.data!.bundle.entry!) {
        expect(entry.fullUrl).toBeDefined();
        expect(entry.fullUrl!.startsWith('urn:uuid:')).toBe(true);
        expect(entry.resource).toBeDefined();
      }
    });

    it('should include US Core profiles in meta', () => {
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\r' +
        'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M\r';

      const parseResult = parser.parse(message);
      const translateResult = translator.translate(parseResult.data!.message);

      const patient = translateResult.data!.resources.find((r) => r.resourceType === 'Patient');
      expect((patient as any).meta?.profile).toBeDefined();
      expect((patient as any).meta?.profile).toContain(
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'
      );
    });
  });

  describe('Error Handling', () => {
    it('should return failure for messages with no translatable content', () => {
      // Create a minimal message with just MSH
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ACK^A01|MSG001|P|2.5.1\r';

      const parseResult = parser.parse(message);
      const translateResult = translator.translate(parseResult.data!.message);

      // ACK messages don't produce resources
      expect(translateResult.success).toBe(false);
      expect(translateResult.error).toBeDefined();
      expect(translateResult.error!.code).toBe('VALIDATION_ERROR');
      expect(translateResult.error!.message).toContain('No resources');
    });

    it('should include source message info in error details', () => {
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ACK^A01|MSG001|P|2.5.1\r';

      const parseResult = parser.parse(message);
      const translateResult = translator.translate(parseResult.data!.message);

      expect(translateResult.success).toBe(false);
      const details = translateResult.error!.details as Record<string, unknown>;
      expect(details.sourceMessageId).toBe('MSG001');
      expect(details.sourceMessageType).toBe('ACK^A01');
    });

    it('should add warnings for unsupported message types', () => {
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||XYZ^Z01|MSG001|P|2.5.1\r' +
        'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M\r';

      const parseResult = parser.parse(message);
      const translateResult = translator.translate(parseResult.data!.message);

      // Should still succeed (extracts patient) but with warning
      expect(translateResult.success).toBe(true);
      expect(translateResult.data!.warnings.length).toBeGreaterThan(0);
      expect(translateResult.data!.warnings[0]).toContain('Unsupported message type');
    });
  });

  describe('Data Type Translations', () => {
    it('should translate gender correctly', () => {
      const maleMessage =
        'MSH|^~\\&|ADT|HOSPITAL|WELLFIT|CLINIC|20231201120000||ADT^A01|MSG001|P|2.5.1\r' +
        'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M\r';

      const femaleMessage =
        'MSH|^~\\&|ADT|HOSPITAL|WELLFIT|CLINIC|20231201120000||ADT^A01|MSG001|P|2.5.1\r' +
        'PID|1||12345^^^HOSPITAL^MR||Doe^Jane||19800115|F\r';

      const maleResult = parser.parse(maleMessage);
      const femaleResult = parser.parse(femaleMessage);

      const maleTranslation = translator.translate(maleResult.data!.message);
      const femaleTranslation = translator.translate(femaleResult.data!.message);

      const malePatient = maleTranslation.data!.resources.find((r) => r.resourceType === 'Patient');
      const femalePatient = femaleTranslation.data!.resources.find(
        (r) => r.resourceType === 'Patient'
      );

      expect((malePatient as any).gender).toBe('male');
      expect((femalePatient as any).gender).toBe('female');
    });

    it('should translate dates correctly', () => {
      const message =
        'MSH|^~\\&|ADT|HOSPITAL|WELLFIT|CLINIC|20231201120000||ADT^A01|MSG001|P|2.5.1\r' +
        'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M\r';

      const parseResult = parser.parse(message);
      const translateResult = translator.translate(parseResult.data!.message);

      const patient = translateResult.data!.resources.find((r) => r.resourceType === 'Patient');
      expect((patient as any).birthDate).toBe('1980-01-15'); // YYYYMMDD -> YYYY-MM-DD
    });

    it('should translate coded elements to CodeableConcepts', () => {
      const oruMessage = [
        'MSH|^~\\&|LAB|HOSPITAL|WELLFIT|CLINIC|20231201140000||ORU^R01|LAB001|P|2.5.1',
        'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M',
        'OBR|1|ORD001|FIL001|80053^Comprehensive Metabolic Panel^CPT|||20231201130000||||||||||||F',
        'OBX|1|NM|2345-7^Glucose^LN||95|mg/dL|70-100||||F|||20231201133000',
      ].join('\r');

      const parseResult = parser.parseORU(oruMessage);
      const translateResult = translator.translate(parseResult.data!.message);

      const observation = translateResult.data!.resources.find(
        (r) => r.resourceType === 'Observation'
      );

      expect((observation as any).code.coding).toBeDefined();
      expect((observation as any).code.coding[0].code).toBe('2345-7');
      expect((observation as any).code.coding[0].display).toBe('Glucose');
      expect((observation as any).code.coding[0].system).toBe('http://loinc.org');
    });

    it('should map coding systems correctly', () => {
      const adtMessage = [
        'MSH|^~\\&|ADT|HOSPITAL|WELLFIT|CLINIC|20231201120000||ADT^A01|MSG001|P|2.5.1',
        'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M',
        'DG1|1|I10|E11.9^Type 2 diabetes mellitus without complications^I10||20231201|A',
      ].join('\r');

      const parseResult = parser.parseADT(adtMessage);
      const translateResult = translator.translate(parseResult.data!.message);

      const condition = translateResult.data!.resources.find(
        (r) => r.resourceType === 'Condition'
      );

      expect((condition as any).code?.coding?.[0]?.system).toBe('http://hl7.org/fhir/sid/icd-10');
    });
  });

  describe('Legacy Method', () => {
    it('should provide backward compatible translateLegacy method', () => {
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\r' +
        'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M\r';

      const parseResult = parser.parse(message);
      const legacyResult = translator.translateLegacy(parseResult.data!.message);

      // Legacy format
      expect(legacyResult.success).toBe(true);
      expect(legacyResult.bundle).toBeDefined();
      expect(legacyResult.resources).toBeDefined();
      expect(legacyResult.errors).toEqual([]);
      expect(legacyResult.warnings).toBeDefined();
    });

    it('should convert failures to legacy format', () => {
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ACK^A01|MSG001|P|2.5.1\r';

      const parseResult = parser.parse(message);
      const legacyResult = translator.translateLegacy(parseResult.data!.message);

      expect(legacyResult.success).toBe(false);
      expect(legacyResult.errors.length).toBeGreaterThan(0);
      expect(legacyResult.bundle).toBeUndefined();
    });
  });
});
