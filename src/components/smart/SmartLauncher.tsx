// SMART on FHIR Launcher Component
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import SMARTClient, { EHR_CONFIGS } from '../../lib/smartOnFhir';

interface SmartLauncherProps {
  onLaunch?: (ehrSystem: string) => void;
}

const SmartLauncher: React.FC<SmartLauncherProps> = ({ onLaunch }) => {
  const [launching, setLaunching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const launchSmartApp = async (ehrSystem: keyof typeof EHR_CONFIGS) => {
    try {
      setLaunching(ehrSystem);
      setError(null);

      const config = EHR_CONFIGS[ehrSystem];
      const smartClient = new SMARTClient(config.fhirServerUrl, config.clientId);

      // Store config for callback
      sessionStorage.setItem('smart-config', JSON.stringify(config));

      // Get authorization URL
      const authUrl = await smartClient.getAuthorizationUrl();

      // Notify parent component
      onLaunch?.(ehrSystem);

      // Redirect to EHR authorization
      window.location.href = authUrl;

    } catch (error) {
      console.error('SMART launch error:', error);
      setError(error instanceof Error ? error.message : 'Failed to launch SMART app');
      setLaunching(null);
    }
  };

  const ehrOptions = [
    { 
      key: 'EPIC_SANDBOX' as const, 
      name: 'Epic (Sandbox)', 
      description: 'Connect to Epic EHR system',
      icon: '🏥',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
    },
    { 
      key: 'CERNER_SANDBOX' as const, 
      name: 'Cerner (Sandbox)', 
      description: 'Connect to Cerner EHR system',
      icon: '🔬',
      color: 'bg-green-50 border-green-200 hover:bg-green-100'
    },
    { 
      key: 'ALLSCRIPTS' as const, 
      name: 'Allscripts', 
      description: 'Connect to Allscripts EHR system',
      icon: '📋',
      color: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
    }
  ];

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">🔗 Connect to EHR System</CardTitle>
        <p className="text-center text-gray-600">
          Choose your healthcare system to securely connect WellFit with your EHR
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ehrOptions.map((ehr) => (
            <div
              key={ehr.key}
              className={`border rounded-lg p-4 text-center transition-colors ${ehr.color}`}
            >
              <div className="text-3xl mb-2">{ehr.icon}</div>
              <h3 className="font-medium mb-1">{ehr.name}</h3>
              <p className="text-sm text-gray-600 mb-3">{ehr.description}</p>
              <Button
                onClick={() => launchSmartApp(ehr.key)}
                disabled={launching === ehr.key}
                className="w-full"
                size="sm"
              >
                {launching === ehr.key ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          ))}
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800">
            <strong>SMART on FHIR:</strong> This will securely connect to your EHR system using 
            industry-standard SMART on FHIR protocols. Your credentials stay with your EHR - 
            WellFit only receives authorized health data.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default SmartLauncher;