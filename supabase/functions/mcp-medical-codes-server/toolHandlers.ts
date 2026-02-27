// =====================================================
// MCP Medical Codes Server — Tool Handlers
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { CPTCode, ICD10Code, HCPCSCode, CodeSuggestions } from "./types.ts";
import { SDOH_CODES, checkBundling } from "./codeData.ts";
import { handlePing } from "../_shared/mcpServerBase.ts";

interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  debug(event: string, data?: Record<string, unknown>): void;
}

export function createToolHandlers(sb: SupabaseClient, logger: MCPLogger) {

  // Audit logging with graceful degradation
  async function logCodeLookup(params: {
    userId?: string;
    tool: string;
    query?: string;
    codesReturned: number;
    executionTimeMs: number;
  }) {
    try {
      const { error } = await sb.from("mcp_code_lookup_logs").insert({
        user_id: params.userId,
        tool_name: params.tool,
        search_query: params.query,
        codes_returned: params.codesReturned,
        execution_time_ms: params.executionTimeMs,
        created_at: new Date().toISOString()
      });

      if (error) {
        logger.debug("Audit log skipped (RLS restriction)", {
          tool: params.tool,
          error: error.message
        });
      }
    } catch (err: unknown) {
      logger.debug("Audit log failed", {
        tool: params.tool,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  // Search functions
  async function searchCPT(query: string, category?: string, limit = 20, client: SupabaseClient = sb): Promise<CPTCode[]> {
    let queryBuilder = client
      .from('code_cpt')
      .select('code, short_description, long_description, category, work_rvu, facility_rvu')
      .or(`code.ilike.%${query}%,short_description.ilike.%${query}%,long_description.ilike.%${query}%`)
      .limit(limit);

    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      const { data: altData, error: altError } = await client
        .from('cpt_codes')
        .select('*')
        .or(`code.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(limit);

      if (altError) throw new Error(`CPT search failed: ${error.message}`);
      return altData || [];
    }

    return data || [];
  }

  async function searchICD10(query: string, chapter?: string, limit = 20, client: SupabaseClient = sb): Promise<ICD10Code[]> {
    let queryBuilder = client
      .from('code_icd10')
      .select('code, description, chapter, category, is_billable')
      .or(`code.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(limit);

    if (chapter) {
      queryBuilder = queryBuilder.eq('chapter', chapter);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      const { data: altData, error: altError } = await client
        .from('icd10_codes')
        .select('*')
        .or(`code.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(limit);

      if (altError) throw new Error(`ICD-10 search failed: ${error.message}`);
      return altData || [];
    }

    return data || [];
  }

  async function searchHCPCS(query: string, level?: string, limit = 20, client: SupabaseClient = sb): Promise<HCPCSCode[]> {
    let queryBuilder = client
      .from('code_hcpcs')
      .select('code, short_description, long_description, level, pricing_indicator')
      .or(`code.ilike.%${query}%,short_description.ilike.%${query}%,long_description.ilike.%${query}%`)
      .limit(limit);

    if (level) {
      queryBuilder = queryBuilder.eq('level', level);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      const { data: altData, error: altError } = await client
        .from('hcpcs_codes')
        .select('*')
        .or(`code.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(limit);

      if (altError) throw new Error(`HCPCS search failed: ${error.message}`);
      return altData || [];
    }

    return data || [];
  }

  async function getModifiers(code: string, codeType?: string, client: SupabaseClient = sb) {
    const { data, error } = await client
      .from('code_modifiers')
      .select('modifier, description, applies_to')
      .or(`applies_to.cs.{${codeType || 'cpt'}},applies_to.cs.{all}`)
      .limit(50);

    if (error) {
      return [
        { modifier: "25", description: "Significant, separately identifiable E/M service", applies_to: ["cpt"] },
        { modifier: "26", description: "Professional component", applies_to: ["cpt"] },
        { modifier: "59", description: "Distinct procedural service", applies_to: ["cpt"] },
        { modifier: "76", description: "Repeat procedure by same physician", applies_to: ["cpt"] },
        { modifier: "77", description: "Repeat procedure by another physician", applies_to: ["cpt"] },
        { modifier: "LT", description: "Left side", applies_to: ["cpt", "hcpcs"] },
        { modifier: "RT", description: "Right side", applies_to: ["cpt", "hcpcs"] },
        { modifier: "TC", description: "Technical component", applies_to: ["cpt"] },
      ];
    }

    return data || [];
  }

  // Main dispatcher
  async function handleToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
    userClient: SupabaseClient,
    serverConfig: { name: string; version: string; tier: string },
    initResult: unknown,
    callerId?: string
  ): Promise<{ result: unknown; codesReturned: number }> {
    let result: unknown;
    let codesReturned = 0;

    switch (toolName) {
      case "ping": {
        result = handlePing(serverConfig as { name: string; version: string; tier: "external_api" | "user_scoped" | "admin" }, initResult as { supabase: SupabaseClient | null; logger: MCPLogger; canRateLimit: boolean });
        break;
      }

      case "search_cpt": {
        const { query, category, limit } = toolArgs;
        const cptResults = await searchCPT(query as string, category as string | undefined, limit as number | undefined, userClient);
        result = cptResults;
        codesReturned = cptResults.length;
        break;
      }

      case "search_icd10": {
        const { query, chapter, limit } = toolArgs;
        const icd10Results = await searchICD10(query as string, chapter as string | undefined, limit as number | undefined, userClient);
        result = icd10Results;
        codesReturned = icd10Results.length;
        break;
      }

      case "search_hcpcs": {
        const { query, level, limit } = toolArgs;
        const hcpcsResults = await searchHCPCS(query as string, level as string | undefined, limit as number | undefined, userClient);
        result = hcpcsResults;
        codesReturned = hcpcsResults.length;
        break;
      }

      case "get_modifiers": {
        const { code, code_type } = toolArgs;
        const modifierResults = await getModifiers(code as string, code_type as string | undefined, userClient);
        result = modifierResults;
        codesReturned = modifierResults.length;
        break;
      }

      case "validate_code_combination": {
        const { cpt_codes, icd10_codes } = toolArgs;
        const cptArr = cpt_codes as string[];
        const icdArr = icd10_codes as string[];

        const cptValidation = await Promise.all(
          cptArr.map(async (code: string) => {
            const results = await searchCPT(code, undefined, 1, userClient);
            return { code, valid: results.length > 0 };
          })
        );

        const icdValidation = await Promise.all(
          icdArr.map(async (code: string) => {
            const results = await searchICD10(code, undefined, 1, userClient);
            return { code, valid: results.length > 0 };
          })
        );

        const bundlingIssues = checkBundling(cptArr);

        result = {
          cpt_validation: cptValidation,
          icd10_validation: icdValidation,
          bundling_issues: bundlingIssues,
          is_valid: cptValidation.every(v => v.valid) &&
                    icdValidation.every(v => v.valid) &&
                    bundlingIssues.length === 0
        };
        codesReturned = cptArr.length + icdArr.length;
        break;
      }

      case "check_bundling": {
        const { cpt_codes } = toolArgs;
        const codes = cpt_codes as string[];
        result = checkBundling(codes);
        codesReturned = codes.length;
        break;
      }

      case "get_code_details": {
        const { code, code_type } = toolArgs;
        let detailResults: unknown[];

        switch (code_type) {
          case "cpt":
            detailResults = await searchCPT(code as string, undefined, 1, userClient);
            break;
          case "icd10":
            detailResults = await searchICD10(code as string, undefined, 1, userClient);
            break;
          case "hcpcs":
            detailResults = await searchHCPCS(code as string, undefined, 1, userClient);
            break;
          default:
            throw new Error(`Invalid code_type: ${code_type}`);
        }

        result = detailResults[0] || null;
        codesReturned = result ? 1 : 0;
        break;
      }

      case "suggest_codes": {
        const { description, code_types = ["cpt", "icd10"], limit = 5 } = toolArgs;
        const typesArr = code_types as string[];
        const suggestions: CodeSuggestions = {};

        if (typesArr.includes("cpt")) {
          suggestions.cpt = await searchCPT(description as string, undefined, limit as number, userClient);
        }
        if (typesArr.includes("icd10")) {
          suggestions.icd10 = await searchICD10(description as string, undefined, limit as number, userClient);
        }
        if (typesArr.includes("hcpcs")) {
          suggestions.hcpcs = await searchHCPCS(description as string, undefined, limit as number, userClient);
        }

        result = suggestions;
        codesReturned = Object.values(suggestions).flat().length;
        break;
      }

      case "get_sdoh_codes": {
        const { category = "all" } = toolArgs;

        if (category === "all") {
          result = SDOH_CODES;
          codesReturned = Object.values(SDOH_CODES).flat().length;
        } else if (SDOH_CODES[category as string]) {
          result = { [category as string]: SDOH_CODES[category as string] };
          codesReturned = SDOH_CODES[category as string].length;
        } else {
          throw new Error(`Invalid SDOH category: ${category}`);
        }
        break;
      }

      default:
        throw new Error(`Tool ${toolName} not implemented`);
    }

    // Audit log
    const startTime = Date.now();
    await logCodeLookup({
      userId: callerId,
      tool: toolName,
      query: (toolArgs.query || toolArgs.description || toolArgs.code) as string | undefined,
      codesReturned,
      executionTimeMs: Date.now() - startTime
    });

    return { result, codesReturned };
  }

  return { handleToolCall };
}
