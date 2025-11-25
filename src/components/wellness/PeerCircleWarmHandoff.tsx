// ============================================================================
// Peer Circle Warm Handoff
// ============================================================================
// Purpose: Connect new/struggling staff with peer support circles warmly
// Design: Human-first, not algorithmic - show real facilitator messages
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';
import type { ProviderSupportCircle, BurnoutRiskLevel } from '../../types/nurseos';

interface PeerCircleWarmHandoffProps {
  userId?: string;
  userName?: string;
  burnoutRisk?: BurnoutRiskLevel;
  isNewUser?: boolean;
  onDismiss?: () => void;
  onJoinCircle?: (circleId: string) => void;
}

interface RecommendedCircle extends ProviderSupportCircle {
  facilitatorName?: string;
  facilitatorMessage?: string;
  memberCount?: number;
  matchReason?: string;
}

export const PeerCircleWarmHandoff: React.FC<PeerCircleWarmHandoffProps> = ({
  userId,
  userName,
  burnoutRisk,
  isNewUser = false,
  onDismiss,
  onJoinCircle,
}) => {
  const [recommendedCircles, setRecommendedCircles] = useState<RecommendedCircle[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [showAllCircles, setShowAllCircles] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Pre-written facilitator welcome messages
  const FACILITATOR_MESSAGES = [
    "Hey there! I've been in your shoes - the long hours, the emotional weight. Our group meets weekly and it's become my safe space. No judgment, just support. Hope to see you there!",
    "Welcome! I started this circle after my own burnout experience. We talk about the real stuff - the hard cases, the system frustrations, and how we cope. You're not alone in this.",
    "Hi! Whether you're struggling or just want to connect with others who get it, you're welcome here. We laugh, we vent, we support each other. That's what it's about.",
    "Hey friend! Our group is for anyone who needs a space to decompress. We meet biweekly and it's always a judgment-free zone. Looking forward to meeting you!",
    "Welcome to our circle! I've been a nurse for 15 years and facilitating these groups for 3. Whatever you're going through, someone here has been there. Come as you are.",
  ];

  // Load recommended circles
  const loadCircles = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Check if user is already in circles
      const { data: existingMemberships } = await supabase
        .from('provider_support_circle_members')
        .select('circle_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      const existingCircleIds = existingMemberships?.map(m => m.circle_id) || [];

      // If already in circles, don't show handoff
      if (existingCircleIds.length > 0 && !isNewUser && burnoutRisk !== 'high' && burnoutRisk !== 'critical') {
        setDismissed(true);
        setLoading(false);
        return;
      }

      // Get available circles
      const { data: circles, error } = await supabase
        .from('provider_support_circles')
        .select(`
          *,
          provider_support_circle_members(user_id, is_active)
        `)
        .eq('is_active', true)
        .not('id', 'in', `(${existingCircleIds.join(',') || 'null'})`);

      if (error) throw error;

      // Enhance circles with facilitator info and match reasons
      const enhanced: RecommendedCircle[] = (circles || []).map((circle, idx) => {
        const activeMembers = circle.provider_support_circle_members?.filter(
          (m: { is_active: boolean }) => m.is_active
        ).length || 0;

        // Generate match reason
        let matchReason = 'Great for general peer support';
        if (circle.meeting_frequency === 'weekly') {
          matchReason = 'Weekly meetings for consistent support';
        }
        if (isNewUser) {
          matchReason = 'Perfect for new team members';
        }
        if (burnoutRisk === 'high' || burnoutRisk === 'critical') {
          matchReason = 'Supportive community during challenging times';
        }

        return {
          ...circle,
          memberCount: activeMembers,
          facilitatorMessage: FACILITATOR_MESSAGES[idx % FACILITATOR_MESSAGES.length],
          facilitatorName: circle.facilitator_id ? 'Circle Facilitator' : 'Peer Leader',
          matchReason,
        };
      });

      // Sort by member count (prefer smaller, more intimate groups)
      enhanced.sort((a, b) => (a.memberCount || 0) - (b.memberCount || 0));

      setRecommendedCircles(enhanced.slice(0, 3));
    } catch (error) {
      auditLogger.error('PEER_CIRCLE_LOAD_FAILED', error instanceof Error ? error : new Error('Load failed'));
    } finally {
      setLoading(false);
    }
  }, [userId, isNewUser, burnoutRisk]);

  useEffect(() => {
    loadCircles();
  }, [loadCircles]);

  // Handle joining a circle
  const handleJoinCircle = async (circleId: string) => {
    if (!userId) return;

    setJoining(circleId);

    try {
      // Get practitioner ID
      const { data: practitioner } = await supabase
        .from('fhir_practitioners')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!practitioner) throw new Error('Practitioner not found');

      // Join the circle
      const { error } = await supabase
        .from('provider_support_circle_members')
        .insert({
          circle_id: circleId,
          user_id: userId,
          practitioner_id: practitioner.id,
          role: 'member',
          is_active: true,
        });

      if (error) throw error;

      auditLogger.info('PEER_CIRCLE_JOINED', {
        circleId,
        source: isNewUser ? 'new_user_handoff' : burnoutRisk ? 'burnout_intervention' : 'browse',
      });

      onJoinCircle?.(circleId);
      setDismissed(true);
    } catch (error) {
      auditLogger.error('PEER_CIRCLE_JOIN_FAILED', error instanceof Error ? error : new Error('Join failed'));
    } finally {
      setJoining(null);
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    // Remember dismissal for this session
    sessionStorage.setItem('peer_circle_handoff_dismissed', 'true');
    setDismissed(true);
    onDismiss?.();
  };

  // Check if already dismissed this session
  useEffect(() => {
    if (sessionStorage.getItem('peer_circle_handoff_dismissed') === 'true') {
      setDismissed(true);
    }
  }, []);

  if (dismissed || loading) {
    return null;
  }

  if (recommendedCircles.length === 0) {
    return null;
  }

  // Get contextual header
  const getHeader = () => {
    if (isNewUser) {
      return {
        emoji: '👋',
        title: `Welcome to the team${userName ? `, ${userName}` : ''}!`,
        subtitle: 'Connect with peers who understand what you do',
      };
    }
    if (burnoutRisk === 'critical' || burnoutRisk === 'high') {
      return {
        emoji: '💚',
        title: "You don't have to do this alone",
        subtitle: 'Our peer circles are here for you',
      };
    }
    return {
      emoji: '👥',
      title: 'Join a Peer Support Circle',
      subtitle: 'Connect with colleagues who understand',
    };
  };

  const header = getHeader();
  const topCircle = recommendedCircles[0];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fadeIn p-4">
      <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 rounded-2xl max-w-lg w-full shadow-2xl border-2 border-teal-300 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 p-6 text-white">
          <div className="text-4xl mb-2">{header.emoji}</div>
          <h2 className="text-2xl font-bold">{header.title}</h2>
          <p className="text-teal-100 mt-1">{header.subtitle}</p>
        </div>

        {/* Featured Circle */}
        <div className="p-6">
          <div className="bg-white rounded-xl p-5 border-2 border-teal-200 shadow-lg mb-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-2xl">
                👤
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{topCircle.name}</h3>
                <p className="text-sm text-gray-600">
                  {topCircle.memberCount} members · Meets {topCircle.meeting_frequency}
                </p>
                <div className="mt-2 text-xs text-teal-700 bg-teal-50 px-2 py-1 rounded inline-block">
                  {topCircle.matchReason}
                </div>
              </div>
            </div>

            {/* Facilitator message */}
            <div className="mt-4 bg-gray-50 rounded-lg p-4 border-l-4 border-teal-400">
              <p className="text-sm text-gray-700 italic">
                "{topCircle.facilitatorMessage}"
              </p>
              <p className="text-xs text-gray-500 mt-2 font-medium">
                — {topCircle.facilitatorName}
              </p>
            </div>

            <button
              onClick={() => handleJoinCircle(topCircle.id)}
              disabled={joining === topCircle.id}
              className="mt-4 w-full bg-teal-600 text-white py-3 rounded-lg font-semibold hover:bg-teal-700 transition-all disabled:opacity-50"
            >
              {joining === topCircle.id ? 'Joining...' : 'Join This Circle'}
            </button>
          </div>

          {/* Other circles */}
          {recommendedCircles.length > 1 && (
            <>
              <button
                onClick={() => setShowAllCircles(!showAllCircles)}
                className="text-sm text-teal-600 hover:underline mb-3"
              >
                {showAllCircles ? 'Show less' : `See ${recommendedCircles.length - 1} more circles`}
              </button>

              {showAllCircles && (
                <div className="space-y-3">
                  {recommendedCircles.slice(1).map(circle => (
                    <div
                      key={circle.id}
                      className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-medium text-gray-900">{circle.name}</h4>
                        <p className="text-xs text-gray-600">
                          {circle.memberCount} members · {circle.meeting_frequency}
                        </p>
                      </div>
                      <button
                        onClick={() => handleJoinCircle(circle.id)}
                        disabled={joining === circle.id}
                        className="px-4 py-2 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-200 transition-all disabled:opacity-50"
                      >
                        {joining === circle.id ? '...' : 'Join'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Browse all */}
          <div className="mt-4 text-center">
            <button
              onClick={() => window.location.href = '/resilience/circles'}
              className="text-sm text-gray-600 hover:text-teal-600 hover:underline"
            >
              Browse all peer circles →
            </button>
          </div>
        </div>

        {/* Dismiss */}
        <div className="px-6 pb-6">
          <button
            onClick={handleDismiss}
            className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
          >
            {isNewUser ? 'I\'ll explore later' : 'Not right now'}
          </button>
        </div>

        {/* Privacy note */}
        <div className="bg-gray-100 px-6 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            🔒 Circle discussions are confidential. You can post anonymously.
          </p>
        </div>
      </div>

      {/* Fade in animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PeerCircleWarmHandoff;
