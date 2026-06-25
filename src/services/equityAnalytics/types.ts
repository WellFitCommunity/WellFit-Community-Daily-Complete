/**
 * Equity Analytics — shared client types.
 *
 * The engine returns REPORT-GENERATED aggregates (counts/%, distributions, cross-tabs), never raw
 * patient rows. These types describe the request spec and the aggregate response.
 */

export type EquitySource = 'members' | 'checkins' | 'readmission' | 'sdoh_detections';

export type EquityTimeGrain = 'month' | 'quarter' | 'year';

export interface EquityFilter {
  dimension: string;
  value: string;
}

/** A query spec — compiles to ONE parameterized aggregate query server-side. */
export interface EquitySpec {
  source: EquitySource;
  measure: string;
  dimensions: string[];
  filters?: EquityFilter[];
  timeGrain?: EquityTimeGrain | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  /**
   * Optional: EXCLUDE cells smaller than this n from the report. Omit to keep every cell (small
   * cells are returned and flagged `low_n`, not hidden). Surfacing small/underserved groups is the
   * point of equity analytics; the researcher tier enforces its own minimum server-side.
   */
  minCellSize?: number | null;
}

/** One aggregate cell. Dimension keys appear as additional string-valued properties. */
export interface EquityCell {
  /** The measure value for this group (count, %, or average). Null when undefined for the group. */
  value: number | null;
  /** Number of underlying records in this cell. */
  cell_n: number;
  /** True when cell_n is below the low-N threshold — a hint to the viewer, NOT a mask. */
  low_n: boolean;
  [dimension: string]: unknown;
}

export interface EquityReportMeta {
  source: EquitySource;
  measure: string;
  dimensions: string[];
  timeGrain: EquityTimeGrain | null;
  tier: 'standard' | 'researcher';
  cellCount: number;
  lowNCellCount: number;
  smallCellsDropped: boolean;
  generatedAt: string;
}

export interface EquityReport {
  rows: EquityCell[];
  meta: EquityReportMeta;
}

export interface CatalogField {
  key: string;
  label: string;
  kind?: 'count' | 'percent' | 'average' | 'category';
  unit?: string;
}

export interface CatalogSource {
  key: string;
  label: string;
  description: string;
  timeSeries: boolean;
  dimensions: CatalogField[];
  measures: CatalogField[];
}

export interface EquityCatalogResponse {
  catalog: Record<string, CatalogSource>;
  tier: 'standard' | 'researcher';
}

/** Result of translating a plain-language question (Session 2 AI layer). */
export type EquityTranslation =
  | { kind: 'spec'; spec: EquitySpec; interpretedFrom: string; translatedBy: string }
  | { kind: 'clarification'; message: string; question: string };

/** Result of asking a plain-language question and running it end-to-end. */
export type EquityAskResult =
  | { kind: 'report'; report: EquityReport }
  | { kind: 'clarification'; message: string; question: string };
