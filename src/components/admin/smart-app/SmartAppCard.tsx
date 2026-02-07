/**
 * SmartAppCard - Individual SMART app display card
 *
 * Shows app details, status badge, developer info, and action buttons.
 * Used by SmartAppManagementPanel in the app list.
 */

import React from 'react';
import {
  Edit2,
  Trash2,
  Key,
  ExternalLink,
  AlertTriangle,
  Copy,
  Ban,
  Play,
  Users,
  Clock,
  Smartphone,
} from 'lucide-react';
import type { SmartApp } from './SmartAppManagement.types';
import { appTypeIcons, appTypeLabels, statusColors } from './SmartAppManagement.types';

interface SmartAppCardProps {
  app: SmartApp;
  onEdit: (app: SmartApp) => void;
  onReview: (app: SmartApp) => void;
  onSuspend: (app: SmartApp) => void;
  onReactivate: (app: SmartApp) => void;
  onRevoke: (app: SmartApp) => void;
  onCopy: (text: string) => void;
}

export const SmartAppCard: React.FC<SmartAppCardProps> = ({
  app,
  onEdit,
  onReview,
  onSuspend,
  onReactivate,
  onRevoke,
  onCopy,
}) => {
  const Icon = appTypeIcons[app.app_type] || Smartphone;

  return (
    <div
      className={`bg-white border rounded-lg p-4 ${
        app.status === 'revoked' ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gray-100 rounded-lg">
            <Icon className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{app.client_name}</h3>
              <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[app.status]}`}>
                {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
              </span>
              {app.is_confidential && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Confidential
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {app.client_description || 'No description'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Key className="w-3 h-3" />
                {app.client_id}
                <button
                  onClick={() => onCopy(app.client_id)}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {app.active_authorizations} active / {app.total_authorizations} total
              </span>
              {app.last_authorization_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last auth: {new Date(app.last_authorization_at).toLocaleDateString()}
                </span>
              )}
              {app.client_uri && (
                <a
                  href={app.client_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-teal-600 hover:text-teal-700"
                >
                  <ExternalLink className="w-3 h-3" />
                  Website
                </a>
              )}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              {appTypeLabels[app.app_type]}
              {app.developer_email && ` • ${app.developer_email}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {app.status === 'pending' && (
            <button
              onClick={() => onReview(app)}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
            >
              Review
            </button>
          )}
          {app.status === 'approved' && (
            <button
              onClick={() => onSuspend(app)}
              className="p-2 text-gray-400 hover:text-orange-600"
              title="Suspend"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
          {app.status === 'suspended' && (
            <button
              onClick={() => onReactivate(app)}
              className="p-2 text-gray-400 hover:text-green-600"
              title="Reactivate"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(app)}
            className="p-2 text-gray-400 hover:text-blue-600"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {app.status !== 'revoked' && (
            <button
              onClick={() => onRevoke(app)}
              className="p-2 text-gray-400 hover:text-red-600"
              title="Revoke"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Rejection reason */}
      {app.status === 'rejected' && app.rejection_reason && (
        <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Rejection Reason:</span>
          </div>
          <p className="text-red-600 text-sm mt-1">{app.rejection_reason}</p>
        </div>
      )}
    </div>
  );
};

export default SmartAppCard;
