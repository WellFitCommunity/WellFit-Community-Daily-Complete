/**
 * Shift Handoff Marker Summary
 *
 * Utilities for generating marker summaries for shift handoff reports.
 */

import {
  PatientMarker,
  MarkerCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from '../../../types/patientAvatar';

/**
 * Marker summary for a single patient
 */
export interface PatientMarkerSummary {
  patientId: string;
  patientName: string;
  totalMarkers: number;
  criticalCount: number;
  pendingCount: number;
  attentionCount: number;
  recentChanges: MarkerChange[];
  markersByCategory: CategorySummary[];
  highlights: string[];
}

/**
 * Category summary
 */
export interface CategorySummary {
  category: MarkerCategory;
  label: string;
  color: string;
  count: number;
  markers: MarkerBrief[];
}

/**
 * Brief marker info for summaries
 */
export interface MarkerBrief {
  id: string;
  displayName: string;
  bodyRegion: string;
  status: string;
  requiresAttention: boolean;
  insertionDate?: string;
}

/**
 * Recent marker change
 */
export interface MarkerChange {
  markerId: string;
  markerName: string;
  changeType: 'added' | 'removed' | 'modified' | 'confirmed' | 'rejected';
  changedAt: string;
  changedBy?: string;
}

/**
 * Generate marker summary for a patient
 */
export function generateMarkerSummary(
  patientId: string,
  patientName: string,
  markers: PatientMarker[],
  sinceTimestamp?: string
): PatientMarkerSummary {
  const activeMarkers = markers.filter((m) => m.is_active && m.status !== 'rejected');

  // Count by status
  const criticalCount = activeMarkers.filter((m) => m.category === 'critical').length;
  const pendingCount = activeMarkers.filter((m) => m.status === 'pending_confirmation').length;
  const attentionCount = activeMarkers.filter((m) => m.requires_attention).length;

  // Group by category
  const markersByCategory: CategorySummary[] = Object.entries(CATEGORY_LABELS)
    .map(([category, label]) => {
      const categoryMarkers = activeMarkers.filter((m) => m.category === category);
      return {
        category: category as MarkerCategory,
        label,
        color: CATEGORY_COLORS[category as MarkerCategory].bg,
        count: categoryMarkers.length,
        markers: categoryMarkers.map((m) => ({
          id: m.id,
          displayName: m.display_name,
          bodyRegion: m.body_region,
          status: m.status,
          requiresAttention: m.requires_attention,
          insertionDate: m.details?.insertion_date,
        })),
      };
    })
    .filter((c) => c.count > 0);

  // Find recent changes
  const recentChanges: MarkerChange[] = [];
  const sinceDate = sinceTimestamp ? new Date(sinceTimestamp) : new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const marker of markers) {
    const updatedAt = new Date(marker.updated_at);
    const createdAt = new Date(marker.created_at);

    if (createdAt > sinceDate) {
      recentChanges.push({
        markerId: marker.id,
        markerName: marker.display_name,
        changeType: 'added',
        changedAt: marker.created_at,
      });
    } else if (updatedAt > sinceDate && marker.status === 'confirmed') {
      recentChanges.push({
        markerId: marker.id,
        markerName: marker.display_name,
        changeType: 'confirmed',
        changedAt: marker.updated_at,
      });
    } else if (!marker.is_active && updatedAt > sinceDate) {
      recentChanges.push({
        markerId: marker.id,
        markerName: marker.display_name,
        changeType: 'removed',
        changedAt: marker.updated_at,
      });
    }
  }

  // Sort changes by time (most recent first)
  recentChanges.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

  // Generate highlights
  const highlights: string[] = [];

  if (criticalCount > 0) {
    highlights.push(`${criticalCount} critical device${criticalCount > 1 ? 's' : ''} (central lines, chest tubes, etc.)`);
  }

  if (pendingCount > 0) {
    highlights.push(`${pendingCount} marker${pendingCount > 1 ? 's' : ''} pending confirmation from SmartScribe`);
  }

  if (attentionCount > 0) {
    highlights.push(`${attentionCount} item${attentionCount > 1 ? 's' : ''} requiring attention`);
  }

  const recentAdds = recentChanges.filter((c) => c.changeType === 'added').length;
  if (recentAdds > 0) {
    highlights.push(`${recentAdds} new marker${recentAdds > 1 ? 's' : ''} added this shift`);
  }

  const recentRemoves = recentChanges.filter((c) => c.changeType === 'removed').length;
  if (recentRemoves > 0) {
    highlights.push(`${recentRemoves} marker${recentRemoves > 1 ? 's' : ''} removed this shift`);
  }

  return {
    patientId,
    patientName,
    totalMarkers: activeMarkers.length,
    criticalCount,
    pendingCount,
    attentionCount,
    recentChanges: recentChanges.slice(0, 10), // Limit to 10 most recent
    markersByCategory,
    highlights,
  };
}

