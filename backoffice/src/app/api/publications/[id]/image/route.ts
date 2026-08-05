import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';

const NOT_EDITABLE = new Set(['published', 'publishing', 'rejected', 'failed']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

// Formatea la fecha como el workflow 03 ("dd LLL yyyy" en español).
function formatDate(d: Date): string {
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const day = String(d.getDate()).padStart(2, '0');
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pub = await prisma.publication.findUnique({
    where: { id },
    select: {
      status: true,
      wpTitle: true,
      wpCategories: true,
      receivedAt: true,
    },
  });
  if (!pub) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (NOT_EDITABLE.has(pub.status)) {
    return NextResponse.json({ error: `no se puede editar en estado ${pub.status}` }, { status: 409 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file requerido' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `archivo mayor a ${MAX_BYTES / 1024 / 1024}MB` }, { status: 413 });
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return NextResponse.json({
      error: `tipo no soportado (${file.type}). Solo JPG, PNG o WebP`,
    }, { status: 415 });
  }

  // 1. Guardar el raw en el volumen /uploads (rw en backoffice)
  const uploadsDir = process.env.UPLOADS_MOUNT ?? '/uploads';
  if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const uploadPath = join(uploadsDir, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(uploadPath, buf);

  // 2. Invocar image-renderer con la nueva foto como hero + el resto de vars actuales
  const rendererUrl = process.env.IMAGE_RENDERER_URL ?? 'http://image-renderer:3001';
  const publicBase  = process.env.BACKOFFICE_INTERNAL_URL ?? 'http://backoffice:3000';
  const heroUrl = `${publicBase}/api/upload/${filename}`;

  const renderRes = await fetch(`${rendererUrl}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template: 'article',
      vars: {
        title:     pub.wpTitle ?? '',
        category:  pub.wpCategories[0] ?? 'Actualidad',
        date:      formatDate(pub.receivedAt),
        image_url: heroUrl,
      },
      width: 1080,
      height: 1080,
    }),
  });

  if (!renderRes.ok) {
    const text = await renderRes.text().catch(() => '');
    return NextResponse.json({
      error: `image-renderer respondió ${renderRes.status}: ${text}`,
    }, { status: 502 });
  }
  const rendered = (await renderRes.json()) as { id: string; path: string; url: string };

  // 3. Update publication + audit
  const actor = process.env.ADMIN_EMAIL ?? 'admin';
  await prisma.publication.update({
    where: { id },
    data: { imageUrl: rendered.url },
  });
  await prisma.auditLog.create({
    data: {
      publicationId: id,
      actorEmail: actor,
      action: 'image_edit',
      payload: {
        uploadedAs: filename,
        originalName: file.name,
        sizeBytes: file.size,
        renderedTo: rendered.url,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    id,
    imageUrl: rendered.url,
  });
}
