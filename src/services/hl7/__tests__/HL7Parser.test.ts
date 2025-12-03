/**
 * HL7 v2.x Parser Tests
 *
 * Tests for parsing ADT, ORU, and ORM messages
 */

import { HL7Parser } from '../HL7Parser';
import { ADTMessage, ORUMessage, ORMMessage } from '../../../types/hl7v2';

// Mock audit logger
jest.mock('../../auditLogger', () => ({
  auditLogger: {
    log: jest.fn(),
    logSecurityEvent: jest.fn(),
  },
}));

describe('HL7Parser', () => {
  let parser: HL7Parser;

  beforeEach(() => {
    parser = new HL7Parser();
  });

  describe('Basic Message Parsing', () => {
    it('should parse a minimal valid HL7 message', () => {
      const message = 'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\r';

      const result = parser.parse(message);

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message!.header.messageType.messageCode).toBe('ADT');
      expect(result.message!.header.messageType.triggerEvent).toBe('A01');
      expect(result.message!.header.messageControlId).toBe('MSG001');
    });

    it('should reject empty messages', () => {
      const result = parser.parse('');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject messages without MSH segment', () => {
      const message = 'PID|1||12345^^^Hospital^MR||Doe^John||19800101|M\r';

      const result = parser.parse(message);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message.includes('MSH'))).toBe(true);
    });

    it('should handle MLLP framing', () => {
      const message =
        '\x0BMSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\r\x1C\x0D';

      const result = parser.parse(message);

      expect(result.success).toBe(true);
      expect(result.message!.header.messageControlId).toBe('MSG001');
    });

    it('should normalize different line endings', () => {
      const messageCRLF =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\r\n' +
        'PID|1||12345^^^Hospital^MR||Doe^John||19800101|M\r\n';

      const messageLF =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\n' +
        'PID|1||12345^^^Hospital^MR||Doe^John||19800101|M\n';

      const resultCRLF = parser.parse(messageCRLF);
      const resultLF = parser.parse(messageLF);

      expect(resultCRLF.success).toBe(true);
      expect(resultLF.success).toBe(true);
    });
  });

  describe('ADT Message Parsing', () => {
    const adtA01Message = [
      'MSH|^~\\&|ADT|HOSPITAL|WELLFIT|CLINIC|20231201120000||ADT^A01^ADT_A01|MSG12345|P|2.5.1',
      'EVN|A01|20231201120000',
      'PID|1||12345^^^HOSPITAL^MR~555-12-3456^^^SSA^SS||Doe^John^William^Jr^Dr||19800115|M|||123 Main St^Apt 4^Houston^TX^77001^USA^H||713-555-1234^PRN^PH~713-555-5678^WPN^CP|713-555-9012^WPN^FX|EN|M|CHR|987654|||N|||||20231201',
      'PV1|1|I|ICU^101^A^HOSPITAL||||1234^Smith^Jane^M^Dr^MD|5678^Johnson^Robert^L^Dr^MD||MED|||Y||9|1234^Smith^Jane^M^Dr^MD||||S||||||||||||||||ACUTE||||||20231201100000',
      'DG1|1|I10|E11.9^Type 2 diabetes mellitus without complications^I10||20231201|A||||||||||1234^Smith^Jane^M^Dr^MD',
      'AL1|1|DA|00000-0000-001^Penicillin^NDC|SV|Anaphylaxis|20200101',
      'IN1|1|BCBS001^Blue Cross Blue Shield|BCBS|Blue Cross Blue Shield of Texas^TX123|123 Insurance Way^Suite 100^Dallas^TX^75001|||GRP12345|General Motors|||20230101|20231231|||||SEL|Doe^John|01|19800115',
    ].join('\r');

    it('should parse ADT A01 (Admit) message', () => {
      const result = parser.parseADT(adtA01Message);

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message!.messageType).toBe('ADT');
      expect(result.message!.eventType).toBe('A01');
    });

    it('should extract patient demographics from PID', () => {
      const result = parser.parseADT(adtA01Message);
      const pid = result.message!.patientIdentification;

      expect(pid).toBeDefined();
      expect(pid.patientName[0].familyName).toBe('Doe');
      expect(pid.patientName[0].givenName).toBe('John');
      expect(pid.patientName[0].middleInitialOrName).toBe('William');
      expect(pid.dateOfBirth).toBe('19800115');
      expect(pid.administrativeSex).toBe('M');
    });

    it('should extract patient identifiers (MRN, SSN)', () => {
      const result = parser.parseADT(adtA01Message);
      const pid = result.message!.patientIdentification;

      expect(pid.patientIdentifierList.length).toBe(2);

      const mrn = pid.patientIdentifierList.find((id) => id.identifierTypeCode === 'MR');
      expect(mrn).toBeDefined();
      expect(mrn!.id).toBe('12345');

      const ssn = pid.patientIdentifierList.find((id) => id.identifierTypeCode === 'SS');
      expect(ssn).toBeDefined();
      expect(ssn!.id).toBe('555-12-3456');
    });

    it('should extract patient address', () => {
      const result = parser.parseADT(adtA01Message);
      const pid = result.message!.patientIdentification;

      expect(pid.patientAddress).toBeDefined();
      expect(pid.patientAddress!.length).toBe(1);
      expect(pid.patientAddress![0].streetAddress).toBe('123 Main St');
      expect(pid.patientAddress![0].city).toBe('Houston');
      expect(pid.patientAddress![0].stateOrProvince).toBe('TX');
      expect(pid.patientAddress![0].zipOrPostalCode).toBe('77001');
    });

    it('should extract patient visit information from PV1', () => {
      const result = parser.parseADT(adtA01Message);
      const pv1 = result.message!.patientVisit;

      expect(pv1).toBeDefined();
      expect(pv1!.patientClass).toBe('I'); // Inpatient
      expect(pv1!.assignedPatientLocation).toBeDefined();
      expect(pv1!.assignedPatientLocation!.pointOfCare).toBe('ICU');
      expect(pv1!.assignedPatientLocation!.room).toBe('101');
      expect(pv1!.assignedPatientLocation!.bed).toBe('A');
    });

    it('should extract attending doctor', () => {
      const result = parser.parseADT(adtA01Message);
      const pv1 = result.message!.patientVisit;

      expect(pv1!.attendingDoctor).toBeDefined();
      expect(pv1!.attendingDoctor!.length).toBe(1);
      expect(pv1!.attendingDoctor![0].idNumber).toBe('1234');
      expect(pv1!.attendingDoctor![0].familyName).toBe('Smith');
      expect(pv1!.attendingDoctor![0].givenName).toBe('Jane');
    });

    it('should extract diagnoses from DG1', () => {
      const result = parser.parseADT(adtA01Message);

      expect(result.message!.diagnoses).toBeDefined();
      expect(result.message!.diagnoses!.length).toBe(1);
      expect(result.message!.diagnoses![0].diagnosisCode?.identifier).toBe('E11.9');
      expect(result.message!.diagnoses![0].diagnosisType).toBe('A');
    });

    it('should extract allergies from AL1', () => {
      const result = parser.parseADT(adtA01Message);

      expect(result.message!.allergies).toBeDefined();
      expect(result.message!.allergies!.length).toBe(1);
      expect(result.message!.allergies![0].allergenCode.text).toBe('Penicillin');
      expect(result.message!.allergies![0].allergySeverityCode).toBe('SV');
      expect(result.message!.allergies![0].allergyReaction).toContain('Anaphylaxis');
    });

    it('should extract insurance from IN1', () => {
      const result = parser.parseADT(adtA01Message);

      expect(result.message!.insurance).toBeDefined();
      expect(result.message!.insurance!.length).toBe(1);
      expect(result.message!.insurance![0].insuranceCompanyName![0].organizationName).toBe(
        'Blue Cross Blue Shield of Texas'
      );
      expect(result.message!.insurance![0].groupNumber).toBe('GRP12345');
    });
  });

  describe('ORU Message Parsing (Lab Results)', () => {
    const oruR01Message = [
      'MSH|^~\\&|LAB|HOSPITAL|WELLFIT|CLINIC|20231201140000||ORU^R01^ORU_R01|LAB67890|P|2.5.1',
      'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M',
      'ORC|RE|ORD001|FIL001||CM||||20231201130000|||1234^Smith^Jane',
      'OBR|1|ORD001|FIL001|80053^Comprehensive Metabolic Panel^CPT|||20231201130000|||||||20231201130500||1234^Smith^Jane||||||20231201140000|||F',
      'OBX|1|NM|2345-7^Glucose^LN||95|mg/dL|70-100||||F|||20231201133000',
      'OBX|2|NM|2160-0^Creatinine^LN||1.1|mg/dL|0.7-1.3||||F|||20231201133000',
      'OBX|3|NM|3094-0^BUN^LN||18|mg/dL|7-20||||F|||20231201133000',
      'OBX|4|NM|2951-2^Sodium^LN||140|mEq/L|136-145||||F|||20231201133000',
      'OBX|5|NM|2823-3^Potassium^LN||4.5|mEq/L|3.5-5.0||||F|||20231201133000',
      'NTE|1|L|Normal metabolic panel results.',
    ].join('\r');

    it('should parse ORU R01 (Lab Results) message', () => {
      const result = parser.parseORU(oruR01Message);

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message!.messageType).toBe('ORU');
      expect(result.message!.eventType).toBe('R01');
    });

    it('should group observations under their OBR', () => {
      const result = parser.parseORU(oruR01Message);

      expect(result.message!.observationResults.length).toBe(1);
      expect(result.message!.observationResults[0].observations.length).toBe(5);
    });

    it('should parse OBR (Observation Request)', () => {
      const result = parser.parseORU(oruR01Message);
      const obr = result.message!.observationResults[0].request;

      expect(obr.placerOrderNumber).toBe('ORD001');
      expect(obr.fillerOrderNumber).toBe('FIL001');
      expect(obr.universalServiceIdentifier.identifier).toBe('80053');
      expect(obr.universalServiceIdentifier.text).toBe('Comprehensive Metabolic Panel');
      expect(obr.resultStatus).toBe('F'); // Final
    });

    it('should parse OBX (Observation Result) with numeric values', () => {
      const result = parser.parseORU(oruR01Message);
      const observations = result.message!.observationResults[0].observations;

      // Glucose
      const glucose = observations.find(
        (obs) => obs.observationIdentifier.identifier === '2345-7'
      );
      expect(glucose).toBeDefined();
      expect(glucose!.valueType).toBe('NM');
      expect(glucose!.observationValue![0]).toBe('95');
      expect(glucose!.units?.identifier).toBe('mg/dL');
      expect(glucose!.referenceRange).toBe('70-100');
      expect(glucose!.observationResultStatus).toBe('F');
    });

    it('should include notes from NTE segments', () => {
      const result = parser.parseORU(oruR01Message);

      expect(result.message!.observationResults[0].notes).toBeDefined();
      expect(result.message!.observationResults[0].notes!.length).toBe(1);
      expect(result.message!.observationResults[0].notes![0].comment![0]).toBe(
        'Normal metabolic panel results.'
      );
    });

    it('should parse abnormal flags', () => {
      const abnormalMessage = [
        'MSH|^~\\&|LAB|HOSPITAL|WELLFIT|CLINIC|20231201140000||ORU^R01|LAB001|P|2.5.1',
        'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M',
        'OBR|1|ORD001|FIL001|80053^CMP^CPT|||20231201130000||||||||||||F',
        'OBX|1|NM|2345-7^Glucose^LN||250|mg/dL|70-100|H|||F|||20231201133000',
        'OBX|2|NM|2160-0^Creatinine^LN||2.5|mg/dL|0.7-1.3|HH|||F|||20231201133000',
      ].join('\r');

      const result = parser.parseORU(abnormalMessage);
      const observations = result.message!.observationResults[0].observations;

      const glucose = observations.find(
        (obs) => obs.observationIdentifier.identifier === '2345-7'
      );
      expect(glucose!.abnormalFlags).toContain('H');

      const creatinine = observations.find(
        (obs) => obs.observationIdentifier.identifier === '2160-0'
      );
      expect(creatinine!.abnormalFlags).toContain('HH');
    });
  });

  describe('ORM Message Parsing (Orders)', () => {
    const ormO01Message = [
      'MSH|^~\\&|CPOE|HOSPITAL|LAB|HOSPITAL|20231201100000||ORM^O01^ORM_O01|ORD99999|P|2.5.1',
      'PID|1||12345^^^HOSPITAL^MR||Doe^John||19800115|M',
      'PV1|1|O|OUTPATIENT||||1234^Smith^Jane^M^Dr^MD',
      'ORC|NW|ORD001||GRP001|SC||1^Once||20231201100000|USER123|||||INTERNAL_MED',
      'OBR|1|ORD001||80053^Comprehensive Metabolic Panel^CPT|R||20231201100000|||NURSE001||||Blood|||1234^Smith^Jane^M^Dr^MD',
      'DG1|1||E11.9^Type 2 diabetes^I10||20231201',
      'ORC|NW|ORD002||GRP001|SC||1^Once||20231201100000|USER123',
      'OBR|2|ORD002||85025^CBC with Differential^CPT|R||20231201100000|||NURSE001||||Blood|||1234^Smith^Jane^M^Dr^MD',
    ].join('\r');

    it('should parse ORM O01 (New Order) message', () => {
      const result = parser.parseORM(ormO01Message);

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message!.messageType).toBe('ORM');
      expect(result.message!.eventType).toBe('O01');
    });

    it('should parse multiple orders', () => {
      const result = parser.parseORM(ormO01Message);

      expect(result.message!.orders.length).toBe(2);
    });

    it('should parse ORC (Common Order)', () => {
      const result = parser.parseORM(ormO01Message);
      const orc = result.message!.orders[0].commonOrder;

      expect(orc.orderControl).toBe('NW'); // New order
      expect(orc.placerOrderNumber).toBe('ORD001');
      expect(orc.placerGroupNumber).toBe('GRP001');
      expect(orc.orderStatus).toBe('SC'); // Scheduled
    });

    it('should parse OBR order details', () => {
      const result = parser.parseORM(ormO01Message);
      const obr = result.message!.orders[0].orderDetail;

      expect(obr).toBeDefined();
      expect(obr!.universalServiceIdentifier.identifier).toBe('80053');
      expect(obr!.universalServiceIdentifier.text).toBe('Comprehensive Metabolic Panel');
      expect(obr!.priority).toBe('R'); // Routine
    });

    it('should link ordering provider', () => {
      const result = parser.parseORM(ormO01Message);
      const obr = result.message!.orders[0].orderDetail;

      expect(obr!.orderingProvider).toBeDefined();
      expect(obr!.orderingProvider![0].idNumber).toBe('1234');
      expect(obr!.orderingProvider![0].familyName).toBe('Smith');
    });
  });

  describe('ACK Generation', () => {
    it('should generate valid ACK message', () => {
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\r';
      const result = parser.parse(message);

      const ack = parser.generateACK(result.message!, 'AA');

      expect(ack).toContain('MSH|');
      expect(ack).toContain('ACK^A01');
      expect(ack).toContain('MSA|AA|MSG001');
    });

    it('should include error message in AE/AR ACK', () => {
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\r';
      const result = parser.parse(message);

      const ack = parser.generateACK(result.message!, 'AE', 'Validation failed');

      expect(ack).toContain('MSA|AE|MSG001');
      expect(ack).toContain('ERR|');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle messages with custom delimiters', () => {
      // Using # as field separator instead of |
      const message =
        'MSH#@~\\&#SendApp#SendFac#RecApp#RecFac#20231201120000##ADT@A01#MSG001#P#2.5.1\r';

      const result = parser.parse(message);

      expect(result.success).toBe(true);
      expect(result.message!.header.messageType.messageCode).toBe('ADT');
    });

    it('should handle empty optional fields', () => {
      const message =
        'MSH|^~\\&|SendApp||RecApp||20231201120000||ADT^A01|MSG001|P|2.5.1\r' +
        'PID|1||12345^^^HOSPITAL^MR||Doe^John\r';

      const result = parser.parse(message);

      expect(result.success).toBe(true);
      expect(result.message!.header.sendingFacility).toBe('');
      expect(result.message!.header.receivingFacility).toBe('');
    });

    it('should handle repeated fields', () => {
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\r' +
        'PID|1||12345^^^HOSPITAL^MR~67890^^^CLINIC^MR||Doe^John~Doe^Johnny\r';

      const result = parser.parse(message);

      expect(result.success).toBe(true);
      expect(result.message!.patientIdentification!.patientIdentifierList.length).toBe(2);
      expect(result.message!.patientIdentification!.patientName.length).toBe(2);
    });

    it('should handle very long messages', () => {
      // Generate a message with many segments
      let message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ORU^R01|MSG001|P|2.5.1\r';
      message += 'PID|1||12345^^^HOSPITAL^MR||Doe^John\r';
      message += 'OBR|1|ORD001|FIL001|80053^CMP^CPT|||20231201\r';

      // Add 100 OBX segments
      for (let i = 1; i <= 100; i++) {
        message += `OBX|${i}|NM|${i}^Test${i}^LN||${i * 10}|mg/dL||||F\r`;
      }

      const result = parser.parseORU(message);

      expect(result.success).toBe(true);
      expect(result.message!.observationResults[0].observations.length).toBe(100);
    });

    it('should include warnings for unknown segments', () => {
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\r' +
        'PID|1||12345^^^HOSPITAL^MR||Doe^John\r' +
        'ZXX|1|Custom data|More custom data\r'; // Custom Z-segment

      const result = parser.parse(message);

      expect(result.success).toBe(true);
      // Should parse as generic segment
      const zxxSegment = result.message!.segments.find((s) => s.segmentType === 'ZXX');
      expect(zxxSegment).toBeDefined();
    });

    it('should preserve raw message in result', () => {
      const message =
        'MSH|^~\\&|SendApp|SendFac|RecApp|RecFac|20231201120000||ADT^A01|MSG001|P|2.5.1\r';

      const result = parser.parse(message);

      expect(result.rawMessage).toBe(message);
    });
  });
});