/**
 * Generate text summary for voice/print
 */
export function generateTextSummary(summary: PatientMarkerSummary): string {
  const lines: string[] = [];

  lines.push(`Patient: ${summary.patientName}`);
  lines.push(`Total Markers: ${summary.totalMarkers}`);
  lines.push('');

  if (summary.highlights.length > 0) {
    lines.push('Key Points:');
    summary.highlights.forEach((h) => lines.push(`  - ${h}`));
    lines.push('');
  }

  if (summary.markersByCategory.length > 0) {
    lines.push('Markers by Category:');
    summary.markersByCategory.forEach((cat) => {
      lines.push(`  ${cat.label}: ${cat.count}`);
      cat.markers.forEach((m) => {
        const attention = m.requiresAttention ? ' [ATTENTION]' : '';
        const pending = m.status === 'pending_confirmation' ? ' [PENDING]' : '';
        lines.push(`    - ${m.displayName} (${m.bodyRegion})${attention}${pending}`);
      });
    });
    lines.push('');
  }

  if (summary.recentChanges.length > 0) {
    lines.push('Recent Changes:');
    summary.recentChanges.slice(0, 5).forEach((c) => {
      const time = new Date(c.changedAt).toLocaleTimeString();
      lines.push(`  - ${c.markerName} ${c.changeType} at ${time}`);
    });
  }

  return lines.join('\n');
}

/**
 * Generate HTML summary for reports
 */
export function generateHtmlSummary(summary: PatientMarkerSummary): string {
  const categoryRows = summary.markersByCategory
    .map(
      (cat) => `
        <tr>
          <td style="padding: 4px 8px;">
            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${cat.color}; margin-right: 6px;"></span>
            ${cat.label}
          </td>
          <td style="padding: 4px 8px; text-align: center; font-weight: bold;">${cat.count}</td>
          <td style="padding: 4px 8px; font-size: 11px;">
            ${cat.markers.map((m) => m.displayName).join(', ')}
          </td>
        </tr>
      `
    )
    .join('');

  const highlightsList = summary.highlights.map((h) => `<li>${h}</li>`).join('');

  return `
    <div style="font-family: system-ui, sans-serif; font-size: 12px;">
      <h4 style="margin: 0 0 8px 0; font-size: 14px;">
        ${summary.patientName} - Body Map Summary
      </h4>

      <div style="display: flex; gap: 16px; margin-bottom: 12px;">
        <div style="background: #fee2e2; padding: 8px 12px; border-radius: 4px;">
          <div style="font-size: 18px; font-weight: bold; color: #991b1b;">${summary.criticalCount}</div>
          <div style="font-size: 10px; color: #991b1b;">Critical</div>
        </div>
        <div style="background: #fef3c7; padding: 8px 12px; border-radius: 4px;">
          <div style="font-size: 18px; font-weight: bold; color: #92400e;">${summary.pendingCount}</div>
          <div style="font-size: 10px; color: #92400e;">Pending</div>
        </div>
        <div style="background: #dbeafe; padding: 8px 12px; border-radius: 4px;">
          <div style="font-size: 18px; font-weight: bold; color: #1e40af;">${summary.totalMarkers}</div>
          <div style="font-size: 10px; color: #1e40af;">Total</div>
        </div>
      </div>

      ${
        summary.highlights.length > 0
          ? `
        <div style="margin-bottom: 12px;">
          <strong>Key Points:</strong>
          <ul style="margin: 4px 0; padding-left: 20px;">${highlightsList}</ul>
        </div>
      `
          : ''
      }

      ${
        categoryRows
          ? `
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd; font-size: 11px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 6px 8px; text-align: left;">Category</th>
              <th style="padding: 6px 8px; text-align: center;">Count</th>
              <th style="padding: 6px 8px; text-align: left;">Items</th>
            </tr>
          </thead>
          <tbody>${categoryRows}</tbody>
        </table>
      `
          : ''
      }
    </div>
  `;
}

export default {
  generateMarkerSummary,
  generateTextSummary,
  generateHtmlSummary,
};
