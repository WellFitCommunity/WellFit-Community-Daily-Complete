// Evidence Retrieval Service — PubMed Integration for Compass Riley
// Session 4 of Compass Riley Clinical Reasoning Hardening (2026-02-23)
//
// Connects Riley to peer-reviewed literature in real-time so physicians get
// evidence-backed support when their knowledge base ends.
//
// Architecture: Calls the existing mcp-pubmed-server via HTTP (MCP JSON-RPC 2.0).
// Evidence is a separate concern from the encounter state — sent as its own
// WebSocket message to the client.

import type { EncounterState, DiagnosisEntry, MedicationEntry } from './encounterStateManager.ts';

// =====================================================
// Evidence Types
// =====================================================

/** A single citation from PubMed */
export interface EvidenceCitation {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: string;
  doi: string;
  /** Why this article is relevant to the current encounter */
  relevanceNote: string;
}

/** Result of a single evidence search */
export interface EvidenceSearchResult {
  query: string;
  trigger: EvidenceTrigger;
  triggerDetail: string;
  citations: EvidenceCitation[];
  searchTimeMs: number;
}

/** What triggered the evidence search */
export type EvidenceTrigger =
  | 'physician_request'
  | 'low_confidence_diagnosis'
  | 'drug_interaction'
  | 'rare_condition'
  | 'multiple_differentials';

/** A query to execute against PubMed */
interface EvidenceQuery {
  query: string;
  trigger: EvidenceTrigger;
  triggerDetail: string;
}

/** What detectEvidenceTriggers returns */
export interface EvidenceTriggerResult {
  shouldSearch: boolean;
  queries: EvidenceQuery[];
}

/** Rate limiting state per encounter */
export interface EvidenceRateLimiter {
  queriesMade: number;
  lastQueryTime: number;
}

// =====================================================
// Constants
// =====================================================

/** Max PubMed queries per encounter (cost/rate control) */
const MAX_QUERIES_PER_ENCOUNTER = 10;

/** Min interval between evidence searches (ms) — prevents flooding */
const MIN_QUERY_INTERVAL_MS = 30_000;

/** Max results per PubMed search */
const MAX_RESULTS_PER_SEARCH = 5;

/** Confidence threshold — diagnoses below this trigger evidence search */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Phrases that indicate the physician wants a literature search.
 * Matched case-insensitively against the transcript.
 */
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

// =====================================================
// Trigger Detection
// =====================================================

/**
 * Detect whether the current encounter state and transcript warrant
 * a PubMed evidence search. Returns specific queries to execute.
 */
export function detectEvidenceTriggers(
  transcript: string,
  encounterState: EncounterState,
  rateLimiter: EvidenceRateLimiter
): EvidenceTriggerResult {
  // Rate limit check
  if (rateLimiter.queriesMade >= MAX_QUERIES_PER_ENCOUNTER) {
    return { shouldSearch: false, queries: [] };
  }
  const timeSinceLastQuery = Date.now() - rateLimiter.lastQueryTime;
  if (rateLimiter.lastQueryTime > 0 && timeSinceLastQuery < MIN_QUERY_INTERVAL_MS) {
    return { shouldSearch: false, queries: [] };
  }

  const queries: EvidenceQuery[] = [];
  const lowerTranscript = transcript.toLowerCase();

  // 1. Physician-triggered search (highest priority) — find the LAST trigger in transcript
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
        triggerDetail: `Provider asked for evidence on chief complaint`,
      });
    }
  }

  // 2. Low-confidence working diagnoses (auto-trigger)
  const workingDx = encounterState.diagnoses.filter(
    d => d.status === 'working' && d.confidence < LOW_CONFIDENCE_THRESHOLD
  );
  for (const dx of workingDx.slice(0, 2)) {
    queries.push({
      query: buildDiagnosisQuery(dx),
      trigger: 'low_confidence_diagnosis',
      triggerDetail: `Working diagnosis "${dx.condition}" at ${Math.round(dx.confidence * 100)}% confidence`,
    });
  }

  // 3. Multiple differentials (3+ active working diagnoses)
  const allWorking = encounterState.diagnoses.filter(d => d.status === 'working');
  if (allWorking.length >= 3 && queries.length === 0) {
    const conditions = allWorking.map(d => d.condition).join(' OR ');
    queries.push({
      query: `differential diagnosis ${conditions}`,
      trigger: 'multiple_differentials',
      triggerDetail: `${allWorking.length} working differentials: ${allWorking.map(d => d.condition).join(', ')}`,
    });
  }

  // 4. Drug interaction concern (2+ new medications)
  const newMeds = encounterState.medications.filter(m => m.action === 'new');
  if (newMeds.length >= 2) {
    queries.push({
      query: buildDrugInteractionQuery(newMeds),
      trigger: 'drug_interaction',
      triggerDetail: `${newMeds.length} new medications: ${newMeds.map(m => m.name).join(', ')}`,
    });
  }

  // Deduplicate queries by normalized query string
  const seen = new Set<string>();
  const uniqueQueries = queries.filter(q => {
    const normalized = q.query.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  // Cap at 3 queries per analysis cycle
  const cappedQueries = uniqueQueries.slice(0, 3);

  return {
    shouldSearch: cappedQueries.length > 0,
    queries: cappedQueries,
  };
}

// =====================================================
// PubMed MCP Server Client
// =====================================================

/**
 * Search PubMed via the mcp-pubmed-server edge function.
 * Uses MCP JSON-RPC 2.0 protocol.
 */
export async function searchPubMedEvidence(
  queries: EvidenceQuery[],
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<EvidenceSearchResult[]> {
  const results: EvidenceSearchResult[] = [];

  for (const q of queries) {
    const startTime = Date.now();
    try {
      const citations = await callPubMedMCP(
        supabaseUrl, serviceRoleKey, 'search_pubmed',
        { query: q.query, max_results: MAX_RESULTS_PER_SEARCH, sort: 'relevance' }
      );
      results.push({
        query: q.query,
        trigger: q.trigger,
        triggerDetail: q.triggerDetail,
        citations: formatSearchResults(citations, q),
        searchTimeMs: Date.now() - startTime,
      });
    } catch {
      // Non-fatal — evidence is supplementary, never blocks clinical reasoning
      results.push({
        query: q.query,
        trigger: q.trigger,
        triggerDetail: q.triggerDetail,
        citations: [],
        searchTimeMs: Date.now() - startTime,
      });
    }
  }

  return results;
}

/**
 * Call the PubMed MCP server via HTTP POST (MCP JSON-RPC 2.0).
 */
async function callPubMedMCP(
  supabaseUrl: string,
  serviceRoleKey: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(`${supabaseUrl}/functions/v1/mcp-pubmed-server`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: args },
      id: crypto.randomUUID(),
    }),
  });

  if (!response.ok) {
    throw new Error(`PubMed MCP server returned ${response.status}`);
  }

  const data = await response.json();

  // MCP response path: result.content[0].text (JSON string)
  const textContent = data?.result?.content?.[0]?.text;
  if (!textContent) {
    throw new Error('Empty response from PubMed MCP server');
  }

  return JSON.parse(textContent);
}

