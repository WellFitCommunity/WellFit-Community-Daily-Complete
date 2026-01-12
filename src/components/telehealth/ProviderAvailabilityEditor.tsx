/**
 * Provider Availability Editor
 *
 * Allows providers to manage their:
 * - Weekly working hours
 * - Blocked time periods (vacation, PTO, etc.)
 *
 * @component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import {
  AvailabilityService,
  type WeeklyAvailability,
  type DayOfWeek,
  type BlockedTime,
} from '../../services/availabilityService';
import { auditLogger } from '../../services/auditLogger';

// Optimized lucide imports
import Clock from 'lucide-react/dist/esm/icons/clock';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Save from 'lucide-react/dist/esm/icons/save';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';

// ============================================================================
// TYPES
// ============================================================================

interface ProviderAvailabilityEditorProps {
  providerId?: string;  // If not provided, uses current user
  onSave?: () => void;
  className?: string;
}

interface DayConfig {
  enabled: boolean;
  start: string;
  end: string;
}

type WeekConfig = Record<DayOfWeek, DayConfig>;

// ============================================================================
// CONSTANTS
// ============================================================================

const DAYS_OF_WEEK: { key: DayOfWeek; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const DEFAULT_HOURS = { start: '09:00', end: '17:00' };

const BLOCKED_TIME_REASONS = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'pto', label: 'PTO / Personal Time' },
  { value: 'training', label: 'Training / Conference' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'other', label: 'Other' },
];

// ============================================================================
// COMPONENT
// ============================================================================

const ProviderAvailabilityEditor: React.FC<ProviderAvailabilityEditorProps> = ({
  providerId,
  onSave,
  className = '',
}) => {
  const user = useUser();
  const effectiveProviderId = providerId || user?.id || '';

  // State
  const [weekConfig, setWeekConfig] = useState<WeekConfig>({
    monday: { enabled: true, ...DEFAULT_HOURS },
    tuesday: { enabled: true, ...DEFAULT_HOURS },
    wednesday: { enabled: true, ...DEFAULT_HOURS },
    thursday: { enabled: true, ...DEFAULT_HOURS },
    friday: { enabled: true, ...DEFAULT_HOURS },
    saturday: { enabled: false, start: '', end: '' },
    sunday: { enabled: false, start: '', end: '' },
  });

  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [newBlockedTime, setNewBlockedTime] = useState({
    startDate: '',
    endDate: '',
    reason: 'vacation',
    description: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showBlockedTimeForm, setShowBlockedTimeForm] = useState(false);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadAvailability = useCallback(async () => {
    if (!effectiveProviderId) return;

    setIsLoading(true);
    try {
      // Load weekly availability
      const availResult = await AvailabilityService.getProviderAvailability(effectiveProviderId);
      if (availResult.success && availResult.data) {
        const newConfig: WeekConfig = { ...weekConfig };
        DAYS_OF_WEEK.forEach(({ key }) => {
          const hours = availResult.data[key];
          if (hours) {
            newConfig[key] = { enabled: true, start: hours.start, end: hours.end };
          } else {
            newConfig[key] = { enabled: false, start: '', end: '' };
          }
        });
        setWeekConfig(newConfig);
      }

      // Load blocked times (next 90 days)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 90);

      const blockedResult = await AvailabilityService.getBlockedTimes(
        effectiveProviderId,
        startDate,
        endDate
      );
      if (blockedResult.success) {
        setBlockedTimes(blockedResult.data);
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'LOAD_AVAILABILITY_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { providerId: effectiveProviderId }
      );
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveProviderId]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleDayToggle = (day: DayOfWeek) => {
    setWeekConfig((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        start: !prev[day].enabled ? DEFAULT_HOURS.start : '',
        end: !prev[day].enabled ? DEFAULT_HOURS.end : '',
      },
    }));
  };

  const handleTimeChange = (day: DayOfWeek, field: 'start' | 'end', value: string) => {
    setWeekConfig((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSaveAvailability = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      // Convert weekConfig to WeeklyAvailability format
      const availability: WeeklyAvailability = {};
      DAYS_OF_WEEK.forEach(({ key }) => {
        const config = weekConfig[key];
        if (config.enabled && config.start && config.end) {
          availability[key] = { start: config.start, end: config.end };
        }
      });

      const result = await AvailabilityService.updateProviderAvailability(
        effectiveProviderId,
        availability
      );

      if (result.success) {
        setMessage({ type: 'success', text: 'Availability updated successfully!' });
        onSave?.();
      } else {
        setMessage({ type: 'error', text: result.error?.message || 'Failed to update availability' });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ type: 'error', text: `Failed to save: ${errorMessage}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBlockedTime = async () => {
    if (!newBlockedTime.startDate || !newBlockedTime.endDate) {
      setMessage({ type: 'error', text: 'Please select both start and end dates' });
      return;
    }

    setIsAddingBlock(true);
    setMessage(null);

    try {
      const result = await AvailabilityService.addBlockedTime({
        providerId: effectiveProviderId,
        startTime: new Date(newBlockedTime.startDate),
        endTime: new Date(newBlockedTime.endDate + 'T23:59:59'),
        reason: newBlockedTime.reason,
        description: newBlockedTime.description || undefined,
      });

      if (result.success) {
        setBlockedTimes((prev) => [...prev, result.data].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        ));
        setNewBlockedTime({ startDate: '', endDate: '', reason: 'vacation', description: '' });
        setShowBlockedTimeForm(false);
        setMessage({ type: 'success', text: 'Blocked time added successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error?.message || 'Failed to add blocked time' });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ type: 'error', text: `Failed to add: ${errorMessage}` });
    } finally {
      setIsAddingBlock(false);
    }
  };

  const handleRemoveBlockedTime = async (blockedTimeId: string) => {
    if (!window.confirm('Remove this blocked time?')) return;

    try {
      const result = await AvailabilityService.removeBlockedTime(blockedTimeId, effectiveProviderId);
      if (result.success) {
        setBlockedTimes((prev) => prev.filter((bt) => bt.id !== blockedTimeId));
        setMessage({ type: 'success', text: 'Blocked time removed' });
      } else {
        setMessage({ type: 'error', text: result.error?.message || 'Failed to remove' });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ type: 'error', text: `Failed to remove: ${errorMessage}` });
    }
  };

  const formatBlockedTimeDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading availability...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Message Alert */}
      {message && (
        <Alert className={message.type === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Weekly Hours Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Weekly Office Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DAYS_OF_WEEK.map(({ key, label }) => (
              <div
                key={key}
                className={`flex items-center gap-4 p-3 rounded-lg border ${
                  weekConfig[key].enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                }`}
              >
                {/* Day Toggle */}
                <label className="flex items-center gap-2 w-32 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={weekConfig[key].enabled}
                    onChange={() => handleDayToggle(key)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`font-medium ${weekConfig[key].enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </label>

                {/* Time Inputs */}
                {weekConfig[key].enabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={weekConfig[key].start}
                      onChange={(e) => handleTimeChange(key, 'start', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="time"
                      value={weekConfig[key].end}
                      onChange={(e) => handleTimeChange(key, 'end', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ) : (
                  <span className="text-gray-400 italic">Not available</span>
                )}
              </div>
            ))}
          </div>

          {/* Save Button */}
          <div className="mt-6">
            <Button
              onClick={handleSaveAvailability}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Office Hours
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Blocked Times Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              Blocked Time / Time Off
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBlockedTimeForm(!showBlockedTimeForm)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Time Off
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Add Blocked Time Form */}
          {showBlockedTimeForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-3">Add New Blocked Time</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newBlockedTime.startDate}
                    onChange={(e) => setNewBlockedTime((prev) => ({ ...prev, startDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newBlockedTime.endDate}
                    onChange={(e) => setNewBlockedTime((prev) => ({ ...prev, endDate: e.target.value }))}
                    min={newBlockedTime.startDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <select
                    value={newBlockedTime.reason}
                    onChange={(e) => setNewBlockedTime((prev) => ({ ...prev, reason: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {BLOCKED_TIME_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={newBlockedTime.description}
                    onChange={(e) => setNewBlockedTime((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., Family vacation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleAddBlockedTime} disabled={isAddingBlock}>
                  {isAddingBlock ? 'Adding...' : 'Add Blocked Time'}
                </Button>
                <Button variant="outline" onClick={() => setShowBlockedTimeForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Blocked Times List */}
          {blockedTimes.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No blocked times scheduled</p>
              <p className="text-sm">Add vacation or time off to block appointments during those periods.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blockedTimes.map((bt) => (
                <div
                  key={bt.id}
                  className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {formatBlockedTimeDate(bt.start_time)} - {formatBlockedTimeDate(bt.end_time)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {BLOCKED_TIME_REASONS.find((r) => r.value === bt.reason)?.label || bt.reason}
                      {bt.description && ` - ${bt.description}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveBlockedTime(bt.id)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProviderAvailabilityEditor;
