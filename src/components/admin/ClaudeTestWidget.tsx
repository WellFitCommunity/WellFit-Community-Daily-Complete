// Claude AI Test Widget - Admin Only
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';

const ClaudeTestWidget: React.FC = () => {
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [healthTest, setHealthTest] = useState<string>('');

  const runConnectionTest = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/anthropic-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello, this is a connection test.' }],
          max_tokens: 50
        })
      });

      const data = await response.json();

      if (response.ok && data.content) {
        setTestResult({
          success: true,
          message: `✅ Claude API connected! Response: "${data.content[0]?.text || 'Connected successfully'}"`
        });
      } else {
        setTestResult({
          success: false,
          message: `❌ API Error: ${data.error || 'Unknown error'} (Status: ${response.status})`
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
    setIsLoading(true);
    setHealthTest('');

    try {
      const testHealthData = {
        mood: 'Good',
        bp_systolic: 120,
        bp_diastolic: 80,
        blood_sugar: 95,
        blood_oxygen: 98
      };

      const prompt = `Please analyze this health data and provide a brief assessment: ${JSON.stringify(testHealthData)}`;

      const response = await fetch('/api/anthropic-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200
        })
      });

      const data = await response.json();

      if (response.ok && data.content) {
        setHealthTest(data.content[0]?.text || 'Health analysis completed successfully');
      } else {
        setHealthTest(`Health test failed: ${data.error || 'Unknown error'}`);
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
          <p><strong>Model:</strong> claude-3-5-sonnet-20241022</p>
          <p><strong>API Key:</strong> ✅ Configured server-side</p>
          <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
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