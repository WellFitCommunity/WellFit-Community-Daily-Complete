/**
 * Self Reporting — Previous Reports History List
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React from 'react';
import { useBranding } from '../../BrandingContext';
import type { SelfReportLog } from './types';
import { colorForSource } from './types';

interface ReportHistoryProps {
  reports: SelfReportLog[];
}

const ReportHistory: React.FC<ReportHistoryProps> = ({ reports }) => {
  const { branding } = useBranding();

  return (
    <div className="mt-8">
      <h2 className="text-lg sm:text-xl font-semibold mb-4" style={{ color: branding.primaryColor }}>
        Your Previous Reports
      </h2>
      {reports.length === 0 ? (
        <p className="text-white/90">No reports yet.</p>
      ) : (
        reports.map((log) => (
          <div
            key={log.id}
            style={{
              borderLeft: `8px solid ${colorForSource(log.source_type)}`,
              padding: '8px',
              marginBottom: '8px',
              background: '#fff',
            }}
            className="rounded-md shadow-xs"
          >
            <strong>{new Date(log.created_at).toLocaleString()}</strong>
            <span
              style={{ color: colorForSource(log.source_type), fontWeight: 'bold', marginLeft: 8 }}
            >
              {log.source_type === 'self' ? 'Self' : 'Staff'}
            </span>
            <br />
            <strong>😊 Mood:</strong> {log.mood}
            {log.blood_pressure_systolic && log.blood_pressure_diastolic && (
              <>
                <br />
                <strong>🩸 Blood Pressure:</strong> {log.blood_pressure_systolic}/{log.blood_pressure_diastolic}
              </>
            )}
            {log.blood_sugar && (
              <>
                <br />
                <strong>🍯 Blood Sugar:</strong> {log.blood_sugar} mg/dL
              </>
            )}
            {log.blood_oxygen && (
              <>
                <br />
                <strong>🫁 Blood Oxygen:</strong> {log.blood_oxygen}%
              </>
            )}
            {log.weight && (
              <>
                <br />
                <strong>⚖️ Weight:</strong> {log.weight} lbs
              </>
            )}
            {log.physical_activity && (
              <>
                <br />
                <strong>🏃‍♀️ Activity:</strong> {log.physical_activity}
              </>
            )}
            {log.social_engagement && (
              <>
                <br />
                <strong>👥 Social:</strong> {log.social_engagement}
              </>
            )}
            {log.symptoms && (
              <>
                <br />
                <strong>🤒 Symptoms:</strong> {log.symptoms}
              </>
            )}
            {log.activity_description && (
              <>
                <br />
                <strong>📓 Notes:</strong> {log.activity_description}
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default ReportHistory;
