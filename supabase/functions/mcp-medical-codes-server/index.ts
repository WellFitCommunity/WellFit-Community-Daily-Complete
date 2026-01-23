// =====================================================
// MCP Medical Codes Server
// Purpose: Unified access to CPT, ICD-10, HCPCS, and modifier codes
// Features: Smart search, code validation, bundling rules, audit logging
// =====================================================

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkMCPRateLimit, getRequestIdentifier, createRateLimitResponse, MCP_RATE_LIMITS } from "../_shared/mcpRateLimiter.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("mcp-medical-codes-server");

// =====================================================
// Type Definitions for Medical Codes
// =====================================================

interface CPTCode {
  code: string;
  short_description?: string;
  long_description?: string;
  category?: string;
  work_rvu?: number;
  facility_rvu?: number;
  description?: string; // alternate table
}

interface ICD10Code {
  code: string;
  description: string;
  chapter?: string;
  category?: string;
  is_billable?: boolean;
}

interface HCPCSCode {
  code: string;
  short_description?: string;
  long_description?: string;
  level?: string;
  pricing_indicator?: string;
}

type MedicalCode = CPTCode | ICD10Code | HCPCSCode;

interface CodeSuggestions {
  cpt?: CPTCode[];
  icd10?: ICD10Code[];
  hcpcs?: HCPCSCode[];
}

// Environment
const SERVICE_KEY = SB_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase credentials");

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// =====================================================
// MCP Tools Definition
// =====================================================

const TOOLS = {
  "search_cpt": {
    description: "Search CPT (Current Procedural Terminology) codes",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (description or code)" },
        category: { type: "string", description: "Category filter (e.g., 'Surgery', 'E/M')" },
        limit: { type: "number", description: "Max results (default 20)" }
      },
      required: ["query"]
    }
  },
  "search_icd10": {
    description: "Search ICD-10 diagnosis codes",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (description or code)" },
        chapter: { type: "string", description: "ICD-10 chapter filter" },
        limit: { type: "number", description: "Max results (default 20)" }
      },
      required: ["query"]
    }
  },
  "search_hcpcs": {
    description: "Search HCPCS (Healthcare Common Procedure Coding System) codes",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (description or code)" },
        level: { type: "string", description: "Level filter (I or II)" },
        limit: { type: "number", description: "Max results (default 20)" }
      },
      required: ["query"]
    }
  },
  "get_modifiers": {
    description: "Get applicable modifiers for a CPT/HCPCS code",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "CPT or HCPCS code" },
        code_type: { type: "string", enum: ["cpt", "hcpcs"], description: "Code type" }
      },
      required: ["code"]
    }
  },
  "validate_code_combination": {
    description: "Validate if CPT/ICD-10/modifier combination is valid",
    inputSchema: {
      type: "object",
      properties: {
        cpt_codes: { type: "array", items: { type: "string" }, description: "CPT codes" },
        icd10_codes: { type: "array", items: { type: "string" }, description: "ICD-10 codes" },
        modifiers: { type: "array", items: { type: "string" }, description: "Modifier codes" }
      },
      required: ["cpt_codes", "icd10_codes"]
    }
  },
  "check_bundling": {
    description: "Check for bundling/unbundling issues with CPT codes",
    inputSchema: {
      type: "object",
      properties: {
        cpt_codes: { type: "array", items: { type: "string" }, description: "List of CPT codes to check" }
      },
      required: ["cpt_codes"]
    }
  },
  "get_code_details": {
    description: "Get detailed information about a specific code",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "The code to look up" },
        code_type: { type: "string", enum: ["cpt", "icd10", "hcpcs"], description: "Type of code" }
      },
      required: ["code", "code_type"]
    }
  },
  "suggest_codes": {
    description: "Suggest codes based on clinical description",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Clinical description or scenario" },
        code_types: {
          type: "array",
          items: { type: "string", enum: ["cpt", "icd10", "hcpcs"] },
          description: "Types of codes to suggest"
        },
        limit: { type: "number", description: "Max suggestions per type (default 5)" }
      },
      required: ["description"]
    }
  },
  "get_sdoh_codes": {
    description: "Get ICD-10 Z-codes for Social Determinants of Health",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "SDOH category (housing, food, transportation, employment, education, social)",
          enum: ["housing", "food", "transportation", "employment", "education", "social", "all"]
        }
      },
      required: []
    }
  }
};

// =====================================================
// SDOH Z-Code Mappings
// =====================================================

