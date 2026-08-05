import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, join, normalize } from 'node:path';

// Sirve las fotos subidas por el editor desde el volumen /uploads (rw).
// Existe para que el image-renderer (Puppeteer) pueda descargar la foto
// vía HTTP durante el re-render del template — pa_net permite que llame
// a http://backoffice:3000/api/upload/<filename> desde el otro contenedor.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const mount = process.env.UPLOADS_MOUNT ?? '/uploads';
  const safe = basename(filename);
  const full = normalize(join(mount, safe));

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
  const ext = safe.split('.').pop()?.toLowerCase() ?? '';
  const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream';

  const stream = createReadStream(full);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
