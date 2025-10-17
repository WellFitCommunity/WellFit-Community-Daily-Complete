/**
 * Psychiatric Medication Classifier Service
 *
 * Identifies psychiatric medications and flags when patients have multiple psych meds
 * Important for monitoring polypharmacy and potential drug interactions
 *
 * @module psychMedClassifier
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PsychMedClassification {
  isPsychiatric: boolean;
  category?: 'antidepressant' | 'antipsychotic' | 'mood_stabilizer' | 'anxiolytic' | 'stimulant' | 'other_psych';
  subcategory?: string;
  confidence: number; // 0.0 to 1.0
  warnings?: string[];
}

export interface PsychMedAlert {
  hasMultiplePsychMeds: boolean;
  psychMedCount: number;
  medications: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  warnings: string[];
  requiresReview: boolean;
}

// ============================================================================
// PSYCHIATRIC MEDICATION DATABASE
// ============================================================================

/**
 * Comprehensive database of psychiatric medications by category
 * Includes generic and common brand names
 */
const PSYCH_MEDICATIONS = {
  // SSRIs - Selective Serotonin Reuptake Inhibitors
  antidepressant_ssri: [
    'fluoxetine', 'prozac',
    'sertraline', 'zoloft',
    'paroxetine', 'paxil',
    'citalopram', 'celexa',
    'escitalopram', 'lexapro',
    'fluvoxamine', 'luvox'
  ],

  // SNRIs - Serotonin-Norepinephrine Reuptake Inhibitors
  antidepressant_snri: [
    'venlafaxine', 'effexor',
    'duloxetine', 'cymbalta',
    'desvenlafaxine', 'pristiq',
    'levomilnacipran', 'fetzima'
  ],

  // Tricyclic Antidepressants
  antidepressant_tricyclic: [
    'amitriptyline', 'elavil',
    'nortriptyline', 'pamelor',
    'imipramine', 'tofranil',
    'desipramine', 'norpramin',
    'doxepin', 'sinequan',
    'clomipramine', 'anafranil'
  ],

  // MAOIs - Monoamine Oxidase Inhibitors
  antidepressant_maoi: [
    'phenelzine', 'nardil',
    'tranylcypromine', 'parnate',
    'isocarboxazid', 'marplan',
    'selegiline', 'emsam'
  ],

  // Atypical Antidepressants
  antidepressant_atypical: [
    'bupropion', 'wellbutrin', 'zyban',
    'mirtazapine', 'remeron',
    'trazodone', 'desyrel',
    'nefazodone', 'serzone',
    'vilazodone', 'viibryd',
    'vortioxetine', 'trintellix'
  ],

  // Typical Antipsychotics (First Generation)
  antipsychotic_typical: [
    'haloperidol', 'haldol',
    'chlorpromazine', 'thorazine',
    'fluphenazine', 'prolixin',
    'perphenazine', 'trilafon',
    'thioridazine', 'mellaril',
    'thiothixene', 'navane',
    'loxapine', 'loxitane'
  ],

  // Atypical Antipsychotics (Second Generation)
  antipsychotic_atypical: [
    'risperidone', 'risperdal',
    'olanzapine', 'zyprexa',
    'quetiapine', 'seroquel',
    'aripiprazole', 'abilify',
    'ziprasidone', 'geodon',
    'paliperidone', 'invega',
    'asenapine', 'saphris',
    'lurasidone', 'latuda',
    'brexpiprazole', 'rexulti',
    'cariprazine', 'vraylar',
    'clozapine', 'clozaril'
  ],

  // Mood Stabilizers
  mood_stabilizer: [
    'lithium', 'lithobid', 'eskalith',
    'valproic acid', 'valproate', 'depakote', 'depakene',
    'carbamazepine', 'tegretol', 'carbatrol',
    'lamotrigine', 'lamictal',
    'oxcarbazepine', 'trileptal',
    'topiramate', 'topamax'
  ],

  // Benzodiazepines (Anxiolytics)
  anxiolytic_benzo: [
    'alprazolam', 'xanax',
    'lorazepam', 'ativan',
    'clonazepam', 'klonopin',
    'diazepam', 'valium',
    'temazepam', 'restoril',
    'oxazepam', 'serax',
    'chlordiazepoxide', 'librium',
    'triazolam', 'halcion',
    'midazolam', 'versed'
  ],

  // Non-Benzodiazepine Anxiolytics
  anxiolytic_other: [
    'buspirone', 'buspar',
    'hydroxyzine', 'atarax', 'vistaril',
    'pregabalin', 'lyrica',
    'gabapentin', 'neurontin'
  ],

  // Stimulants (ADHD medications)
  stimulant: [
    'methylphenidate', 'ritalin', 'concerta', 'daytrana',
    'amphetamine', 'adderall', 'vyvanse',
    'dexmethylphenidate', 'focalin',
    'lisdexamfetamine', 'vyvanse',
    'dextroamphetamine', 'dexedrine',
    'atomoxetine', 'strattera',
    'modafinil', 'provigil',
    'armodafinil', 'nuvigil'
  ],

  // Sleep Medications (often used for psychiatric conditions)
  sleep_aid: [
    'zolpidem', 'ambien',
    'eszopiclone', 'lunesta',
    'zaleplon', 'sonata',
    'ramelteon', 'rozerem',
    'suvorexant', 'belsomra',
    'lemborexant', 'dayvigo'
  ]
};

