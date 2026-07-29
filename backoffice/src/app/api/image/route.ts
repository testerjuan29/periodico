import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, join, normalize } from 'node:path';

// Sirve las imágenes generadas por image-renderer, montadas en /image-output (read-only).
// Espera ?path=/output/<uuid>.jpg (o .png, para publicaciones antiguas).
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('path');
  if (!raw) return NextResponse.json({ error: 'path required' }, { status: 400 });

  const mount = process.env.IMAGE_OUTPUT_MOUNT ?? '/image-output';
  const file = basename(raw);
  const full = normalize(join(mount, file));

  if (!full.startsWith(normalize(mount))) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }

  try {
    await stat(full);
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const MIME_BY_EXT: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream';

  const stream = createReadStream(full);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
