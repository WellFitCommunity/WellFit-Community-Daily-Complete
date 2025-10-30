import { DataMapping, MappingRule } from './fhirMappingService';

export interface CodeGenerationTemplate {
  generateImports(): string;
  generateInterfaces(): string;
  generateTransformerClass(mapping: DataMapping): string;
  generateUsageExample(): string;
}

export class WellFitCodeTemplate implements CodeGenerationTemplate {
  generateImports(): string {
    return `import { supabase } from '../lib/supabaseClient';`;
  }

  generateInterfaces(): string {
    return `export interface FHIRBundle {
  resourceType: 'Bundle';
  id: string;
  type: 'transaction';
  entry: Array<{ resource: any }>;
}

export interface FHIRPatient {
  resourceType: 'Patient';
  id?: string;
  identifier?: Array<{ system: string; value: string }>;
  name?: Array<{ family: string; given: string[] }>;
  gender?: string;
  birthDate?: string;
  telecom?: Array<{ system: string; value: string }>;
  address?: Array<{ line: string[]; city: string; state: string; postalCode: string }>;
}

export interface FHIRObservation {
  resourceType: 'Observation';
  status: 'final' | 'preliminary' | 'registered';
  category: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  code: { coding: Array<{ system: string; code: string; display: string }> };
  subject: { reference: string };
  effectiveDateTime: string;
  valueQuantity?: { value: number; unit: string; system: string; code: string };
  valueString?: string;
}`;
  }

  generateTransformerClass(mapping: DataMapping): string {
    const patientRules = mapping.mappingRules.filter(rule => rule.fhirResource === 'Patient');
    const observationRules = mapping.mappingRules.filter(rule => rule.fhirResource === 'Observation');

    return `export class WellFitDataTransformer {
  async transformAndSync(sourceData: any): Promise<FHIRBundle> {
    const bundle: FHIRBundle = {
      resourceType: 'Bundle',
      id: \`wellfit-transform-\${Date.now()}\`,
      type: 'transaction',
      entry: []
    };

${this.generatePatientTransformation(patientRules)}

${this.generateObservationTransformation(observationRules)}

    return bundle;
  }

${this.generateHelperMethods()}

${this.generateWellFitSyncMethods()}

${this.generateValidationMethods(mapping)}
}`;
  }

  private generatePatientTransformation(rules: MappingRule[]): string {
    if (rules.length === 0) return '';

    return `    // Transform Patient data
    const patient: FHIRPatient = {
      resourceType: 'Patient',
${rules.map(rule => `      // ${rule.sourceField} -> ${rule.fhirPath}${rule.transformation ? ` (${rule.transformation})` : ''}
      ${this.mapRuleToProperty(rule)}`).join(',\n')}
    };

    if (patient.id) {
      bundle.entry.push({ resource: patient });
      await this.syncPatientToWellFit(patient);
    }`;
  }

  private generateObservationTransformation(rules: MappingRule[]): string {
    if (rules.length === 0) return '';

    return rules.map(rule => `
    // Transform ${rule.sourceField} to Observation
    const observation_${this.sanitizeIdentifier(rule.sourceField)}: FHIRObservation = {
      resourceType: 'Observation',
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }],
      code: { coding: [{ system: 'http://loinc.org', code: '${this.mapFieldToLoincCode(rule.sourceField)}', display: '${rule.sourceField}' }] },
      subject: { reference: 'Patient/' + this.extractValue(sourceData, 'id') },
      effectiveDateTime: new Date().toISOString(),
      ${this.generateObservationValue(rule)}
    };

    if (observation_${this.sanitizeIdentifier(rule.sourceField)}.subject.reference !== 'Patient/') {
      bundle.entry.push({ resource: observation_${this.sanitizeIdentifier(rule.sourceField)} });
      await this.syncObservationToWellFit(observation_${this.sanitizeIdentifier(rule.sourceField)});
    }`).join('\n');
  }

  private generateHelperMethods(): string {
    return `
  private extractValue(data: any, path: string): any {
    return path.split('.').reduce((obj, key) => obj?.[key], data);
  }

  private sanitizeValue(value: any): string {
    if (value == null) return '';
    return String(value).trim();
  }

  private parseNumericValue(value: any): number | null {
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? null : parsed;
  }`;
  }

