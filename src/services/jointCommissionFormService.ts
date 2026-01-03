// Joint Commission Medication Reconciliation Form Generator
// NPSG.03.06.01 - Maintain and communicate accurate patient medication information

import type { HandoffPacket } from '../types/handoff';
import type { MedRecReport } from './medicationReconciliationService';

export interface JointCommissionMedRecForm {
  html: string;
  fileName: string;
}

export class JointCommissionFormService {
  /**
   * Generate Joint Commission compliant medication reconciliation form (HTML for printing/PDF)
   */
  static async generateMedRecForm(
    packet: HandoffPacket,
    decryptedName: string,
    decryptedDOB: string,
    medRecReport: MedRecReport
  ): Promise<JointCommissionMedRecForm> {
    const medsGiven = packet.clinical_data?.medications_given || [];
    const medsPrescribed = packet.clinical_data?.medications_prescribed || [];
    const medsCurrent = packet.clinical_data?.medications_current || [];
    const allergies = packet.clinical_data?.allergies || [];

    const formHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Medication Reconciliation Form - ${packet.packet_number}</title>
  <style>
    @media print {
      @page { margin: 0.5in; size: letter; }
      body { margin: 0; }
      .no-print { display: none; }
      .page-break { page-break-before: always; }
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      text-align: center;
      border-bottom: 3px solid #000;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }

    .header h1 {
      margin: 0 0 5px 0;
      font-size: 18pt;
      text-transform: uppercase;
    }

    .header p {
      margin: 2px 0;
      font-size: 10pt;
    }

    .patient-info {
      background: #f0f0f0;
      border: 2px solid #000;
      padding: 10px;
      margin-bottom: 15px;
    }

    .patient-info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .info-field {
      margin-bottom: 5px;
    }

    .info-label {
      font-weight: bold;
      font-size: 9pt;
      text-transform: uppercase;
    }

    .info-value {
      font-size: 11pt;
      padding: 2px 5px;
      background: white;
      border-bottom: 1px solid #333;
    }

    .section {
      margin-bottom: 20px;
      border: 1px solid #333;
      padding: 10px;
    }

    .section-title {
      font-weight: bold;
      font-size: 12pt;
      text-transform: uppercase;
      background: #333;
      color: white;
      padding: 5px 10px;
      margin: -10px -10px 10px -10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    th {
      background: #ddd;
      border: 1px solid #000;
      padding: 8px 5px;
      text-align: left;
      font-size: 9pt;
      font-weight: bold;
    }

    td {
      border: 1px solid #666;
      padding: 6px 5px;
      font-size: 10pt;
      vertical-align: top;
    }

    .allergy-alert {
      background: #ffdddd;
      border: 3px solid #cc0000;
      padding: 10px;
      margin-bottom: 15px;
      font-weight: bold;
    }

    .discrepancy-alert {
      background: #fff3cd;
      border: 2px solid #ff9800;
      padding: 10px;
      margin: 10px 0;
    }

    .discrepancy-alert h4 {
      margin: 0 0 10px 0;
      color: #cc6600;
    }

    .signature-section {
      margin-top: 30px;
      border-top: 2px solid #000;
      padding-top: 20px;
    }

    .signature-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 30px;
      margin-top: 15px;
    }

    .signature-box {
      border: 1px solid #333;
      padding: 15px;
    }

    .signature-line {
      border-bottom: 2px solid #000;
      margin: 20px 0 5px 0;
      min-height: 40px;
    }

    .checkbox {
      display: inline-block;
      width: 15px;
      height: 15px;
      border: 2px solid #000;
      margin-right: 8px;
      vertical-align: middle;
    }

    .footer {
      margin-top: 30px;
      font-size: 8pt;
      text-align: center;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }

    .print-button {
      background: #4CAF50;
      color: white;
      padding: 15px 30px;
      border: none;
      border-radius: 5px;
      font-size: 14pt;
      cursor: pointer;
      margin: 20px 0;
      display: block;
      width: 100%;
    }

    .print-button:hover {
      background: #45a049;
    }
  </style>
</head>
<body>
  <!-- Print Button (hidden when printing) -->
  <button class="print-button no-print" onclick="window.print()">
    🖨️ Print Medication Reconciliation Form
  </button>

  <!-- Form Header -->
  <div class="header">
    <h1>Medication Reconciliation Form</h1>
    <p><strong>Joint Commission NPSG.03.06.01 Compliance</strong></p>
    <p>Transfer of Care - Inter-Facility Patient Handoff</p>
  </div>

  <!-- Patient Information -->
  <div class="patient-info">
    <div class="patient-info-grid">
      <div class="info-field">
        <div class="info-label">Patient Name:</div>
        <div class="info-value">${this.escapeHtml(decryptedName)}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Date of Birth:</div>
        <div class="info-value">${decryptedDOB}</div>
      </div>
      <div class="info-field">
        <div class="info-label">MRN / Medical Record Number:</div>
        <div class="info-value">${packet.patient_mrn || 'N/A'}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Transfer ID:</div>
        <div class="info-value">${packet.packet_number}</div>
      </div>
      <div class="info-field">
        <div class="info-label">From Facility:</div>
        <div class="info-value">${this.escapeHtml(packet.sending_facility)}</div>
      </div>
      <div class="info-field">
        <div class="info-label">To Facility:</div>
        <div class="info-value">${this.escapeHtml(packet.receiving_facility)}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Transfer Date/Time:</div>
        <div class="info-value">${new Date(packet.sent_at || packet.created_at).toLocaleString()}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Reconciliation Date:</div>
        <div class="info-value">${new Date().toLocaleString()}</div>
      </div>
    </div>
  </div>

  <!-- Allergy Alert -->
  ${allergies.length > 0 ? `
    <div class="allergy-alert">
      <strong>⚠️ ALLERGY ALERT:</strong><br/>
      ${allergies.map(a =>
        `${this.escapeHtml(a.allergen)} - ${this.escapeHtml(a.reaction)} (${a.severity || 'unknown severity'})`
      ).join('<br/>')}
    </div>
  ` : `
    <div class="info-field">
      <span class="checkbox"></span> <strong>No Known Drug Allergies (NKDA)</strong>
    </div>
  `}

  <!-- Medication Reconciliation Status -->
  ${medRecReport.discrepancies.length > 0 ? `
    <div class="discrepancy-alert">
      <h4>⚠️ MEDICATION DISCREPANCIES DETECTED - REVIEW REQUIRED</h4>
      <p><strong>${medRecReport.discrepancies.length} discrepanc${medRecReport.discrepancies.length === 1 ? 'y' : 'ies'} found.</strong>
      Reconciliation must be completed and documented before patient admission.</p>
      ${medRecReport.discrepancies.slice(0, 3).map(d => `
        <p style="margin: 5px 0; padding-left: 15px;">
          • <strong>${this.escapeHtml(d.medication_name)}:</strong> ${this.escapeHtml(d.details)}
        </p>
      `).join('')}
      ${medRecReport.discrepancies.length > 3 ?
        `<p style="font-size: 9pt; font-style: italic;">... and ${medRecReport.discrepancies.length - 3} more (see electronic report)</p>`
        : ''
      }
    </div>
  ` : `
    <div style="background: #d4edda; border: 2px solid #28a745; padding: 10px; margin-bottom: 15px;">
      <strong>✅ NO DISCREPANCIES DETECTED</strong> - Medication lists reconciled successfully.
    </div>
  `}

  <!-- Section 1: Medications Given During Visit/Transfer -->
  ${medsGiven.length > 0 ? `
    <div class="section">
      <div class="section-title">1. Medications Administered During Transfer</div>
      <table>
        <thead>
          <tr>
            <th style="width: 30%;">Medication Name</th>
            <th style="width: 15%;">Dosage</th>
            <th style="width: 15%;">Route</th>
            <th style="width: 15%;">Frequency</th>
            <th style="width: 25%;">Time Given</th>
          </tr>
        </thead>
        <tbody>
          ${medsGiven.map(med => `
            <tr>
              <td><strong>${this.escapeHtml(med.name)}</strong></td>
              <td>${this.escapeHtml(med.dosage)}</td>
              <td>${this.escapeHtml(med.route || '')}</td>
              <td>${this.escapeHtml(med.frequency || '')}</td>
              <td>${med.last_given || 'During transfer'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : ''}

  <!-- Section 2: Currently Prescribed Medications -->
  <div class="section">
    <div class="section-title">2. Currently Prescribed Medications (Active Prescriptions)</div>
    ${medsPrescribed.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th style="width: 30%;">Medication Name</th>
            <th style="width: 15%;">Dosage</th>
            <th style="width: 15%;">Route</th>
            <th style="width: 15%;">Frequency</th>
            <th style="width: 25%;">Prescribing Physician</th>
          </tr>
        </thead>
        <tbody>
          ${medsPrescribed.map(med => `
            <tr>
              <td><strong>${this.escapeHtml(med.name)}</strong></td>
              <td>${this.escapeHtml(med.dosage)}</td>
              <td>${this.escapeHtml(med.route || '')}</td>
              <td>${this.escapeHtml(med.frequency || '')}</td>
              <td>${this.escapeHtml(med.notes || 'See chart')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p><span class="checkbox"></span> <strong>No prescribed medications documented</strong></p>'}
  </div>

  <!-- Section 3: Home Medications (including OTC) -->
  <div class="section">
    <div class="section-title">3. Home Medications - Patient Currently Taking (Including OTC & Supplements)</div>
    ${medsCurrent.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th style="width: 30%;">Medication/Supplement Name</th>
            <th style="width: 15%;">Dosage</th>
            <th style="width: 15%;">Route</th>
            <th style="width: 15%;">Frequency</th>
            <th style="width: 25%;">Patient Reported</th>
          </tr>
        </thead>
        <tbody>
          ${medsCurrent.map(med => `
            <tr>
              <td><strong>${this.escapeHtml(med.name)}</strong></td>
              <td>${this.escapeHtml(med.dosage)}</td>
              <td>${this.escapeHtml(med.route || 'PO')}</td>
              <td>${this.escapeHtml(med.frequency || '')}</td>
              <td><span class="checkbox"></span> Yes</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p><span class="checkbox"></span> <strong>No home medications reported</strong></p>'}
    <p style="margin-top: 10px; font-size: 9pt;">
      <strong>Source of Information:</strong>
      <span class="checkbox"></span> Patient Interview
      <span class="checkbox"></span> Family/Caregiver
      <span class="checkbox"></span> Medication List
      <span class="checkbox"></span> Pharmacy Records
      <span class="checkbox"></span> Transferring Facility
    </p>
  </div>

  <!-- Reconciliation Attestation -->
  <div class="signature-section">
    <h3 style="margin-top: 0;">Medication Reconciliation Attestation</h3>
    <p style="font-size: 10pt;">
      I attest that I have reviewed all medication lists above and completed medication reconciliation per
      Joint Commission NPSG.03.06.01 requirements. All discrepancies have been resolved and documented.
    </p>

    <div class="signature-grid">
      <div class="signature-box">
        <p><strong>Reconciled By (Physician/NP/PA):</strong></p>
        <div class="signature-line"></div>
        <p style="font-size: 9pt; margin: 0;">Signature</p>
        <p style="margin-top: 15px; font-size: 9pt;"><strong>Print Name:</strong> ___________________________</p>
        <p style="font-size: 9pt;"><strong>Date/Time:</strong> ___________________________</p>
      </div>

      <div class="signature-box">
        <p><strong>Verified By (RN):</strong></p>
        <div class="signature-line"></div>
        <p style="font-size: 9pt; margin: 0;">Signature</p>
        <p style="margin-top: 15px; font-size: 9pt;"><strong>Print Name:</strong> ___________________________</p>
        <p style="font-size: 9pt;"><strong>Date/Time:</strong> ___________________________</p>
      </div>
    </div>

    <div style="margin-top: 20px; padding: 10px; border: 2px solid #333;">
      <p style="margin: 0; font-size: 10pt;">
        <span class="checkbox"></span> <strong>All discrepancies resolved and documented in patient chart</strong><br/>
        <span class="checkbox"></span> <strong>Patient/family educated on medication changes</strong><br/>
        <span class="checkbox"></span> <strong>Updated medication list provided to patient</strong><br/>
        <span class="checkbox"></span> <strong>Medication reconciliation form filed in medical record</strong>
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>
      <strong>For Medical Records Only - Protected Health Information (PHI)</strong><br/>
      Generated: ${new Date().toLocaleString()} | Transfer ID: ${packet.packet_number}<br/>
      Joint Commission National Patient Safety Goal 03.06.01 - Medication Reconciliation<br/>
      This form satisfies medication reconciliation requirements for inter-facility patient transfers.
    </p>
  </div>
</body>
</html>`;

    return {
      html: formHtml,
      fileName: `MedRec_${packet.packet_number}_${new Date().getTime()}.html`
    };
  }

  /**
   * Helper to escape HTML characters
   */
  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Open form in new window for printing
   */
  static openFormForPrinting(form: JointCommissionMedRecForm): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(form.html);
      printWindow.document.close();
      printWindow.focus();
    }
  }

  /**
   * Download form as HTML file
   */
  static downloadForm(form: JointCommissionMedRecForm): void {
    const blob = new Blob([form.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = form.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export default JointCommissionFormService;
