// CSV conversion for bulk exports.

import type { ExportRecord } from "./types.ts";

/** Convert an array of records to CSV (headers from the first record). */
export function convertToCSV(data: ExportRecord[]): string {
  if (!data || data.length === 0) {
    return "";
  }

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  csvRows.push(headers.join(","));

  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) {
        return "";
      }
      const escaped = String(value).replace(/"/g, '""');
      return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}
