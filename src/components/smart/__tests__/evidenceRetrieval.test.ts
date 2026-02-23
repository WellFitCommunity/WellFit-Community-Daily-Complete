/**
 * Evidence Retrieval Service Tests
 * Session 4: PubMed Integration for Compass Riley
 *
 * Tests the evidence trigger detection, citation formatting, and rate limiting logic.
 * Since the edge function module uses Deno imports, we replicate the pure logic here
 * with inline types to avoid the Deno import chain.
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Type replicas (matches evidenceRetrievalService.ts types)
// ============================================================================

interface DiagnosisEntry {
  condition: string;
  icd10?: string;
  confidence: number;
  supportingEvidence: string[];
  refutingEvidence: string[];
  status: 'active' | 'ruled_out' | 'working';
}

interface MedicationEntry {
  name: string;
  action: 'new' | 'adjusted' | 'continued' | 'discontinued' | 'reviewed';
  details?: string;
}

interface EvidenceRateLimiter {
  queriesMade: number;
  lastQueryTime: number;
}

type EvidenceTrigger =
  | 'physician_request'
  | 'low_confidence_diagnosis'
  | 'drug_interaction'
  | 'rare_condition'
  | 'multiple_differentials';

interface EvidenceQuery {
  query: string;
  trigger: EvidenceTrigger;
  triggerDetail: string;
}

interface EvidenceTriggerResult {
  shouldSearch: boolean;
  queries: EvidenceQuery[];
}

interface EvidenceCitation {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: string;
  doi: string;
  relevanceNote: string;
}

interface EvidenceSearchResult {
  query: string;
  trigger: EvidenceTrigger;
  triggerDetail: string;
  citations: EvidenceCitation[];
  searchTimeMs: number;
}

// ============================================================================
// Pure logic replicated from evidenceRetrievalService.ts for testing
// (Same code, no Deno imports)
// ============================================================================

const MAX_QUERIES_PER_ENCOUNTER = 10;
const MIN_QUERY_INTERVAL_MS = 30_000;
const LOW_CONFIDENCE_THRESHOLD = 0.7;

const PHYSICIAN_TRIGGER_PHRASES = [
  'what does the literature say',
  'what does the research say',
  'what does the evidence say',
  'check the evidence',
  'check the literature',
  'any studies on',
  'are there any studies',
  'is there evidence for',
  'is there evidence that',
  'what are the guidelines for',
  'what do the guidelines say',
  'riley look up',
  'riley search',
  'riley find me',
  'look up the evidence',
  'search pubmed',
  'search the literature',
] as const;

// Minimal encounter state for testing (only fields used by trigger detection)
interface MinimalEncounterState {
  chiefComplaint: string | null;
  diagnoses: DiagnosisEntry[];
  medications: MedicationEntry[];
}

function detectEvidenceTriggers(
  transcript: string,
  encounterState: MinimalEncounterState,
  rateLimiter: EvidenceRateLimiter
): EvidenceTriggerResult {
  if (rateLimiter.queriesMade >= MAX_QUERIES_PER_ENCOUNTER) {
    return { shouldSearch: false, queries: [] };
  }
  const timeSinceLastQuery = Date.now() - rateLimiter.lastQueryTime;
  if (rateLimiter.lastQueryTime > 0 && timeSinceLastQuery < MIN_QUERY_INTERVAL_MS) {
    return { shouldSearch: false, queries: [] };
  }

  const queries: EvidenceQuery[] = [];
  const lowerTranscript = transcript.toLowerCase();

  let bestTriggerIdx = -1;
  let bestTriggerPhrase = '';
  for (const phrase of PHYSICIAN_TRIGGER_PHRASES) {
    const idx = lowerTranscript.lastIndexOf(phrase);
    if (idx > bestTriggerIdx) {
      bestTriggerIdx = idx;
      bestTriggerPhrase = phrase;
    }
  }
  if (bestTriggerIdx >= 0) {
    const afterPhrase = transcript.slice(bestTriggerIdx + bestTriggerPhrase.length).trim();
    const topicMatch = afterPhrase.match(/^[^.?!]{5,80}/);
    if (topicMatch) {
      queries.push({
        query: topicMatch[0].trim(),
        trigger: 'physician_request',
        triggerDetail: `Provider asked: "${bestTriggerPhrase}${topicMatch[0].trim()}"`,
      });
    } else if (encounterState.chiefComplaint) {
      queries.push({
        query: encounterState.chiefComplaint,
        trigger: 'physician_request',
        triggerDetail: 'Provider asked for evidence on chief complaint',
      });
    }
  }

  const workingDx = encounterState.diagnoses.filter(
    d => d.status === 'working' && d.confidence < LOW_CONFIDENCE_THRESHOLD
  );
  for (const dx of workingDx.slice(0, 2)) {
    const parts = [dx.condition];
    if (dx.icd10) parts.push(dx.icd10);
    queries.push({
      query: `${parts.join(' ')} diagnosis management`,
      trigger: 'low_confidence_diagnosis',
      triggerDetail: `Working diagnosis "${dx.condition}" at ${Math.round(dx.confidence * 100)}% confidence`,
    });
  }

  const allWorking = encounterState.diagnoses.filter(d => d.status === 'working');
  if (allWorking.length >= 3 && queries.length === 0) {
    const conditions = allWorking.map(d => d.condition).join(' OR ');
    queries.push({
      query: `differential diagnosis ${conditions}`,
      trigger: 'multiple_differentials',
      triggerDetail: `${allWorking.length} working differentials: ${allWorking.map(d => d.condition).join(', ')}`,
    });
  }

  const newMeds = encounterState.medications.filter(m => m.action === 'new');
  if (newMeds.length >= 2) {
    const names = newMeds.map(m => m.name).slice(0, 3);
    queries.push({
      query: `${names.join(' ')} drug interaction`,
      trigger: 'drug_interaction',
      triggerDetail: `${newMeds.length} new medications: ${newMeds.map(m => m.name).join(', ')}`,
    });
  }

  const seen = new Set<string>();
  const uniqueQueries = queries.filter(q => {
    const normalized = q.query.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  return {
    shouldSearch: uniqueQueries.length > 0,
    queries: uniqueQueries.slice(0, 3),
  };
}

function formatCitationsForDisplay(results: EvidenceSearchResult[]): string[] {
  const lines: string[] = [];
  for (const result of results) {
    if (result.citations.length === 0) continue;
    lines.push(`--- ${result.triggerDetail} ---`);
    for (const cite of result.citations) {
      const authorStr = cite.authors.length > 0
        ? `${cite.authors[0]}${cite.authors.length > 1 ? ' et al.' : ''}`
        : 'Unknown';
      const doiLink = cite.doi ? `https://doi.org/${cite.doi}` : '';
      lines.push(
        `[PMID:${cite.pmid}] ${authorStr}. "${cite.title}" ${cite.journal} (${cite.year}).${doiLink ? ` ${doiLink}` : ''}`
      );
    }
  }
  return lines;
}

// ============================================================================
// Test Helpers
// ============================================================================

function makeEmptyState(): MinimalEncounterState {
  return { chiefComplaint: null, diagnoses: [], medications: [] };
}

function makeFreshLimiter(): EvidenceRateLimiter {
  return { queriesMade: 0, lastQueryTime: 0 };
}

// ============================================================================
// Tests
// ============================================================================

describe('Evidence Retrieval Service — Trigger Detection', () => {
  it('detects physician voice trigger with topic extraction', () => {
    const transcript = 'The patient has an unusual rash. What does the literature say about cutaneous vasculitis in elderly patients.';
    const result = detectEvidenceTriggers(transcript, makeEmptyState(), makeFreshLimiter());

    expect(result.shouldSearch).toBe(true);
    expect(result.queries).toHaveLength(1);
    expect(result.queries[0].trigger).toBe('physician_request');
    expect(result.queries[0].query).toContain('cutaneous vasculitis');
  });

  it('uses chief complaint as fallback when no topic after trigger phrase', () => {
    const transcript = 'What does the evidence say?';
    const state = { ...makeEmptyState(), chiefComplaint: 'persistent headache' };
    const result = detectEvidenceTriggers(transcript, state, makeFreshLimiter());

    expect(result.shouldSearch).toBe(true);
    expect(result.queries[0].query).toBe('persistent headache');
    expect(result.queries[0].trigger).toBe('physician_request');
  });

  it('detects Riley-directed search triggers', () => {
    const transcript = 'Riley search for metformin and SGLT2 inhibitor combination therapy outcomes.';
    const result = detectEvidenceTriggers(transcript, makeEmptyState(), makeFreshLimiter());

    expect(result.shouldSearch).toBe(true);
    expect(result.queries[0].trigger).toBe('physician_request');
    expect(result.queries[0].query).toContain('metformin');
  });

  it('triggers search for low-confidence working diagnoses', () => {
    const state: MinimalEncounterState = {
      chiefComplaint: 'chest pain',
      diagnoses: [
        {
          condition: 'Costochondritis',
          icd10: 'M94.0',
          confidence: 0.45,
          supportingEvidence: ['localized tenderness'],
          refutingEvidence: [],
          status: 'working',
        },
      ],
      medications: [],
    };
    const result = detectEvidenceTriggers('patient reports sharp chest pain', state, makeFreshLimiter());

    expect(result.shouldSearch).toBe(true);
    const dxQuery = result.queries.find(q => q.trigger === 'low_confidence_diagnosis');
    expect(dxQuery).toBeDefined();
    expect(dxQuery?.query).toContain('Costochondritis');
    expect(dxQuery?.triggerDetail).toContain('45%');
  });

  it('does NOT trigger for high-confidence diagnoses', () => {
    const state: MinimalEncounterState = {
      chiefComplaint: 'diabetes follow-up',
      diagnoses: [
        {
          condition: 'Type 2 diabetes',
          icd10: 'E11.65',
          confidence: 0.95,
          supportingEvidence: ['A1C 7.8%'],
          refutingEvidence: [],
          status: 'active',
        },
      ],
      medications: [],
    };
    const result = detectEvidenceTriggers('routine follow up', state, makeFreshLimiter());

    expect(result.shouldSearch).toBe(false);
  });

  it('triggers for multiple differentials (3+ working diagnoses)', () => {
    const state: MinimalEncounterState = {
      chiefComplaint: 'abdominal pain',
      diagnoses: [
        { condition: 'Appendicitis', confidence: 0.8, supportingEvidence: [], refutingEvidence: [], status: 'working' },
        { condition: 'Diverticulitis', confidence: 0.75, supportingEvidence: [], refutingEvidence: [], status: 'working' },
        { condition: 'Ovarian cyst', confidence: 0.72, supportingEvidence: [], refutingEvidence: [], status: 'working' },
      ],
      medications: [],
    };
    const result = detectEvidenceTriggers('patient reports lower right abdominal pain', state, makeFreshLimiter());

    expect(result.shouldSearch).toBe(true);
    const diffQuery = result.queries.find(q => q.trigger === 'multiple_differentials');
    expect(diffQuery).toBeDefined();
    expect(diffQuery?.query).toContain('differential diagnosis');
  });

  it('triggers for drug interaction concern (2+ new medications)', () => {
    const state: MinimalEncounterState = {
      chiefComplaint: 'hypertension',
      diagnoses: [],
      medications: [
        { name: 'Lisinopril', action: 'new', details: '10mg daily' },
        { name: 'Spironolactone', action: 'new', details: '25mg daily' },
      ],
    };
    const result = detectEvidenceTriggers('starting new medications', state, makeFreshLimiter());

    expect(result.shouldSearch).toBe(true);
    const drugQuery = result.queries.find(q => q.trigger === 'drug_interaction');
    expect(drugQuery).toBeDefined();
    expect(drugQuery?.query).toContain('Lisinopril');
    expect(drugQuery?.query).toContain('Spironolactone');
    expect(drugQuery?.query).toContain('drug interaction');
  });

  it('does NOT trigger for continued medications', () => {
    const state: MinimalEncounterState = {
      chiefComplaint: 'follow-up',
      diagnoses: [],
      medications: [
        { name: 'Metformin', action: 'continued' },
        { name: 'Lisinopril', action: 'continued' },
      ],
    };
    const result = detectEvidenceTriggers('continue current medications', state, makeFreshLimiter());

    expect(result.shouldSearch).toBe(false);
  });

  it('caps queries at 3 per analysis cycle', () => {
    const state: MinimalEncounterState = {
      chiefComplaint: 'complex case',
      diagnoses: [
        { condition: 'Condition A', confidence: 0.3, supportingEvidence: [], refutingEvidence: [], status: 'working' },
        { condition: 'Condition B', confidence: 0.4, supportingEvidence: [], refutingEvidence: [], status: 'working' },
      ],
      medications: [
        { name: 'Drug X', action: 'new' },
        { name: 'Drug Y', action: 'new' },
      ],
    };
    const transcript = 'What does the literature say about combined therapy approaches for these conditions';
    const result = detectEvidenceTriggers(transcript, state, makeFreshLimiter());

    expect(result.queries.length).toBeLessThanOrEqual(3);
  });
});

describe('Evidence Retrieval Service — Rate Limiting', () => {
  it('blocks search when query limit reached', () => {
    const limiter: EvidenceRateLimiter = { queriesMade: 10, lastQueryTime: 0 };
    const state: MinimalEncounterState = {
      chiefComplaint: 'test',
      diagnoses: [
        { condition: 'Test', confidence: 0.3, supportingEvidence: [], refutingEvidence: [], status: 'working' },
      ],
      medications: [],
    };
    const result = detectEvidenceTriggers('what does the literature say about test', state, limiter);

    expect(result.shouldSearch).toBe(false);
    expect(result.queries).toHaveLength(0);
  });

  it('blocks search when within minimum interval', () => {
    const limiter: EvidenceRateLimiter = {
      queriesMade: 1,
      lastQueryTime: Date.now() - 5000, // 5 seconds ago (< 30s minimum)
    };
    const state: MinimalEncounterState = {
      chiefComplaint: 'test',
      diagnoses: [
        { condition: 'Test', confidence: 0.3, supportingEvidence: [], refutingEvidence: [], status: 'working' },
      ],
      medications: [],
    };
    const result = detectEvidenceTriggers('what does the literature say about test', state, limiter);

    expect(result.shouldSearch).toBe(false);
  });

  it('allows search after minimum interval passes', () => {
    const limiter: EvidenceRateLimiter = {
      queriesMade: 1,
      lastQueryTime: Date.now() - 60_000, // 60 seconds ago (> 30s minimum)
    };
    const state: MinimalEncounterState = {
      chiefComplaint: 'test',
      diagnoses: [
        { condition: 'Test', confidence: 0.3, supportingEvidence: [], refutingEvidence: [], status: 'working' },
      ],
      medications: [],
    };
    const result = detectEvidenceTriggers('what does the literature say about test', state, limiter);

    expect(result.shouldSearch).toBe(true);
  });
});

describe('Evidence Retrieval Service — Citation Formatting', () => {
  it('formats citations with PMID, authors, title, journal, year, and DOI', () => {
    const results: EvidenceSearchResult[] = [
      {
        query: 'metformin glycemic control',
        trigger: 'physician_request',
        triggerDetail: 'Provider asked about metformin evidence',
        searchTimeMs: 450,
        citations: [
          {
            pmid: '34567890',
            title: 'Metformin as First-Line Therapy for Type 2 Diabetes',
            authors: ['Smith JA', 'Jones BC', 'Williams D'],
            journal: 'Diabetes Care',
            year: '2024',
            doi: '10.2337/dc24-0123',
            relevanceNote: 'Matches provider evidence request',
          },
        ],
      },
    ];

    const display = formatCitationsForDisplay(results);

    expect(display).toHaveLength(2); // header + 1 citation
    expect(display[0]).toContain('Provider asked about metformin evidence');
    expect(display[1]).toContain('[PMID:34567890]');
    expect(display[1]).toContain('Smith JA et al.');
    expect(display[1]).toContain('Metformin as First-Line Therapy');
    expect(display[1]).toContain('Diabetes Care');
    expect(display[1]).toContain('2024');
    expect(display[1]).toContain('https://doi.org/10.2337/dc24-0123');
  });

  it('handles single author without "et al."', () => {
    const results: EvidenceSearchResult[] = [
      {
        query: 'test',
        trigger: 'low_confidence_diagnosis',
        triggerDetail: 'Test',
        searchTimeMs: 100,
        citations: [
          {
            pmid: '12345',
            title: 'Single Author Study',
            authors: ['Solo Author'],
            journal: 'Test Journal',
            year: '2023',
            doi: '',
            relevanceNote: 'test',
          },
        ],
      },
    ];

    const display = formatCitationsForDisplay(results);
    expect(display[1]).toContain('Solo Author.');
    expect(display[1]).not.toContain('et al.');
  });

  it('shows "Unknown" for articles with no authors', () => {
    const results: EvidenceSearchResult[] = [
      {
        query: 'test',
        trigger: 'drug_interaction',
        triggerDetail: 'Test',
        searchTimeMs: 100,
        citations: [
          {
            pmid: '99999',
            title: 'No Author Article',
            authors: [],
            journal: 'Unknown Journal',
            year: '2022',
            doi: '',
            relevanceNote: 'test',
          },
        ],
      },
    ];

    const display = formatCitationsForDisplay(results);
    expect(display[1]).toContain('Unknown.');
  });

  it('omits DOI link when not available', () => {
    const results: EvidenceSearchResult[] = [
      {
        query: 'test',
        trigger: 'physician_request',
        triggerDetail: 'Test',
        searchTimeMs: 100,
        citations: [
          {
            pmid: '11111',
            title: 'No DOI',
            authors: ['Test Author'],
            journal: 'Journal',
            year: '2025',
            doi: '',
            relevanceNote: 'test',
          },
        ],
      },
    ];

    const display = formatCitationsForDisplay(results);
    expect(display[1]).not.toContain('https://doi.org');
  });

  it('skips results with no citations', () => {
    const results: EvidenceSearchResult[] = [
      {
        query: 'no results query',
        trigger: 'physician_request',
        triggerDetail: 'Test',
        searchTimeMs: 200,
        citations: [],
      },
    ];

    const display = formatCitationsForDisplay(results);
    expect(display).toHaveLength(0);
  });

  it('formats multiple search results with headers', () => {
    const results: EvidenceSearchResult[] = [
      {
        query: 'query 1',
        trigger: 'physician_request',
        triggerDetail: 'Provider asked about condition A',
        searchTimeMs: 300,
        citations: [
          { pmid: '111', title: 'Article 1', authors: ['Auth A'], journal: 'J1', year: '2024', doi: '10.1/a', relevanceNote: '' },
        ],
      },
      {
        query: 'query 2',
        trigger: 'drug_interaction',
        triggerDetail: 'Drug interaction concern',
        searchTimeMs: 400,
        citations: [
          { pmid: '222', title: 'Article 2', authors: ['Auth B'], journal: 'J2', year: '2025', doi: '10.1/b', relevanceNote: '' },
          { pmid: '333', title: 'Article 3', authors: ['Auth C', 'Auth D'], journal: 'J3', year: '2025', doi: '', relevanceNote: '' },
        ],
      },
    ];

    const display = formatCitationsForDisplay(results);

    // 2 headers + 3 citations = 5 lines
    expect(display).toHaveLength(5);
    expect(display[0]).toContain('Provider asked about condition A');
    expect(display[2]).toContain('Drug interaction concern');
  });
});

describe('Evidence Retrieval Service — Physician Trigger Phrases', () => {
  const allPhrases = [
    'what does the literature say about',
    'what does the research say about',
    'what does the evidence say about',
    'check the evidence for',
    'check the literature on',
    'any studies on this topic',
    'are there any studies on',
    'is there evidence for this approach',
    'what are the guidelines for treating',
    'riley look up recent studies on',
    'riley search for evidence on',
    'search pubmed for clinical trials on',
  ];

  it.each(allPhrases)('detects physician trigger phrase: "%s"', (phrase) => {
    const transcript = `${phrase} this specific clinical topic here`;
    const result = detectEvidenceTriggers(transcript, makeEmptyState(), makeFreshLimiter());

    expect(result.shouldSearch).toBe(true);
    expect(result.queries[0].trigger).toBe('physician_request');
  });

  it('does NOT trigger on unrelated text', () => {
    const transcript = 'The patient reports feeling better today. Blood pressure is normal.';
    const result = detectEvidenceTriggers(transcript, makeEmptyState(), makeFreshLimiter());

    expect(result.shouldSearch).toBe(false);
  });

  it('uses the LAST trigger phrase when multiple present', () => {
    const transcript = 'What does the literature say about aspirin. Later the doctor asked riley search for statin therapy outcomes.';
    const result = detectEvidenceTriggers(transcript, makeEmptyState(), makeFreshLimiter());

    expect(result.shouldSearch).toBe(true);
    expect(result.queries[0].query).toContain('statin therapy');
  });
});
