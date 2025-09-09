export function setCookie(headers: Headers, name: string, value: string, maxAgeSec: number) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  headers.append('Set-Cookie', parts.join('; '));
}

export function clearCookie(headers: Headers, name: string) {
  headers.append('Set-Cookie', `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie') || '';
  const m = raw.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
