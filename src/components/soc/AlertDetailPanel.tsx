/**
 * Alert Detail Panel - SOC Dashboard
 *
 * Detailed view of a security alert with:
 * - Full alert information
 * - Team messaging/collaboration
 * - Action buttons (acknowledge, assign, resolve)
 * - Timeline of events
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { getSOCDashboardService } from '../../services/socDashboardService';
import {
  SecurityAlert,
  AlertMessage,
  SOCPresence,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
} from '../../types/socDashboard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';

interface AlertDetailPanelProps {
  alert: SecurityAlert;
  operators: SOCPresence[];
  onAcknowledge: () => void;
  onAssign: (assigneeId: string) => void;
  onResolve: (resolution: string) => void;
  onFalsePositive: (reason: string) => void;
  onClose: () => void;
}

export const AlertDetailPanel: React.FC<AlertDetailPanelProps> = ({
  alert,
  operators,
  onAcknowledge,
  onAssign,
  onResolve,
  onFalsePositive,
  onClose,
}) => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const service = getSOCDashboardService(supabase);

  // Check if this is a Guardian approval alert
  const isGuardianApproval = alert.alert_type === 'guardian_approval_required';
  const guardianTicketId = alert.metadata?.ticket_id as string | undefined;

  const [messages, setMessages] = useState<AlertMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showFalsePositiveModal, setShowFalsePositiveModal] = useState(false);
  const [resolution, setResolution] = useState('');
  const [falsePositiveReason, setFalsePositiveReason] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const severityConfig = SEVERITY_CONFIG[alert.severity];
  const statusConfig = STATUS_CONFIG[alert.status];

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      const data = await service.getAlertMessages(alert.id);
      setMessages(data);
    };
    loadMessages();

    // Subscribe to new messages
    service.subscribeToMessages(alert.id, (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      service.unsubscribeFromMessages();
    };
  }, [alert.id, service]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await service.addMessage(alert.id, newMessage.trim());
      setNewMessage('');
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{severityConfig.icon}</span>
              <span className={`px-2 py-1 rounded-sm text-sm ${severityConfig.bgColor} ${severityConfig.color}`}>
                {severityConfig.label}
              </span>
              <span className={`px-2 py-1 rounded-sm text-sm ${statusConfig.bgColor} ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
              {alert.escalated && (
                <EABadge variant="critical" pulse>ESCALATED</EABadge>
              )}
            </div>
            <h2 className="text-xl font-bold text-white">{alert.title}</h2>
            <p className="text-sm text-slate-400 mt-1">
              Alert ID: {alert.id.substring(0, 8)}... | Created: {new Date(alert.created_at).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>
      </div>

      {/* Alert Details */}
      <div className="p-4 border-b border-slate-700 bg-slate-850">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs text-slate-500 uppercase mb-1">Description</h3>
            <p className="text-sm text-slate-300">{alert.description || 'No description'}</p>
          </div>
          <div>
            <h3 className="text-xs text-slate-500 uppercase mb-1">Detection</h3>
            <p className="text-sm text-slate-300">
              Method: {alert.detection_method || 'Unknown'}<br />
              {alert.source_ip && <>Source IP: {alert.source_ip}<br /></>}
              {alert.confidence_score !== null && <>Confidence: {(alert.confidence_score * 100).toFixed(0)}%</>}
            </p>
          </div>
          {alert.threshold_value && (
            <div>
              <h3 className="text-xs text-slate-500 uppercase mb-1">Threshold</h3>
              <p className="text-sm text-slate-300">
                Value: {alert.actual_value} / Threshold: {alert.threshold_value}
              </p>
            </div>
          )}
          {alert.affected_user_id && (
            <div>
              <h3 className="text-xs text-slate-500 uppercase mb-1">Affected User</h3>
              <p className="text-sm text-slate-300">
                {(alert as unknown as { affected_user?: { email?: string } }).affected_user?.email || alert.affected_user_id.substring(0, 8)}
              </p>
            </div>
          )}
        </div>

        {/* Metadata */}
        {alert.metadata && Object.keys(alert.metadata).length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs text-slate-500 uppercase mb-1">Additional Details</h3>
            <pre className="text-xs bg-slate-900 p-2 rounded-sm overflow-x-auto text-slate-300">
              {JSON.stringify(alert.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-b border-slate-700 flex flex-wrap gap-2">
        {/* Guardian Approval Button - show prominently if this is a Guardian approval alert */}
        {isGuardianApproval && guardianTicketId && (
          <EAButton
            variant="primary"
            size="sm"
            onClick={() => navigate(`/guardian/approval/${guardianTicketId}`)}
            className="bg-teal-600! hover:bg-teal-500!"
          >
            🛡️ Review in Guardian
          </EAButton>
        )}
        {alert.status === 'new' && (
          <EAButton variant="primary" size="sm" onClick={onAcknowledge}>
            ✋ Acknowledge
          </EAButton>
        )}
        <EAButton
          variant="secondary"
          size="sm"
          onClick={() => setShowAssignModal(true)}
        >
          👤 Assign
        </EAButton>
        {alert.status !== 'resolved' && alert.status !== 'false_positive' && (
          <>
            <EAButton
              variant="secondary"
              size="sm"
              onClick={() => setShowResolveModal(true)}
            >
              ✅ Resolve
            </EAButton>
            <EAButton
              variant="secondary"
              size="sm"
              onClick={() => setShowFalsePositiveModal(true)}
            >
              ❌ False Positive
            </EAButton>
          </>
        )}
      </div>

      {/* Guardian Approval Notice */}
      {isGuardianApproval && (
        <div className="p-4 bg-teal-500/10 border-b border-teal-500/30">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <div>
              <p className="text-teal-300 font-semibold">Guardian Approval Required</p>
              <p className="text-sm text-teal-400/80">
                This alert requires review and approval before the Guardian Agent can apply the fix.
                {guardianTicketId ? (
                  <button
                    onClick={() => navigate(`/guardian/approval/${guardianTicketId}`)}
                    className="ml-1 text-teal-300 underline hover:text-teal-200"
                  >
                    Open Guardian Review Form →
                  </button>
                ) : (
                  <span className="ml-1 text-slate-400">(Ticket ID not found)</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-2 bg-slate-700/50 text-xs text-slate-400">
          Team Discussion
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              No messages yet. Start the discussion.
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-slate-700 bg-slate-800">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 bg-slate-700 border border-slate-600 rounded-sm px-3 py-2 text-white placeholder-slate-400 focus:outline-hidden focus:border-teal-500"
              disabled={sending}
            />
            <EAButton
              variant="primary"
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
            >
              Send
            </EAButton>
          </div>
        </div>
      </div>

      {/* Resolve Modal */}
      {showResolveModal && (
        <Modal onClose={() => setShowResolveModal(false)}>
          <h3 className="text-lg font-bold mb-4">Resolve Alert</h3>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Describe how the alert was resolved..."
            className="w-full h-32 bg-slate-700 border border-slate-600 rounded-sm p-3 text-white placeholder-slate-400 focus:outline-hidden focus:border-teal-500 mb-4"
          />
          <div className="flex justify-end gap-2">
            <EAButton variant="secondary" onClick={() => setShowResolveModal(false)}>
              Cancel
            </EAButton>
            <EAButton
              variant="primary"
              onClick={() => {
                onResolve(resolution);
                setShowResolveModal(false);
              }}
              disabled={!resolution.trim()}
            >
              Resolve Alert
            </EAButton>
          </div>
        </Modal>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <Modal onClose={() => setShowAssignModal(false)}>
          <h3 className="text-lg font-bold mb-4">Assign Alert</h3>
          <p className="text-sm text-slate-400 mb-4">Select a team member to assign this alert:</p>
          <div className="space-y-2 mb-4">
            {operators.map((op) => (
              <button
                key={op.user_id}
                onClick={() => {
                  onAssign(op.user_id);
                  setShowAssignModal(false);
                }}
                className="w-full text-left px-4 py-3 rounded-sm bg-slate-700 hover:bg-slate-600 flex items-center gap-3"
              >
                <span className={`w-2 h-2 rounded-full ${
                  op.status === 'online' ? 'bg-green-500' :
                  op.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'
                }`} />
                <span className="text-white">{op.user_name}</span>
                {op.current_alert_id && (
                  <span className="text-xs text-slate-400 ml-auto">
                    Working on alert
                  </span>
                )}
              </button>
            ))}
            {operators.length === 0 && (
              <p className="text-slate-400 text-center py-4">No operators online</p>
            )}
          </div>
          <div className="flex justify-end">
            <EAButton variant="secondary" onClick={() => setShowAssignModal(false)}>
              Cancel
            </EAButton>
          </div>
        </Modal>
      )}

      {/* False Positive Modal */}
      {showFalsePositiveModal && (
        <Modal onClose={() => setShowFalsePositiveModal(false)}>
          <h3 className="text-lg font-bold mb-4">Mark as False Positive</h3>
          <textarea
            value={falsePositiveReason}
            onChange={(e) => setFalsePositiveReason(e.target.value)}
            placeholder="Explain why this is a false positive..."
            className="w-full h-32 bg-slate-700 border border-slate-600 rounded-sm p-3 text-white placeholder-slate-400 focus:outline-hidden focus:border-teal-500 mb-4"
          />
          <div className="flex justify-end gap-2">
            <EAButton variant="secondary" onClick={() => setShowFalsePositiveModal(false)}>
              Cancel
            </EAButton>
            <EAButton
              variant="danger"
              onClick={() => {
                onFalsePositive(falsePositiveReason);
                setShowFalsePositiveModal(false);
              }}
              disabled={!falsePositiveReason.trim()}
            >
              Mark as False Positive
            </EAButton>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ============================================================================
// Message Bubble Component
// ============================================================================

interface MessageBubbleProps {
  message: AlertMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isSystem = message.message_type === 'system' || message.message_type === 'action';

  if (isSystem) {
    return (
      <div className="text-center text-xs text-slate-500 py-1">
        <span className="bg-slate-700 px-3 py-1 rounded-sm">
          {message.content}
        </span>
        <span className="ml-2">
          {new Date(message.created_at).toLocaleTimeString()}
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-xs font-bold">
        {message.author_name?.charAt(0) || '?'}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm text-white">
            {message.author_name || 'Unknown'}
          </span>
          <span className="text-xs text-slate-500">
            {new Date(message.created_at).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm text-slate-300 mt-1">{message.content}</p>
      </div>
    </div>
  );
};

// ============================================================================
// Modal Component
// ============================================================================

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({ children, onClose: _onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
        {children}
      </div>
    </div>
  );
};

export default AlertDetailPanel;
