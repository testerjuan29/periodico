/**
 * Sesión firmada con HMAC-SHA256 vía Web Crypto.
 *
 * Usa SOLO APIs disponibles en el runtime Edge (crypto.subtle, atob/btoa):
 * el mismo código corre en el middleware y en las rutas de auth. El token es
 * `base64url(payload).base64url(firma)` — sin dependencias externas.
 */

export const SESSION_COOKIE = 'pa_session';
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 días

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array | null {
  try {
    let t = s.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    const bin = atob(t);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/** Comparación en tiempo constante — no filtra en qué byte difiere la firma. */
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function createSessionToken(secret: string, user: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({
    u: user,
    exp: Date.now() + SESSION_MAX_AGE_S * 1000,
  })));
  const sig = b64url(await hmac(secret, payload));
  return `${payload}.${sig}`;
}

export async function verifySessionToken(secret: string, token: string): Promise<boolean> {
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = b64urlDecode(token.slice(dot + 1));
  if (!sig) return false;

  const expected = await hmac(secret, payload);
  if (!equal(expected, sig)) return false;

  const raw = b64urlDecode(payload);
  if (!raw) return false;
  try {
    const { exp } = JSON.parse(new TextDecoder().decode(raw)) as { exp?: unknown };
    return typeof exp === 'number' && Date.now() < exp;
  } catch {
    return false;
  }
}