// ============================================================================
// PSYCH MED CLASSIFIER SERVICE
// ============================================================================

export class PsychMedClassifierService {
  /**
   * Classify a medication as psychiatric or not
   */
  classifyMedication(medicationName: string, genericName?: string): PsychMedClassification {
    if (!medicationName) {
      return {
        isPsychiatric: false,
        confidence: 0
      };
    }

    // Normalize medication names for comparison
    const normalizedName = medicationName.toLowerCase().trim();
    const normalizedGeneric = genericName?.toLowerCase().trim();

    // Check against all categories
    for (const [category, medications] of Object.entries(PSYCH_MEDICATIONS)) {
      for (const med of medications) {
        const normalizedMed = med.toLowerCase();

        // Check if medication name or generic name matches
        if (
          normalizedName.includes(normalizedMed) ||
          normalizedMed.includes(normalizedName) ||
          (normalizedGeneric && (
            normalizedGeneric.includes(normalizedMed) ||
            normalizedMed.includes(normalizedGeneric)
          ))
        ) {
          // Extract main category and subcategory
          const parts = category.split('_');
          const mainCategory = parts[0] as PsychMedClassification['category'];
          const subcategoryParts = parts.slice(1);
          const subcategory: string | undefined = subcategoryParts.length > 0 ? subcategoryParts.join('_') : undefined;

          let warnings: string[] = [];
          if (mainCategory) {
            warnings = this.getWarningsForCategory(mainCategory, subcategory);
          }

          return {
            isPsychiatric: true,
            category: mainCategory,
            subcategory: subcategory,
            confidence: 1.0, // Exact match
            warnings
          };
        }
      }
    }

    // If no exact match, check for partial matches (lower confidence)
    const partialMatch = this.checkPartialMatch(normalizedName, normalizedGeneric);
    if (partialMatch) {
      return partialMatch;
    }

    return {
      isPsychiatric: false,
      confidence: 1.0
    };
  }

  /**
   * Check for partial medication name matches
   */
  private checkPartialMatch(name: string, genericName?: string): PsychMedClassification | null {
    // Common psychiatric medication suffixes/prefixes
    const psychIndicators = [
      'pam', // benzodiazepines (diazepam, clonazepam)
      'pine', // many antidepressants (imipramine, clomipramine)
      'zine', // antipsychotics (chlorpromazine, olanzapine)
      'done', // trazodone, nefazodone
      'oxetine', // fluoxetine, paroxetine
    ];

    for (const indicator of psychIndicators) {
      if (name.includes(indicator) || genericName?.includes(indicator)) {
        return {
          isPsychiatric: true,
          category: 'other_psych',
          confidence: 0.7, // Lower confidence for pattern match
          warnings: ['Medication appears to be psychiatric based on naming pattern - please verify']
        };
      }
    }

    return null;
  }

