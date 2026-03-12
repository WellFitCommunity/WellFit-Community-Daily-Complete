/**
 * ComplianceReportsPanel — Generate and download compliance reports
 */

import React from 'react';
import { Shield, FileText, Lock, Download } from 'lucide-react';

export const ComplianceReportsPanel: React.FC = () => {
  const handleGenerateReport = (reportType: string) => {
    alert(`Generating ${reportType} report...`);
  };

  const reports = [
    { type: 'Access Audit', description: 'Complete log of all user access to patient data' },
    { type: 'User Activity', description: 'Monthly summary of user logins and actions' },
    { type: 'Security Incident', description: 'Failed logins, suspicious activities, and security alerts' },
    { type: 'API Usage', description: 'API key usage, rate limits, and integration health' },
  ];

  return (
    <div className="space-y-6">
      {/* Compliance Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-6 rounded-xl border-2 border-green-300">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-200 rounded-lg">
              <Shield className="w-8 h-8 text-green-800" />
            </div>
            <div>
              <h3 className="font-bold text-green-800">HIPAA Compliance</h3>
              <p className="text-2xl font-bold text-green-900">98%</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 p-6 rounded-xl border-2 border-blue-300">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-200 rounded-lg">
              <FileText className="w-8 h-8 text-blue-800" />
            </div>
            <div>
              <h3 className="font-bold text-blue-800">SOC2 Type II</h3>
              <p className="text-2xl font-bold text-blue-900">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-6 rounded-xl border-2 border-purple-300">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-200 rounded-lg">
              <Lock className="w-8 h-8 text-purple-800" />
            </div>
            <div>
              <h3 className="font-bold text-purple-800">Data Encryption</h3>
              <p className="text-2xl font-bold text-purple-900">AES-256</p>
            </div>
          </div>
        </div>
      </div>

      {/* Available Reports */}
      <div className="bg-white rounded-xl border-2 border-black overflow-hidden">
        <div className="bg-[#2D3339] p-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#C8E63D]" />
            Available Compliance Reports
          </h3>
        </div>
        <div className="p-6 space-y-4">
          {reports.map(report => (
            <div key={report.type} className="flex items-center justify-between p-4 bg-[#E8F8F7] rounded-lg border border-black hover:bg-[#D1F2F0] transition-all">
              <div>
                <p className="font-bold text-black">{report.type} Report</p>
                <p className="text-sm text-gray-600">{report.description}</p>
              </div>
              <button
                onClick={() => handleGenerateReport(report.type)}
                className="px-4 py-2 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg border border-black transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Generate
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
