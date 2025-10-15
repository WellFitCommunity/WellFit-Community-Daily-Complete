// src/pages/MetricsPage.tsx
import React, { useEffect, useState } from 'react';
import { useSupabaseClient } from '../contexts/AuthContext';
import { fetchPatientEngagementMetrics, PatientEngagementMetric } from '../api/metrics';

// If you already have a BrandingContext with tenant info, import it here:
// import { useBranding } from '../contexts/BrandingContext';

const MetricsPage: React.FC = () => {
  const supabase = useSupabaseClient();

  // 1) Provide your tenant UUID here.
  //    Replace with your actual source of tenant id (BrandingContext, route param, etc.)
  const TENANT_ID = '<PUT-YOUR-TENANT-UUID-HERE>';

  const [rows, setRows] = useState<PatientEngagementMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        setErrorMsg('');
        const data = await fetchPatientEngagementMetrics(supabase, {
          tenantId: TENANT_ID,
          // If you want “my data only”, pass the user’s id as userId; otherwise leave null
          userId: null,
        });
        if (isMounted) setRows(data);
      } catch (err: any) {
        if (isMounted) setErrorMsg(err.message ?? String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [supabase, TENANT_ID]);

  if (loading) return <div className="p-4">Loading metrics…</div>;
  if (errorMsg) return <div className="p-4 text-red-600">Error: {errorMsg}</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Patient Engagement Metrics</h1>
      {rows.length === 0 ? (
        <div className="text-gray-600">No data yet for this tenant.</div>
      ) : (
        <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2 border-b">User</th>
              <th className="text-left p-2 border-b">Last Check-In</th>
              <th className="text-left p-2 border-b">Check-Ins</th>
              <th className="text-left p-2 border-b">Engagement Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.user_id}-${r.tenant_id}`} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border-b">{r.user_id}</td>
                <td className="p-2 border-b">{r.last_check_in_at ?? '—'}</td>
                <td className="p-2 border-b">{r.check_in_count ?? '—'}</td>
                <td className="p-2 border-b">{r.engagement_score ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MetricsPage;
