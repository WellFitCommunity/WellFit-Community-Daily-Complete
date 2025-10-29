/**
 * Database Administration Panel
 *
 * Tools for database maintenance, backup management, and performance optimization.
 * Provides IT staff with essential database administration capabilities.
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { Alert, AlertDescription } from '../ui/alert';
import { Database, Download, Upload, RefreshCw, HardDrive, TrendingUp } from 'lucide-react';

interface DatabaseStats {
  total_tables: number;
  total_rows: number;
  database_size_mb: number;
  largest_tables: Array<{
    table_name: string;
    row_count: number;
    table_size: string;
  }>;
}

const DatabaseAdminPanel: React.FC = () => {
  const supabase = useSupabaseClient();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadDatabaseStats();
  }, []);

  const loadDatabaseStats = async () => {
    try {
      setLoading(true);
      setMessage(null);

      // Get rough table counts for key tables
      const tableNames = [
        'profiles', 'check_ins', 'community_moments', 'billing_claims',
        'fhir_observations', 'patient_encounters', 'user_sessions',
        'phi_access_logs', 'security_events', 'audit_logs'
      ];

      const tableCounts = await Promise.all(
        tableNames.map(async (tableName) => {
          const { count, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          if (error) {

            return { table_name: tableName, row_count: 0, table_size: 'N/A' };
          }

          return {
            table_name: tableName,
            row_count: count || 0,
            table_size: 'N/A' // Size calculation would require admin access
          };
        })
      );

      const totalRows = tableCounts.reduce((sum, t) => sum + t.row_count, 0);

      setStats({
        total_tables: tableNames.length,
        total_rows: totalRows,
        database_size_mb: 0, // Would require admin access to pg_catalog
        largest_tables: tableCounts.sort((a, b) => b.row_count - a.row_count).slice(0, 5)
      });
    } catch (error) {

      setMessage({ type: 'error', text: 'Failed to load database statistics' });
    } finally {
      setLoading(false);
    }
  };

  const triggerBackup = async () => {
    setActionLoading(true);
    setMessage({ type: 'info', text: 'Backup functionality requires Supabase CLI or dashboard access. Use: npx supabase db dump' });
    setTimeout(() => setActionLoading(false), 2000);
  };

  const optimizeDatabase = async () => {
    if (!window.confirm('Are you sure you want to run database optimization? This may take several minutes.')) {
      return;
    }

    setActionLoading(true);
    setMessage({ type: 'info', text: 'Database optimization (VACUUM, ANALYZE) requires direct PostgreSQL access via Supabase dashboard or CLI.' });
    setTimeout(() => setActionLoading(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1BA39C] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading database statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {message && (
        <Alert className={
          message.type === 'success' ? 'bg-green-50 border-green-200' :
          message.type === 'error' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }>
          <AlertDescription className={
            message.type === 'success' ? 'text-green-800' :
            message.type === 'error' ? 'text-red-800' :
            'text-blue-800'
          }>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Database Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-6 border-2 border-black shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-[#1BA39C]">{stats.total_tables}</div>
                <div className="text-sm text-gray-600 font-semibold mt-1">Monitored Tables</div>
              </div>
              <Database className="w-12 h-12 text-[#1BA39C]" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border-2 border-black shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-blue-600">{stats.total_rows.toLocaleString()}</div>
                <div className="text-sm text-gray-600 font-semibold mt-1">Total Rows</div>
              </div>
              <TrendingUp className="w-12 h-12 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border-2 border-black shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-purple-600">
                  {stats.database_size_mb > 0 ? `${stats.database_size_mb} MB` : 'N/A'}
                </div>
                <div className="text-sm text-gray-600 font-semibold mt-1">Database Size</div>
              </div>
              <HardDrive className="w-12 h-12 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-[#E8F8F7] rounded-lg p-6 border-2 border-black">
        <h3 className="text-lg font-bold text-black mb-4">Database Operations</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={triggerBackup}
            disabled={actionLoading}
            className="px-6 py-4 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg border-2 border-black disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Create Backup
          </button>

          <button
            onClick={optimizeDatabase}
            disabled={actionLoading}
            className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg border-2 border-black disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Optimize Database
          </button>

          <button
            onClick={loadDatabaseStats}
            disabled={actionLoading}
            className="px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg border-2 border-black disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh Stats
          </button>
        </div>
      </div>

      {/* Largest Tables */}
      {stats && stats.largest_tables.length > 0 && (
        <div className="bg-white rounded-lg border-2 border-black shadow-lg overflow-hidden">
          <div className="bg-[#E8F8F7] px-6 py-4 border-b-2 border-black">
            <h3 className="font-bold text-black">Largest Tables by Row Count</h3>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Table Name</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Row Count</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Estimated Size</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.largest_tables.map((table, index) => (
                    <tr key={table.table_name} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">{table.table_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-semibold">{table.row_count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{table.table_size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CLI Instructions */}
      <div className="bg-yellow-50 rounded-lg p-6 border-2 border-yellow-300">
        <h3 className="text-lg font-bold text-yellow-900 mb-3 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Database Administration via CLI
        </h3>
        <div className="space-y-2 text-sm text-yellow-800">
          <p className="font-semibold">For advanced database operations, use the Supabase CLI:</p>
          <div className="bg-yellow-100 rounded p-3 font-mono text-xs space-y-1">
            <p># Create a backup</p>
            <p>npx supabase db dump {">"} backup.sql</p>
            <br />
            <p># Apply pending migrations</p>
            <p>npx supabase db push</p>
            <br />
            <p># Connect to database</p>
            <p>PGPASSWORD="..." psql -h aws-0-us-west-1.pooler.supabase.com -p 6543 -U postgres.xkybsjnvuohpqpbkikyn -d postgres</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseAdminPanel;
