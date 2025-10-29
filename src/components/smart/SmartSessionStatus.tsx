// SMART Session Status Display
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface SmartSession {
  accessToken: string;
  context: {
    patient?: string;
    user?: string;
    encounter?: string;
  };
  scope: string;
  timestamp: number;
}

const SmartSessionStatus: React.FC = () => {
  const [session, setSession] = useState<SmartSession | null>(null);
  const [patientData, setPatientData] = useState<any>(null);

  useEffect(() => {
    // Check for active SMART session
    const sessionData = sessionStorage.getItem('smart-session');
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        setSession(parsed);
        
        // Check if session is still valid (24 hours)
        const isExpired = Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000;
        if (isExpired) {
          clearSession();
        }
      } catch (error) {

        clearSession();
      }
    }
  }, []);

  const clearSession = () => {
    sessionStorage.removeItem('smart-session');
    sessionStorage.removeItem('smart-config');
    setSession(null);
    setPatientData(null);
  };

  const getTimeAgo = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / (1000 * 60));
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  if (!session) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-3xl mb-4">🔌</div>
        <p>No active EHR connections</p>
        <p className="text-sm mt-2">Use the launcher above to connect to an EHR system</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Badge className="bg-green-600">Connected</Badge>
                <span className="text-sm text-gray-600">
                  {getTimeAgo(session.timestamp)}
                </span>
              </div>
              
              <div className="space-y-1 text-sm">
                <div><strong>Scope:</strong> {session.scope}</div>
                {session.context.patient && (
                  <div><strong>Patient ID:</strong> {session.context.patient}</div>
                )}
                {session.context.user && (
                  <div><strong>User:</strong> {session.context.user}</div>
                )}
                {session.context.encounter && (
                  <div><strong>Encounter:</strong> {session.context.encounter}</div>
                )}
              </div>
            </div>

            <div className="space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Refresh session or fetch new data
                  window.location.reload();
                }}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={clearSession}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          variant="outline"
          className="h-auto p-4 text-left"
          onClick={() => {
            // Implement patient data sync
            alert('Patient data sync feature coming soon!');
          }}
        >
          <div>
            <div className="font-medium">📥 Sync Patient Data</div>
            <div className="text-xs text-gray-500 mt-1">
              Pull latest data from EHR
            </div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-auto p-4 text-left"
          onClick={() => {
            // Implement data export
            alert('Export to EHR feature coming soon!');
          }}
        >
          <div>
            <div className="font-medium">📤 Export to EHR</div>
            <div className="text-xs text-gray-500 mt-1">
              Send WellFit data to EHR
            </div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-auto p-4 text-left"
          onClick={() => {
            // Show session details
            const details = JSON.stringify(session, null, 2);
            navigator.clipboard.writeText(details);
            alert('Session details copied to clipboard!');
          }}
        >
          <div>
            <div className="font-medium">🔍 Session Details</div>
            <div className="text-xs text-gray-500 mt-1">
              View technical details
            </div>
          </div>
        </Button>
      </div>
    </div>
  );
};

export default SmartSessionStatus;