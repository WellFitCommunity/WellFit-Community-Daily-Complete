// supabase/functions/nightly-excel-backup/index.ts
import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import {
  createLogger,
  getChicagoTime,
  validateEnvVars,
  isWithinWindowChicago,
  type DatabaseTypes,
  type Logger,
} from "../shared/types.ts";

interface BackupData {
  checkIns: any[];
  communityMoments: any[];
  adminActions: any[];
  interactionLog: any[];
}

interface MailerSendEmail {
  from: { email: string; name: string };
  to: Array<{ email: string; name?: string }>;
  subject: string;
  html: string;
  text: string;
}

class BackupService {
  private supabase;
  private logger: Logger;
  private backupBucket: string;
  private backupPathPrefix: string;
  private mailerSendApiKey?: string;
  private adminEmails: string[];

  constructor() {
    this.logger = createLogger("nightly-excel-backup");

    validateEnvVars(["SB_URL", "SB_SERVICE_ROLE_KEY", "BACKUP_BUCKET", "BACKUP_PATH_PREFIX"]);

    this.supabase = createClient<DatabaseTypes>(
      SUPABASE_URL,
      SB_SECRET_KEY);

    this.backupBucket = Deno.env.get("BACKUP_BUCKET");
    this.backupPathPrefix = Deno.env.get("BACKUP_PATH_PREFIX");
    this.mailerSendApiKey = Deno.env.get("MAILERSEND_API_KEY");
    this.adminEmails = (Deno.env.get("ADMIN_EMAILS") || "").split(",").map((s) => s.trim()).filter(Boolean);
  }

  async fetchYesterdayData(): Promise<BackupData> {
    // Use Chicago midnight boundaries
    const ct = getChicagoTime();
    ct.setHours(0, 0, 0, 0); // today midnight CT
    const start = new Date(ct);
    start.setDate(start.getDate() - 1); // yesterday 00:00 CT
    const end = new Date(ct); // today 00:00 CT

    const startDate = start.toISOString();
    const endDate = end.toISOString();

    this.logger.info("Fetching yesterday data", { startDate, endDate });

    const { data: checkIns, error: checkInsError } = await this.supabase
      .from("check_ins")
      .select("*")
      .gte("created_at", startDate)
      .lt("created_at", endDate);
    if (checkInsError) throw new Error(`Failed to fetch check_ins: ${checkInsError.message}`);

    const { data: communityMoments, error: momentsError } = await this.supabase
      .from("community_moments")
      .select("*")
      .gte("created_at", startDate)
      .lt("created_at", endDate);
    if (momentsError) throw new Error(`Failed to fetch community_moments: ${momentsError.message}`);

    const { data: adminActions, error: adminError } = await this.supabase
      .from("admin_actions")
      .select("*")
      .gte("created_at", startDate)
      .lt("created_at", endDate);
    if (adminError) throw new Error(`Failed to fetch admin_actions: ${adminError.message}`);

    const { data: interactionLog, error: logError } = await this.supabase
      .from("interaction_log")
      .select("*")
      .gte("created_at", startDate)
      .lt("created_at", endDate);
    if (logError) throw new Error(`Failed to fetch interaction_log: ${logError.message}`);

    const counts = {
      checkIns: checkIns?.length || 0,
      communityMoments: communityMoments?.length || 0,
      adminActions: adminActions?.length || 0,
      interactionLog: interactionLog?.length || 0,
    };
    this.logger.info("Data fetched successfully", counts);

    return {
      checkIns: checkIns || [],
      communityMoments: communityMoments || [],
      adminActions: adminActions || [],
      interactionLog: interactionLog || [],
    };
  }

