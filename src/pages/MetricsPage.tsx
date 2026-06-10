// src/pages/MetricsPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { fetchPatientEngagementMetrics, PatientEngagementMetric } from '../api/metrics';

const MetricsPage: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();

  const [rows, setRows] = useState<PatientEngagementMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        setErrorMsg('');

        if (!user?.id) {
          if (isMounted) {
            setRows([]);
            setErrorMsg('You must be signed in to view engagement metrics.');
          }
          return;
        }

        // Resolve the caller's tenant from their own profile (profiles PK is user_id).
        // RLS on patient_engagement_metrics still governs which rows the RPC returns.
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();
        if (profileError) throw profileError;

        const tenantId = profile?.tenant_id;
        if (!tenantId) {
          if (isMounted) {
            setRows([]);
            setErrorMsg('No tenant is associated with your account.');
          }
          return;
        }

        const data = await fetchPatientEngagementMetrics(supabase, {
          tenantId,
          // null = all patients in the tenant (admin view); RLS still applies.
          userId: null,
        });
        if (isMounted) setRows(data);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (isMounted) setErrorMsg(errMsg);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [supabase, user?.id]);

  if (loading) return <div className="p-4">Loading metrics…</div>;
  if (errorMsg) return <div className="p-4 text-red-600">Error: {errorMsg}</div>;

  return (
    <div className="p-4 space-y-4">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="text-sm font-medium">Back</span>
      </button>

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