  /**
   * Get warnings for specific medication categories
   */
  private getWarningsForCategory(category: string, subcategory?: string | undefined): string[] {
    const warnings: string[] = [];

    switch (category) {
      case 'antidepressant':
        warnings.push('Monitor for serotonin syndrome if combined with other antidepressants');
        if (subcategory === 'maoi') {
          warnings.push('CRITICAL: MAOIs have serious drug and food interactions');
          warnings.push('Requires 2-week washout period when switching medications');
        }
        break;

      case 'antipsychotic':
        warnings.push('Monitor for extrapyramidal symptoms and metabolic changes');
        warnings.push('Regular metabolic screening recommended');
        break;

      case 'mood_stabilizer':
        warnings.push('Requires regular blood level monitoring');
        warnings.push('Monitor kidney and liver function');
        break;

      case 'anxiolytic':
        if (subcategory === 'benzo') {
          warnings.push('CAUTION: Benzodiazepine - risk of dependence');
          warnings.push('Fall risk - especially in elderly patients');
          warnings.push('Avoid alcohol');
        }
        break;

      case 'stimulant':
        warnings.push('Monitor blood pressure and heart rate');
        warnings.push('Controlled substance - risk of abuse');
        break;
    }

    return warnings;
  }

  /**
   * Analyze all medications and detect multiple psych meds
   */
  analyzeMultiplePsychMeds(medications: Array<{
    id: string;
    medication_name: string;
    generic_name?: string;
    status?: string;
  }>): PsychMedAlert {
    // Filter for active medications only
    const activeMeds = medications.filter(m => !m.status || m.status === 'active');

    // Classify all medications
    const psychMeds = activeMeds
      .map(med => ({
        ...med,
        classification: this.classifyMedication(med.medication_name, med.generic_name || undefined)
      }))
      .filter(med => med.classification.isPsychiatric);

    const psychMedCount = psychMeds.length;
    const hasMultiple = psychMedCount > 1;

    // Generate warnings
    const warnings: string[] = [];

    if (hasMultiple) {
      warnings.push(`Patient is taking ${psychMedCount} psychiatric medications simultaneously`);

      // Check for specific dangerous combinations
      const categories = psychMeds.map(m => m.classification.category);

      // Multiple antidepressants
      const antidepressantCount = categories.filter(c => c === 'antidepressant').length;
      if (antidepressantCount > 1) {
        warnings.push('ALERT: Multiple antidepressants - High risk of serotonin syndrome');
      }

      // Antipsychotic + mood stabilizer
      if (categories.includes('antipsychotic') && categories.includes('mood_stabilizer')) {
        warnings.push('Antipsychotic + Mood Stabilizer combination - Monitor for metabolic effects');
      }

      // Multiple benzos
      const benzoCount = psychMeds.filter(m =>
        m.classification.subcategory === 'benzo'
      ).length;
      if (benzoCount > 1) {
        warnings.push('ALERT: Multiple benzodiazepines - Increased fall risk and dependence risk');
      }

      // CNS depressant combinations
      const cnsDepressants = psychMeds.filter(m =>
        m.classification.category === 'anxiolytic' ||
        m.classification.subcategory?.includes('tricyclic')
      ).length;
      if (cnsDepressants > 1) {
        warnings.push('Multiple CNS depressants - Monitor for excessive sedation');
      }
    }

    return {
      hasMultiplePsychMeds: hasMultiple,
      psychMedCount,
      medications: psychMeds.map(m => ({
        id: m.id,
        name: m.medication_name,
        category: `${m.classification.category}${m.classification.subcategory ? ` (${m.classification.subcategory})` : ''}`
      })),
      warnings,
      requiresReview: hasMultiple || psychMedCount >= 3
    };
  }

  /**
   * Get user-friendly category name
   */
  getCategoryDisplayName(category?: string, subcategory?: string): string {
    if (!category) return 'Unknown';

    const baseNames: Record<string, string> = {
      'antidepressant': 'Antidepressant',
      'antipsychotic': 'Antipsychotic',
      'mood_stabilizer': 'Mood Stabilizer',
      'anxiolytic': 'Anti-Anxiety',
      'stimulant': 'Stimulant/ADHD',
      'sleep_aid': 'Sleep Aid',
      'other_psych': 'Psychiatric'
    };

    let display = baseNames[category] || category;

    if (subcategory) {
      const subNames: Record<string, string> = {
        'ssri': 'SSRI',
        'snri': 'SNRI',
        'tricyclic': 'Tricyclic',
        'maoi': 'MAOI',
        'atypical': 'Atypical',
        'typical': 'Typical',
        'benzo': 'Benzodiazepine'
      };
      display += ` - ${subNames[subcategory] || subcategory}`;
    }

    return display;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const psychMedClassifier = new PsychMedClassifierService();

export default psychMedClassifier;