const SDOH_CODES: Record<string, Array<{ code: string; description: string }>> = {
  housing: [
    { code: "Z59.0", description: "Homelessness" },
    { code: "Z59.1", description: "Inadequate housing" },
    { code: "Z59.2", description: "Discord with neighbors, lodgers and landlord" },
    { code: "Z59.3", description: "Problems related to living in residential institution" },
    { code: "Z59.41", description: "Food insecurity" },
    { code: "Z59.48", description: "Other specified lack of adequate food" },
    { code: "Z59.5", description: "Extreme poverty" },
    { code: "Z59.6", description: "Low income" },
    { code: "Z59.7", description: "Insufficient social insurance and welfare support" },
    { code: "Z59.81", description: "Housing instability, housed" },
    { code: "Z59.811", description: "Housing instability, housed, with risk of homelessness" },
    { code: "Z59.812", description: "Housing instability, housed, homelessness in past 12 months" },
    { code: "Z59.819", description: "Housing instability, housed, unspecified" },
    { code: "Z59.89", description: "Other problems related to housing and economic circumstances" },
  ],
  food: [
    { code: "Z59.41", description: "Food insecurity" },
    { code: "Z59.48", description: "Other specified lack of adequate food" },
    { code: "E63.9", description: "Nutritional deficiency, unspecified" },
    { code: "E46", description: "Unspecified protein-calorie malnutrition" },
  ],
  transportation: [
    { code: "Z59.82", description: "Transportation insecurity" },
    { code: "Z75.3", description: "Unavailability and inaccessibility of health-care facilities" },
  ],
  employment: [
    { code: "Z56.0", description: "Unemployment, unspecified" },
    { code: "Z56.1", description: "Change of job" },
    { code: "Z56.2", description: "Threat of job loss" },
    { code: "Z56.3", description: "Stressful work schedule" },
    { code: "Z56.4", description: "Discord with boss and workmates" },
    { code: "Z56.5", description: "Uncongenial work environment" },
    { code: "Z56.6", description: "Other physical and mental strain related to work" },
    { code: "Z56.81", description: "Sexual harassment on the job" },
    { code: "Z56.82", description: "Military deployment status" },
    { code: "Z56.89", description: "Other problems related to employment" },
  ],
  education: [
    { code: "Z55.0", description: "Illiteracy and low-level literacy" },
    { code: "Z55.1", description: "Schooling unavailable and unattainable" },
    { code: "Z55.2", description: "Failed school examinations" },
    { code: "Z55.3", description: "Underachievement in school" },
    { code: "Z55.4", description: "Educational maladjustment and discord with teachers and classmates" },
    { code: "Z55.5", description: "Less than a high school diploma" },
    { code: "Z55.8", description: "Other problems related to education and literacy" },
  ],
  social: [
    { code: "Z60.0", description: "Problems of adjustment to life-cycle transitions" },
    { code: "Z60.2", description: "Problems related to living alone" },
    { code: "Z60.3", description: "Acculturation difficulty" },
    { code: "Z60.4", description: "Social exclusion and rejection" },
    { code: "Z60.5", description: "Target of (perceived) adverse discrimination and persecution" },
    { code: "Z60.8", description: "Other problems related to social environment" },
    { code: "Z63.0", description: "Problems in relationship with spouse or partner" },
    { code: "Z63.4", description: "Disappearance and death of family member" },
    { code: "Z63.5", description: "Disruption of family by separation and divorce" },
    { code: "Z63.6", description: "Dependent relative needing care at home" },
    { code: "Z63.71", description: "Stress on family due to return of family member from military deployment" },
    { code: "Z63.72", description: "Alcoholism and drug addiction in family" },
    { code: "Z63.79", description: "Other stressful life events affecting family and household" },
    { code: "Z65.4", description: "Victim of crime and terrorism" },
  ]
};

// =====================================================
// Common Bundling Rules (simplified)
// =====================================================

const BUNDLING_RULES: Array<{
  column1: string;
  column2: string;
  modifier: string | null;
  description: string;
}> = [
  { column1: "99213", column2: "99214", modifier: null, description: "Cannot bill multiple E/M codes same day same provider" },
  { column1: "99213", column2: "99215", modifier: null, description: "Cannot bill multiple E/M codes same day same provider" },
  { column1: "99214", column2: "99215", modifier: null, description: "Cannot bill multiple E/M codes same day same provider" },
  { column1: "36415", column2: "36416", modifier: null, description: "Blood draw codes bundle together" },
  { column1: "81000", column2: "81001", modifier: null, description: "Urinalysis codes bundle" },
  { column1: "81002", column2: "81003", modifier: null, description: "Urinalysis codes bundle" },
  { column1: "99201", column2: "99211", modifier: "25", description: "New patient and established patient codes need modifier 25" },
];

// =====================================================
// Audit Logging
// =====================================================