  private generateWellFitSyncMethods(): string {
    return `
  private async syncPatientToWellFit(patient: FHIRPatient): Promise<void> {
    try {
      const profileData = {
        user_id: patient.id,
        first_name: patient.name?.[0]?.given?.[0] || '',
        last_name: patient.name?.[0]?.family || '',
        phone: patient.telecom?.find(t => t.system === 'phone')?.value || null,
        email: patient.telecom?.find(t => t.system === 'email')?.value || null,
        dob: patient.birthDate || null,
        address: patient.address?.[0] ?
          \`\${patient.address[0].line?.join(' ')}, \${patient.address[0].city}, \${patient.address[0].state} \${patient.address[0].postalCode}\` : null
      };

      const { error } = await supabase.from('profiles').upsert(profileData);
      if (error) {

        throw new Error(\`Patient sync failed: \${error.message}\`);
      }
    } catch (error) {

      throw error;
    }
  }

  private async syncObservationToWellFit(observation: FHIRObservation): Promise<void> {
    try {
      const checkInData: any = {
        user_id: observation.subject.reference.replace('Patient/', ''),
        created_at: observation.effectiveDateTime,
      };

      // Map FHIR observations to WellFit check_ins fields
      const loincCode = observation.code.coding[0]?.code;
      switch (loincCode) {
        case '85354-9': // Blood pressure
          if (observation.valueString) {
            const [systolic, diastolic] = this.parseBloodPressure(observation.valueString);
            checkInData.bp_systolic = systolic;
            checkInData.bp_diastolic = diastolic;
          }
          break;
        case '8867-4': // Heart rate
          checkInData.heart_rate = observation.valueQuantity?.value;
          break;
        case '33743-4': // Glucose
          checkInData.glucose_mg_dl = observation.valueQuantity?.value;
          break;
        default:

      }

      const { error } = await supabase.from('check_ins').insert(checkInData);
      if (error) {

        throw new Error(\`Observation sync failed: \${error.message}\`);
      }
    } catch (error) {

      throw error;
    }
  }

  private parseBloodPressure(bp: string): [number | null, number | null] {
    const match = bp.match(/(\\d+)\\/(\\d+)/);
    if (match) {
      return [parseInt(match[1]), parseInt(match[2])];
    }
    return [null, null];
  }`;
  }

  private generateValidationMethods(mapping: DataMapping): string {
    const validationRules = mapping.mappingRules.filter(rule => rule.validation);

    return `
  validateData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

${validationRules.map(rule => `    // Validate ${rule.sourceField}: ${rule.validation}
    if (!this.validateField(data, '${rule.sourceField}', '${rule.validation}')) {
      errors.push('${rule.sourceField}: ${rule.validation}');
    }`).join('\n')}

    return { isValid: errors.length === 0, errors };
  }

  private validateField(data: any, field: string, rule: string): boolean {
    const value = this.extractValue(data, field);

    // Common validation patterns
    switch (rule.toLowerCase()) {
      case 'required':
        return value != null && value !== '';
      case 'email':
        return !value || /^[^ @]+@[^ @]+.[^ @]+$/.test(value);
      case 'phone':
        return !value || /^[+]?[\d ()-]+$/.test(value);
      case 'date':
        return !value || !isNaN(Date.parse(value));
      case 'numeric':
        return !value || !isNaN(parseFloat(value));
      default:
        return true;
    }
  }`;
  }

  private mapRuleToProperty(rule: MappingRule): string {
    const fhirPath = rule.fhirPath.split('.').pop() || '';
    const sourceValue = `this.extractValue(sourceData, '${rule.sourceField}')`;

    switch (fhirPath) {
      case 'id':
        return `id: ${sourceValue}`;
      case 'family':
        return `name: [{ family: this.sanitizeValue(${sourceValue}) }]`;
      case 'given':
        return `name: [{ given: [this.sanitizeValue(${sourceValue})] }]`;
      case 'gender':
        return `gender: this.sanitizeValue(${sourceValue})`;
      case 'birthDate':
        return `birthDate: this.sanitizeValue(${sourceValue})`;
      default:
        return `// ${fhirPath}: ${sourceValue}`;
    }
  }

  private generateObservationValue(rule: MappingRule): string {
    if (rule.sourceType.toLowerCase().includes('numeric') || rule.sourceType.toLowerCase().includes('number')) {
      return `valueQuantity: { value: this.parseNumericValue(this.extractValue(sourceData, '${rule.sourceField}')), unit: 'unit', system: 'http://unitsofmeasure.org', code: 'unit' }`;
    }
    return `valueString: this.sanitizeValue(this.extractValue(sourceData, '${rule.sourceField}'))`;
  }

  private mapFieldToLoincCode(field: string): string {
    const fieldLower = field.toLowerCase();
    if (fieldLower.includes('blood') && fieldLower.includes('pressure')) return '85354-9';
    if (fieldLower.includes('heart') && fieldLower.includes('rate')) return '8867-4';
    if (fieldLower.includes('glucose')) return '33743-4';
    if (fieldLower.includes('temperature')) return '8310-5';
    if (fieldLower.includes('weight')) return '29463-7';
    if (fieldLower.includes('height')) return '8302-2';
    return 'unknown';
  }

  private sanitizeIdentifier(field: string): string {
    return field.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  generateUsageExample(): string {
    return `// Usage example:
// const transformer = new WellFitDataTransformer();
// const fhirBundle = await transformer.transformAndSync(legacyData);`;
  }
}

export class FHIRCodeGenerator {
  constructor(private template: CodeGenerationTemplate) {}

  generateFullCode(mapping: DataMapping): string {
    return `// Generated FHIR Transformation Code for WellFit Integration
${this.template.generateImports()}

${this.template.generateInterfaces()}

${this.template.generateTransformerClass(mapping)}

${this.template.generateUsageExample()}`;
  }
}

export const wellFitCodeGenerator = new FHIRCodeGenerator(new WellFitCodeTemplate());