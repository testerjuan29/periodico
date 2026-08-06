import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

// Recibe la foto adjunta de un correo/WhatsApp desde n8n (base64) y la guarda
// en /uploads para que el image-renderer la use como hero del template.
// Vive bajo /api/upload/ porque el middleware de auth excluye ese prefijo
// (n8n no tiene cookie de sesión) — por eso exige el token compartido.

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

interface IngestPayload {
  contentBase64?: string;
  contentType?: string;
  originalName?: string;
}

export async function POST(req: NextRequest) {
  const expected = process.env.UPLOAD_TOKEN;
  const got = req.headers.get('x-upload-token') ?? '';
  if (!expected || !safeEqual(got, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: IngestPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'body JSON requerido' }, { status: 400 });
  }

  const mime = String(payload.contentType ?? '').toLowerCase().split(';')[0].trim();
  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    return NextResponse.json({
      error: `tipo no soportado (${mime || 'desconocido'}). Solo JPG, PNG o WebP`,
    }, { status: 415 });
  }
  if (!payload.contentBase64) {
    return NextResponse.json({ error: 'contentBase64 requerido' }, { status: 400 });
  }

  const buf = Buffer.from(payload.contentBase64, 'base64');
  if (buf.length === 0) {
    return NextResponse.json({ error: 'contentBase64 inválido o vacío' }, { status: 400 });
  }
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: `archivo mayor a ${MAX_BYTES / 1024 / 1024}MB` }, { status: 413 });
  }

  const uploadsDir = process.env.UPLOADS_MOUNT ?? '/uploads';
  if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(join(uploadsDir, filename), buf);

  return NextResponse.json({
    ok: true,
    filename,
    url: `/api/upload/${filename}`,
    sizeBytes: buf.length,
    originalName: payload.originalName ?? null,
  });
}