async function logCodeLookup(params: {
  userId?: string;
  tool: string;
  query?: string;
  codesReturned: number;
  executionTimeMs: number;
}) {
  try {
    await sb.from("mcp_code_lookup_logs").insert({
      user_id: params.userId,
      tool_name: params.tool,
      search_query: params.query,
      codes_returned: params.codesReturned,
      execution_time_ms: params.executionTimeMs,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    // Fallback to claude_usage_logs
    try {
      await sb.from("claude_usage_logs").insert({
        user_id: params.userId,
        request_id: crypto.randomUUID(),
        request_type: `mcp_medical_code_${params.tool}`,
        response_time_ms: params.executionTimeMs,
        success: true,
        created_at: new Date().toISOString()
      });
    } catch (innerErr: unknown) {
      logger.error("Audit log fallback failed", {
        originalError: err instanceof Error ? err.message : String(err),
        fallbackError: innerErr instanceof Error ? innerErr.message : String(innerErr)
      });
    }
  }
}

// =====================================================
// Search Functions
// =====================================================

async function searchCPT(query: string, category?: string, limit = 20): Promise<CPTCode[]> {
  let queryBuilder = sb
    .from('code_cpt')
    .select('code, short_description, long_description, category, work_rvu, facility_rvu')
    .or(`code.ilike.%${query}%,short_description.ilike.%${query}%,long_description.ilike.%${query}%`)
    .limit(limit);

  if (category) {
    queryBuilder = queryBuilder.eq('category', category);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    // Try alternate table name
    const { data: altData, error: altError } = await sb
      .from('cpt_codes')
      .select('*')
      .or(`code.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(limit);

    if (altError) throw new Error(`CPT search failed: ${error.message}`);
    return altData || [];
  }

  return data || [];
}

async function searchICD10(query: string, chapter?: string, limit = 20): Promise<ICD10Code[]> {
  let queryBuilder = sb
    .from('code_icd10')
    .select('code, description, chapter, category, is_billable')
    .or(`code.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(limit);

  if (chapter) {
    queryBuilder = queryBuilder.eq('chapter', chapter);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    // Try alternate table name
    const { data: altData, error: altError } = await sb
      .from('icd10_codes')
      .select('*')
      .or(`code.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(limit);

    if (altError) throw new Error(`ICD-10 search failed: ${error.message}`);
    return altData || [];
  }

  return data || [];
}

async function searchHCPCS(query: string, level?: string, limit = 20): Promise<HCPCSCode[]> {
  let queryBuilder = sb
    .from('code_hcpcs')
    .select('code, short_description, long_description, level, pricing_indicator')
    .or(`code.ilike.%${query}%,short_description.ilike.%${query}%,long_description.ilike.%${query}%`)
    .limit(limit);

  if (level) {
    queryBuilder = queryBuilder.eq('level', level);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    // Try alternate table name
    const { data: altData, error: altError } = await sb
      .from('hcpcs_codes')
      .select('*')
      .or(`code.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(limit);

    if (altError) throw new Error(`HCPCS search failed: ${error.message}`);
    return altData || [];
  }

  return data || [];
}

async function getModifiers(code: string, codeType?: string) {
  const { data, error } = await sb
    .from('code_modifiers')
    .select('modifier, description, applies_to')
    .or(`applies_to.cs.{${codeType || 'cpt'}},applies_to.cs.{all}`)
    .limit(50);

  if (error) {
    // Return common modifiers as fallback
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

function checkBundling(cptCodes: string[]): Array<{ codes: string[]; issue: string; suggestion: string }> {
  const issues: Array<{ codes: string[]; issue: string; suggestion: string }> = [];

  for (const rule of BUNDLING_RULES) {
    if (cptCodes.includes(rule.column1) && cptCodes.includes(rule.column2)) {
      issues.push({
        codes: [rule.column1, rule.column2],
        issue: rule.description,
        suggestion: rule.modifier
          ? `Add modifier ${rule.modifier} to separate the services`
          : `Remove one of the codes or document medical necessity`
      });
    }
  }

  // Check for duplicate codes
  const codeCounts = cptCodes.reduce((acc, code) => {
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  for (const [code, count] of Object.entries(codeCounts)) {
    if (count > 1) {
      issues.push({
        codes: [code],
        issue: `Code ${code} appears ${count} times`,
        suggestion: `Add modifier 76 or 77 for repeat procedures, or combine units`
      });
    }
  }

  return issues;
}

// =====================================================
// Request Handler
// =====================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // Rate limiting
  const identifier = getRequestIdentifier(req);
  const rateLimitResult = checkMCPRateLimit(identifier, MCP_RATE_LIMITS.medicalCodes);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, MCP_RATE_LIMITS.medicalCodes, corsHeaders);
  }

  try {
    const body = await req.json();
    const { method, params, id } = body;

    // MCP Protocol: Initialize handshake
    if (method === "initialize") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "mcp-medical-codes-server",
            version: "1.0.0"
          },
          capabilities: {
            tools: {}
          }
        },
        id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: List tools
    if (method === "tools/list") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          tools: Object.entries(TOOLS).map(([name, def]) => ({ name, ...def }))
        },
        id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: Call tool
    if (method === "tools/call") {
      const { name: toolName, arguments: toolArgs } = params;
      const startTime = Date.now();

      if (!TOOLS[toolName as keyof typeof TOOLS]) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      let result: unknown;
      let codesReturned = 0;

      switch (toolName) {
        case "search_cpt": {
          const { query, category, limit } = toolArgs;
          result = await searchCPT(query, category, limit);
          codesReturned = result.length;
          break;
        }

        case "search_icd10": {
          const { query, chapter, limit } = toolArgs;
          result = await searchICD10(query, chapter, limit);
          codesReturned = result.length;
          break;
        }

        case "search_hcpcs": {
          const { query, level, limit } = toolArgs;
          result = await searchHCPCS(query, level, limit);
          codesReturned = result.length;
          break;
        }

        case "get_modifiers": {
          const { code, code_type } = toolArgs;
          result = await getModifiers(code, code_type);
          codesReturned = result.length;
          break;
        }

        case "validate_code_combination": {
          const { cpt_codes, icd10_codes, modifiers } = toolArgs;

          // Validate CPT codes exist
          const cptValidation = await Promise.all(
            cpt_codes.map(async (code: string) => {
              const results = await searchCPT(code, undefined, 1);
              return { code, valid: results.length > 0 };
            })
          );

          // Validate ICD-10 codes exist
          const icdValidation = await Promise.all(
            icd10_codes.map(async (code: string) => {
              const results = await searchICD10(code, undefined, 1);
              return { code, valid: results.length > 0 };
            })
          );

          // Check bundling
          const bundlingIssues = checkBundling(cpt_codes);

          result = {
            cpt_validation: cptValidation,
            icd10_validation: icdValidation,
            bundling_issues: bundlingIssues,
            is_valid: cptValidation.every(v => v.valid) &&
                      icdValidation.every(v => v.valid) &&
                      bundlingIssues.length === 0
          };
          codesReturned = cpt_codes.length + icd10_codes.length;
          break;
        }

        case "check_bundling": {
          const { cpt_codes } = toolArgs;
          result = checkBundling(cpt_codes);
          codesReturned = cpt_codes.length;
          break;
        }

        case "get_code_details": {
          const { code, code_type } = toolArgs;

          switch (code_type) {
            case "cpt":
              result = await searchCPT(code, undefined, 1);
              break;
            case "icd10":
              result = await searchICD10(code, undefined, 1);
              break;
            case "hcpcs":
              result = await searchHCPCS(code, undefined, 1);
              break;
            default:
              throw new Error(`Invalid code_type: ${code_type}`);
          }

          result = result[0] || null;
          codesReturned = result ? 1 : 0;
          break;
        }

        case "suggest_codes": {
          const { description, code_types = ["cpt", "icd10"], limit = 5 } = toolArgs;

          const suggestions: CodeSuggestions = {};

          if (code_types.includes("cpt")) {
            suggestions.cpt = await searchCPT(description, undefined, limit);
          }
          if (code_types.includes("icd10")) {
            suggestions.icd10 = await searchICD10(description, undefined, limit);
          }
          if (code_types.includes("hcpcs")) {
            suggestions.hcpcs = await searchHCPCS(description, undefined, limit);
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
          } else if (SDOH_CODES[category]) {
            result = { [category]: SDOH_CODES[category] };
            codesReturned = SDOH_CODES[category].length;
          } else {
            throw new Error(`Invalid SDOH category: ${category}`);
          }
          break;
        }

        default:
          throw new Error(`Tool ${toolName} not implemented`);
      }

      const executionTimeMs = Date.now() - startTime;

      // Audit log
      await logCodeLookup({
        userId: toolArgs.userId,
        tool: toolName,
        query: toolArgs.query || toolArgs.description || toolArgs.code,
        codesReturned,
        executionTimeMs
      });

      return new Response(JSON.stringify({
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        metadata: {
          codesReturned,
          executionTimeMs,
          tool: toolName
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error(`Unknown MCP method: ${method}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({
      error: {
        code: "internal_error",
        message: errorMessage
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
