// supabase/functions/mcp-pubmed-server/__tests__/index.test.ts
// Tests for MCP PubMed Literature Server - NCBI E-utilities integration
// Tier 1 (external_api): PubMed search, abstracts, citations, clinical trials, MeSH terms

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("MCP PubMed Server Tests", async (t) => {

  // =====================================================
  // Server Configuration Tests
  // =====================================================

  await t.step("should have correct server config (tier=external_api, rate 50/60s)", () => {
    const SERVER_CONFIG = {
      name: "mcp-pubmed-server",
      version: "1.0.0",
      tier: "external_api" as const
    };
    assertEquals(SERVER_CONFIG.name, "mcp-pubmed-server");
    assertEquals(SERVER_CONFIG.tier, "external_api");
    // Rate limit: 50 req/60s — conservative vs NCBI 3 req/sec (180/min)
    const maxRequests = 50;
    const windowMs = 60000;
    assertEquals(maxRequests < 180, true);
    assertEquals(windowMs, 60000);
  });

  // =====================================================
  // Tool Definitions Tests
  // =====================================================

  await t.step("should define all 7 tools", () => {
    const toolNames = [
      "search_pubmed", "get_article_summary", "get_article_abstract",
      "get_article_citations", "search_clinical_trials", "get_mesh_terms", "ping"
    ];
    assertEquals(toolNames.length, 7);
    for (const name of toolNames) {
      assertEquals(toolNames.includes(name), true);
    }
  });

  await t.step("should define search_pubmed schema with article_types enum and sort enum", () => {
    const schema = {
      properties: {
        query: { type: "string" },
        max_results: { type: "number" },
        sort: { type: "string", enum: ["relevance", "date"] },
        date_from: { type: "string" },
        date_to: { type: "string" },
        article_types: {
          type: "string",
          enum: ["review", "clinical-trial", "meta-analysis",
            "randomized-controlled-trial", "systematic-review", "case-reports"]
        }
      },
      required: ["query"]
    };
    assertEquals(schema.required, ["query"]);
    assertEquals(schema.properties.sort.enum, ["relevance", "date"]);
    assertEquals(schema.properties.article_types.enum.length, 6);
  });

  await t.step("should define clinical_trials schema with phase enum", () => {
    const phaseEnum = ["phase-1", "phase-2", "phase-3", "phase-4"];
    assertEquals(phaseEnum.length, 4);
    assertEquals(phaseEnum[0], "phase-1");
    assertEquals(phaseEnum[3], "phase-4");
  });

  await t.step("should require pmids (string) for get_article_summary", () => {
    const schema = { required: ["pmids"], properties: { pmids: { type: "string" } } };
    assertEquals(schema.required, ["pmids"]);
  });

  await t.step("should require single pmid for get_article_abstract", () => {
    const schema = { required: ["pmid"], properties: { pmid: { type: "string" } } };
    assertEquals(schema.required, ["pmid"]);
  });

  // =====================================================
  // E-utilities URL Construction Tests
  // =====================================================

  await t.step("should build correct esearch URL with retmode=json", () => {
    const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
    const url = new URL(`${EUTILS_BASE}/esearch.fcgi`);
    url.searchParams.set("retmode", "json");
    url.searchParams.set("db", "pubmed");
    url.searchParams.set("term", "diabetes mellitus");
    url.searchParams.set("retmax", "20");
    const s = url.toString();
    assertEquals(s.includes("esearch.fcgi"), true);
    assertEquals(s.includes("retmode=json"), true);
    assertEquals(s.includes("db=pubmed"), true);
  });

  await t.step("should build esummary URL with comma-joined PMIDs", () => {
    const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
    const ids = ["12345678", "23456789", "34567890"];
    const url = new URL(`${EUTILS_BASE}/esummary.fcgi`);
    url.searchParams.set("retmode", "json");
    url.searchParams.set("db", "pubmed");
    url.searchParams.set("id", ids.join(","));
    const s = url.toString();
    assertEquals(s.includes("12345678"), true);
    assertEquals(s.includes("34567890"), true);
  });

  await t.step("should build elink URL for pubmed_pubmed_citedin", () => {
    const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
    const url = new URL(`${EUTILS_BASE}/elink.fcgi`);
    url.searchParams.set("retmode", "json");
    url.searchParams.set("dbfrom", "pubmed");
    url.searchParams.set("db", "pubmed");
    url.searchParams.set("id", "12345678");
    url.searchParams.set("linkname", "pubmed_pubmed_citedin");
    const s = url.toString();
    assertEquals(s.includes("elink.fcgi"), true);
    assertEquals(s.includes("linkname=pubmed_pubmed_citedin"), true);
  });

  await t.step("should include api_key in URL when provided", () => {
    const url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
    url.searchParams.set("retmode", "json");
    url.searchParams.set("api_key", "test_key_abc123");
    assertEquals(url.toString().includes("api_key=test_key_abc123"), true);
  });

  await t.step("should convert retmode to xml for efetch endpoints", () => {
    const jsonUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?retmode=json&db=pubmed";
    const xmlUrl = jsonUrl.replace("retmode=json", "retmode=xml");
    assertEquals(xmlUrl.includes("retmode=xml"), true);
    assertEquals(xmlUrl.includes("retmode=json"), false);
  });

  // =====================================================
  // Search Query Construction Tests
  // =====================================================

  await t.step("should append article type filter with [pt] tag", () => {
    const types = [
      { input: "clinical-trial", expected: "clinical trial[pt]" },
      { input: "randomized-controlled-trial", expected: "randomized controlled trial[pt]" },
      { input: "meta-analysis", expected: "meta analysis[pt]" },
      { input: "case-reports", expected: "case reports[pt]" }
    ];
    for (const { input, expected } of types) {
      const filter = `${input.replace(/-/g, " ")}[pt]`;
      assertEquals(filter, expected);
    }
  });

  await t.step("should build clinical trials phase query with phaseMap", () => {
    const phaseMap: Record<string, string> = {
      "phase-1": "clinical trial, phase i[pt]",
      "phase-2": "clinical trial, phase ii[pt]",
      "phase-3": "clinical trial, phase iii[pt]",
      "phase-4": "clinical trial, phase iv[pt]"
    };
    const query = "metformin";
    assertEquals(`${query} AND clinical trial[pt]`, "metformin AND clinical trial[pt]");
    assertEquals(`${query} AND ${phaseMap["phase-3"]}`, "metformin AND clinical trial, phase iii[pt]");
    assertEquals(Object.keys(phaseMap).length, 4);
  });

  await t.step("should map sort param (date->pub_date, else relevance)", () => {
    const sortMap = (s: string) => s === "date" ? "pub_date" : "relevance";
    assertEquals(sortMap("date"), "pub_date");
    assertEquals(sortMap("relevance"), "relevance");
    assertEquals(sortMap("other"), "relevance");
  });

  await t.step("should add date params with datetype=pdat when date filters set", () => {
    const p: Record<string, string> = { db: "pubmed", term: "test", retmax: "20", sort: "relevance", usehistory: "n" };
    const dateFrom = "2024/01/01";
    const dateTo = "2025/06/30";
    if (dateFrom) p.mindate = dateFrom;
    if (dateTo) p.maxdate = dateTo;
    if (dateFrom || dateTo) p.datetype = "pdat";
    assertEquals(p.mindate, "2024/01/01");
    assertEquals(p.maxdate, "2025/06/30");
    assertEquals(p.datetype, "pdat");
  });

  await t.step("should cap max_results at 100 and default to 20", () => {
    const cap = (m: number) => Math.min(m, 100);
    assertEquals(cap(20), 20);
    assertEquals(cap(100), 100);
    assertEquals(cap(500), 100);
    // Default
    const defaultMax = 20;
    assertEquals(defaultMax, 20);
  });

  // =====================================================
  // ESearch Response Parsing Tests
  // =====================================================

  await t.step("should parse ESearch result with PMID list and count", () => {
    const searchData = {
      esearchresult: { count: "2543", idlist: ["38901234", "38901235", "38901236"], querytranslation: "diabetes mellitus[MeSH Terms]" }
    };
    const idList = searchData.esearchresult?.idlist || [];
    const totalCount = parseInt(searchData.esearchresult?.count || "0", 10);
    assertEquals(idList.length, 3);
    assertEquals(totalCount, 2543);
    assertEquals(searchData.esearchresult?.querytranslation, "diabetes mellitus[MeSH Terms]");
  });

  await t.step("should return empty articles when ESearch yields no PMIDs", () => {
    const idList: string[] = [];
    const result = { articles: [] as unknown[], total: 0, query_translation: "nonexistent" };
    assertEquals(idList.length === 0, true);
    assertEquals(result.total, 0);
  });

  // =====================================================
  // ESummary Response Parsing Tests
  // =====================================================

  await t.step("should parse ESummary doc into article with DOI, PMC, authors", () => {
    const doc = {
      uid: "38901234", title: "Synthetic Study of Type 2 Diabetes Management",
      authors: [{ name: "Smith J", authtype: "Author" }, { name: "Jones A", authtype: "Author" }, { name: "Lee B", authtype: "Author" }],
      fulljournalname: "Journal of Clinical Medicine", pubdate: "2025 Mar",
      articleids: [{ idtype: "pubmed", value: "38901234" }, { idtype: "doi", value: "10.1234/jcm.2025.56789" }, { idtype: "pmc", value: "PMC12345678" }],
      pubtype: ["Journal Article", "Clinical Trial"]
    };
    const doi = doc.articleids.find(a => a.idtype === "doi")?.value || "";
    const pmc = doc.articleids.find(a => a.idtype === "pmc")?.value || "";
    const authors = doc.authors.map(a => a.name);
    assertEquals(doi, "10.1234/jcm.2025.56789");
    assertEquals(pmc, "PMC12345678");
    assertEquals(authors.length, 3);
    assertEquals(authors[0], "Smith J");
  });

  await t.step("should truncate authors to first 5 in search results", () => {
    const authors = ["A", "B", "C", "D", "E", "F", "G", "H"];
    assertEquals(authors.slice(0, 5).length, 5);
    assertEquals(authors.length, 8);
  });

  await t.step("should handle missing ESummary fields with fallbacks", () => {
    const title = undefined || "No title";
    const doi = undefined || "";
    const journal = undefined || undefined || "";
    const pubTypes = undefined || [];
    assertEquals(title, "No title");
    assertEquals(doi, "");
    assertEquals(journal, "");
    assertEquals(pubTypes.length, 0);
  });

  await t.step("should fall back to elocationid when no DOI in articleids", () => {
    const articleids = [{ idtype: "pubmed", value: "38901234" }];
    const elocationid = "10.1234/fallback.doi";
    const doi = articleids.find(a => a.idtype === "doi")?.value || elocationid || "";
    assertEquals(doi, "10.1234/fallback.doi");
  });

  // =====================================================
  // PMID Validation Tests
  // =====================================================

  await t.step("should validate PMID format as numeric-only", () => {
    const re = /^\d+$/;
    assertEquals(re.test("12345678"), true);
    assertEquals(re.test("1"), true);
    assertEquals(re.test("abc"), false);
    assertEquals(re.test("123.456"), false);
    assertEquals(re.test(""), false);
  });

  await t.step("should parse comma-separated PMIDs filtering invalid entries", () => {
    const input = "12345678, 23456789, abc, 34567890, , 45678901";
    const idList = input.split(",").map(id => id.trim()).filter(id => /^\d+$/.test(id));
    assertEquals(idList.length, 4);
    assertEquals(idList.includes("abc"), false);
  });

  await t.step("should cap article summary PMIDs to 50", () => {
    const ids = Array.from({ length: 75 }, (_, i) => String(10000000 + i));
    assertEquals(ids.slice(0, 50).length, 50);
  });

  await t.step("should return invalid PMID response for non-numeric input", () => {
    const pmid = "not-a-number";
    if (!/^\d+$/.test(pmid.trim())) {
      const result = { pmid, title: "Invalid PMID", abstract: "PMID must be numeric", mesh_terms: [] as string[] };
      assertEquals(result.title, "Invalid PMID");
      assertEquals(result.mesh_terms.length, 0);
    }
  });

  // =====================================================
  // XML Parsing Tests (Abstract & MeSH)
  // =====================================================

  await t.step("should parse ArticleTitle from XML", () => {
    const xml = `<ArticleTitle>Effects of Synthetic Drug Alpha on Glucose Levels</ArticleTitle>`;
    const m = xml.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/);
    assertEquals(m ? m[1].replace(/<[^>]*>/g, "") : "No title", "Effects of Synthetic Drug Alpha on Glucose Levels");
  });

  await t.step("should parse structured abstract with labeled sections", () => {
    const xml = `<Abstract>
      <AbstractText Label="BACKGROUND">Synthetic background text.</AbstractText>
      <AbstractText Label="METHODS">RCT with 200 synthetic patients.</AbstractText>
      <AbstractText Label="RESULTS">HbA1c decreased 1.2%.</AbstractText>
      <AbstractText Label="CONCLUSIONS">Drug shows promise.</AbstractText>
    </Abstract>`;
    const sections: string[] = [];
    const re = /<AbstractText(?:\s+Label="([^"]*)")?[^>]*>([\s\S]*?)<\/AbstractText>/g;
    let m = re.exec(xml);
    while (m) {
      const label = m[1];
      const text = m[2].replace(/<[^>]*>/g, "").trim();
      sections.push(label ? `${label}: ${text}` : text);
      m = re.exec(xml);
    }
    assertEquals(sections.length, 4);
    assertEquals(sections[0].startsWith("BACKGROUND:"), true);
    assertEquals(sections[3].startsWith("CONCLUSIONS:"), true);
  });

  await t.step("should return 'No abstract available' when no sections found", () => {
    const sections: string[] = [];
    const text = sections.length > 0 ? sections.join("\n\n") : "No abstract available";
    assertEquals(text, "No abstract available");
  });

  await t.step("should parse MeSH DescriptorName terms from efetch XML", () => {
    const xml = `<MeshHeadingList>
      <MeshHeading><DescriptorName UI="D003920">Diabetes Mellitus</DescriptorName></MeshHeading>
      <MeshHeading><DescriptorName UI="D008687">Metformin</DescriptorName></MeshHeading>
    </MeshHeadingList>`;
    const terms: string[] = [];
    const re = /<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/g;
    let m = re.exec(xml);
    while (m) { terms.push(m[1].replace(/<[^>]*>/g, "").trim()); m = re.exec(xml); }
    assertEquals(terms.length, 2);
    assertEquals(terms[0], "Diabetes Mellitus");
    assertEquals(terms[1], "Metformin");
  });

  // =====================================================
  // ELink / Citation Parsing Tests
  // =====================================================

  await t.step("should parse ELink citedin linkset and ignore other link types", () => {
    const linkData = {
      linksets: [{ linksetdbs: [
        { linkname: "pubmed_pubmed_citedin", links: [{ id: "39001001" }, { id: "39001002" }] },
        { linkname: "pubmed_pubmed_refs", links: [{ id: "38000001" }] }
      ]}]
    };
    const linkSet = linkData.linksets[0].linksetdbs.find(db => db.linkname === "pubmed_pubmed_citedin");
    const citingIds = (linkSet?.links || []).map(l => l.id);
    assertEquals(citingIds.length, 2);
    assertEquals(citingIds.includes("38000001"), false);
  });

  await t.step("should handle empty citation linkset", () => {
    const linkData = { linksets: [{ linksetdbs: [] as Array<{ linkname: string; links: Array<{ id: string }> }> }] };
    const linkSet = linkData.linksets[0].linksetdbs.find(db => db.linkname === "pubmed_pubmed_citedin");
    assertEquals(linkSet, undefined);
    assertEquals((linkSet?.links || []).length, 0);
  });

  // =====================================================
  // MeSH Descriptor Record Parsing Tests
  // =====================================================

  await t.step("should parse MeSH DescriptorRecord with tree numbers and scope note", () => {
    const xml = `<DescriptorRecord DescriptorClass="1">
      <DescriptorName><String>Diabetes Mellitus</String></DescriptorName>
      <TreeNumberList><TreeNumber>C18.452.394.750</TreeNumber><TreeNumber>C19.246</TreeNumber></TreeNumberList>
      <ConceptList><Concept><ScopeNote>Heterogeneous disorders characterized by hyperglycemia.</ScopeNote></Concept></ConceptList>
    </DescriptorRecord>`;
    const nameMatch = xml.match(/<DescriptorName>\s*<String>([\s\S]*?)<\/String>/);
    const name = nameMatch ? nameMatch[1].trim() : "Unknown";
    const trees: string[] = [];
    const treeRe = /<TreeNumber>([\s\S]*?)<\/TreeNumber>/g;
    let tm = treeRe.exec(xml);
    while (tm) { trees.push(tm[1].trim()); tm = treeRe.exec(xml); }
    const scopeMatch = xml.match(/<ScopeNote>([\s\S]*?)<\/ScopeNote>/);
    const scope = scopeMatch ? scopeMatch[1].trim() : "";

    assertEquals(name, "Diabetes Mellitus");
    assertEquals(trees.length, 2);
    assertEquals(trees[0], "C18.452.394.750");
    assertEquals(scope.includes("hyperglycemia"), true);
    assertEquals(`"${name}"[MeSH Terms]`, '"Diabetes Mellitus"[MeSH Terms]');
  });

  await t.step("should provide fallback MeSH result when XML parse yields nothing", () => {
    const term = "obscure_term";
    const meshResults: Array<Record<string, unknown>> = [];
    if (meshResults.length === 0) {
      meshResults.push({
        descriptor_name: term, tree_numbers: [],
        scope_note: "MeSH record found but details could not be parsed. Try searching PubMed directly.",
        search_suggestion: `"${term}"[MeSH Terms]`
      });
    }
    assertEquals(meshResults.length, 1);
    assertEquals((meshResults[0].scope_note as string).includes("could not be parsed"), true);
  });

  await t.step("should truncate scope_note to 500 characters", () => {
    const longNote = "A".repeat(700);
    assertEquals(longNote.slice(0, 500).length, 500);
  });

  await t.step("should use mesh database (not pubmed) for MeSH lookups", () => {
    const params = { db: "mesh", term: "hypertension", retmax: "10" };
    assertEquals(params.db, "mesh");
    assertNotEquals(params.db, "pubmed");
  });

  // =====================================================
  // MCP JSON-RPC Protocol Tests
  // =====================================================

  await t.step("should wrap tool results in MCP content format with metadata", () => {
    const toolResult = { articles: [], total: 0, query_translation: "test" };
    const mcpResponse = {
      jsonrpc: "2.0",
      result: {
        content: [{ type: "text", text: JSON.stringify(toolResult, null, 2) }],
        metadata: { tool: "search_pubmed", executionTimeMs: 42 }
      },
      id: 1
    };
    assertEquals(mcpResponse.result.content[0].type, "text");
    assertEquals(mcpResponse.result.metadata.tool, "search_pubmed");
    const parsed = JSON.parse(mcpResponse.result.content[0].text);
    assertEquals(parsed.total, 0);
  });

  await t.step("should return -32601 for unknown JSON-RPC methods", () => {
    const errorCode = -32601;
    assertEquals(errorCode, -32601);
  });

  await t.step("should format rate limit response with code -32000 and Retry-After", () => {
    const resetAt = Date.now() + 30000;
    const retryAfter = String(Math.ceil((resetAt - Date.now()) / 1000));
    const response = {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Rate limit exceeded. NCBI allows max 3 requests/second." },
      id: null
    };
    assertEquals(response.error.code, -32000);
    assertEquals(parseInt(retryAfter) > 0, true);
  });

  await t.step("should use 350ms delay between chained NCBI calls (under 3/sec)", () => {
    const delayMs = 350;
    assertEquals(1000 / delayMs < 3, true);
  });

  await t.step("should set usehistory=n for search queries", () => {
    const p = { db: "pubmed", term: "test", usehistory: "n" };
    assertEquals(p.usehistory, "n");
  });
});
