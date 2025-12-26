import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Download, Trash2, Info, Shield, FileText, FileCode, Printer } from 'lucide-react';

interface UserDataStatus {
  dataSummary: {
    checkIns: number;
    communityMoments: number;
    alerts: number;
    profileStatus: string;
    accountCreated: string;
    consentGiven: boolean;
  };
  totalRecords: number;
}

type ExportType = 'json' | 'pdf' | 'ccda';

export default function DataManagementPanel() {
  const [dataStatus, setDataStatus] = useState<UserDataStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingType, setExportingType] = useState<ExportType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const loadDataStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('user-data-management', {
        body: { action: 'status' }
      });

      if (error) throw error;
      setDataStatus(data);
    } catch (error) {

      alert('Failed to load data status. Please try again.');
    }
    setLoading(false);
  };

  const exportJSON = async () => {
    setExportingType('json');
    try {
      const { data, error } = await supabase.functions.invoke('user-data-management', {
        body: { action: 'export' }
      });

      if (error) throw error;

      // Create and download the file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-wellfit-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('Your data has been downloaded successfully!');
    } catch (error) {
      alert('Failed to export data. Please try again.');
    }
    setExportingType(null);
  };

  const exportPDF = async () => {
    setExportingType('pdf');
    try {
      const { data, error } = await supabase.functions.invoke('pdf-health-summary', {});

      if (error) throw error;

      // Open the HTML in a new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        // Auto-trigger print dialog after content loads
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        // Fallback: download as HTML file
        const blob = new Blob([data.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my-health-summary-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Health summary downloaded. Open the file and use your browser\'s print function to save as PDF.');
      }
    } catch (error) {
      alert('Failed to generate PDF. Please try again.');
    }
    setExportingType(null);
  };

  const exportCCDA = async () => {
    setExportingType('ccda');
    try {
      const { data, error } = await supabase.functions.invoke('ccda-export', {});

      if (error) throw error;

      // Download the C-CDA XML file
      const blob = new Blob([data.xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-health-record-${new Date().toISOString().split('T')[0]}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('Your C-CDA health record has been downloaded. This format can be imported into most healthcare systems.');
    } catch (error) {
      alert('Failed to export C-CDA. Please try again.');
    }
    setExportingType(null);
  };

  const deleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      alert('Please type "DELETE MY ACCOUNT" to confirm deletion.');
      return;
    }

    setLoading(true);
    try {
      const { data: _data, error } = await supabase.functions.invoke('user-data-management', {
        body: {
          action: 'delete',
          confirmDeletion: true
        }
      });

      if (error) throw error;

      alert('Your account and data have been deleted. You will be logged out.');

      // Sign out and redirect
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error) {

      alert('Failed to delete account. Please contact support.');
    }
    setLoading(false);
  };

  React.useEffect(() => {
    loadDataStatus();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <Shield className="mr-3 text-blue-600" />
          Your Data & Privacy Controls
        </h2>

        {/* Data Status Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Info className="mr-2" />
            Your Data Summary
          </h3>

          {loading && !dataStatus ? (
            <div className="text-gray-500">Loading your data information...</div>
          ) : dataStatus ? (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {dataStatus.dataSummary.checkIns}
                  </div>
                  <div className="text-sm text-gray-600">Health Check-ins</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {dataStatus.dataSummary.communityMoments}
                  </div>
                  <div className="text-sm text-gray-600">Community Posts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {dataStatus.dataSummary.alerts}
                  </div>
                  <div className="text-sm text-gray-600">Alerts</div>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p>Account created: {new Date(dataStatus.dataSummary.accountCreated).toLocaleDateString()}</p>
                <p>Consent status: {dataStatus.dataSummary.consentGiven ? 'Given' : 'Not given'}</p>
                <p>Total records: {dataStatus.totalRecords}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Data Export Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Download className="mr-2" />
            Download Your Data
          </h3>
          <p className="text-gray-600 mb-4">
            Download a complete copy of all your health data. Choose the format that works best for you:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PDF Health Summary */}
            <div className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
              <div className="flex items-center mb-2">
                <Printer className="w-5 h-5 text-blue-600 mr-2" />
                <h4 className="font-medium">PDF Summary</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Easy-to-read health summary. Print it or share with your doctor.
              </p>
              <button
                onClick={exportPDF}
                disabled={exportingType !== null}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center text-sm"
              >
                <Printer className="mr-2 w-4 h-4" />
                {exportingType === 'pdf' ? 'Generating...' : 'Print/Save PDF'}
              </button>
            </div>

            {/* C-CDA Export */}
            <div className="border rounded-lg p-4 hover:border-green-300 transition-colors">
              <div className="flex items-center mb-2">
                <FileCode className="w-5 h-5 text-green-600 mr-2" />
                <h4 className="font-medium">C-CDA Record</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Standard medical format. Import into Epic, Cerner, or other health systems.
              </p>
              <button
                onClick={exportCCDA}
                disabled={exportingType !== null}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center text-sm"
              >
                <FileCode className="mr-2 w-4 h-4" />
                {exportingType === 'ccda' ? 'Generating...' : 'Download C-CDA'}
              </button>
            </div>

            {/* JSON Data Export */}
            <div className="border rounded-lg p-4 hover:border-purple-300 transition-colors">
              <div className="flex items-center mb-2">
                <FileText className="w-5 h-5 text-purple-600 mr-2" />
                <h4 className="font-medium">JSON Data</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Complete data backup. For developers or personal backup.
              </p>
              <button
                onClick={exportJSON}
                disabled={exportingType !== null}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center text-sm"
              >
                <FileText className="mr-2 w-4 h-4" />
                {exportingType === 'json' ? 'Preparing...' : 'Download JSON'}
              </button>
            </div>
          </div>

          {/* 21st Century Cures Act Notice */}
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Your Right to Your Data:</strong> Under the 21st Century Cures Act and HIPAA Privacy Rule,
              you have the right to access all of your electronic health information without delay and at no charge.
              These exports include all data we maintain about you.
            </p>
          </div>
        </div>

        {/* Account Deletion Section */}
        <div className="border-t pt-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-red-600">
            <Trash2 className="mr-2" />
            Delete My Account
          </h3>

          {!showDeleteConfirm ? (
            <div>
              <p className="text-gray-600 mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
                All your health data, community posts, and profile information will be permanently removed.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
              >
                Delete My Account
              </button>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-800 mb-2">⚠️ Confirm Account Deletion</h4>
              <p className="text-red-700 mb-4">
                This will permanently delete ALL of your data including:
              </p>
              <ul className="list-disc ml-6 text-red-700 mb-4">
                <li>Your profile and personal information</li>
                <li>All health check-ins and vital signs</li>
                <li>Community posts and photos you've shared</li>
                <li>Alert settings and notifications</li>
                <li>Account access and login credentials</li>
              </ul>

              <p className="text-red-700 mb-4">
                <strong>This action cannot be undone.</strong> We recommend downloading your data first.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-red-800 mb-2">
                  Type "DELETE MY ACCOUNT" to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full p-2 border border-red-300 rounded-sm focus:ring-red-500 focus:border-red-500"
                  placeholder="DELETE MY ACCOUNT"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={deleteAccount}
                  disabled={loading || deleteConfirmText !== 'DELETE MY ACCOUNT'}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Permanently Delete Account'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Data Rights Information */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">Your Data Rights</h4>
          <p className="text-blue-700 text-sm">
            You have the right to access, correct, or delete your personal information at any time.
            For questions about your data or to request corrections, please contact us at{' '}
            <a href="mailto:privacy@wellfitcommunity.com" className="underline">
              privacy@wellfitcommunity.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}