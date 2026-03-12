// MCP CMS Coverage Server — Tool Handlers (Database-backed)
// Queries real CMS reference data from Supabase tables.
// Falls back to coverageData.ts when DB is unavailable.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withTimeout, MCP_LOOKUP_TIMEOUT_MS, MCP_QUERY_TIMEOUT_MS } from "../_shared/mcpQueryTimeout.ts";
import { FALLBACK_PRIOR_AUTH_CODES, FALLBACK_MAC_CONTRACTORS } from "./coverageData.ts";
import type {
  CMSLCDRow,
  CMSNCDRow,
  CMSPriorAuthRow,
  CMSArticleRow,
  CMSMACRow,
  MCPLogger,
} from "./types.ts";

export function createToolHandlers(logger: MCPLogger, sb: SupabaseClient | null) {
  // DB availability flag. After early-return on !dbAvailable, db is guaranteed non-null.
  const dbAvailable = sb !== null;
  // Non-null reference for use after dbAvailable guard (avoids sb! on every call)
  const db = sb as SupabaseClient;

  //search_lcd
  //
  async function searchLCD(params: {
    query: string;
    state?: string;
    contractor_number?: string;
    status?: string;
    limit?: number;
  }) {
    const { query, contractor_number, status = "active", limit = 20 } = params;

    if (!dbAvailable) {
      logger.info("LCD search using fallback (no DB)", { query });
      return {
        lcds: [{
          lcd_id: "FALLBACK",
          title: `Search results unavailable — database not connected. Query: ${query}`,
          status,
          source: "fallback"
        }],
        total: 0,
        source: "fallback"
      };
    }

    let dbQuery = db
      .from("cms_lcds")
      .select("lcd_id, title, contractor_name, contractor_number, jurisdiction, status, effective_date, revision_date, related_codes, summary, benefit_category")
      .eq("status", status)
      .or(`title.ilike.%${query}%,summary.ilike.%${query}%,related_codes.cs.{${query.toUpperCase()}}`)
      .limit(limit);

    if (contractor_number) {
      dbQuery = dbQuery.eq("contractor_number", contractor_number);
    }

    const { data, error } = await withTimeout(
      dbQuery,
      MCP_QUERY_TIMEOUT_MS,
      "LCD search"
    );

    if (error) {
      logger.error("LCD search failed", { errorMessage: error.message, query });
      return { lcds: [], total: 0, error: error.message };
    }

    const lcds = (data || []) as CMSLCDRow[];
    logger.info("LCD search completed", { query, results: lcds.length });

    return {
      lcds: lcds.map(lcd => ({
        lcd_id: lcd.lcd_id,
        title: lcd.title,
        contractor: lcd.contractor_name ?? "Unknown",
        contractor_number: lcd.contractor_number ?? "Unknown",
        status: lcd.status,
        effective_date: lcd.effective_date,
        revision_date: lcd.revision_date,
        related_codes: lcd.related_codes ?? [],
        summary: lcd.summary ?? ""
      })),
      total: lcds.length,
      source: "database"
    };
  }

  //search_ncd
  //
  async function searchNCD(params: {
    query: string;
    benefit_category?: string;
    status?: string;
    limit?: number;
  }) {
    const { query, benefit_category, status = "active", limit = 20 } = params;

    if (!dbAvailable) {
      logger.info("NCD search using fallback (no DB)", { query });
      return { ncds: [], total: 0, source: "fallback" };
    }

    let dbQuery = db
      .from("cms_ncds")
      .select("ncd_id, title, manual_section, status, effective_date, benefit_category, coverage_provisions, covered_indications, non_covered_indications")
      .eq("status", status)
      .or(`title.ilike.%${query}%,coverage_provisions.ilike.%${query}%`)
      .limit(limit);

    if (benefit_category) {
      dbQuery = dbQuery.eq("benefit_category", benefit_category);
    }

    const { data, error } = await withTimeout(
      dbQuery,
      MCP_QUERY_TIMEOUT_MS,
      "NCD search"
    );

    if (error) {
      logger.error("NCD search failed", { errorMessage: error.message, query });
      return { ncds: [], total: 0, error: error.message };
    }

    const ncds = (data || []) as CMSNCDRow[];
    logger.info("NCD search completed", { query, results: ncds.length });

    return {
      ncds: ncds.map(ncd => ({
        ncd_id: ncd.ncd_id,
        title: ncd.title,
        status: ncd.status,
        effective_date: ncd.effective_date,
        manual_section: ncd.manual_section ?? "",
        coverage_provisions: ncd.coverage_provisions ?? "",
        indications: ncd.covered_indications ?? [],
        limitations: ncd.non_covered_indications ?? []
      })),
      total: ncds.length,
      source: "database"
    };
  }

  //get_coverage_requirements
  //
  async function getCoverageRequirements(params: {
    code: string;
    state?: string;
    payer_type?: string;
  }) {
    const { code, payer_type = "medicare" } = params;

    if (!dbAvailable) {
      // Fallback to hardcoded data
      const knownCode = FALLBACK_PRIOR_AUTH_CODES[code];
      if (knownCode) {
        return {
          code,
          description: knownCode.description,
          coverage_status: knownCode.requires_prior_auth ? "Prior authorization required" : "Covered - no prior auth",
          requirements: [
            knownCode.requires_prior_auth ? "Prior authorization required" : "Standard claim submission",
            `Typical approval time: ${knownCode.typical_approval_time}`
          ],
          documentation_needed: knownCode.documentation_required,
          lcd_references: [],
          ncd_references: [],
          source: "fallback"
        };
      }
      return {
        code,
        description: `Procedure code ${code}`,
        coverage_status: "Coverage varies by indication",
        requirements: ["Medical necessity documentation required"],
        documentation_needed: ["Clinical indication", "Supporting diagnosis codes"],
        lcd_references: [],
        ncd_references: [],
        source: "fallback"
      };
    }

    // Query prior auth codes
    const { data: paData, error: paError } = await withTimeout(
      db.from("cms_prior_auth_codes")
        .select("code, description, requires_prior_auth, documentation_required, typical_approval_time, category")
        .eq("code", code)
        .eq("payer_type", payer_type)
        .limit(1),
      MCP_LOOKUP_TIMEOUT_MS,
      "Coverage requirements lookup"
    );

    // Query related LCDs
    const { data: lcdData } = await withTimeout(
      db.from("cms_lcds")
        .select("lcd_id, title")
        .contains("related_codes", [code.toUpperCase()])
        .limit(5),
      MCP_LOOKUP_TIMEOUT_MS,
      "LCD reference lookup"
    );

    if (paError) {
      logger.error("Coverage requirements lookup failed", { errorMessage: paError.message, code });
    }

    const priorAuth = ((paData || []) as CMSPriorAuthRow[])[0];
    const relatedLCDs = (lcdData || []) as Array<{ lcd_id: string; title: string }>;

    if (priorAuth) {
      return {
        code,
        description: priorAuth.description,
        coverage_status: priorAuth.requires_prior_auth ? "Prior authorization required" : "Covered - no prior auth",
        requirements: [
          priorAuth.requires_prior_auth ? "Prior authorization required" : "Standard claim submission",
          `Typical approval time: ${priorAuth.typical_approval_time ?? "Varies"}`
        ],
        documentation_needed: priorAuth.documentation_required ?? [],
        lcd_references: relatedLCDs.map(l => l.lcd_id),
        ncd_references: [],
        source: "database"
      };
    }

    return {
      code,
      description: `Procedure code ${code}`,
      coverage_status: "Coverage varies by indication",
      requirements: ["Medical necessity documentation required", "Check specific LCD for your MAC jurisdiction"],
      documentation_needed: ["Clinical indication", "Supporting diagnosis codes", "Relevant medical history"],
      lcd_references: relatedLCDs.map(l => l.lcd_id),
      ncd_references: [],
      source: "database"
    };
  }

  //check_prior_auth_required
  //
  async function checkPriorAuthRequired(params: {
    cpt_code: string;
    icd10_codes?: string[];
    state?: string;
    place_of_service?: string;
  }) {
    const { cpt_code } = params;

    if (!dbAvailable) {
      const knownCode = FALLBACK_PRIOR_AUTH_CODES[cpt_code];
      if (knownCode) {
        return {
          cpt_code,
          requires_prior_auth: knownCode.requires_prior_auth,
          confidence: "high" as const,
          reason: knownCode.requires_prior_auth
            ? `${knownCode.description} typically requires prior authorization under Medicare guidelines.`
            : `${knownCode.description} does not typically require prior authorization.`,
          documentation_required: knownCode.documentation_required,
          estimated_approval_time: knownCode.typical_approval_time,
          appeal_process: "Submit reconsideration within 60 days if denied",
          source: "fallback"
        };
      }
      return {
        cpt_code,
        requires_prior_auth: false,
        confidence: "low" as const,
        reason: "Unable to determine — database not connected. Verify with payer.",
        documentation_required: ["Clinical indication", "Supporting ICD-10 codes"],
        estimated_approval_time: "Unknown",
        appeal_process: "Submit reconsideration within 60 days if denied",
        source: "fallback"
      };
    }

    const { data, error } = await withTimeout(
      db.from("cms_prior_auth_codes")
        .select("code, description, requires_prior_auth, documentation_required, typical_approval_time, category")
        .eq("code", cpt_code)
        .eq("payer_type", "medicare")
        .limit(1),
      MCP_LOOKUP_TIMEOUT_MS,
      "Prior auth check"
    );

    if (error) {
      logger.error("Prior auth check failed", { errorMessage: error.message, cpt_code });
    }

    const record = ((data || []) as CMSPriorAuthRow[])[0];

    if (record) {
      return {
        cpt_code,
        requires_prior_auth: record.requires_prior_auth,
        confidence: "high" as const,
        reason: record.requires_prior_auth
          ? `${record.description} typically requires prior authorization under Medicare guidelines.`
          : `${record.description} does not typically require prior authorization.`,
        documentation_required: record.documentation_required ?? [],
        estimated_approval_time: record.typical_approval_time ?? "Varies",
        appeal_process: "Submit reconsideration within 60 days if denied",
        source: "database"
      };
    }

    // Heuristic fallback for codes not in our database
    const highCostPrefixes = ["27", "22", "63", "33"];
    const isLikelyHighCost = highCostPrefixes.some(prefix => cpt_code.startsWith(prefix));

    return {
      cpt_code,
      requires_prior_auth: isLikelyHighCost,
      confidence: "medium" as const,
      reason: isLikelyHighCost
        ? "This procedure code category typically requires prior authorization."
        : "This procedure code may not require prior authorization, but verify with payer.",
      documentation_required: ["Clinical indication", "Supporting ICD-10 codes", "Medical necessity statement"],
      estimated_approval_time: isLikelyHighCost ? "5-10 business days" : "N/A",
      appeal_process: "Submit reconsideration within 60 days if denied",
      source: "heuristic"
    };
  }

  //get_lcd_details
  //
  async function getLCDDetails(params: { lcd_id: string }) {
    const { lcd_id } = params;

    if (!dbAvailable) {
      return {
        lcd_id,
        title: `LCD ${lcd_id} — database not connected`,
        status: "unknown",
        source: "fallback"
      };
    }

    const { data: lcdData, error: lcdError } = await withTimeout(
      db.from("cms_lcds")
        .select("lcd_id, title, contractor_name, contractor_number, jurisdiction, status, effective_date, revision_date, related_codes, coverage_indications, limitations, summary, benefit_category")
        .eq("lcd_id", lcd_id)
        .limit(1),
      MCP_LOOKUP_TIMEOUT_MS,
      "LCD details lookup"
    );

    if (lcdError) {
      logger.error("LCD details lookup failed", { errorMessage: lcdError.message, lcd_id });
      return { lcd_id, error: lcdError.message };
    }

    const lcd = ((lcdData || []) as CMSLCDRow[])[0];
    if (!lcd) {
      return { lcd_id, error: `LCD ${lcd_id} not found` };
    }

    // Fetch related articles
    const { data: articleData } = await withTimeout(
      db.from("cms_coverage_articles")
        .select("article_id, title, article_type")
        .eq("related_lcd_id", lcd_id)
        .limit(10),
      MCP_LOOKUP_TIMEOUT_MS,
      "LCD articles lookup"
    );

    const articles = (articleData || []) as Array<{ article_id: string; title: string; article_type: string }>;

    return {
      lcd_id: lcd.lcd_id,
      title: lcd.title,
      contractor: lcd.contractor_name ?? "Unknown",
      contractor_number: lcd.contractor_number ?? "Unknown",
      jurisdiction: lcd.jurisdiction ?? "",
      status: lcd.status,
      effective_date: lcd.effective_date,
      revision_date: lcd.revision_date,
      benefit_category: lcd.benefit_category ?? "",
      coverage_indications: lcd.coverage_indications ?? [],
      limitations: lcd.limitations ?? [],
      summary: lcd.summary ?? "",
      hcpcs_codes: lcd.related_codes ?? [],
      related_articles: articles.map(a => ({
        article_id: a.article_id,
        title: a.title,
        type: a.article_type
      })),
      source: "database"
    };
  }

  //get_ncd_details
  //
  async function getNCDDetails(params: { ncd_id: string }) {
    const { ncd_id } = params;

    if (!dbAvailable) {
      return {
        ncd_id,
        title: `NCD ${ncd_id} — database not connected`,
        status: "unknown",
        source: "fallback"
      };
    }

    const { data, error } = await withTimeout(
      db.from("cms_ncds")
        .select("ncd_id, title, manual_section, status, effective_date, implementation_date, benefit_category, coverage_provisions, covered_indications, non_covered_indications, documentation_requirements, related_lcd_ids")
        .eq("ncd_id", ncd_id)
        .limit(1),
      MCP_LOOKUP_TIMEOUT_MS,
      "NCD details lookup"
    );

    if (error) {
      logger.error("NCD details lookup failed", { errorMessage: error.message, ncd_id });
      return { ncd_id, error: error.message };
    }

    const ncd = ((data || []) as CMSNCDRow[])[0];
    if (!ncd) {
      return { ncd_id, error: `NCD ${ncd_id} not found` };
    }

    return {
      ncd_id: ncd.ncd_id,
      title: ncd.title,
      manual_section: ncd.manual_section ?? "",
      status: ncd.status,
      effective_date: ncd.effective_date,
      implementation_date: ncd.implementation_date,
      benefit_category: ncd.benefit_category ?? "",
      coverage_provisions: ncd.coverage_provisions ?? "",
      covered_indications: ncd.covered_indications ?? [],
      non_covered_indications: ncd.non_covered_indications ?? [],
      documentation_requirements: ncd.documentation_requirements ?? [],
      related_lcd_ids: ncd.related_lcd_ids ?? [],
      source: "database"
    };
  }

  //get_coverage_articles
  //
  async function getCoverageArticles(params: { code: string; article_type?: string }) {
    const { code, article_type = "all" } = params;

    if (!dbAvailable) {
      return { articles: [], source: "fallback" };
    }

    let dbQuery = db
      .from("cms_coverage_articles")
      .select("article_id, title, article_type, related_lcd_id, related_codes, content, contractor_name, effective_date")
      .contains("related_codes", [code.toUpperCase()])
      .limit(20);

    if (article_type !== "all") {
      dbQuery = dbQuery.eq("article_type", article_type);
    }

    const { data, error } = await withTimeout(
      dbQuery,
      MCP_QUERY_TIMEOUT_MS,
      "Coverage articles lookup"
    );

    if (error) {
      logger.error("Coverage articles lookup failed", { errorMessage: error.message, code });
      return { articles: [], error: error.message };
    }

    const articles = (data || []) as CMSArticleRow[];
    logger.info("Coverage articles lookup completed", { code, results: articles.length });

    return {
      articles: articles.map(a => ({
        article_id: a.article_id,
        type: a.article_type,
        title: a.title,
        content: a.content ?? "",
        related_lcd_id: a.related_lcd_id ?? "",
        contractor: a.contractor_name ?? "",
        effective_date: a.effective_date
      })),
      source: "database"
    };
  }

  //get_mac_contractors
  //
  async function getMACContractors(params: { state: string; jurisdiction?: string }) {
    const { state, jurisdiction } = params;
    const stateUpper = state.toUpperCase();

    if (!dbAvailable) {
      // Fallback to hardcoded data
      const contractorInfo = FALLBACK_MAC_CONTRACTORS[stateUpper];
      if (contractorInfo) {
        return { state: stateUpper, contractors: contractorInfo, source: "fallback" };
      }
      return {
        state: stateUpper,
        contractors: {
          part_a_b: { name: "Check CMS.gov for your jurisdiction", number: "Unknown" },
          dme: { name: "Check CMS.gov for your jurisdiction", number: "Unknown" }
        },
        source: "fallback"
      };
    }

    let dbQuery = db
      .from("cms_mac_contractors")
      .select("state_code, jurisdiction_type, contractor_name, contractor_number, jurisdiction_label")
      .eq("state_code", stateUpper);

    if (jurisdiction) {
      dbQuery = dbQuery.eq("jurisdiction_type", jurisdiction);
    }

    const { data, error } = await withTimeout(
      dbQuery,
      MCP_LOOKUP_TIMEOUT_MS,
      "MAC contractor lookup"
    );

    if (error) {
      logger.error("MAC contractor lookup failed", { errorMessage: error.message, state: stateUpper });
      // Fall back to hardcoded
      const contractorInfo = FALLBACK_MAC_CONTRACTORS[stateUpper];
      if (contractorInfo) {
        return { state: stateUpper, contractors: contractorInfo, source: "fallback" };
      }
      return { state: stateUpper, error: error.message };
    }

    const rows = (data || []) as CMSMACRow[];

    if (rows.length === 0) {
      return {
        state: stateUpper,
        contractors: {
          part_a_b: { name: "Not found — check CMS.gov", number: "Unknown" },
          dme: { name: "Not found — check CMS.gov", number: "Unknown" }
        },
        source: "database"
      };
    }

    // Build structured response
    const partAB = rows.find(r => r.jurisdiction_type === "part_a_b");
    const dme = rows.find(r => r.jurisdiction_type === "dme");

    return {
      state: stateUpper,
      contractors: {
        part_a_b: partAB
          ? { name: partAB.contractor_name, number: partAB.contractor_number, jurisdiction: partAB.jurisdiction_label ?? "" }
          : { name: "Not found", number: "Unknown" },
        dme: dme
          ? { name: dme.contractor_name, number: dme.contractor_number, jurisdiction: dme.jurisdiction_label ?? "" }
          : { name: "Not found", number: "Unknown" }
      },
      source: "database"
    };
  }

  //Dispatcher
  //
  async function handleToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "search_lcd":
        return searchLCD(args as Parameters<typeof searchLCD>[0]);
      case "search_ncd":
        return searchNCD(args as Parameters<typeof searchNCD>[0]);
      case "get_coverage_requirements":
        return getCoverageRequirements(args as Parameters<typeof getCoverageRequirements>[0]);
      case "check_prior_auth_required":
        return checkPriorAuthRequired(args as Parameters<typeof checkPriorAuthRequired>[0]);
      case "get_lcd_details":
        return getLCDDetails(args as Parameters<typeof getLCDDetails>[0]);
      case "get_ncd_details":
        return getNCDDetails(args as Parameters<typeof getNCDDetails>[0]);
      case "get_coverage_articles":
        return getCoverageArticles(args as Parameters<typeof getCoverageArticles>[0]);
      case "get_mac_contractors":
        return getMACContractors(args as Parameters<typeof getMACContractors>[0]);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  return { handleToolCall };
}
