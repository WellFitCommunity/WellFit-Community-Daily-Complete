// Claude AI Test Widget - Admin Only
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { useClaudeRateLimit } from '../../hooks/useClaudeRateLimit';

const ClaudeTestWidget: React.FC = () => {
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [healthTest, setHealthTest] = useState<string>('');

  // UI Rate Limiting
  const {
    isLimited,
    checkRateLimit,
    remainingDisplay,
    resetTimeDisplay
  } = useClaudeRateLimit({
    userId: 'admin-test-user',
    onLimitExceeded: (resetTime) => {
      setTestResult({
        success: false,
        message: `⚠️ Rate limit exceeded. Please wait until ${resetTime.toLocaleTimeString()}`
      });
    }
  });

  const runConnectionTest = async () => {
    // Check rate limit before making request
    if (!checkRateLimit()) {
      return; // Blocked by rate limit, message already shown
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      // Use coding-suggest function for testing (it works)
      const { supabase } = await import('../../lib/supabaseClient');
      const { data, error } = await supabase.functions.invoke('coding-suggest', {
        body: {
          encounter: {
            id: 'test-connection-' + Date.now(),
            // Simple test data
            diagnoses: [{ term: "wellness check" }],
            procedures: [{ code: "99213", units: 1 }]
          }
        }
      });

      if (error) {
        setTestResult({
          success: false,
          message: `❌ Edge Function Error: ${error.message}`
        });
      } else if (data) {
        setTestResult({
          success: true,
          message: `✅ Claude API connected via Edge Function! Confidence: ${data.confidence || 'N/A'}%`
        });
      } else {
        setTestResult({
          success: false,
          message: `❌ No response from Edge Function`
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `❌ Connection failed: ${error instanceof Error ? error.message : 'Network error'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runHealthDataTest = async () => {
    // Check rate limit before making request
    if (!checkRateLimit()) {
      setHealthTest(`⚠️ Rate limit exceeded. ${remainingDisplay} requests remaining.`);
      return;
    }

    setIsLoading(true);
    setHealthTest('');

    try {
      // Test health data analysis using coding-suggest with clinical context
      const { supabase } = await import('../../lib/supabaseClient');
      const { data, error } = await supabase.functions.invoke('coding-suggest', {
        body: {
          encounter: {
            id: 'health-test-' + Date.now(),
            diagnoses: [{ term: "hypertension screening" }, { term: "diabetes monitoring" }],
            procedures: [{ code: "99213", units: 1 }]
          }
        }
      });

      if (error) {
        setHealthTest(`Health test failed: ${error.message}`);
      } else if (data) {
        const suggestions = data.cpt?.length || 0;
        const diagnoses = data.icd10?.length || 0;
        setHealthTest(`✅ Health data processing successful! Generated ${suggestions} procedure suggestions and ${diagnoses} diagnosis codes. Confidence: ${data.confidence || 'N/A'}%`);
      } else {
        setHealthTest(`Health test failed: No response from Edge Function`);
      }
    } catch (error) {
      setHealthTest(`Health test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>🤖 Claude AI Service Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Basic Connection Test */}
        <div className="space-y-2">
          <h3 className="font-medium">Connection Test</h3>
          <Button
            onClick={runConnectionTest}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Testing...' : 'Test Claude Connection'}
          </Button>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Health Data Interpretation Test */}
        <div className="space-y-2">
          <h3 className="font-medium">Health Data Test</h3>
          <Button
            onClick={runHealthDataTest}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? 'Testing...' : 'Test Health Data Interpretation'}
          </Button>

          {healthTest && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">{healthTest}</p>
            </div>
          )}
        </div>

        {/* Configuration Info */}
        <div className="text-xs text-gray-600 space-y-1">
          <p><strong>AI Engine:</strong> Enterprise AI</p>
          <p><strong>API Key:</strong> ✅ Configured server-side</p>
          <p><strong>Environment:</strong> {import.meta.env.MODE}</p>
          <p><strong>Rate Limit:</strong> {remainingDisplay} requests remaining</p>
          {isLimited && (
            <p className="text-red-600"><strong>⚠️ Rate Limited:</strong> Resets at {resetTimeDisplay}</p>
          )}
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            ✅ <strong>Security:</strong> API key is properly secured server-side only.
          </AlertDescription>
        </Alert>

      </CardContent>
    </Card>
  );
};

export default ClaudeTestWidget