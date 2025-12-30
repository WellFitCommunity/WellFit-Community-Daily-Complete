// supabase/functions/cleanup-temp-images/index.ts
// Scheduled cleanup job for expired temp vital images
// Run hourly via Supabase scheduler or external cron

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("cleanup-temp-images");

interface CleanupResult {
  success: boolean;
  deleted_jobs: number;
  deleted_files: number;
  failed_deletions: string[];
  execution_time_ms: number;
}

serve(async (req: Request) => {
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // Allow GET for cron triggers, POST for manual triggers
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Get service role key for admin operations
    const SB_URL = Deno.env.get("SB_URL") || SUPABASE_URL;
    const SB_SERVICE_KEY = Deno.env.get("SB_SERVICE_KEY") || SB_SECRET_KEY;

    if (!SB_URL || !SB_SERVICE_KEY) {
      throw new Error("Missing Supabase service configuration");
    }

    // Use service role for admin operations
    const supabase = createClient(SB_URL, SB_SERVICE_KEY);

    // Optional: Validate admin token for manual triggers
    const adminToken = req.headers.get("x-admin-token");
    const expectedToken = Deno.env.get("CLEANUP_ADMIN_TOKEN");

    // If admin token is configured, require it for POST requests
    if (req.method === "POST" && expectedToken && adminToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    logger.info("Starting cleanup");

    // Step 1: Get expired jobs with storage paths
    const { data: expiredJobs, error: selectErr } = await supabase
      .from("temp_image_jobs")
      .select("id, storage_path")
      .lt("expires_at", new Date().toISOString());

    if (selectErr) {
      throw new Error(`Failed to query expired jobs: ${selectErr.message}`);
    }

    const jobCount = expiredJobs?.length || 0;
    logger.info("Found expired jobs", { count: jobCount });

    if (jobCount === 0) {
      const result: CleanupResult = {
        success: true,
        deleted_jobs: 0,
        deleted_files: 0,
        failed_deletions: [],
        execution_time_ms: Date.now() - startTime
      };
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders });
    }

    // Step 2: Delete files from storage
    const storagePaths = expiredJobs!
      .map(job => job.storage_path)
      .filter((path): path is string => !!path);

    const failedDeletions: string[] = [];
    let deletedFiles = 0;

    // Delete files in batches to avoid overwhelming storage API
    const BATCH_SIZE = 10;
    for (let i = 0; i < storagePaths.length; i += BATCH_SIZE) {
      const batch = storagePaths.slice(i, i + BATCH_SIZE);

      const { data: deleteResult, error: deleteErr } = await supabase
        .storage
        .from("temp_vital_images")
        .remove(batch);

      if (deleteErr) {
        logger.error("Storage delete error", { error: deleteErr.message, batch });
        failedDeletions.push(...batch);
      } else {
        deletedFiles += deleteResult?.length || batch.length;
      }
    }

    // Step 3: Delete database records
    const jobIds = expiredJobs!.map(job => job.id);
    const { error: dbDeleteErr } = await supabase
      .from("temp_image_jobs")
      .delete()
      .in("id", jobIds);

    if (dbDeleteErr) {
      logger.error("Database delete error", { error: dbDeleteErr.message });
      throw new Error(`Failed to delete job records: ${dbDeleteErr.message}`);
    }

    logger.info("Cleanup completed", { deletedJobs: jobCount, deletedFiles });

    // Step 4: Also clean up any orphaned files older than 25 hours
    // (in case DB records were deleted but files weren't)
    try {
      const { data: allFiles } = await supabase
        .storage
        .from("temp_vital_images")
        .list("", { limit: 1000 });

      if (allFiles && allFiles.length > 0) {
        const cutoffTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
        const orphanedFiles = allFiles.filter(file => {
          const fileDate = new Date(file.created_at || file.updated_at || Date.now());
          return fileDate < cutoffTime;
        });

        if (orphanedFiles.length > 0) {
          logger.info("Found orphaned files", { count: orphanedFiles.length });
          const orphanPaths = orphanedFiles.map(f => f.name);

          const { error: orphanDeleteErr } = await supabase
            .storage
            .from("temp_vital_images")
            .remove(orphanPaths);

          if (!orphanDeleteErr) {
            deletedFiles += orphanedFiles.length;
          }
        }
      }
    } catch (orphanErr: unknown) {
      // Non-critical - log but don't fail
      const errorMessage = orphanErr instanceof Error ? orphanErr.message : String(orphanErr);
      logger.warn("Orphan cleanup warning", { error: errorMessage });
    }

    const result: CleanupResult = {
      success: true,
      deleted_jobs: jobCount,
      deleted_files: deletedFiles,
      failed_deletions: failedDeletions,
      execution_time_ms: Date.now() - startTime
    };

    return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Cleanup failed", { error: errorMessage });

    const result: CleanupResult = {
      success: false,
      deleted_jobs: 0,
      deleted_files: 0,
      failed_deletions: [],
      execution_time_ms: Date.now() - startTime
    };

    return new Response(
      JSON.stringify({ ...result, error: errorMessage || "Cleanup failed" }),
      { status: 500, headers: corsFromRequest(req).headers }
    );
  }
});
