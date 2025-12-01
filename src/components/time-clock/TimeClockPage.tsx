/**
 * TimeClockPage
 *
 * Main time clock page with tabs for Clock In/Out and History.
 * Shows today's hours and weekly cumulative prominently.
 */

import React, { useState, useEffect } from 'react';
import { Clock, History, Settings } from 'lucide-react';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { EAPageLayout, EATabs, EATabsList, EATabsTrigger, EATabsContent, EABadge } from '../envision-atlus';
import { ClockInOutWidget } from './ClockInOutWidget';
import { TimeHistory } from './TimeHistory';
import { auditLogger } from '../../services/auditLogger';

export const TimeClockPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clock');

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user?.id) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.tenant_id) {
          setTenantId(profile.tenant_id);
        }
      } catch (error) {
        await auditLogger.error('TIME_CLOCK_PAGE_LOAD_FAILED', error as Error, {
          category: 'ADMINISTRATIVE',
        });
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [user, supabase]);

  if (loading) {
    return (
      <EAPageLayout title="Time Clock">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      </EAPageLayout>
    );
  }

  if (!user?.id || !tenantId) {
    return (
      <EAPageLayout title="Time Clock">
        <div className="text-center py-12 text-slate-400">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Unable to load time clock</p>
          <p className="text-sm mt-1">Please try refreshing the page</p>
        </div>
      </EAPageLayout>
    );
  }

  return (
    <EAPageLayout
      title="Time Clock"
      subtitle="Track your work hours"
      badge={<EABadge variant="info">Employee Portal</EABadge>}
    >
      <div className="max-w-2xl mx-auto">
        <EATabs value={activeTab} onValueChange={setActiveTab}>
          <EATabsList className="mb-6">
            <EATabsTrigger value="clock">
              <Clock className="h-4 w-4 mr-2" />
              Clock In/Out
            </EATabsTrigger>
            <EATabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              History
            </EATabsTrigger>
          </EATabsList>

          <EATabsContent value="clock">
            <ClockInOutWidget userId={user.id} tenantId={tenantId} />
          </EATabsContent>

          <EATabsContent value="history">
            <TimeHistory userId={user.id} tenantId={tenantId} />
          </EATabsContent>
        </EATabs>
      </div>
    </EAPageLayout>
  );
};

export default TimeClockPage;
