/**
 * Specialist Dashboard
 * Universal dashboard for all specialist types
 */

import React, { useEffect, useState } from 'react';
import { fieldVisitManager } from '../../services/specialist-workflow-engine/FieldVisitManager';
import { offlineSync } from '../../services/specialist-workflow-engine/OfflineDataSync';
import { workflowRegistry } from '../../services/specialist-workflow-engine/templates';
import { FieldVisit } from '../../services/specialist-workflow-engine/types';

interface SpecialistDashboardProps {
  specialistId: string;
  specialistType: string;
}

export const SpecialistDashboard: React.FC<SpecialistDashboardProps> = ({
  specialistId,
  specialistType
}) => {
  const [todaysVisits, setTodaysVisits] = useState<FieldVisit[]>([]);
  const [upcomingVisits, setUpcomingVisits] = useState<FieldVisit[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const workflow = workflowRegistry.getByType(specialistType)[0];

  useEffect(() => {
    loadVisits();
    initializeOfflineSync();

    // Monitor online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [specialistId]);

  const loadVisits = async () => {
    try {
      const today = await fieldVisitManager.getTodaysVisits(specialistId);
      setTodaysVisits(today);

      const upcoming = await fieldVisitManager.getVisitsForSpecialist(
        specialistId,
        'scheduled'
      );
      setUpcomingVisits(upcoming.filter(v => !today.find(t => t.id === v.id)));
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const initializeOfflineSync = async () => {
    try {
      await offlineSync.initialize();
      offlineSync.startAutoSync(30000); // Sync every 30 seconds

      const status = await offlineSync.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {

    }
  };

  const handleStartVisit = async (visitId: string) => {
    try {
      await fieldVisitManager.startVisit(visitId);
      window.location.href = `/specialist/visit/${visitId}`;
    } catch (error) {

      alert('Failed to start visit. Please try again.');
    }
  };

  const handleSyncNow = async () => {
    try {
      const result = await offlineSync.syncAll();
      setSyncStatus(await offlineSync.getSyncStatus());
      alert(`Synced: ${result.visits} visits, ${result.assessments} assessments, ${result.photos} photos`);
    } catch (error) {

      alert('Sync failed. Will retry automatically.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-4xl">{workflow?.icon || '🏥'}</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {workflow?.name || 'Specialist Dashboard'}
              </h1>
              <p className="text-gray-600">{workflow?.description}</p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
              isOnline ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className="text-sm font-medium">{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {!isOnline && syncStatus && (
              <button
                onClick={handleSyncNow}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Sync ({syncStatus.pending.visits + syncStatus.pending.assessments} pending)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Today's Visits</h2>
          <p className="text-gray-600 text-sm">{todaysVisits.length} visits scheduled</p>
        </div>

        <div className="divide-y divide-gray-200">
          {todaysVisits.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No visits scheduled for today
            </div>
          ) : (
            todaysVisits.map(visit => (
              <div key={visit.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        visit.status === 'completed' ? 'bg-green-500' :
                        visit.status === 'in_progress' ? 'bg-blue-500' :
                        'bg-gray-300'
                      }`}></div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {(visit as any).patient?.full_name || 'Patient'}
                      </h3>
                    </div>

                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                      <span>🕐 {visit.scheduled_at ? new Date(visit.scheduled_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      }) : 'Not scheduled'}</span>
                      <span>📍 {(visit as any).patient?.address || 'Address not available'}</span>
                      <span>📋 {visit.visit_type}</span>
                    </div>

                    {visit.status === 'in_progress' && (
                      <div className="mt-2">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${(visit.completed_steps.length / (workflow?.visitWorkflow.length || 1)) * 100}%`
                              }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">
                            Step {visit.current_step} of {workflow?.visitWorkflow.length}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    {visit.status === 'scheduled' && (
                      <button
                        onClick={() => handleStartVisit(visit.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        Start Visit
                      </button>
                    )}
                    {visit.status === 'in_progress' && (
                      <button
                        onClick={() => window.location.href = `/specialist/visit/${visit.id}`}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                      >
                        Continue
                      </button>
                    )}
                    {visit.status === 'completed' && (
                      <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium">
                        ✓ Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upcoming Visits */}
      {upcomingVisits.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Upcoming Visits</h2>
            <p className="text-gray-600 text-sm">{upcomingVisits.length} visits scheduled</p>
          </div>

          <div className="divide-y divide-gray-200">
            {upcomingVisits.slice(0, 5).map(visit => (
              <div key={visit.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {(visit as any).patient?.full_name || 'Patient'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {visit.scheduled_at ? new Date(visit.scheduled_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      }) : 'Date not set'}
                    </p>
                  </div>
                  <span className="text-sm text-gray-500">{visit.visit_type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Today's Visits</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{todaysVisits.length}</div>
          <div className="text-sm text-green-600 mt-1">
            {todaysVisits.filter(v => v.status === 'completed').length} completed
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Pending Sync</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {syncStatus ? syncStatus.pending.visits + syncStatus.pending.assessments : 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">items</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">This Week</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{upcomingVisits.length}</div>
          <div className="text-sm text-gray-600 mt-1">upcoming visits</div>
        </div>
      </div>
    </div>
  );
};
