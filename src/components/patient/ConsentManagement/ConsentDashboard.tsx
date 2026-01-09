/**
 * ConsentDashboard - Patient Consent Management Portal
 *
 * Allows patients to:
 * - View who has access to their health data
 * - View authorized third-party apps (SMART on FHIR)
 * - Grant/revoke access to providers and apps
 * - View access audit log
 *
 * Compliance: 21st Century Cures Act, HIPAA Privacy Rule
 */

import React, { useState } from 'react';
import { Shield, Users, Smartphone, History, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../hooks/useToast';
import AuthorizedAppsList from './AuthorizedAppsList';
import ConsentAuditLog from './ConsentAuditLog';
import GrantAccessModal from './GrantAccessModal';

type TabType = 'overview' | 'apps' | 'providers' | 'audit';

interface ConsentStats {
  activeConsents: number;
  authorizedApps: number;
  recentAccess: number;
  pendingRequests: number;
}

/** Patient consent record from database */
interface PatientConsent {
  id: string;
  patient_id: string;
  consent_category: string;
  purpose: string;
  external_system_name?: string;
  scopes_granted?: string[];
  data_categories?: string[];
  status: string;
  granted_at: string;
  expires_at?: string;
  revoked_at?: string;
}

/** Care team member with practitioner data */
interface CareTeamMember {
  id: string;
  patient_id: string;
  member_name?: string;
  role?: string;
  practitioner?: {
    id: string;
    name?: string;
    specialty?: string;
  } | null;
}

const ConsentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [stats, setStats] = useState<ConsentStats>({
    activeConsents: 0,
    authorizedApps: 0,
    recentAccess: 0,
    pendingRequests: 0,
  });

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Shield },
    { id: 'apps' as const, label: 'Connected Apps', icon: Smartphone },
    { id: 'providers' as const, label: 'Providers', icon: Users },
    { id: 'audit' as const, label: 'Access Log', icon: History },
  ];

  const handleStatsUpdate = (newStats: Partial<ConsentStats>) => {
    setStats(prev => ({ ...prev, ...newStats }));
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Please log in to manage your consent settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Shield className="mr-3 text-blue-600" />
              Consent Management
            </h1>
            <p className="text-gray-600 mt-1">
              Control who can access your health information
            </p>
          </div>
          <button
            onClick={() => setShowGrantModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Users className="mr-2 w-4 h-4" />
            Grant Access
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Active Consents</p>
                <p className="text-2xl font-bold text-green-800">{stats.activeConsents}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Connected Apps</p>
                <p className="text-2xl font-bold text-blue-800">{stats.authorizedApps}</p>
              </div>
              <Smartphone className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Recent Access</p>
                <p className="text-2xl font-bold text-purple-800">{stats.recentAccess}</p>
              </div>
              <History className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Pending</p>
                <p className="text-2xl font-bold text-orange-800">{stats.pendingRequests}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center justify-center ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTab userId={user.id} onStatsUpdate={handleStatsUpdate} />
          )}
          {activeTab === 'apps' && (
            <AuthorizedAppsList
              userId={user.id}
              onCountUpdate={(count) => handleStatsUpdate({ authorizedApps: count })}
            />
          )}
          {activeTab === 'providers' && (
            <ProvidersTab userId={user.id} />
          )}
          {activeTab === 'audit' && (
            <ConsentAuditLog
              userId={user.id}
              onCountUpdate={(count) => handleStatsUpdate({ recentAccess: count })}
            />
          )}
        </div>
      </div>

      {/* Your Rights Notice */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Your Data Rights</h3>
        <p className="text-sm text-blue-700">
          Under the <strong>21st Century Cures Act</strong> and <strong>HIPAA Privacy Rule</strong>,
          you have the right to control who accesses your health information. You can grant or
          revoke access at any time. All access to your data is logged and available for your review.
        </p>
      </div>

      {/* Grant Access Modal */}
      {showGrantModal && (
        <GrantAccessModal
          userId={user.id}
          onClose={() => setShowGrantModal(false)}
          onSuccess={() => {
            setShowGrantModal(false);
            // Refresh will happen via React Query
          }}
        />
      )}
    </div>
  );
};

