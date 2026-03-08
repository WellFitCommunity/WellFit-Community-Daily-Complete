/**
 * culturalProfilePdfExport — PDF generation for cultural competency profiles
 *
 * Generates downloadable PDF with all population profiles formatted as
 * readable cards. Each profile includes: overview, clinical considerations,
 * barriers, cultural practices, trust factors, support systems, SDOH codes,
 * and drug interaction warnings.
 *
 * Akima-friendly: readable fonts, clear section headers, color-coded warnings.
 * Uses jsPDF + jspdf-autotable. No server dependency.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ========================================================
// Types matching the cultural_profiles table JSONB shape
// ========================================================

export interface CulturalProfileRow {
  id: string;
  population_key: string;
  display_name: string;
  description: string;
  caveat: string;
  profile_data: CulturalProfileData;
  is_active: boolean;
}

interface CulturalProfileData {
  communication: {
    languagePreferences: string[];
    formalityLevel: string;
    familyInvolvementNorm: string;
    keyPhrases: string[];
    avoidPhrases: string[];
    contextSpecific: Record<string, string>;
  };
  clinicalConsiderations: Array<{
    condition: string;
    prevalence: string;
    screeningRecommendation: string;
    clinicalNote: string;
  }>;
  barriers: Array<{
    barrier: string;
    impact: string;
    mitigation: string;
  }>;
  culturalPractices: Array<{
    practice: string;
    description: string;
    clinicalImplication: string;
  }>;
  trustFactors: Array<{
    factor: string;
    historicalContext: string;
    trustBuildingStrategy: string;
  }>;
  supportSystems: Array<{
    resource: string;
    description: string;
    accessInfo: string;
  }>;
  sdohCodes: Array<{
    code: string;
    description: string;
    applicability: string;
  }>;
  culturalRemedies: Array<{
    remedy: string;
    commonUse: string;
    potentialInteractions: string[];
    warningLevel: 'info' | 'caution' | 'warning';
  }>;
}

// ========================================================
// Helpers
// ========================================================

/** Shared PDF header */
function addHeader(doc: jsPDF, title: string, subtitle: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 20);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(subtitle, 14, 28);
  const dateStr = `Generated: ${new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })}`;
  doc.setFontSize(9);
  doc.text(dateStr, pageWidth - 14, 28, { align: 'right' });
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 32, pageWidth - 14, 32);
  doc.setTextColor(0, 0, 0);
  return 38;
}

/** Add page numbers */
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
      pageWidth / 2, pageHeight - 10, { align: 'center' }
    );
  }
}

/** Get finalY from last autoTable */
function getFinalY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

/** Check if we need a new page */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    return 20;
  }
  return y;
}

/** Warning level colors */
const WARNING_COLORS: Record<string, [number, number, number]> = {
  warning: [192, 57, 43],
  caution: [211, 84, 0],
  info: [41, 128, 185],
};

// ========================================================
// Main export function
// ========================================================

/**
 * Generate a cultural competency profiles PDF.
 * Each profile gets its own section with clinical cards.
 */
