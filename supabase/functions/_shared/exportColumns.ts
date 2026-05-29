// Runtime export-column resolver.
//
// Bulk/CCDA exporters need every column of a table (a data export is, by
// definition, "all of it"), but a literal SELECT * is forbidden (PHI-exposure
// rule, .claude/rules/supabase.md §9). Resolving the column list at runtime via
// get_exportable_columns() keeps exports COMPLETE on schema changes while
// avoiding the literal '*'. Results are cached per warm instance (columns
// rarely change; a cold start refreshes the cache).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const columnCache = new Map<string, string>();

/**
 * Returns a comma-separated column list for an allowlisted export table,
 * resolved from get_exportable_columns(). Throws if the table is not
 * exportable or has no columns.
 */
export async function resolveSelectColumns(
  supabaseAdmin: SupabaseClient,
  table: string,
): Promise<string> {
  const cached = columnCache.get(table);
  if (cached) return cached;

  const { data, error } = await supabaseAdmin.rpc("get_exportable_columns", {
    p_table: table,
  });

  if (error) {
    throw new Error(`Failed to resolve export columns for "${table}": ${error.message}`);
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No exportable columns returned for "${table}"`);
  }

  const cols = (data as string[]).join(", ");
  columnCache.set(table, cols);
  return cols;
}

/**
 * Same as resolveSelectColumns, but appends a PostgREST embed used purely for
 * tenant filtering (e.g. `profiles!inner(tenant_id)`). The embed is NOT part of
 * the table's own columns, so it is added after the resolved list.
 */
export async function resolveSelectColumnsWithEmbed(
  supabaseAdmin: SupabaseClient,
  table: string,
  embed: string,
): Promise<string> {
  const cols = await resolveSelectColumns(supabaseAdmin, table);
  return `${cols}, ${embed}`;
}
