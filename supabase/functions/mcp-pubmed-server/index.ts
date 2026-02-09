// =====================================================
// MCP PubMed Literature Server
// Purpose: Biomedical literature search via NCBI PubMed E-utilities
// Features: Article search, abstracts, citations, clinical trials, MeSH terms
// API: NCBI Entrez E-utilities (https://eutils.ncbi.nlm.nih.gov/entrez/eutils/)
//
// TIER 1 (external_api): No Supabase required - calls public NCBI API
// Auth: Supabase apikey header only (for edge function access)
// Rate limit: NCBI allows 3 req/sec without API key, 10 req/sec with key
//
// Architecture: index.ts (protocol) + pubmedTools.ts (tool handlers)
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { getRequestIdentifier } from "../_shared/mcpRateLimiter.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  createErrorResponse,
  handlePing,
  handleHealthCheck,
  checkInMemoryRateLimit,
  PING_TOOL
} from "../_shared/mcpServerBase.ts";
import { getRequestId } from "../_shared/mcpAuthGate.ts";
import {
  searchPubmed,
  getArticleSummary,
  getArticleAbstract,
  getArticleCitations,
  searchClinicalTrials,
  getMeshTerms
} from "./pubmedTools.ts";

// Initialize as Tier 1 (external_api) - no Supabase required
const SERVER_CONFIG = {
  name: "mcp-pubmed-server",
  version: "1.0.0",
  tier: "external_api" as const
};

const initResult = initMCPServer(SERVER_CONFIG);
const { logger } = initResult;

// =====================================================
// MCP Tools Definition
// =====================================================

const TOOLS = {
  "search_pubmed": {
    description: "Search PubMed for biomedical articles by keywords, MeSH terms, author, or date range. Returns structured article metadata.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (keywords, MeSH terms, author name, PMID)" },
        max_results: { type: "number", description: "Maximum results to return (default 20, max 100)" },
        sort: {
          type: "string",
          enum: ["relevance", "date"],
          description: "Sort order (default: relevance)"
        },
        date_from: { type: "string", description: "Start date filter (YYYY/MM/DD)" },
        date_to: { type: "string", description: "End date filter (YYYY/MM/DD)" },
        article_types: {
          type: "string",
          enum: ["review", "clinical-trial", "meta-analysis", "randomized-controlled-trial", "systematic-review", "case-reports"],
          description: "Filter by article type"
        }
      },
      required: ["query"]
    }
  },
  "get_article_summary": {
    description: "Get structured metadata (title, authors, journal, date, DOI) for one or more PubMed articles by PMID",
    inputSchema: {
      type: "object",
      properties: {
        pmids: { type: "string", description: "Comma-separated PubMed IDs (e.g., '12345678,23456789')" }
      },
      required: ["pmids"]
    }
  },
  "get_article_abstract": {
    description: "Get the full abstract text and MeSH terms for a single PubMed article",
    inputSchema: {
      type: "object",
      properties: {
        pmid: { type: "string", description: "Single PubMed ID (e.g., '12345678')" }
      },
      required: ["pmid"]
    }
  },
  "get_article_citations": {
    description: "Find articles that cite a given PubMed article (cited-by lookup)",
    inputSchema: {
      type: "object",
      properties: {
        pmid: { type: "string", description: "PubMed ID of the source article" },
        max_results: { type: "number", description: "Maximum citing articles to return (default 20, max 100)" }
      },
      required: ["pmid"]
    }
  },
  "search_clinical_trials": {
    description: "Search PubMed for clinical trial publications by condition, intervention, or keywords",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (condition, drug, intervention)" },
        max_results: { type: "number", description: "Maximum results (default 20, max 100)" },
        phase: {
          type: "string",
          enum: ["phase-1", "phase-2", "phase-3", "phase-4"],
          description: "Clinical trial phase filter"
        }
      },
      required: ["query"]
    }
  },
  "get_mesh_terms": {
    description: "Look up MeSH (Medical Subject Headings) vocabulary terms for a topic. Useful for building precise PubMed searches.",
    inputSchema: {
      type: "object",
      properties: {
        term: { type: "string", description: "Topic or term to look up in MeSH vocabulary" }
      },
      required: ["term"]
    }
  },
  "ping": PING_TOOL
};

// =====================================================
// MCP Protocol Handlers
// =====================================================

async function handleToolCallRequest(
  toolName: string,
  args: Record<string, unknown>
): Promise<Response> {
  let result: unknown;

  switch (toolName) {
    case "search_pubmed":
      result = await searchPubmed(args as Parameters<typeof searchPubmed>[0], logger);
      break;
    case "get_article_summary":
      result = await getArticleSummary(args as Parameters<typeof getArticleSummary>[0], logger);
      break;
    case "get_article_abstract":
      result = await getArticleAbstract(args as Parameters<typeof getArticleAbstract>[0], logger);
      break;
    case "get_article_citations":
      result = await getArticleCitations(args as Parameters<typeof getArticleCitations>[0], logger);
      break;
    case "search_clinical_trials":
      result = await searchClinicalTrials(args as Parameters<typeof searchClinicalTrials>[0], logger);
      break;
    case "get_mesh_terms":
      result = await getMeshTerms(args as Parameters<typeof getMeshTerms>[0], logger);
      break;
    default:
      return new Response(JSON.stringify({ error: `Unknown tool: ${toolName}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
  }

  return new Response(JSON.stringify({
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

// =====================================================
// Main Handler (MCP JSON-RPC Protocol)
// =====================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = getRequestId(req);

  // Handle GET /health for infrastructure monitoring
  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  try {
    // Rate limiting — conservative for NCBI (50 req/min to stay well under 3/sec)
    const identifier = getRequestIdentifier(req);
    const rateLimitResult = checkInMemoryRateLimit(identifier, 50, 60000);

    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Rate limit exceeded. NCBI allows max 3 requests/second." },
        id: null
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000))
        }
      });
    }

    // Parse JSON-RPC request
    const body = await req.json();
    const { method, params, id } = body;

    // Handle MCP JSON-RPC methods
    switch (method) {
      case "initialize": {
        return new Response(JSON.stringify(
          createInitializeResponse(SERVER_CONFIG, id)
        ), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "tools/list": {
        return new Response(JSON.stringify(
          createToolsListResponse(TOOLS, id)
        ), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "tools/call": {
        const { name, arguments: args } = params || {};
        const startTime = Date.now();

        logger.info("PubMed tool call", { tool: name });

        // Handle ping tool specially
        if (name === "ping") {
          const pingResult = handlePing(SERVER_CONFIG, { supabase: null, logger, canRateLimit: false });
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: JSON.stringify(pingResult, null, 2) }]
            },
            id
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const response = await handleToolCallRequest(name, args || {});
        const responseBody = await response.text();
        const result = JSON.parse(responseBody);

        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            ...result,
            metadata: {
              tool: name,
              executionTimeMs: Date.now() - startTime
            }
          },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        return new Response(JSON.stringify(
          createErrorResponse(-32601, `Method not found: ${method}`, id)
        ), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("PubMed server error", { errorMessage: error.message, requestId });

    const errorResponse = createErrorResponse(-32603, error.message, null);
    return new Response(JSON.stringify({
      ...errorResponse,
      error: {
        ...(errorResponse.error as Record<string, unknown>),
        data: { requestId }
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
