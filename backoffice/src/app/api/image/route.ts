import { NextRequest, NextResponse } from 'next/server';
import { basename } from 'node:path';

// Sirve las imágenes generadas por el image-renderer.
// Espera ?path=/output/<uuid>.jpg (o .png, para publicaciones antiguas).
//
// Hace PROXY al renderer por HTTP en vez de leer un volumen compartido:
// así funciona igual en docker-compose (red interna) y en plataformas
// donde los servicios no comparten filesystem (Railway, Fly, etc.).
// La interfaz pública no cambia — n8n y la UI siguen pidiendo ?path=.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('path');
  if (!raw) return NextResponse.json({ error: 'path required' }, { status: 400 });

  const renderer = process.env.IMAGE_RENDERER_URL ?? 'http://image-renderer:3001';
  const file = basename(raw); // corta cualquier path traversal

  let upstream: Response;
  try {
    upstream = await fetch(`${renderer}/output/${encodeURIComponent(file)}`, {
      // Las imágenes renderizadas son inmutables (uuid por archivo).
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'renderer unreachable' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'not found' }, { status: upstream.status === 404 ? 404 : 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
