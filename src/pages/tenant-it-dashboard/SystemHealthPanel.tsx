/**
 * SystemHealthPanel — Monitor tenant's service health and latency
 */

import React, { useState } from 'react';
import {
  CheckCircle, AlertTriangle, XCircle, RefreshCw,
  Server, HardDrive, Shield, Activity, Database, Mail, Phone
} from 'lucide-react';
import type { SystemHealth } from './TenantITDashboard.types';

export const SystemHealthPanel: React.FC = () => {
  const [healthChecks] = useState<SystemHealth[]>([
    { service: 'Database (PostgreSQL)', status: 'healthy', latency_ms: 12, last_check: '2025-01-25T15:50:00Z' },
    { service: 'Authentication Service', status: 'healthy', latency_ms: 45, last_check: '2025-01-25T15:50:00Z' },
    { service: 'API Gateway', status: 'healthy', latency_ms: 8, last_check: '2025-01-25T15:50:00Z' },
    { service: 'File Storage', status: 'healthy', latency_ms: 156, last_check: '2025-01-25T15:50:00Z' },
    { service: 'Email Service', status: 'degraded', latency_ms: 2340, last_check: '2025-01-25T15:50:00Z' },
    { service: 'SMS Gateway', status: 'healthy', latency_ms: 89, last_check: '2025-01-25T15:50:00Z' }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      case 'down':
        return <XCircle className="w-6 h-6 text-red-600" />;
      default:
        return null;
    }
  };

  const getServiceIcon = (service: string) => {
    if (service.includes('Database')) return <Database className="w-5 h-5" />;
    if (service.includes('Authentication')) return <Shield className="w-5 h-5" />;
    if (service.includes('API')) return <Server className="w-5 h-5" />;
    if (service.includes('File')) return <HardDrive className="w-5 h-5" />;
    if (service.includes('Email')) return <Mail className="w-5 h-5" />;
    if (service.includes('SMS')) return <Phone className="w-5 h-5" />;
    return <Activity className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div className="bg-linear-to-r from-green-500 to-[#1BA39C] p-6 rounded-xl border-2 border-black text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold">System Status: Operational</h3>
            <p className="text-white/80 mt-1">All critical services are running normally</p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            <span className="text-sm">Last checked: Just now</span>
          </div>
        </div>
      </div>

      {/* Service Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {healthChecks.map(check => (
          <div
            key={check.service}
            className={`p-4 rounded-lg border-2 ${
              check.status === 'healthy' ? 'border-green-300 bg-green-50' :
              check.status === 'degraded' ? 'border-yellow-300 bg-yellow-50' :
              'border-red-300 bg-red-50'
            } transition-all hover:shadow-lg`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  check.status === 'healthy' ? 'bg-green-200' :
                  check.status === 'degraded' ? 'bg-yellow-200' :
                  'bg-red-200'
                }`}>
                  {getServiceIcon(check.service)}
                </div>
                <div>
                  <p className="font-bold text-black">{check.service}</p>
                  <p className="text-sm text-gray-600">Latency: {check.latency_ms}ms</p>
                </div>
              </div>
              {getStatusIcon(check.status)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
