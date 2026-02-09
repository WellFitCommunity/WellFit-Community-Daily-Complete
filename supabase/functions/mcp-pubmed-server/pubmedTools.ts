// =====================================================
// PubMed Tool Handlers
// Purpose: NCBI E-utilities API integration for PubMed search
// API: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
//
// Rate limit: NCBI allows 3 req/sec (no key), 10 req/sec (with key)
// =====================================================

import { EdgeFunctionLogger } from "../_shared/auditLogger.ts";

// NCBI E-utilities base URL
const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

// Optional API key from environment (increases rate limit)
const NCBI_API_KEY = Deno.env.get("NCBI_API_KEY") || "";

// =====================================================
// NCBI API Helpers
// =====================================================

function buildEutilsUrl(endpoint: string, params: Record<string, string>): string {
  const url = new URL(`${EUTILS_BASE}/${endpoint}`);
  url.searchParams.set("retmode", "json");
  if (NCBI_API_KEY) {
    url.searchParams.set("api_key", NCBI_API_KEY);
  }
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function fetchEutils(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const url = buildEutilsUrl(endpoint, params);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NCBI API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchEutilsXml(endpoint: string, params: Record<string, string>): Promise<string> {
  const baseUrl = buildEutilsUrl(endpoint, params);
  // Override retmode to xml for XML endpoints
  const url = baseUrl.replace("retmode=json", "retmode=xml");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NCBI API error: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

// Small delay to respect NCBI rate limits between chained calls
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================================================
// NCBI API Response Types
// =====================================================

interface ESearchResult {
  esearchresult?: {
    count?: string;
    idlist?: string[];
    querytranslation?: string;
  };
}

interface ESummaryDoc {
  uid?: string;
  title?: string;
  sortfirstauthor?: string;
  authors?: Array<{ name: string; authtype: string }>;
  source?: string;
  pubdate?: string;
  epubdate?: string;
  elocationid?: string;
  fulljournalname?: string;
  sortpubdate?: string;
  articleids?: Array<{ idtype: string; value: string }>;
  pubtype?: string[];
}

interface ESummaryResult {
  result?: {
    uids?: string[];
    [pmid: string]: ESummaryDoc | string[] | undefined;
  };
}

interface ELinkResult {
  linksets?: Array<{
    linksetdbs?: Array<{
      linkname?: string;
      links?: Array<{ id: string }>;
    }>;
  }>;
}

// =====================================================
// Tool Handlers
// =====================================================

export async function searchPubmed(
  params: {
    query: string;
    max_results?: number;
    sort?: string;
    date_from?: string;
    date_to?: string;
    article_types?: string;
  },
  logger: EdgeFunctionLogger
): Promise<{ articles: Array<Record<string, unknown>>; total: number; query_translation: string }> {
  const {
    query,
    max_results = 20,
    sort = "relevance",
    date_from,
    date_to,
    article_types
  } = params;

  const retmax = Math.min(max_results, 100);

  // Build search query with optional filters
  let searchQuery = query;
  if (article_types) {
    const typeFilter = article_types.replace(/-/g, " ");
    searchQuery += ` AND ${typeFilter}[pt]`;
  }

  const searchParams: Record<string, string> = {
    db: "pubmed",
    term: searchQuery,
    retmax: String(retmax),
    sort: sort === "date" ? "pub_date" : "relevance",
    usehistory: "n"
  };

  if (date_from) searchParams.mindate = date_from;
  if (date_to) searchParams.maxdate = date_to;
  if (date_from || date_to) searchParams.datetype = "pdat";

  // Step 1: ESearch to get PMIDs
  const searchData = await fetchEutils("esearch.fcgi", searchParams) as ESearchResult;
  const idList = searchData.esearchresult?.idlist || [];
  const totalCount = parseInt(searchData.esearchresult?.count || "0", 10);
  const queryTranslation = searchData.esearchresult?.querytranslation || query;

  if (idList.length === 0) {
    return { articles: [], total: 0, query_translation: queryTranslation };
  }

  // Step 2: ESummary to get article metadata
  await delay(350);
  const summaryData = await fetchEutils("esummary.fcgi", {
    db: "pubmed",
    id: idList.join(",")
  }) as ESummaryResult;

  const articles = idList.map(pmid => {
    const doc = summaryData.result?.[pmid] as ESummaryDoc | undefined;
    if (!doc) return { pmid, title: "Unknown", authors: [], journal: "", pub_date: "", doi: "" };

    const doi = doc.articleids?.find(a => a.idtype === "doi")?.value || doc.elocationid || "";
    const authors = (doc.authors || []).map(a => a.name);

    return {
      pmid,
      title: doc.title || "No title",
      authors: authors.slice(0, 5),
      author_count: authors.length,
      journal: doc.fulljournalname || doc.source || "",
      pub_date: doc.pubdate || doc.sortpubdate || "",
      doi,
      pub_types: doc.pubtype || []
    };
  });

  await logger.info("PubMed search completed", { query, results: articles.length, total: totalCount });
  return { articles, total: totalCount, query_translation: queryTranslation };
}

export async function getArticleSummary(
  params: { pmids: string },
  logger: EdgeFunctionLogger
): Promise<{ articles: Array<Record<string, unknown>> }> {
  const { pmids } = params;

  const idList = pmids.split(",").map(id => id.trim()).filter(id => /^\d+$/.test(id));
  if (idList.length === 0) {
    return { articles: [] };
  }

  const cappedIds = idList.slice(0, 50);
  const summaryData = await fetchEutils("esummary.fcgi", {
    db: "pubmed",
    id: cappedIds.join(",")
  }) as ESummaryResult;

  const articles = cappedIds.map(pmid => {
    const doc = summaryData.result?.[pmid] as ESummaryDoc | undefined;
    if (!doc) return { pmid, error: "Article not found" };

    const doi = doc.articleids?.find(a => a.idtype === "doi")?.value || doc.elocationid || "";
    const pmc = doc.articleids?.find(a => a.idtype === "pmc")?.value || "";
    const authors = (doc.authors || []).map(a => a.name);

    return {
      pmid,
      title: doc.title || "No title",
      authors,
      journal: doc.fulljournalname || doc.source || "",
      pub_date: doc.pubdate || "",
      doi,
      pmc_id: pmc,
      pub_types: doc.pubtype || []
    };
  });

  await logger.info("Article summary retrieved", { count: articles.length });
  return { articles };
}

export async function getArticleAbstract(
  params: { pmid: string },
  logger: EdgeFunctionLogger
): Promise<{ pmid: string; title: string; abstract: string; mesh_terms: string[] }> {
  const { pmid } = params;

  if (!/^\d+$/.test(pmid.trim())) {
    return { pmid, title: "Invalid PMID", abstract: "PMID must be numeric", mesh_terms: [] };
  }

  const xmlText = await fetchEutilsXml("efetch.fcgi", {
    db: "pubmed",
    id: pmid.trim(),
    rettype: "abstract"
  });

  // Parse title
  const titleMatch = xmlText.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "") : "No title";

  // Parse abstract sections (structured abstracts have Label attributes)
  const abstractSections: string[] = [];
  const abstractTextRegex = /<AbstractText(?:\s+Label="([^"]*)")?[^>]*>([\s\S]*?)<\/AbstractText>/g;
  let match = abstractTextRegex.exec(xmlText);
  while (match) {
    const label = match[1];
    const text = match[2].replace(/<[^>]*>/g, "").trim();
    abstractSections.push(label ? `${label}: ${text}` : text);
    match = abstractTextRegex.exec(xmlText);
  }

  const abstractText = abstractSections.length > 0
    ? abstractSections.join("\n\n")
    : "No abstract available";

  // Parse MeSH terms
  const meshTerms: string[] = [];
  const meshRegex = /<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/g;
  let meshMatch = meshRegex.exec(xmlText);
  while (meshMatch) {
    meshTerms.push(meshMatch[1].replace(/<[^>]*>/g, "").trim());
    meshMatch = meshRegex.exec(xmlText);
  }

  await logger.info("Article abstract retrieved", { pmid });
  return { pmid: pmid.trim(), title, abstract: abstractText, mesh_terms: meshTerms };
}

export async function getArticleCitations(
  params: { pmid: string; max_results?: number },
  logger: EdgeFunctionLogger
): Promise<{ source_pmid: string; citing_articles: Array<Record<string, unknown>>; total_citations: number }> {
  const { pmid, max_results = 20 } = params;
  const retmax = Math.min(max_results, 100);

  if (!/^\d+$/.test(pmid.trim())) {
    return { source_pmid: pmid, citing_articles: [], total_citations: 0 };
  }

  const linkData = await fetchEutils("elink.fcgi", {
    dbfrom: "pubmed",
    db: "pubmed",
    id: pmid.trim(),
    linkname: "pubmed_pubmed_citedin"
  }) as ELinkResult;

  const linkSet = linkData.linksets?.[0]?.linksetdbs?.find(
    db => db.linkname === "pubmed_pubmed_citedin"
  );
  const citingIds = (linkSet?.links || []).map(l => l.id);
  const totalCitations = citingIds.length;

  if (citingIds.length === 0) {
    await logger.info("No citations found", { pmid });
    return { source_pmid: pmid.trim(), citing_articles: [], total_citations: 0 };
  }

  const cappedIds = citingIds.slice(0, retmax);
  await delay(350);

  const summaryData = await fetchEutils("esummary.fcgi", {
    db: "pubmed",
    id: cappedIds.join(",")
  }) as ESummaryResult;

  const citingArticles = cappedIds.map(citePmid => {
    const doc = summaryData.result?.[citePmid] as ESummaryDoc | undefined;
    if (!doc) return { pmid: citePmid, title: "Unknown" };

    return {
      pmid: citePmid,
      title: doc.title || "No title",
      first_author: doc.sortfirstauthor || "",
      journal: doc.fulljournalname || doc.source || "",
      pub_date: doc.pubdate || ""
    };
  });

  await logger.info("Citation lookup completed", { pmid, citations: totalCitations });
  return { source_pmid: pmid.trim(), citing_articles: citingArticles, total_citations: totalCitations };
}

export async function searchClinicalTrials(
  params: { query: string; max_results?: number; phase?: string },
  logger: EdgeFunctionLogger
): Promise<{ trials: Array<Record<string, unknown>>; total: number }> {
  const { query, max_results = 20, phase } = params;
  const retmax = Math.min(max_results, 100);

  let searchQuery = `${query} AND clinical trial[pt]`;
  if (phase) {
    const phaseMap: Record<string, string> = {
      "phase-1": "clinical trial, phase i[pt]",
      "phase-2": "clinical trial, phase ii[pt]",
      "phase-3": "clinical trial, phase iii[pt]",
      "phase-4": "clinical trial, phase iv[pt]"
    };
    if (phaseMap[phase]) {
      searchQuery = `${query} AND ${phaseMap[phase]}`;
    }
  }

  const searchData = await fetchEutils("esearch.fcgi", {
    db: "pubmed",
    term: searchQuery,
    retmax: String(retmax),
    sort: "pub_date"
  }) as ESearchResult;

  const idList = searchData.esearchresult?.idlist || [];
  const totalCount = parseInt(searchData.esearchresult?.count || "0", 10);

  if (idList.length === 0) {
    return { trials: [], total: 0 };
  }

  await delay(350);
  const summaryData = await fetchEutils("esummary.fcgi", {
    db: "pubmed",
    id: idList.join(",")
  }) as ESummaryResult;

  const trials = idList.map(pmid => {
    const doc = summaryData.result?.[pmid] as ESummaryDoc | undefined;
    if (!doc) return { pmid, title: "Unknown" };

    const doi = doc.articleids?.find(a => a.idtype === "doi")?.value || "";
    return {
      pmid,
      title: doc.title || "No title",
      first_author: doc.sortfirstauthor || "",
      journal: doc.fulljournalname || doc.source || "",
      pub_date: doc.pubdate || "",
      doi,
      pub_types: doc.pubtype || []
    };
  });

  await logger.info("Clinical trials search completed", { query, results: trials.length, total: totalCount });
  return { trials, total: totalCount };
}

export async function getMeshTerms(
  params: { term: string },
  logger: EdgeFunctionLogger
): Promise<{ term: string; mesh_results: Array<Record<string, unknown>> }> {
  const { term } = params;

  const searchData = await fetchEutils("esearch.fcgi", {
    db: "mesh",
    term: term,
    retmax: "10"
  }) as ESearchResult;

  const idList = searchData.esearchresult?.idlist || [];

  if (idList.length === 0) {
    await logger.info("No MeSH terms found", { term });
    return { term, mesh_results: [] };
  }

  await delay(350);
  const xmlText = await fetchEutilsXml("efetch.fcgi", {
    db: "mesh",
    id: idList.join(","),
    rettype: "full"
  });

  const meshResults: Array<Record<string, unknown>> = [];
  const descriptorRegex = /<DescriptorRecord[^>]*>([\s\S]*?)<\/DescriptorRecord>/g;
  let descMatch = descriptorRegex.exec(xmlText);

  while (descMatch) {
    const block = descMatch[1];

    const nameMatch = block.match(/<DescriptorName>\s*<String>([\s\S]*?)<\/String>/);
    const descriptorName = nameMatch ? nameMatch[1].trim() : "Unknown";

    const treeNumbers: string[] = [];
    const treeRegex = /<TreeNumber>([\s\S]*?)<\/TreeNumber>/g;
    let treeMatch = treeRegex.exec(block);
    while (treeMatch) {
      treeNumbers.push(treeMatch[1].trim());
      treeMatch = treeRegex.exec(block);
    }

    const scopeMatch = block.match(/<ScopeNote>([\s\S]*?)<\/ScopeNote>/);
    const scopeNote = scopeMatch ? scopeMatch[1].trim() : "";

    meshResults.push({
      descriptor_name: descriptorName,
      tree_numbers: treeNumbers,
      scope_note: scopeNote.slice(0, 500),
      search_suggestion: `"${descriptorName}"[MeSH Terms]`
    });

    descMatch = descriptorRegex.exec(xmlText);
  }

  if (meshResults.length === 0) {
    meshResults.push({
      descriptor_name: term,
      tree_numbers: [],
      scope_note: "MeSH record found but details could not be parsed. Try searching PubMed directly.",
      search_suggestion: `"${term}"[MeSH Terms]`
    });
  }

  await logger.info("MeSH lookup completed", { term, results: meshResults.length });
  return { term, mesh_results: meshResults };
}
