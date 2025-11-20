/**
 * Envision Login Page - Secret Entry Point
 *
 * Private login for Envision VirtualEdge Group super administrators
 * Route: /envision (not publicly linked)
 *
 * Access: Only Envision staff know this URL exists
 * Validates against super_admin_users table
 * Redirects to Master Panel (/super-admin) with vault animation
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useSupabaseClient } from '../contexts/AuthContext';
import { auditLogger } from '../services/auditLogger';

export const EnvisionLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { supabase, user } = useSupabaseClient() as any;

  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in as super admin, redirect to Master Panel
  useEffect(() => {
    const checkExistingSession = async () => {
      if (user) {
        const { data: superAdmin } = await supabase
          .from('super_admin_users')
          .select('id, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (superAdmin) {
          navigate('/super-admin');
        }
      }
    };

    checkExistingSession();
  }, [user, navigate, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Step 1: Authenticate with Supabase Auth (email + PIN as password)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pin
      });

      if (authError) {
        // Audit failed login attempt
        await auditLogger.error('ENVISION_LOGIN_FAILED', authError, {
          email: email.trim(),
          reason: 'Invalid credentials'
        });

        setError('Invalid email or PIN');
        setLoading(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        setError('Authentication failed');
        setLoading(false);
        return;
      }

      // Step 2: Verify user is in super_admin_users table
      const { data: superAdmin, error: superAdminError } = await supabase
        .from('super_admin_users')
        .select('id, role, is_active, permissions')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (superAdminError || !superAdmin) {
        // User authenticated but not a super admin - log out immediately
        await supabase.auth.signOut();

        await auditLogger.error('ENVISION_UNAUTHORIZED_ACCESS_ATTEMPT', new Error('Not a super admin'), {
          email: email.trim(),
          userId
        });

        setError('Unauthorized: Super admin access required');
        setLoading(false);
        return;
      }

      // Step 3: Audit successful login
      await auditLogger.info('ENVISION_LOGIN_SUCCESS', {
        superAdminId: superAdmin.id,
        role: superAdmin.role,
        permissions: superAdmin.permissions
      });

      // Step 4: Update last_login_at
      await supabase
        .from('super_admin_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', superAdmin.id);

      // Step 5: Redirect to Master Panel (vault animation will play)
      navigate('/super-admin');

    } catch (err: any) {
      await auditLogger.error('ENVISION_LOGIN_ERROR', err, {
        email: email.trim()
      });
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500/10 rounded-full mb-4 border-2 border-blue-500/30">
            <Shield className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Envision Portal</h1>
          <p className="text-blue-300 text-sm">
            Authorized Personnel Only
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-blue-100 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="you@envisionvirtualedge.com"
              />
            </div>

            {/* PIN Field */}
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-blue-100 mb-2">
                PIN
              </label>
              <div className="relative">
                <input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  autoComplete="off"
                  disabled={loading}
                  pattern="\d{4,8}"
                  title="PIN must be 4-8 digits"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed pr-12"
                  placeholder="••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-blue-100 focus:outline-none disabled:opacity-50"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-blue-300/70 mt-1">4-8 digit PIN</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || !pin}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Access Master Panel
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-blue-300/60 text-center">
              All access attempts are logged and monitored for security purposes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-blue-400/60">
            Envision VirtualEdge Group LLC
          </p>
        </div>
      </div>
    </div>
  );
};

export default EnvisionLoginPage;
