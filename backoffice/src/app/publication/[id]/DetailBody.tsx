'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditForm } from './EditForm';
import { PreviewTabs } from './PreviewTabs';

type Props = {
  id: string;
  status: string;
  wpTitle: string | null;
  wpBodyHtml: string | null;
  wpExcerpt: string | null;
  wpCategories: string[];
  wpTags: string[];
  fbCaption: string | null;
  igCaption: string | null;
  hashtags: string[];
  wpSubtitle: string | null;
  seoKeyphrase: string | null;
  seoKeywords: string[];
  twCaption: string | null;
  shareText: string | null;
  wpPostUrl: string | null;
  imageUrl: string | null;
  /** URL pública del WordPress (env WP_PUBLIC_URL) — para dominios y placeholders. */
  siteUrl: string;
  /** El panel de triage enlaza con ?edit=1 para saltar directo al editor. */
  initialEdit?: boolean;
};

const NOT_EDITABLE = new Set(['published', 'publishing', 'rejected', 'failed']);

export function DetailBody(props: Readonly<Props>) {
  const canEdit = !NOT_EDITABLE.has(props.status);
  const [editing, setEditing] = useState(Boolean(props.initialEdit) && canEdit);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        {editing ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-pending-soft px-3 py-1 text-label font-semibold text-pending">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pending" aria-hidden />
            {'Editando copy'}
          </span>
        ) : (
          <h2 className="text-label font-semibold uppercase tracking-wider text-muted">
            Prueba de imprenta
          </h2>
        )}
        {canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Editar copy
          </Button>
        )}
        {/* En edición NO hay botón de salida acá: la única salida es el
            "Cancelar" del editor, que sí confirma si hay cambios sin guardar. */}
      </div>

      {editing ? (
        <EditForm
          id={props.id}
          initial={{
            wpTitle:      props.wpTitle ?? '',
            wpBodyHtml:   props.wpBodyHtml ?? '',
            wpExcerpt:    props.wpExcerpt ?? '',
            wpCategories: props.wpCategories,
            wpTags:       props.wpTags,
            fbCaption:    props.fbCaption ?? '',
            igCaption:    props.igCaption ?? '',
            hashtags:     props.hashtags,
            wpSubtitle:   props.wpSubtitle ?? '',
            seoKeyphrase: props.seoKeyphrase ?? '',
            seoKeywords:  props.seoKeywords,
            twCaption:    props.twCaption ?? '',
            shareText:    props.shareText ?? '',
          }}
          imageUrl={props.imageUrl}
          siteUrl={props.siteUrl}
          onDone={() => setEditing(false)}
        />
      ) : (
        <PreviewTabs
          wpTitle={props.wpTitle}
          wpBodyHtml={props.wpBodyHtml}
          wpExcerpt={props.wpExcerpt}
          wpCategories={props.wpCategories}
          wpTags={props.wpTags}
          fbCaption={props.fbCaption}
          igCaption={props.igCaption}
          hashtags={props.hashtags}
          twCaption={props.twCaption}
          shareText={props.shareText}
          wpPostUrl={props.wpPostUrl}
          imageUrl={props.imageUrl}
          siteUrl={props.siteUrl}
        />
      )}
    </div>
  );
}
