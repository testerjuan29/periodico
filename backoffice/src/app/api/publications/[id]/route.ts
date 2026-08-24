import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/currentUser';

const patchSchema = z.object({
  wpTitle:      z.string().optional(),
  wpBodyHtml:   z.string().optional(),
  wpExcerpt:    z.string().optional(),
  wpCategories: z.array(z.string()).optional(),
  wpTags:       z.array(z.string()).optional(),
  fbCaption:    z.string().optional(),
  igCaption:    z.string().optional(),
  hashtags:     z.array(z.string()).optional(),
  wpSubtitle:   z.string().optional(),
  seoKeyphrase: z.string().optional(),
  seoKeywords:  z.array(z.string()).optional(),
  twCaption:    z.string().optional(),
  shareText:    z.string().optional(),
});

// Alimenta el panel de preview del escritorio de triage sin navegar de página.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pub = await prisma.publication.findUnique({
    where: { id },
    select: {
      id: true, status: true,
      sourceType: true, sourceSender: true, sourceSubject: true, sourceText: true,
      wpTitle: true, wpBodyHtml: true, wpExcerpt: true, wpCategories: true, wpTags: true,
      fbCaption: true, igCaption: true, hashtags: true,
      wpSubtitle: true, seoKeyphrase: true, seoKeywords: true, twCaption: true, shareText: true,
      imageUrl: true, receivedAt: true, scheduledAt: true,
      wpPostUrl: true, fbPostUrl: true, igPostUrl: true,
    },
  });
  if (!pub) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(pub);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  // No permitir editar publicaciones ya publicadas o descartadas
  const current = await prisma.publication.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!current) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (['published', 'publishing', 'rejected', 'failed'].includes(current.status)) {
    return NextResponse.json({ error: `no se puede editar en estado ${current.status}` }, { status: 409 });
  }

  const changed = Object.keys(body.data);
  if (changed.length === 0) {
    return NextResponse.json({ ok: true, changed: [] });
  }

  const updated = await prisma.publication.update({
    where: { id },
    data: body.data,
  });

  await prisma.auditLog.create({
    data: {
      publicationId: id,
      actorEmail: (await getSessionUser())?.email ?? 'sistema',
      action: 'edit',
      payload: { changed },
    },
  });

  return NextResponse.json({
    ok: true,
    id: updated.id,
    changed,
  });
}