// =====================================================
// Citation Formatting
// =====================================================

/** Article shape returned by search_pubmed tool */
interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string[];
  author_count: number;
  journal: string;
  pub_date: string;
  doi: string;
  pub_types: string[];
}

/**
 * Format raw PubMed search results into EvidenceCitation objects.
 */
function formatSearchResults(
  rawResults: unknown,
  query: EvidenceQuery
): EvidenceCitation[] {
  const data = rawResults as { articles?: PubMedArticle[] };
  if (!data?.articles || !Array.isArray(data.articles)) return [];

  return data.articles.map(article => ({
    pmid: article.pmid || '',
    title: article.title || 'Untitled',
    authors: (article.authors || []).slice(0, 3),
    journal: article.journal || '',
    year: extractYear(article.pub_date || ''),
    doi: article.doi || '',
    relevanceNote: buildRelevanceNote(query, article),
  }));
}

/**
 * Format citations for display in the provider UI.
 * Returns a concise string per citation (PMID, title, journal, year, DOI).
 */
export function formatCitationsForDisplay(results: EvidenceSearchResult[]): string[] {
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

// =====================================================
// Query Builders
// =====================================================

function buildDiagnosisQuery(dx: DiagnosisEntry): string {
  const parts = [dx.condition];
  if (dx.icd10) parts.push(dx.icd10);
  // Add evidence keywords for clinical relevance
  if (dx.supportingEvidence.length > 0) {
    const firstEvidence = dx.supportingEvidence[0];
    if (firstEvidence.length < 40) parts.push(firstEvidence);
  }
  return `${parts.join(' ')} diagnosis management`;
}

function buildDrugInteractionQuery(meds: MedicationEntry[]): string {
  const names = meds.map(m => m.name).slice(0, 3);
  return `${names.join(' ')} drug interaction`;
}

function extractYear(pubDate: string): string {
  const match = pubDate.match(/(\d{4})/);
  return match ? match[1] : '';
}

function buildRelevanceNote(query: EvidenceQuery, article: PubMedArticle): string {
  switch (query.trigger) {
    case 'physician_request':
      return `Matches provider evidence request`;
    case 'low_confidence_diagnosis':
      return `May help clarify uncertain diagnosis`;
    case 'drug_interaction':
      return `Related to potential drug interaction`;
    case 'rare_condition':
      return `Literature on uncommon condition`;
    case 'multiple_differentials':
      return `May help narrow differential diagnosis`;
    default:
      return '';
  }
}

/**
 * Create a fresh rate limiter for a new encounter
 */
export function createEvidenceRateLimiter(): EvidenceRateLimiter {
  return { queriesMade: 0, lastQueryTime: 0 };
}

/**
 * Update rate limiter after a search
 */
export function updateRateLimiter(
  limiter: EvidenceRateLimiter,
  queriesExecuted: number
): EvidenceRateLimiter {
  return {
    queriesMade: limiter.queriesMade + queriesExecuted,
    lastQueryTime: Date.now(),
  };
}
