// =====================================================
// MCP NPI Registry Server — CMS NPI Registry API Client
// =====================================================

const NPI_API_BASE = "https://npiregistry.cms.hhs.gov/api";
const NPI_API_VERSION = "2.1";

interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

export function createNpiApiClient(logger: MCPLogger) {

  // NPI Validation Algorithm (Luhn Check)
  function isValidNPIFormat(npi: string): boolean {
    if (!/^\d{10}$/.test(npi)) {
      return false;
    }

    // Prefix with "80840" for healthcare industry code
    const prefixedNPI = "80840" + npi;
    let sum = 0;
    let alternate = false;

    for (let i = prefixedNPI.length - 1; i >= 0; i--) {
      let digit = parseInt(prefixedNPI[i], 10);

      if (alternate) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      alternate = !alternate;
    }

    return sum % 10 === 0;
  }

  async function callNPIRegistry(params: Record<string, string | number>): Promise<{
    result_count: number;
    results: Array<Record<string, unknown>>;
  }> {
    const searchParams = new URLSearchParams();
    searchParams.set("version", NPI_API_VERSION);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.set(key, String(value));
      }
    }

    try {
      const response = await fetch(`${NPI_API_BASE}/?${searchParams.toString()}`);

      if (!response.ok) {
        throw new Error(`NPI Registry API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("NPI Registry API call failed", { errorMessage: error.message });
      return { result_count: 0, results: [] };
    }
  }

  return { isValidNPIFormat, callNPIRegistry };
}