// Overview Tab Component
interface OverviewTabProps {
  userId: string;
  onStatsUpdate: (stats: Partial<ConsentStats>) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ userId, onStatsUpdate }) => {
  const [consents, setConsents] = React.useState<PatientConsent[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadConsents();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadConsents is stable, userId captures trigger
  }, [userId]);

  const loadConsents = async () => {
    setLoading(true);
    try {
      // Import supabase dynamically to avoid circular deps
      const { supabase } = await import('../../../lib/supabaseClient');

      const { data, error } = await supabase
        .from('patient_consents')
        .select('*')
        .eq('patient_id', userId)
        .eq('status', 'active')
        .order('granted_at', { ascending: false });

      if (!error && data) {
        setConsents(data);
        onStatsUpdate({ activeConsents: data.length });
      }
    } catch (err: unknown) {
      // Silent fail - will show empty state
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-gray-200 rounded-lg"></div>
        <div className="h-20 bg-gray-200 rounded-lg"></div>
        <div className="h-20 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  if (consents.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Consents</h3>
        <p className="text-gray-600 mb-4">
          You haven't granted access to any providers or apps yet.
        </p>
        <p className="text-sm text-gray-500">
          When you authorize a healthcare provider or app to access your data,
          it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Active Data Sharing</h3>

      {consents.map((consent) => (
        <ConsentCard key={consent.id} consent={consent} onRevoke={loadConsents} />
      ))}
    </div>
  );
};

// Consent Card Component
interface ConsentCardProps {
  consent: PatientConsent;
  onRevoke: () => void;
}

const ConsentCard: React.FC<ConsentCardProps> = ({ consent, onRevoke }) => {
  const [revoking, setRevoking] = useState(false);
  const { showToast, ToastContainer } = useToast();

  const handleRevoke = async () => {
    if (!confirm('Are you sure you want to revoke this access? This action cannot be undone.')) {
      return;
    }

    setRevoking(true);
    try {
      const { supabase } = await import('../../../lib/supabaseClient');

      const { error } = await supabase
        .from('patient_consents')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
        })
        .eq('id', consent.id);

      if (!error) {
        showToast('success', 'Access revoked successfully.');
        onRevoke();
      } else {
        showToast('error', 'Failed to revoke access. Please try again.');
      }
    } catch (err: unknown) {
      showToast('error', 'Failed to revoke access. Please try again.');
    }
    setRevoking(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'third_party_app':
        return <Smartphone className="w-5 h-5 text-blue-600" />;
      case 'data_sharing':
        return <Users className="w-5 h-5 text-green-600" />;
      case 'research':
        return <Shield className="w-5 h-5 text-purple-600" />;
      default:
        return <Shield className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <>
      <ToastContainer />
      <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-start">
            <div className="mr-4 mt-1">
              {getCategoryIcon(consent.consent_category)}
            </div>
            <div>
              <h4 className="font-medium text-gray-900">
                {consent.external_system_name || consent.purpose}
              </h4>
              <p className="text-sm text-gray-600 mt-1">{consent.purpose}</p>

              {consent.scopes_granted && consent.scopes_granted.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {consent.scopes_granted.slice(0, 3).map((scope: string, idx: number) => (
                    <span
                      key={idx}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                    >
                      {scope.replace('patient/', '').replace('.read', '')}
                    </span>
                  ))}
                  {consent.scopes_granted.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{consent.scopes_granted.length - 3} more
                    </span>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-500 mt-2">
                Granted: {formatDate(consent.granted_at)}
                {consent.expires_at && ` · Expires: ${formatDate(consent.expires_at)}`}
              </p>
            </div>
          </div>

          <button
            onClick={handleRevoke}
            disabled={revoking}
            className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
          >
            {revoking ? 'Revoking...' : 'Revoke'}
          </button>
        </div>
      </div>
    </>
  );
};

// Providers Tab Component
interface ProvidersTabProps {
  userId: string;
}

const ProvidersTab: React.FC<ProvidersTabProps> = ({ userId }) => {
  const [providers, setProviders] = React.useState<CareTeamMember[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadProviders is stable, userId captures trigger
  }, [userId]);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../../../lib/supabaseClient');

      // Get providers from care team
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .select(`
          *,
          practitioner:fhir_practitioners(*)
        `)
        .eq('patient_id', userId);

      if (!error && data) {
        setProviders(data);
      }
    } catch (err: unknown) {
      // Silent fail
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-gray-200 rounded-lg"></div>
        <div className="h-20 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Care Team Members</h3>
        <p className="text-gray-600">
          Your care team providers will appear here once they are added to your record.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Your Care Team</h3>
      <p className="text-sm text-gray-600 mb-4">
        These healthcare providers have access to your health information as part of your care team.
      </p>

      {providers.map((member) => (
        <div key={member.id} className="border rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">
                {member.practitioner?.name || member.member_name || 'Care Team Member'}
              </h4>
              <p className="text-sm text-gray-600">
                {member.role || 'Provider'} · {member.practitioner?.specialty || 'Healthcare'}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConsentDashboard;
