// Health Dashboard Page - AI-Enhanced Health Insights
// Provides both patient and admin AI-powered health dashboards

import React from 'react';
import FhirAiDashboardRouter from '../components/FhirAiDashboardRouter';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const HealthDashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Health Dashboard
          </h1>
          <p className="text-gray-600">
            AI-powered insights for your health journey
          </p>
        </div>

        {/* Main Dashboard Content */}
        <div className="space-y-6">
          {/* Introduction Card for First-Time Users */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-800">Welcome to Your AI Health Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl mb-2">🧠</div>
                  <div className="font-medium text-blue-800">Smart Insights</div>
                  <div className="text-blue-600">AI analyzes your health patterns</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-2">📈</div>
                  <div className="font-medium text-blue-800">Real-time Monitoring</div>
                  <div className="text-blue-600">Track your progress continuously</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-2">💡</div>
                  <div className="font-medium text-blue-800">Personalized Tips</div>
                  <div className="text-blue-600">Get recommendations just for you</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Smart Dashboard Router */}
          <FhirAiDashboardRouter />

          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => window.location.href = '/daily-checkin'}
                  className="p-4 text-center border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="text-2xl mb-2">📝</div>
                  <div className="text-sm font-medium">Daily Check-in</div>
                </button>

                <button
                  onClick={() => window.location.href = '/self-reporting'}
                  className="p-4 text-center border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="text-2xl mb-2">🏥</div>
                  <div className="text-sm font-medium">Health Report</div>
                </button>

                <button
                  onClick={() => window.location.href = '/doctors-view'}
                  className="p-4 text-center border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="text-2xl mb-2">👩‍⚕️</div>
                  <div className="text-sm font-medium">Doctor's View</div>
                </button>

                <button
                  onClick={() => window.location.href = '/community'}
                  className="p-4 text-center border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="text-2xl mb-2">👥</div>
                  <div className="text-sm font-medium">Community</div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Help and Support */}
          <Card className="bg-gray-50">
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="font-medium text-gray-800 mb-2">Need Help?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your health dashboard uses AI to provide personalized insights.
                  Complete regular check-ins to get the most accurate recommendations.
                </p>
                <div className="flex justify-center space-x-4 text-sm">
                  <button className="text-blue-600 hover:text-blue-800">
                    How it Works
                  </button>
                  <button className="text-blue-600 hover:text-blue-800">
                    Privacy & Security
                  </button>
                  <button className="text-blue-600 hover:text-blue-800">
                    Contact Support
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HealthDashboardPage;