// Background export processor: fetch in tenant-scoped batches, convert to the
// requested format, hash for integrity (ONC 170.315(d)(7)/(d)(8)), upload, and
// record the result on export_jobs.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { computeSha256 } from "../_shared/integrityHash.ts";
import { buildBatchQuery } from "./exportQueries.ts";
import { convertToCSV } from "./csv.ts";
import { convertToFHIRBundle } from "./fhirBundle.ts";
import type { AuditLogger, ExportFilters, ExportRecord } from "./types.ts";

const BATCH_SIZE = 1000;

export async function processExportInBackground(
  jobId: string,
  exportType: string,
  filters: ExportFilters,
  totalRecords: number,
  tenantId: string,
  supabaseAdmin: SupabaseClient,
  logger: AuditLogger,
): Promise<void> {
  const processingStartTime = Date.now();

  try {
    logger.info("Background export processing started", {
      jobId,
      exportType,
      totalRecords,
      tenantId,
    });

    let processedRecords = 0;
    const exportedData: ExportRecord[] = [];

    for (let offset = 0; offset < totalRecords; offset += BATCH_SIZE) {
      const limit = Math.min(BATCH_SIZE, totalRecords - offset);

      const query = await buildBatchQuery(
        supabaseAdmin,
        exportType,
        filters,
        tenantId,
        offset,
        limit,
        BATCH_SIZE,
      );

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to fetch batch: ${error.message}`);
      }
      if (data) {
        // Dynamic-string .select() makes PostgREST infer GenericStringError[];
        // this is the query-boundary transform cast (typescript.md cast rules).
        exportedData.push(...(data as unknown as ExportRecord[]));
      }

      processedRecords = Math.min(offset + limit, totalRecords);
      const progress = totalRecords > 0 ? Math.round((processedRecords / totalRecords) * 100) : 100;

      await supabaseAdmin
        .from("export_jobs")
        .update({ processed_records: processedRecords, progress })
        .eq("id", jobId);

      logger.debug("Export batch processed", { jobId, processedRecords, totalRecords, progress });
    }

    // Convert to requested format
    let exportContent: string;
    let contentType: string;
    const format = filters.format || "json";

    if (exportType === "fhir_resources") {
      exportContent = JSON.stringify(convertToFHIRBundle(exportedData, tenantId), null, 2);
      contentType = "application/fhir+json";
    } else if (format === "csv") {
      exportContent = convertToCSV(exportedData);
      contentType = "text/csv";
    } else {
      // json (and xlsx fallback)
      exportContent = JSON.stringify(exportedData, null, 2);
      contentType = "application/json";
      if (format === "xlsx") {
        logger.warn("XLSX format not fully implemented, using JSON", { jobId });
      }
    }

    // Integrity hash (ONC (d)(7)/(d)(8)) — recipient recomputes SHA-256.
    const integrity = await computeSha256(exportContent);

    // Upload to Storage
    const fileName = `${jobId}.${format}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("exports")
      .upload(fileName, new Blob([exportContent], { type: contentType }), {
        contentType,
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Failed to upload export: ${uploadError.message}`);
    }

    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from("exports")
      .createSignedUrl(fileName, 48 * 60 * 60);
    if (urlError) {
      throw new Error(`Failed to generate download URL: ${urlError.message}`);
    }

    await supabaseAdmin
      .from("export_jobs")
      .update({
        status: "completed",
        progress: 100,
        processed_records: totalRecords,
        file_path: fileName,
        file_size: exportContent.length,
        download_url: signedUrlData.signedUrl,
        sha256_hex: integrity.hex,
        integrity_algorithm: integrity.algorithm,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    logger.info("Export processing completed successfully", {
      jobId,
      exportType,
      totalRecords,
      format,
      sha256: integrity.hex,
      processingTimeMs: Date.now() - processingStartTime,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Error processing export", {
      jobId,
      exportType,
      error: errorMessage,
      processingTimeMs: Date.now() - processingStartTime,
    });
    await supabaseAdmin
      .from("export_jobs")
      .update({ status: "failed", error_message: errorMessage || "Unknown error occurred" })
      .eq("id", jobId);
  }
}
