import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

/**
 * Todo requiere sesión salvo:
 *  - /login y /api/auth/login (el punto de entrada)
 *  - /api/image y /api/upload — los consumen n8n (workflows 04/05/06 bajan la
 *    imagen renderizada) y Puppeteer (re-render del template) desde la red
 *    interna de Docker, SIN cookies. Cerrarlos rompería la publicación.
 *    Solo sirven imágenes, exposición aceptable.
 */

const PUBLIC_PATHS = new Set(['/login', '/api/auth/login']);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.NEXTAUTH_SECRET;
  const authed = Boolean(token && secret && await verifySessionToken(secret, token));

  if (PUBLIC_PATHS.has(pathname)) {
    // Ya logueado y visitando /login → directo a la mesa.
    if (authed && pathname === '/login') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (authed) return NextResponse.next();

  // APIs responden 401 JSON; páginas redirigen al login con retorno.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const login = new URL('/login', req.url);
  const next = pathname + search;
  if (next !== '/') login.searchParams.set('next', next);
  return NextResponse.redirect(login);
}

export const config = {
  // Excluye assets de Next y los dos endpoints internos de imágenes.
  matcher: ['/((?!_next/|favicon\\.ico|api/image|api/upload/).*)'],
};