export function exportCulturalCompetencyPDF(profiles: CulturalProfileRow[]): void {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  let y = addHeader(doc, 'Cultural Competency Profiles', `${profiles.length} population profiles — Clinical reference guide`);

  // Table of contents
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Table of Contents', 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  for (let i = 0; i < profiles.length; i++) {
    doc.text(`${i + 1}. ${profiles[i].display_name}`, 18, y);
    y += 5;
  }
  y += 6;

  // Caveat notice
  doc.setFontSize(9);
  doc.setTextColor(150, 50, 50);
  doc.text(
    'Important: These profiles describe population-level patterns, not individual patients. Always ask — never assume.',
    14, y, { maxWidth: 180 }
  );
  doc.setTextColor(0, 0, 0);

  // Render each profile
  for (const profile of profiles) {
    doc.addPage();
    y = renderProfile(doc, profile);
  }

  addPageNumbers(doc);
  doc.save(`cultural-competency-profiles-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ========================================================
// Profile renderer
// ========================================================

function renderProfile(doc: jsPDF, profile: CulturalProfileRow): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;
  const data = profile.profile_data;

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 128, 185);
  doc.text(profile.display_name, 14, y);
  y += 2;
  doc.setDrawColor(41, 128, 185);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;
  doc.setTextColor(0, 0, 0);

  // Description
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const descLines = doc.splitTextToSize(profile.description, 180);
  doc.text(descLines, 14, y);
  y += descLines.length * 4.5 + 3;

  // Caveat (italic box)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  const caveatLines = doc.splitTextToSize(`Note: ${profile.caveat}`, 175);
  doc.setFillColor(245, 245, 245);
  doc.rect(14, y - 2, pageWidth - 28, caveatLines.length * 4 + 4, 'F');
  doc.text(caveatLines, 16, y + 2);
  y += caveatLines.length * 4 + 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  // --- Clinical Considerations ---
  y = ensureSpace(doc, y, 30);
  y = renderSectionHeader(doc, 'Clinical Considerations', y);

  const clinRows = data.clinicalConsiderations.map((c) => [
    c.condition,
    c.prevalence,
    c.screeningRecommendation,
    c.clinicalNote,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Condition', 'Prevalence', 'Screening', 'Clinical Note']],
    body: clinRows,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185], fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30 },
      1: { cellWidth: 35 },
      2: { cellWidth: 40 },
      3: { cellWidth: 75 },
    },
    margin: { left: 14, right: 14 },
  });
  y = getFinalY(doc) + 8;

  // --- Barriers to Care ---
  y = ensureSpace(doc, y, 30);
  y = renderSectionHeader(doc, 'Barriers to Care', y);

  const barrierRows = data.barriers.map((b) => [b.barrier, b.impact, b.mitigation]);
  autoTable(doc, {
    startY: y,
    head: [['Barrier', 'Impact', 'Mitigation Strategy']],
    body: barrierRows,
    theme: 'striped',
    headStyles: { fillColor: [192, 57, 43], fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 1: { cellWidth: 55 }, 2: { cellWidth: 90 } },
    margin: { left: 14, right: 14 },
  });
  y = getFinalY(doc) + 8;

  // --- Communication Guidance ---
  y = ensureSpace(doc, y, 30);
  y = renderSectionHeader(doc, 'Communication Guidance', y);

  const commRows: string[][] = [];
  commRows.push(['Language Preferences', data.communication.languagePreferences.join('; ')]);
  commRows.push(['Formality Level', data.communication.formalityLevel]);
  commRows.push(['Family Involvement', data.communication.familyInvolvementNorm]);
  commRows.push(['Key Phrases', data.communication.keyPhrases.map((p) => `• ${p}`).join('\n')]);
  commRows.push(['Phrases to Avoid', data.communication.avoidPhrases.map((p) => `• ${p}`).join('\n')]);

  for (const [context, guidance] of Object.entries(data.communication.contextSpecific)) {
    const label = context.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    commRows.push([`Context: ${label}`, guidance]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Aspect', 'Guidance']],
    body: commRows,
    theme: 'grid',
    headStyles: { fillColor: [39, 174, 96], fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
    margin: { left: 14, right: 14 },
  });
  y = getFinalY(doc) + 8;

  // --- Trust Factors ---
  y = ensureSpace(doc, y, 30);
  y = renderSectionHeader(doc, 'Trust Factors (Historical Context)', y);

  const trustRows = data.trustFactors.map((t) => [t.factor, t.historicalContext, t.trustBuildingStrategy]);
  autoTable(doc, {
    startY: y,
    head: [['Factor', 'Historical Context', 'Trust-Building Strategy']],
    body: trustRows,
    theme: 'striped',
    headStyles: { fillColor: [142, 68, 173], fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
    margin: { left: 14, right: 14 },
  });
  y = getFinalY(doc) + 8;

  // --- Cultural Practices ---
  y = ensureSpace(doc, y, 30);
  y = renderSectionHeader(doc, 'Cultural Health Practices', y);

  const practiceRows = data.culturalPractices.map((p) => [p.practice, p.description, p.clinicalImplication]);
  autoTable(doc, {
    startY: y,
    head: [['Practice', 'Description', 'Clinical Implication']],
    body: practiceRows,
    theme: 'striped',
    headStyles: { fillColor: [44, 62, 80], fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
    margin: { left: 14, right: 14 },
  });
  y = getFinalY(doc) + 8;

  // --- Drug Interaction Warnings ---
  y = ensureSpace(doc, y, 30);
  y = renderSectionHeader(doc, 'Drug Interaction Warnings (Cultural Remedies)', y);

  const remedyRows = data.culturalRemedies.map((r) => [
    r.remedy,
    r.commonUse,
    r.potentialInteractions.map((i) => `• ${i}`).join('\n'),
    r.warningLevel.toUpperCase(),
  ]);
  autoTable(doc, {
    startY: y,
    head: [['Remedy', 'Common Use', 'Potential Interactions', 'Level']],
    body: remedyRows,
    theme: 'striped',
    headStyles: { fillColor: [192, 57, 43], fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30 },
      1: { cellWidth: 40 },
      2: { cellWidth: 85 },
      3: { cellWidth: 18, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (cellData) => {
      if (cellData.column.index === 3 && cellData.section === 'body') {
        const raw = String(cellData.cell.raw).toLowerCase();
        const color = WARNING_COLORS[raw];
        if (color) {
          cellData.cell.styles.textColor = color;
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });
  y = getFinalY(doc) + 8;

  // --- Support Systems ---
  y = ensureSpace(doc, y, 30);
  y = renderSectionHeader(doc, 'Support Systems & Resources', y);

  const supportRows = data.supportSystems.map((s) => [s.resource, s.description, s.accessInfo]);
  autoTable(doc, {
    startY: y,
    head: [['Resource', 'Description', 'How to Access']],
    body: supportRows,
    theme: 'grid',
    headStyles: { fillColor: [39, 174, 96], fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
    margin: { left: 14, right: 14 },
  });
  y = getFinalY(doc) + 8;

  // --- SDOH Codes ---
  y = ensureSpace(doc, y, 25);
  y = renderSectionHeader(doc, 'Relevant SDOH Z-Codes', y);

  const sdohRows = data.sdohCodes.map((s) => [s.code, s.description, s.applicability]);
  autoTable(doc, {
    startY: y,
    head: [['ICD-10 Code', 'Description', 'When to Apply']],
    body: sdohRows,
    theme: 'grid',
    headStyles: { fillColor: [52, 73, 94], fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 20, halign: 'center' } },
    margin: { left: 14, right: 14 },
  });
  y = getFinalY(doc) + 8;

  return y;
}

function renderSectionHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  return y + 6;
}
