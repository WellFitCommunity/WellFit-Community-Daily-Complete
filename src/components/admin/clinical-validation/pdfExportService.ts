/**
 * pdfExportService — Browser-side PDF generation for clinical validation
 *
 * Generates downloadable PDFs for:
 *   1. Validation Report — rejection stats, rejection log, reference data health
 *   2. DRG Reference Table — all MS-DRG codes, weights, MDC
 *
 * Uses jsPDF + jspdf-autotable. No server dependency.
 * Akima-friendly: readable fonts (12pt body), clear headers, generation date.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  ValidationSummary,
  RejectionLogEntry,
  ReferenceDataSource,
} from './ClinicalValidationDashboard.types';

/** Shared PDF header with title, subtitle, and generation date */
function addPdfHeader(doc: jsPDF, title: string, subtitle: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 20);

  // Subtitle
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(subtitle, 14, 28);

  // Generation date (right-aligned)
  const dateStr = `Generated: ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
  doc.setFontSize(9);
  doc.text(dateStr, pageWidth - 14, 28, { align: 'right' });

  // Horizontal rule
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 32, pageWidth - 14, 32);

  doc.setTextColor(0, 0, 0);
  return 38; // Y position after header
}

/** Add footer with page numbers */
function addPageNumbers(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} — Envision ATLUS I.H.I.S.`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }
}

// ========================================================
// Phase 6-1: Validation Report PDF
// ========================================================

interface ValidationReportData {
  summary: ValidationSummary;
  rejectionLog: RejectionLogEntry[];
  referenceData: ReferenceDataSource[];
  dateRange: string;
}

/**
 * Generate a validation report PDF.
 * Contains: summary stats, rejection log table, reference data health.
 */
export function exportValidationReportPDF(data: ValidationReportData): void {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const dateLabel = data.dateRange === '7d' ? '7 days' : data.dateRange === '30d' ? '30 days' : '90 days';
  let y = addPdfHeader(doc, 'AI Code Validation Report', `Clinical validation hook results — last ${dateLabel}`);

  // --- Summary Section ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, y);
  y += 8;

  const summaryData = [
    ['Total Validation Runs', String(data.summary.totalRuns)],
    ['Codes Checked', String(data.summary.totalCodesChecked)],
    ['Codes Rejected', String(data.summary.totalCodesRejected)],
    ['Codes Auto-Suppressed', String(data.summary.totalCodesSuppressed)],
    ['Rejection Rate', `${data.summary.rejectionRate.toFixed(1)}%`],
    ['Avg Response Time', `${data.summary.avgResponseTimeMs}ms`],
    ['Top Hallucinated Code', data.summary.topHallucinatedCode ?? 'None'],
    ['Top Hallucinated Count', String(data.summary.topHallucinatedCount)],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // --- Rejection Log ---
  if (data.rejectionLog.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rejection Log (${data.rejectionLog.length} entries)`, 14, y);
    y += 6;

    const logRows = data.rejectionLog.map((entry) => [
      new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      entry.sourceFunction.replace(/^(ai-|mcp-)/, '').replace(/-/g, ' '),
      entry.code,
      entry.system.toUpperCase(),
      entry.reason.replace(/_/g, ' '),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Date', 'AI Function', 'Code', 'System', 'Reason']],
      body: logRows,
      theme: 'striped',
      headStyles: { fillColor: [192, 57, 43], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // --- Reference Data Health ---
  if (data.referenceData.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Reference Data Health', 14, y);
    y += 6;

    const refRows = data.referenceData.map((src) => [
      src.source_name,
      src.source_type,
      src.version ?? '—',
      src.status.toUpperCase(),
      new Date(src.last_updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      src.next_expected_update
        ? new Date(src.next_expected_update).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : '—',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Source', 'Type', 'Version', 'Status', 'Last Updated', 'Next Update']],
      body: refRows,
      theme: 'grid',
      headStyles: { fillColor: [39, 174, 96], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
  }

  addPageNumbers(doc);
  doc.save(`validation-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ========================================================
// Phase 6-2: DRG Reference Table PDF
// ========================================================

export interface DRGReferenceEntry {
  drg_code: string;
  description: string;
  relative_weight: number;
  mdc: string | null;
  type: string | null;
}

/**
 * Generate a DRG reference table PDF.
 * Akima reviews DRG codes/weights for clinical accuracy.
 */
export function exportDRGReferencePDF(entries: DRGReferenceEntry[]): void {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const y = addPdfHeader(doc, 'MS-DRG Reference Table', `FY2026 — ${entries.length} codes`);

  const rows = entries.map((e) => [
    e.drg_code,
    e.description,
    e.relative_weight.toFixed(4),
    e.mdc ?? '—',
    e.type ?? '—',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['DRG Code', 'Description', 'Relative Weight', 'MDC', 'Type']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [142, 68, 173], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 120 },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 25, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  addPageNumbers(doc);
  doc.save(`ms-drg-reference-FY2026-${new Date().toISOString().slice(0, 10)}.pdf`);
}
