// lib/verifyJwt.ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL(process.env.JWKS_URL!));

export async function verifyJwt(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'supabase',
    algorithms: ['RS256'],
  });
  return payload;
}
