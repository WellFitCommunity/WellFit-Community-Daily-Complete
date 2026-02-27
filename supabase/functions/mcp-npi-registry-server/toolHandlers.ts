// =====================================================
// MCP NPI Registry Server — Tool Handlers
// =====================================================

import { createNpiApiClient } from "./npiApi.ts";
import { TAXONOMY_CODES } from "./taxonomyCodes.ts";

interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

export function createToolHandlers(logger: MCPLogger) {
  const { isValidNPIFormat, callNPIRegistry } = createNpiApiClient(logger);

  async function validateNPI(params: { npi: string }) {
    const { npi } = params;
    const validFormat = isValidNPIFormat(npi);

    if (!validFormat) {
      return {
        npi,
        valid_format: false,
        is_active: false,
        status: "invalid",
        validation_message: "NPI format is invalid. NPIs must be 10 digits and pass Luhn check."
      };
    }

    const result = await callNPIRegistry({ number: npi });

    if (result.result_count === 0) {
      return {
        npi,
        valid_format: true,
        is_active: false,
        status: "not_found",
        validation_message: "NPI format is valid but not found in the NPI Registry."
      };
    }

    const provider = result.results[0];
    const basic = provider.basic as Record<string, unknown> || {};
    const enumType = provider.enumeration_type as string;

    let providerName: string;
    if (enumType === "NPI-1") {
      providerName = `${basic.first_name || ""} ${basic.last_name || ""}`.trim();
    } else {
      providerName = (basic.organization_name as string) || "Unknown Organization";
    }

    const status = basic.status as string || "A";
    const isActive = status === "A";

    return {
      npi,
      valid_format: true,
      is_active: isActive,
      provider_name: providerName,
      enumeration_type: enumType,
      status: isActive ? "active" : "deactivated",
      validation_message: isActive
        ? `NPI is valid and active for ${providerName}`
        : `NPI is valid but has been deactivated`
    };
  }

  async function lookupNPI(params: { npi: string }) {
    const { npi } = params;
    const result = await callNPIRegistry({ number: npi });

    if (result.result_count === 0) {
      return { found: false, npi };
    }

    const p = result.results[0];
    const basic = p.basic as Record<string, unknown> || {};
    const enumType = p.enumeration_type as string;

    let name: string;
    let credential: string | undefined;
    if (enumType === "NPI-1") {
      name = `${basic.first_name || ""} ${basic.middle_name || ""} ${basic.last_name || ""}`.replace(/\s+/g, " ").trim();
      credential = basic.credential as string | undefined;
    } else {
      name = (basic.organization_name as string) || "Unknown";
    }

    const taxonomies = ((p.taxonomies as Array<Record<string, unknown>>) || []).map(t => ({
      code: t.code as string,
      description: t.desc as string,
      primary: t.primary as boolean,
      state: t.state as string | undefined,
      license: t.license as string | undefined
    }));

    const addresses = ((p.addresses as Array<Record<string, unknown>>) || []).map(a => ({
      type: a.address_purpose as string,
      address_1: a.address_1 as string,
      address_2: a.address_2 as string | undefined,
      city: a.city as string,
      state: a.state as string,
      postal_code: a.postal_code as string,
      telephone: a.telephone_number as string | undefined,
      fax: a.fax_number as string | undefined
    }));

    const identifiers = ((p.identifiers as Array<Record<string, unknown>>) || []).map(i => ({
      identifier: i.identifier as string,
      type: i.desc as string,
      state: i.state as string | undefined,
      issuer: i.issuer as string | undefined
    }));

    return {
      found: true,
      npi,
      provider: {
        name,
        type: enumType === "NPI-1" ? "Individual" : "Organization",
        credential,
        gender: basic.gender as string | undefined,
        sole_proprietor: basic.sole_proprietor === "YES",
        enumeration_date: basic.enumeration_date as string,
        last_updated: basic.last_updated as string,
        status: (basic.status as string) === "A" ? "Active" : "Deactivated",
        taxonomies,
        addresses,
        identifiers
      }
    };
  }

  async function searchProviders(params: {
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    taxonomy_description?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    enumeration_type?: string;
    limit?: number;
  }) {
    const { limit = 20, ...searchParams } = params;
    const apiParams: Record<string, string | number> = { limit: Math.min(limit, 200) };

    if (searchParams.first_name) apiParams.first_name = searchParams.first_name;
    if (searchParams.last_name) apiParams.last_name = searchParams.last_name;
    if (searchParams.organization_name) apiParams.organization_name = searchParams.organization_name;
    if (searchParams.taxonomy_description) apiParams.taxonomy_description = searchParams.taxonomy_description;
    if (searchParams.city) apiParams.city = searchParams.city;
    if (searchParams.state) apiParams.state = searchParams.state;
    if (searchParams.postal_code) apiParams.postal_code = searchParams.postal_code;
    if (searchParams.enumeration_type) apiParams.enumeration_type = searchParams.enumeration_type;

    const result = await callNPIRegistry(apiParams);

    const providers = result.results.map(p => {
      const basic = p.basic as Record<string, unknown> || {};
      const enumType = p.enumeration_type as string;
      const taxonomies = (p.taxonomies as Array<Record<string, unknown>>) || [];
      const addrs = (p.addresses as Array<Record<string, unknown>>) || [];

      let name: string;
      if (enumType === "NPI-1") {
        name = `${basic.first_name || ""} ${basic.last_name || ""}`.trim();
      } else {
        name = (basic.organization_name as string) || "Unknown";
      }

      const primaryTaxonomy = taxonomies.find(t => t.primary) || taxonomies[0];
      const locationAddr = addrs.find(a => a.address_purpose === "LOCATION") || addrs[0];

      return {
        npi: p.number as string,
        name,
        type: enumType === "NPI-1" ? "Individual" : "Organization",
        specialty: primaryTaxonomy?.desc as string | undefined,
        city: locationAddr?.city as string | undefined,
        state: locationAddr?.state as string | undefined,
        phone: locationAddr?.telephone_number as string | undefined
      };
    });

    return {
      total_results: result.result_count,
      providers
    };
  }

  async function searchBySpecialty(params: {
    taxonomy_code: string;
    state?: string;
    city?: string;
    limit?: number;
  }) {
    const { taxonomy_code, state, city, limit = 20 } = params;
    const apiParams: Record<string, string | number> = {
      taxonomy_description: taxonomy_code,
      limit: Math.min(limit, 200)
    };

    if (state) apiParams.state = state;
    if (city) apiParams.city = city;

    const result = await callNPIRegistry(apiParams);

    const providers = result.results.map(p => {
      const basic = p.basic as Record<string, unknown> || {};
      const enumType = p.enumeration_type as string;
      const addrs = (p.addresses as Array<Record<string, unknown>>) || [];
      const locationAddr = addrs.find(a => a.address_purpose === "LOCATION") || addrs[0];

      let name: string;
      if (enumType === "NPI-1") {
        name = `${basic.first_name || ""} ${basic.last_name || ""}`.trim();
      } else {
        name = (basic.organization_name as string) || "Unknown";
      }

      return {
        npi: p.number as string,
        name,
        city: locationAddr?.city as string | undefined,
        state: locationAddr?.state as string | undefined
      };
    });

    let taxonomyDescription: string | undefined;
    if (result.results.length > 0) {
      const taxonomies = (result.results[0].taxonomies as Array<Record<string, unknown>>) || [];
      const matchingTax = taxonomies.find(t => t.code === taxonomy_code);
      taxonomyDescription = matchingTax?.desc as string | undefined;
    }

    return {
      total_results: result.result_count,
      taxonomy_code,
      taxonomy_description: taxonomyDescription,
      providers
    };
  }

  function getTaxonomyCodes(params: { specialty: string; category?: string }) {
    const { specialty, category = "all" } = params;
    const searchTerm = specialty.toLowerCase().replace(/[^a-z0-9]/g, "_");

    const matches = Object.entries(TAXONOMY_CODES)
      .filter(([key, value]) => {
        const matchesSearch = key.includes(searchTerm) ||
          value.classification.toLowerCase().includes(specialty.toLowerCase()) ||
          (value.specialization?.toLowerCase().includes(specialty.toLowerCase()));
        const matchesCategory = category === "all" || value.type === category;
        return matchesSearch && matchesCategory;
      })
      .map(([_, value]) => value);

    return { specialty, matches };
  }

  async function bulkValidateNPIs(params: { npis: string[] }) {
    const limitedNPIs = params.npis.slice(0, 50);

    const results = await Promise.all(
      limitedNPIs.map(async npi => {
        const validation = await validateNPI({ npi });
        return {
          npi,
          valid: validation.valid_format && validation.is_active,
          status: validation.status,
          provider_name: validation.provider_name
        };
      })
    );

    const validCount = results.filter(r => r.valid).length;

    return {
      total: results.length,
      valid: validCount,
      invalid: results.length - validCount,
      results
    };
  }

  async function getProviderIdentifiers(params: { npi: string }) {
    const lookupResult = await lookupNPI(params);

    if (!lookupResult.found || !lookupResult.provider) {
      return { npi: params.npi, found: false, identifiers: [] };
    }

    return {
      npi: params.npi,
      found: true,
      identifiers: lookupResult.provider.identifiers
    };
  }

  async function checkNPIDeactivation(params: { npi: string }) {
    const validation = await validateNPI(params);

    return {
      npi: params.npi,
      is_deactivated: validation.valid_format && !validation.is_active,
      provider_name: validation.provider_name,
      reason: validation.is_active ? undefined : "Provider has been deactivated in NPI Registry"
    };
  }

  // Dispatcher
  async function handleToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "validate_npi":
        return validateNPI(args as { npi: string });
      case "lookup_npi":
        return lookupNPI(args as { npi: string });
      case "search_providers":
        return searchProviders(args as Parameters<typeof searchProviders>[0]);
      case "search_by_specialty":
        return searchBySpecialty(args as Parameters<typeof searchBySpecialty>[0]);
      case "get_taxonomy_codes":
        return getTaxonomyCodes(args as Parameters<typeof getTaxonomyCodes>[0]);
      case "bulk_validate_npis":
        return bulkValidateNPIs(args as { npis: string[] });
      case "get_provider_identifiers":
        return getProviderIdentifiers(args as { npi: string });
      case "check_npi_deactivation":
        return checkNPIDeactivation(args as { npi: string });
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  return { handleToolCall };
}
