// SMART on FHIR Callback Page
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import SMARTClient from '../lib/smartOnFhir';

const SmartCallbackPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Connecting to EHR system...');
  const [patientData, setPatientData] = useState<any>(null);

  useEffect(() => {
    const handleSmartCallback = async () => {
      try {
        const urlParams = new URLSearchParams(location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`EHR Authorization Error: ${error}`);
          return;
        }

        if (!code || !state) {
          setStatus('error');
          setMessage('Missing authorization parameters');
          return;
        }

        setMessage('Exchanging authorization code...');

        // Get SMART client from session storage (stored during launch)
        const storedConfig = sessionStorage.getItem('smart-config');
        if (!storedConfig) {
          throw new Error('SMART configuration not found');
        }

        const config = JSON.parse(storedConfig);
        const smartClient = new SMARTClient(config.fhirServerUrl, config.clientId);

        // Exchange code for token
        const tokenResult = await smartClient.exchangeCodeForToken(code, state);
        
        setMessage('Fetching patient data...');

        // Fetch patient data if available
        if (tokenResult.context.patient) {
          const patient = await smartClient.fetchPatientData(
            tokenResult.accessToken, 
            tokenResult.context.patient
          );
          setPatientData(patient);
        }

        // Store SMART session
        sessionStorage.setItem('smart-session', JSON.stringify({
          accessToken: tokenResult.accessToken,
          context: tokenResult.context,
          scope: tokenResult.scope,
          timestamp: Date.now()
        }));

        setStatus('success');
        setMessage('Successfully connected to EHR system!');

        // Redirect to main app after 3 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);

      } catch (error) {

        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    };

    handleSmartCallback();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-center">🏥 EHR Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'processing' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">
                <div className="text-center">
                  <div className="text-2xl mb-2">✅</div>
                  <p className="font-medium">{message}</p>
                  {patientData && (
                    <p className="text-sm mt-2">
                      Connected patient: {patientData.name?.[0]?.given?.[0]} {patientData.name?.[0]?.family}
                    </p>
                  )}
                  <p className="text-xs mt-2">Redirecting to dashboard...</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <Alert variant="destructive">
              <AlertDescription>
                <div className="text-center">
                  <div className="text-2xl mb-2">❌</div>
                  <p className="font-medium">{message}</p>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Continue to Dashboard
                  </button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SmartCallbackPage;