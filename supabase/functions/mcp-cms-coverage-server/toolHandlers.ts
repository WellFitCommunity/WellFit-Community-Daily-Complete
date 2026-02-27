// =====================================================
// MCP CMS Coverage Server — Tool Handlers
// =====================================================

import { COMMON_PRIOR_AUTH_CODES, MAC_CONTRACTORS } from "./coverageData.ts";

interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

export function createToolHandlers(logger: MCPLogger) {

  async function searchLCD(params: {
    query: string;
    state?: string;
    contractor_number?: string;
    status?: string;
    limit?: number;
  }) {
    const { query, state, status = "active", limit = 20 } = params;

    const mockLCDs = [
      {
        lcd_id: "L33777",
        title: `Local Coverage Determination for ${query}`,
        contractor: state ? MAC_CONTRACTORS[state]?.part_a_b.name : "Multiple MACs",
        contractor_number: state ? MAC_CONTRACTORS[state]?.part_a_b.number : "Various",
        status: status,
        effective_date: "2024-01-01",
        revision_date: "2025-06-15",
        related_codes: [query.toUpperCase()],
        summary: `Coverage is provided for ${query} when medical necessity criteria are met.`
      }
    ];

    await logger.info("LCD search completed", { query, state, results: mockLCDs.length });

    return {
      lcds: mockLCDs.slice(0, limit),
      total: mockLCDs.length
    };
  }

  async function searchNCD(params: {
    query: string;
    benefit_category?: string;
    status?: string;
    limit?: number;
  }) {
    const { query, status = "active", limit = 20 } = params;

    const mockNCDs = [
      {
        ncd_id: "220.6.1",
        title: `National Coverage Determination for ${query}`,
        status: status,
        effective_date: "2023-07-01",
        manual_section: "220.6",
        coverage_provisions: `Medicare covers ${query} when medically necessary and documented appropriately.`,
        indications: ["Medical necessity established", "Appropriate diagnosis"],
        limitations: ["Annual limits may apply", "Documentation requirements must be met"]
      }
    ];

    await logger.info("NCD search completed", { query, results: mockNCDs.length });

    return {
      ncds: mockNCDs.slice(0, limit),
      total: mockNCDs.length
    };
  }

  async function getCoverageRequirements(params: {
    code: string;
    state?: string;
    payer_type?: string;
  }) {
    const { code, payer_type = "medicare" } = params;
    const knownCode = COMMON_PRIOR_AUTH_CODES[code];

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
        lcd_references: [`L${Math.floor(Math.random() * 90000) + 10000}`],
        ncd_references: payer_type === "medicare" ? ["220.6"] : []
      };
    }

    return {
      code,
      description: `Procedure code ${code}`,
      coverage_status: "Coverage varies by indication",
      requirements: [
        "Medical necessity documentation required",
        "Check specific LCD for your MAC jurisdiction"
      ],
      documentation_needed: [
        "Clinical indication",
        "Supporting diagnosis codes",
        "Relevant medical history"
      ],
      lcd_references: [],
      ncd_references: []
    };
  }

  async function checkPriorAuthRequired(params: {
    cpt_code: string;
    icd10_codes?: string[];
    state?: string;
    place_of_service?: string;
  }) {
    const { cpt_code } = params;
    const knownCode = COMMON_PRIOR_AUTH_CODES[cpt_code];

    if (knownCode) {
      return {
        cpt_code,
        requires_prior_auth: knownCode.requires_prior_auth,
        confidence: "high",
        reason: knownCode.requires_prior_auth
          ? `${knownCode.description} typically requires prior authorization under Medicare guidelines.`
          : `${knownCode.description} does not typically require prior authorization.`,
        documentation_required: knownCode.documentation_required,
        estimated_approval_time: knownCode.typical_approval_time,
        appeal_process: "Submit reconsideration within 60 days if denied"
      };
    }

    const highCostIndicators = ["27", "22", "63", "33"];
    const isLikelyHighCost = highCostIndicators.some(prefix => cpt_code.startsWith(prefix));

    return {
      cpt_code,
      requires_prior_auth: isLikelyHighCost,
      confidence: "medium",
      reason: isLikelyHighCost
        ? "This procedure code category typically requires prior authorization."
        : "This procedure code may not require prior authorization, but verify with payer.",
      documentation_required: [
        "Clinical indication",
        "Supporting ICD-10 codes",
        "Medical necessity statement"
      ],
      estimated_approval_time: isLikelyHighCost ? "5-10 business days" : "N/A",
      appeal_process: "Submit reconsideration within 60 days if denied"
    };
  }

  async function getLCDDetails(params: { lcd_id: string }) {
    const { lcd_id } = params;

    return {
      lcd_id,
      title: `Local Coverage Determination ${lcd_id}`,
      contractor: "Multiple MACs",
      status: "active",
      effective_date: "2024-01-01",
      revision_history: [
        { date: "2024-01-01", change: "Initial publication" },
        { date: "2025-01-15", change: "Updated coverage criteria" }
      ],
      coverage_indications: [
        "Medical necessity established by appropriate diagnosis",
        "Treatment is reasonable and necessary"
      ],
      limitations: [
        "Coverage frequency limits may apply",
        "Documentation requirements must be met"
      ],
      related_articles: [`A${lcd_id.slice(1)}`],
      hcpcs_codes: []
    };
  }

  async function getNCDDetails(params: { ncd_id: string }) {
    const { ncd_id } = params;

    return {
      ncd_id,
      title: `National Coverage Determination ${ncd_id}`,
      manual_section: ncd_id.split(".")[0],
      status: "active",
      effective_date: "2023-01-01",
      coverage_provisions: "Medicare covers this service when medically necessary.",
      covered_indications: [
        "Appropriate clinical indication documented",
        "Patient meets eligibility criteria"
      ],
      non_covered_indications: [
        "Screening without symptoms (unless specifically covered)",
        "Experimental or investigational use"
      ],
      documentation_requirements: [
        "Written order from treating physician",
        "Medical necessity documentation",
        "Supporting clinical information"
      ]
    };
  }

  async function getCoverageArticles(params: { code: string; article_type?: string }) {
    const { code, article_type = "all" } = params;

    const articles = [
      {
        article_id: `A${Math.floor(Math.random() * 90000) + 10000}`,
        type: "billing",
        title: `Billing and Coding Article for ${code}`,
        content: `Billing guidance for ${code}: Ensure appropriate modifier usage and supporting diagnosis codes.`,
        effective_date: "2024-01-01"
      },
      {
        article_id: `A${Math.floor(Math.random() * 90000) + 10000}`,
        type: "coding",
        title: `Coding Guidelines for ${code}`,
        content: `Code ${code} should be reported with appropriate ICD-10 diagnosis codes that support medical necessity.`,
        effective_date: "2024-01-01"
      }
    ];

    if (article_type === "all") {
      return { articles };
    }

    return {
      articles: articles.filter(a => a.type === article_type)
    };
  }

  async function getMACContractors(params: { state: string; jurisdiction?: string }) {
    const { state } = params;
    const contractorInfo = MAC_CONTRACTORS[state.toUpperCase()];

    if (contractorInfo) {
      return { state: state.toUpperCase(), contractors: contractorInfo };
    }

    return {
      state: state.toUpperCase(),
      contractors: {
        part_a_b: { name: "Check CMS.gov for your jurisdiction", number: "Unknown" },
        dme: { name: "Check CMS.gov for your jurisdiction", number: "Unknown" }
      }
    };
  }

  // Dispatcher
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
