// =====================================================
// Clearinghouse Client
// Purpose: Manages clearinghouse API connection,
//          authentication, and configuration
// =====================================================

import type { ClearinghouseConfig } from './types.ts';

/**
 * Client for interacting with healthcare clearinghouse APIs.
 * Supports Waystar, Change Healthcare, and Availity providers.
 */
export class ClearinghouseClient {
  private config: ClearinghouseConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  /** Load configuration for a tenant from the vault/database */
  async initialize(_tenantId: string): Promise<void> {
    // In production, this would load from Supabase vault
    // via the get_clearinghouse_credentials RPC
    const config = await this.loadConfig(_tenantId);
    if (config) {
      this.config = config;
    }
  }

  private async loadConfig(_tenantId: string): Promise<ClearinghouseConfig | null> {
    // In production, this would call get_clearinghouse_credentials RPC
    // For now, return null to indicate no config
    return null;
  }

  /** Get or refresh the OAuth access token for the configured provider */
  async getAccessToken(): Promise<string> {
    if (!this.config) {
      throw new Error('Clearinghouse not configured');
    }

    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    // Get new token based on provider
    const tokenUrl = this.getTokenUrl();
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

    return this.accessToken!;
  }

  private getTokenUrl(): string {
    if (!this.config) throw new Error('Not configured');

    switch (this.config.provider) {
      case 'waystar':
        return `${this.config.apiUrl}/oauth/token`;
      case 'change_healthcare':
        return `${this.config.apiUrl}/apip/auth/v2/token`;
      case 'availity':
        return `${this.config.apiUrl}/oauth/token`;
      default:
        return `${this.config.apiUrl}/oauth/token`;
    }
  }

  /** Get the current clearinghouse configuration */
  getConfig(): ClearinghouseConfig | null {
    return this.config;
  }

  /** Check whether the client has a valid configuration loaded */
  isConfigured(): boolean {
    return this.config !== null;
  }
}
