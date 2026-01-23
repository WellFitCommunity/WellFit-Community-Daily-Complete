/**
 * SLA Breach Alerts - Clinical Order SLA Monitoring Dashboard
 *
 * Purpose: Display and manage SLA breaches for clinical orders
 * Features: Active breaches, approaching breaches, compliance metrics, acknowledgment workflow
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Filter,
  Beaker,
  Scan,
  Pill,
  TrendingUp,
  TrendingDown,
  Timer,
} from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
} from '../envision-atlus';
import {
  orderSLAService,
  type OrderType,
  type BreachedOrder,
  type SLAMetrics,
} from '../../services/orderSLAService';
import { supabase } from '../../lib/supabaseClient';

// =============================================================================
// HELPERS
// =============================================================================

const ORDER_TYPE_CONFIG: Record<OrderType, { label: string; icon: typeof Beaker; color: string }> = {
  lab_order: { label: 'Lab Order', icon: Beaker, color: 'text-purple-600 bg-purple-100' },
  imaging_order: { label: 'Imaging', icon: Scan, color: 'text-blue-600 bg-blue-100' },
  refill_request: { label: 'Refill', icon: Pill, color: 'text-green-600 bg-green-100' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  stat: { label: 'STAT', color: 'bg-red-600 text-white' },
  asap: { label: 'ASAP', color: 'bg-orange-500 text-white' },
  urgent: { label: 'Urgent', color: 'bg-yellow-500 text-white' },
  routine: { label: 'Routine', color: 'bg-gray-200 text-gray-700' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-200 text-blue-700' },
  preop: { label: 'Pre-Op', color: 'bg-indigo-200 text-indigo-700' },
  callback: { label: 'Callback', color: 'bg-teal-200 text-teal-700' },
};

function formatOverdue(minutes: number): string {
  return orderSLAService.formatDuration(minutes);
}

function getSeverityColor(minutesOverdue: number, targetMinutes: number): string {
  const percentOver = (minutesOverdue / targetMinutes) * 100;
  if (percentOver > 100) return 'bg-red-100 border-red-500';
  if (percentOver > 50) return 'bg-orange-100 border-orange-500';
  return 'bg-yellow-100 border-yellow-500';
}

// =============================================================================
// COMPONENT
// =============================================================================

export const SLABreachAlerts: React.FC = () => {
  const [breachedOrders, setBreachedOrders] = useState<BreachedOrder[]>([]);
  const [approachingOrders, setApproachingOrders] = useState<BreachedOrder[]>([]);
  const [metrics, setMetrics] = useState<SLAMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<OrderType | 'all'>('all');
  const [showApproaching, setShowApproaching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Run SLA check first to catch any new breaches
      await orderSLAService.checkBreaches();

      // Fetch breached orders
      const breachResult = await orderSLAService.getBreachedOrders(
        filterType === 'all' ? undefined : filterType
      );
      if (breachResult.success) {
        setBreachedOrders(breachResult.data);
      }

      // Fetch orders approaching breach
      const approachingResult = await orderSLAService.getOrdersApproachingBreach(60);
      if (approachingResult.success) {
        setApproachingOrders(approachingResult.data);
      }

      // Fetch metrics
      const metricsResult = await orderSLAService.getDashboardMetrics();
      if (metricsResult.success) {
        setMetrics(metricsResult.data);
      }
    } catch (err) {
      setError('Failed to load SLA data');
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle acknowledge
  const handleAcknowledge = async (order: BreachedOrder) => {
    setAcknowledging(order.id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in');
        return;
      }

      const result = await orderSLAService.acknowledgeBreach(
        order.order_type,
        order.id,
        user.id
      );

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      // Refresh data
      await fetchData();
    } catch (err) {
      setError('Failed to acknowledge breach');
    } finally {
      setAcknowledging(null);
    }
  };

  if (loading && breachedOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">Loading SLA data...</span>
      </div>
    );
  }

  const totalBreaches = breachedOrders.length;
  const unacknowledgedBreaches = breachedOrders.filter(o => !o.sla_acknowledged_at).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Clock className="w-8 h-8 text-orange-600" />
            SLA Breach Alerts
          </h1>
          <p className="text-gray-500 mt-1">
            Monitor and manage clinical order SLA compliance
          </p>
        </div>
        <div className="flex gap-2">
          <EAButton variant="secondary" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </EAButton>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <EAAlert variant="critical" onDismiss={() => setError(null)} dismissible>
          {error}
        </EAAlert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Active Breaches */}
        <EACard className={totalBreaches > 0 ? 'border-2 border-red-500' : ''}>
          <EACardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Active Breaches</div>
                <div className={`text-3xl font-bold ${totalBreaches > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {totalBreaches}
                </div>
                {unacknowledgedBreaches > 0 && (
                  <div className="text-xs text-red-500">{unacknowledgedBreaches} unacknowledged</div>
                )}
              </div>
              <AlertTriangle className={`w-10 h-10 ${totalBreaches > 0 ? 'text-red-500' : 'text-gray-300'}`} />
            </div>
          </EACardContent>
        </EACard>

        {/* Approaching Breach */}
        <EACard className={approachingOrders.length > 0 ? 'border-2 border-yellow-500' : ''}>
          <EACardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Approaching Breach</div>
                <div className={`text-3xl font-bold ${approachingOrders.length > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                  {approachingOrders.length}
                </div>
                <div className="text-xs text-gray-400">Within 60 min</div>
              </div>
              <Timer className={`w-10 h-10 ${approachingOrders.length > 0 ? 'text-yellow-500' : 'text-gray-300'}`} />
            </div>
          </EACardContent>
        </EACard>

        {/* 7-Day Compliance Rate */}
        <EACard>
          <EACardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">7-Day Compliance</div>
                <div className="text-3xl font-bold text-gray-900">
                  {metrics?.overall?.avg_compliance_rate?.toFixed(0) ?? 'N/A'}%
                </div>
                <div className="text-xs text-gray-400">Target: 95%</div>
              </div>
              {(metrics?.overall?.avg_compliance_rate ?? 0) >= 95 ? (
                <TrendingUp className="w-10 h-10 text-green-500" />
              ) : (
                <TrendingDown className="w-10 h-10 text-red-500" />
              )}
            </div>
          </EACardContent>
        </EACard>

        {/* Total Active */}
        <EACard>
          <EACardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Total Active Orders</div>
                <div className="text-3xl font-bold text-gray-900">
                  {(metrics?.lab_orders?.total_orders ?? 0) +
                   (metrics?.imaging_orders?.total_orders ?? 0) +
                   (metrics?.refill_requests?.total_orders ?? 0)}
                </div>
                <div className="text-xs text-gray-400">Last 7 days</div>
              </div>
              <CheckCircle className="w-10 h-10 text-gray-300" />
            </div>
          </EACardContent>
        </EACard>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">Filter by type:</span>
        </div>
        <div className="flex gap-2">
          {(['all', 'lab_order', 'imaging_order', 'refill_request'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type === 'all' ? 'All' : ORDER_TYPE_CONFIG[type].label}
            </button>
          ))}
        </div>
      </div>

      {/* Breached Orders List */}
      <EACard>
        <EACardHeader className="bg-red-50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-red-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Active SLA Breaches ({totalBreaches})
            </h3>
          </div>
        </EACardHeader>
        <EACardContent className="p-0">
          {breachedOrders.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <h4 className="font-medium text-gray-900">No Active Breaches</h4>
              <p className="text-gray-500 mt-1">All orders are within SLA targets</p>
            </div>
          ) : (
            <div className="divide-y">
              {breachedOrders.map((order) => {
                const typeConfig = ORDER_TYPE_CONFIG[order.order_type];
                const priorityConfig = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG.routine;
                const TypeIcon = typeConfig.icon;
                const isExpanded = expandedId === order.id;
                const severityColor = getSeverityColor(order.minutes_overdue, order.sla_target_minutes);

                return (
                  <div
                    key={`${order.order_type}-${order.id}`}
                    className={`border-l-4 ${severityColor}`}
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    >
                      <div className="flex items-center gap-4">
                        {/* Type Icon */}
                        <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                          <TypeIcon className="w-5 h-5" />
                        </div>

                        {/* Order Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {order.internal_order_id}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityConfig.color}`}>
                              {priorityConfig.label}
                            </span>
                            {order.sla_acknowledged_at && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <BellOff className="w-3 h-3" />
                                Acknowledged
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {typeConfig.label} • Patient: {order.patient_id.substring(0, 8)}...
                          </div>
                        </div>

                        {/* Overdue Time */}
                        <div className="text-right">
                          <div className="text-lg font-bold text-red-600">
                            +{formatOverdue(order.minutes_overdue)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Target: {formatOverdue(order.sla_target_minutes)}
                          </div>
                        </div>

                        {/* Expand/Collapse */}
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-gray-50 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500">Order Status</div>
                            <div className="font-medium capitalize">{order.order_status.replace(/_/g, ' ')}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Ordered At</div>
                            <div className="font-medium">{new Date(order.ordered_at).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Breach At</div>
                            <div className="font-medium">{new Date(order.sla_breach_at).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Escalation Level</div>
                            <div className="font-medium">Level {order.escalation_level}</div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          {!order.sla_acknowledged_at && (
                            <EAButton
                              variant="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcknowledge(order);
                              }}
                              disabled={acknowledging === order.id}
                            >
                              {acknowledging === order.id ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                  Acknowledging...
                                </>
                              ) : (
                                <>
                                  <Bell className="w-4 h-4 mr-2" />
                                  Acknowledge
                                </>
                              )}
                            </EAButton>
                          )}
                          <EAButton variant="secondary">
                            View Order
                          </EAButton>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </EACardContent>
      </EACard>

      {/* Approaching Breach Section */}
      <EACard>
        <EACardHeader
          className="bg-yellow-50 cursor-pointer"
          onClick={() => setShowApproaching(!showApproaching)}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-yellow-900 flex items-center gap-2">
              <Timer className="w-5 h-5" />
              Approaching SLA Breach ({approachingOrders.length})
            </h3>
            {showApproaching ? (
              <ChevronUp className="w-5 h-5 text-yellow-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-yellow-600" />
            )}
          </div>
        </EACardHeader>
        {showApproaching && (
          <EACardContent className="p-4">
            {approachingOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No orders approaching SLA breach within the next 60 minutes
              </p>
            ) : (
              <div className="space-y-2">
                {approachingOrders.map((order) => {
                  const typeConfig = ORDER_TYPE_CONFIG[order.order_type];
                  const TypeIcon = typeConfig.icon;
                  const minutesUntilBreach = -order.minutes_overdue;

                  return (
                    <div
                      key={`approaching-${order.order_type}-${order.id}`}
                      className="flex items-center gap-4 p-3 bg-yellow-50 rounded-lg"
                    >
                      <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                        <TypeIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">{order.internal_order_id}</span>
                        <span className="text-sm text-gray-500 ml-2">{typeConfig.label}</span>
                      </div>
                      <div className="text-sm font-medium text-yellow-700">
                        {minutesUntilBreach} min until breach
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </EACardContent>
        )}
      </EACard>
    </div>
  );
};

export default SLABreachAlerts;