  createExcelWorkbook(data: BackupData, date: string): Uint8Array {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.checkIns), "Check-ins");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.communityMoments), "Community Moments");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.adminActions), "Admin Actions");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.interactionLog), "Interaction Log");

    const summary = [
      { Metric: "Backup Date", Value: date },
      { Metric: "Check-ins Count", Value: data.checkIns.length },
      { Metric: "Community Moments Count", Value: data.communityMoments.length },
      { Metric: "Admin Actions Count", Value: data.adminActions.length },
      { Metric: "Interaction Log Count", Value: data.interactionLog.length },
      { Metric: "Generated At", Value: new Date().toISOString() },
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Summary");

    return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  }

  async uploadBackup(data: Uint8Array, filePath: string): Promise<string> {
    const { data: uploadData, error } = await this.supabase.storage
      .from(this.backupBucket)
      .upload(filePath, data, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });
    if (error) throw new Error(`Failed to upload backup: ${error.message}`);
    this.logger.info("Backup uploaded successfully", { filePath });
    return uploadData.path;
  }

  async createSignedUrl(filePath: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.backupBucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days
    if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
    return data.signedUrl;
  }

  async sendEmailNotification(backupData: BackupData, signedUrl: string, date: string): Promise<void> {
    if (!this.mailerSendApiKey || this.adminEmails.length === 0) {
      this.logger.info("Skipping email notification - no API key or admin emails configured");
      return;
    }

    const totalRecords =
      backupData.checkIns.length +
      backupData.communityMoments.length +
      backupData.adminActions.length +
      backupData.interactionLog.length;

    const email: MailerSendEmail = {
      from: {
        email: Deno.env.get("FROM_EMAIL") || "noreply@wellfit.app",
        name: "WellFit Backup System",
      },
      to: this.adminEmails.map((email) => ({ email })),
      subject: `Daily Backup Complete - ${date}`,
      html: `
        <h2>Daily Backup Completed</h2>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Total Records:</strong> ${totalRecords}</p>
        <ul>
          <li>Check-ins: ${backupData.checkIns.length}</li>
          <li>Community Moments: ${backupData.communityMoments.length}</li>
          <li>Admin Actions: ${backupData.adminActions.length}</li>
          <li>Interaction Log: ${backupData.interactionLog.length}</li>
        </ul>
        <p><a href="${signedUrl}">Download Backup File</a> (expires in 7 days)</p>
      `,
      text: `Daily Backup Completed for ${date}
Total Records: ${totalRecords}

Check-ins: ${backupData.checkIns.length}
Community Moments: ${backupData.communityMoments.length}
Admin Actions: ${backupData.adminActions.length}
Interaction Log: ${backupData.interactionLog.length}

Download: ${signedUrl}
(Expires in 7 days)`,
    };

    try {
      const response = await fetch("https://api.mailersend.com/v1/email", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.mailerSendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(email),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`MailerSend API error: ${response.status} - ${errorData.slice(0, 500)}`);
      }

      this.logger.info("Email notification sent successfully", { recipients: this.adminEmails.length });
    } catch (error: any) {
      const msg = String(error?.message || error).slice(0, 500);
      this.logger.error("Failed to send email notification", { message: msg });
    }
  }

  async performBackup(): Promise<{ filePath: string; counts: Record<string, number>; signedUrl?: string }> {
    // Filename and path based on Chicago "yesterday"
    const ct = getChicagoTime();
    ct.setDate(ct.getDate() - 1);
    const dateStr = ct.toISOString().split("T")[0];
    const [year, month, day] = dateStr.split("-");

    const fileName = `wellfit-backup-${dateStr}.xlsx`;
    const dir = `${this.backupPathPrefix}/${year}/${month}/${day}`;
    const filePath = `${dir}/${fileName}`;

    this.logger.info("Starting backup process", { date: dateStr, filePath });

    // Idempotency check (list dir and look for exact file)
    const { data: files, error: listErr } = await this.supabase.storage.from(this.backupBucket).list(dir);
    if (!listErr && (files ?? []).some((f) => f.name === fileName)) {
      this.logger.info("Backup already exists, creating new signed URL", { filePath });
      const signedUrl = await this.createSignedUrl(filePath);
      return { filePath, counts: { message: 1 as unknown as number }, signedUrl };
    }

    // Fetch data & build workbook
    const backupData = await this.fetchYesterdayData();
    const excelData = this.createExcelWorkbook(backupData, dateStr);

    // Upload & sign
    await this.uploadBackup(excelData, filePath);
    const signedUrl = await this.createSignedUrl(filePath);

    // Email notify (optional)
    await this.sendEmailNotification(backupData, signedUrl, dateStr);

    const counts = {
      checkIns: backupData.checkIns.length,
      communityMoments: backupData.communityMoments.length,
      adminActions: backupData.adminActions.length,
      interactionLog: backupData.interactionLog.length,
    };

    return { filePath, counts, signedUrl };
  }
}

serve(async () => {
  const service = new BackupService();
  const logger = createLogger("nightly-excel-backup");

  try {
    logger.info("Function invoked", { chicagoTime: getChicagoTime().toISOString() });

    // Gate: only 2:00–2:05 AM America/Chicago
    if (!isWithinWindowChicago(2, 5)) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Outside scheduled time window",
          chicagoTime: getChicagoTime().toISOString(),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const results = await service.performBackup();

    logger.info("Backup process completed", results);
    return new Response(
      JSON.stringify({
        success: true,
        message: "Nightly backup completed",
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    logger.error("Function execution failed", { message: String(err?.message || err).slice(0, 500) });
    return new Response(
      JSON.stringify({
        success: false,
        error: String(err?.message || err),
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
