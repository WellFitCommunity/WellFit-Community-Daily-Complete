// ============================================================================
// Cross-Role Context Module - View and share context with other roles
// ============================================================================

import React, { useState, useEffect } from 'react';
import { ClaudeCareAssistant } from '../../services/claudeCareAssistant';
import { CareContextEntry, CareContextType } from '../../types/claudeCareAssistant';

interface Props {
  userRole: string;
  patientId: string;
  userId?: string;
}

const CrossRoleContextModule: React.FC<Props> = ({ userRole, patientId, userId }) => {
  const [contextEntries, setContextEntries] = useState<CareContextEntry[]>([]);
  const [newContext, setNewContext] = useState('');
  const [contextType, setContextType] = useState<CareContextType>('clinical');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<CareContextType | 'all'>('all');

  useEffect(() => {
    loadContextEntries();
     
  }, [patientId]);

  const loadContextEntries = async () => {
    setLoading(true);
    try {
      const entries = await ClaudeCareAssistant.getCareContext(patientId);
      setContextEntries(entries);
    } catch (err) {

      setError('Failed to load care context');
    } finally {
      setLoading(false);
    }
  };

  const handleShareContext = async () => {
    if (!newContext.trim() || !userId) {
      setError('Context summary is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await ClaudeCareAssistant.shareCareContext({
        patientId,
        contextType,
        contributedByRole: userRole,
        contributedByUser: userId,
        contextData: { summary: newContext },
        contextSummary: newContext,
        isActive: true,
      });

      setNewContext('');
      await loadContextEntries();
    } catch (err) {

      setError('Failed to share context');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string): string => {
    const colors: Record<string, string> = {
      physician: 'bg-blue-100 text-blue-800',
      nurse: 'bg-green-100 text-green-800',
      nurse_practitioner: 'bg-teal-100 text-teal-800',
      physician_assistant: 'bg-indigo-100 text-indigo-800',
      case_manager: 'bg-purple-100 text-purple-800',
      social_worker: 'bg-pink-100 text-pink-800',
      admin: 'bg-gray-100 text-gray-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getContextTypeColor = (type: CareContextType): string => {
    const colors: Record<CareContextType, string> = {
      clinical: 'bg-red-100 text-red-800',
      social: 'bg-blue-100 text-blue-800',
      administrative: 'bg-yellow-100 text-yellow-800',
      cultural: 'bg-purple-100 text-purple-800',
    };
    return colors[type];
  };

  const getContextTypeIcon = (type: CareContextType): string => {
    const icons: Record<CareContextType, string> = {
      clinical: '🩺',
      social: '👥',
      administrative: '📋',
      cultural: '🌍',
    };
    return icons[type];
  };

  const filteredEntries = filterType === 'all'
    ? contextEntries
    : contextEntries.filter((entry) => entry.contextType === filterType);

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Add New Context */}
      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Context with Team</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Context Type
            </label>
            <select
              value={contextType}
              onChange={(e) => setContextType(e.target.value as CareContextType)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="clinical">Clinical</option>
              <option value="social">Social</option>
              <option value="administrative">Administrative</option>
              <option value="cultural">Cultural</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Context Summary
            </label>
            <textarea
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              rows={4}
              placeholder="Share important context with other care team members..."
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleShareContext}
            disabled={loading || !newContext.trim() || !userId}
            className={`w-full py-3 px-6 rounded-md font-semibold text-white transition-colors ${
              loading || !newContext.trim() || !userId
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Sharing...' : 'Share Context'}
          </button>

          {!userId && (
            <p className="text-sm text-yellow-700">User ID required to share context</p>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Team Context Timeline</h3>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as CareContextType | 'all')}
          className="p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Types</option>
          <option value="clinical">Clinical</option>
          <option value="social">Social</option>
          <option value="administrative">Administrative</option>
          <option value="cultural">Cultural</option>
        </select>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-md">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="mt-4 text-gray-600">No team context entries yet</p>
            <p className="text-sm text-gray-500">Be the first to share context with the care team</p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white border border-gray-200 rounded-md p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getContextTypeIcon(entry.contextType)}</span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-sm ${getRoleBadgeColor(entry.contributedByRole)}`}>
                        {entry.contributedByRole.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-sm ${getContextTypeColor(entry.contextType)}`}>
                        {entry.contextType}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {entry.createdAt && formatRelativeTime(entry.createdAt)}
                    </p>
                  </div>
                </div>

                {entry.validUntil && (
                  <span className="text-xs text-yellow-600">
                    Expires: {new Date(entry.validUntil).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="ml-11">
                <p className="text-gray-800">{entry.contextSummary}</p>

                {entry.contextData && Object.keys(entry.contextData).length > 1 && (
                  <details className="mt-2">
                    <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                      View Details
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-50 p-2 rounded-sm border border-gray-200 overflow-x-auto">
                      {JSON.stringify(entry.contextData, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h4 className="font-semibold text-blue-900 mb-2">About Team Context</h4>
        <p className="text-sm text-blue-800">
          Share important information with other care team members working with this patient.
          Context entries are visible to all clinical staff and help coordinate seamless care.
        </p>
        <ul className="mt-2 space-y-1 text-sm text-blue-800">
          <li>• <strong>Clinical:</strong> Medical observations, symptoms, treatment updates</li>
          <li>• <strong>Social:</strong> Psychosocial factors, family dynamics, support needs</li>
          <li>• <strong>Administrative:</strong> Insurance, discharge planning, coordination</li>
          <li>• <strong>Cultural:</strong> Language preferences, cultural considerations</li>
        </ul>
      </div>
    </div>
  );
};

export default CrossRoleContextModule;
