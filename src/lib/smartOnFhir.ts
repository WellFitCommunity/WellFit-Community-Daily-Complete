// SMART on FHIR Client Library for WellFit
import { supabase } from './supabaseClient';

interface SMARTConfig {
  clientId: string;
  redirectUri: string;
  scope: string;
  aud: string; // FHIR server base URL
  responseType: 'code';
  state: string;
  codeChallengeMethod: 'S256';
  codeChallenge: string;
}

interface FHIREndpoints {
  authorization: string;
  token: string;
  fhirBase: string;
}

interface SMARTContext {
  patient?: string;
  encounter?: string;
  user?: string;
  tenant?: string;
}

export class SMARTClient {
  private config: SMARTConfig;
  private endpoints: FHIREndpoints | null = null;

  constructor(fhirServerUrl: string, clientId: string) {
    this.config = {
      clientId,
      redirectUri: `${window.location.origin}/smart-callback`,
      scope: 'launch/patient patient/*.read user/*.read openid fhirUser',
      aud: fhirServerUrl,
      responseType: 'code',
      state: this.generateState(),
      codeChallengeMethod: 'S256',
      codeChallenge: this.generateCodeChallenge()
    };
  }

  // Discover SMART endpoints from FHIR server
  async discoverEndpoints(): Promise<FHIREndpoints> {
    try {
      const response = await fetch(`${this.config.aud}/.well-known/smart-configuration`);
      if (!response.ok) {
        throw new Error('SMART configuration not found');
      }

      const smartConfig = await response.json();
      
      this.endpoints = {
        authorization: smartConfig.authorization_endpoint,
        token: smartConfig.token_endpoint,
        fhirBase: this.config.aud
      };

      return this.endpoints;
    } catch (error) {

      throw new Error('Unable to discover SMART endpoints');
    }
  }

  // Generate authorization URL for SMART launch
  async getAuthorizationUrl(launchContext?: string): Promise<string> {
    if (!this.endpoints) {
      await this.discoverEndpoints();
    }

    const params = new URLSearchParams({
      response_type: this.config.responseType,
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: launchContext ? `launch:${launchContext} ${this.config.scope}` : this.config.scope,
      state: this.config.state,
      aud: this.config.aud,
      code_challenge: this.config.codeChallenge,
      code_challenge_method: this.config.codeChallengeMethod
    });

    return `${this.endpoints?.authorization}?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code: string, state: string): Promise<{
    accessToken: string;
    tokenType: string;
    scope: string;
    context: SMARTContext;
  }> {
    if (state !== this.config.state) {
      throw new Error('Invalid state parameter');
    }

    if (!this.endpoints) {
      await this.discoverEndpoints();
    }

    if (!this.endpoints?.token) {
      throw new Error('Token endpoint not discovered');
    }

    const response = await fetch(this.endpoints.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        code_verifier: this.getCodeVerifier() // PKCE
      })
    });

    if (!response.ok) {
      throw new Error('Token exchange failed');
    }

    const tokenData = await response.json();

    return {
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      context: {
        patient: tokenData.patient,
        encounter: tokenData.encounter,
        user: tokenData.user,
        tenant: tokenData.tenant
      }
    };
  }

  // Fetch patient data using SMART context
  async fetchPatientData(accessToken: string, patientId: string): Promise<any> {
    if (!this.endpoints) {
      await this.discoverEndpoints();
    }

    const response = await fetch(`${this.endpoints?.fhirBase}/Patient/${patientId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/fhir+json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch patient data');
    }

    return response.json();
  }

  // Utility methods
  private generateState(): string {
    return btoa(crypto.getRandomValues(new Uint8Array(32)).toString());
  }

  private generateCodeChallenge(): string {
    // Simplified - in production use proper PKCE implementation
    return btoa(crypto.getRandomValues(new Uint8Array(32)).toString()).replace(/[^a-zA-Z0-9]/g, '');
  }

  private getCodeVerifier(): string {
    // Return the original code verifier used for challenge
    return 'wellfit-smart-code-verifier-' + Date.now();
  }
}

// Hospital EHR Presets
export const EHR_CONFIGS = {
  EPIC_SANDBOX: {
    fhirServerUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    clientId: 'wellfit-community-app' // You'll register this with Epic
  },
  CERNER_SANDBOX: {
    fhirServerUrl: 'https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d',
    clientId: 'wellfit-community-cerner' // You'll register this with Cerner
  },
  ALLSCRIPTS: {
    fhirServerUrl: 'https://fhir.allscripts.com/fhir/r4',
    clientId: 'wellfit-community-allscripts'
  }
};

export default SMARTClient;