/**
 * TimeClockPage
 *
 * Main time clock page with tabs for Clock In/Out and History.
 * Shows today's hours and weekly cumulative prominently.
 */

import React, { useState, useEffect } from 'react';
import { Clock, History, Lock } from 'lucide-react';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { EAPageLayout, EATabs, EATabsList, EATabsTrigger, EATabsContent, EABadge, EACard, EACardContent } from '../envision-atlus';
import { ClockInOutWidget } from './ClockInOutWidget';
import { TimeHistory } from './TimeHistory';
import { auditLogger } from '../../services/auditLogger';
import { useModuleAccess } from '../../hooks/useModuleAccess';

export const TimeClockPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clock');

  // Check module access (tenant must have purchased AND enabled time clock)
  const { canAccess, loading: moduleLoading, denialReason } = useModuleAccess('time_clock_enabled');

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

  if (loading || moduleLoading) {
    return (
      <EAPageLayout title="Time Clock">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      </EAPageLayout>
    );
  }

  // Module access denied
  if (!canAccess) {
    return (
      <EAPageLayout title="Time Clock">
        <div className="max-w-md mx-auto">
          <EACard>
            <EACardContent className="text-center py-12">
              <Lock className="h-12 w-12 mx-auto mb-4 text-slate-500" />
              <h3 className="text-lg font-semibold text-white mb-2">Time Clock Not Available</h3>
              <p className="text-slate-400">
                {denialReason === 'not_entitled'
                  ? 'Your organization has not purchased the Time Clock module. Contact your administrator to upgrade.'
                  : denialReason === 'not_enabled'
                  ? 'The Time Clock module is not enabled for your organization. Contact your administrator.'
                  : 'Unable to access the Time Clock module.'}
              </p>
            </EACardContent>
          </EACard>
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
        <EATabs defaultValue="clock" value={activeTab} onValueChange={setActiveTab}>
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
