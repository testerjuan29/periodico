'use client';

import { FileText, Facebook, Instagram, Share2, Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { cn, slugify } from '@/lib/utils';

type Props = {
  wpTitle: string | null;
  wpBodyHtml: string | null;
  wpExcerpt: string | null;
  wpCategories: string[];
  wpTags: string[];
  fbCaption: string | null;
  igCaption: string | null;
  hashtags: string[];
  imageUrl: string | null;
  /** Textos de difusión (X + grupos). Opcionales: el triage puede no pasarlos. */
  twCaption?: string | null;
  shareText?: string | null;
  /** Enlace real de la nota publicada — se anexa al copiar los textos de difusión. */
  wpPostUrl?: string | null;
  /** URL pública del WordPress (env WP_PUBLIC_URL) — dominio y placeholders. */
  siteUrl?: string;
  /** Controlado desde afuera cuando el panel de triage maneja los atajos 1/2/3. */
  value?: string;
  onValueChange?: (v: string) => void;
};

/** Host legible de una URL ('' si no hay o no parsea). */
function hostOf(url: string | undefined): string {
  try {
    return url ? new URL(url).host : '';
  } catch {
    return '';
  }
}

export function PreviewTabs(props: Readonly<Props>) {
  const imgSrc = props.imageUrl
    ? `/api/image?path=${encodeURIComponent(props.imageUrl)}`
    : null;
  const hasDifusion = Boolean(props.twCaption || props.shareText);

  return (
    <Tabs
      defaultValue="wordpress"
      value={props.value}
      onValueChange={props.onValueChange}
      className="w-full"
    >
      {/* Segmentado centrado, con el atajo visible en cada pestaña */}
      <div className="flex justify-center">
        <TabsList>
          <TabsTrigger value="wordpress">
            <FileText className="h-3.5 w-3.5" />
            WordPress
            <TabKbd>1</TabKbd>
          </TabsTrigger>
          <TabsTrigger value="facebook">
            <Facebook className="h-3.5 w-3.5" />
            Facebook
            <TabKbd>2</TabKbd>
          </TabsTrigger>
          <TabsTrigger value="instagram">
            <Instagram className="h-3.5 w-3.5" />
            Instagram
            <TabKbd>3</TabKbd>
          </TabsTrigger>
          {hasDifusion && (
            <TabsTrigger value="difusion">
              <Share2 className="h-3.5 w-3.5" />
              Difusión
            </TabsTrigger>
          )}
        </TabsList>
      </div>

      <TabsContent value="wordpress">
        <WordPressPreview {...props} imgSrc={imgSrc} />
      </TabsContent>

      <TabsContent value="facebook">
        <FacebookPreview {...props} imgSrc={imgSrc} />
      </TabsContent>

      <TabsContent value="instagram">
        <InstagramPreview {...props} imgSrc={imgSrc} />
      </TabsContent>

      {hasDifusion && (
        <TabsContent value="difusion">
          <DifusionPreview
            twCaption={props.twCaption ?? null}
            shareText={props.shareText ?? null}
            wpPostUrl={props.wpPostUrl ?? null}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}

/** Textos de difusión listos para copiar; anexa el enlace real si la nota ya se publicó. */
function DifusionPreview({
  twCaption, shareText, wpPostUrl,
}: Readonly<{ twCaption: string | null; shareText: string | null; wpPostUrl: string | null }>) {
  const withLink = (text: string) => (wpPostUrl ? `${text}\n\n${wpPostUrl}` : text);
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(withLink(text));
      toast.success(`${label} copiado${wpPostUrl ? ' (con el enlace de la nota)' : ''}`);
    } catch {
      toast.error('No se pudo copiar — copialo a mano');
    }
  };

  return (
    <div className="mx-auto max-w-[520px] space-y-5">
      {twCaption && (
        <div className="overflow-hidden rounded-lg border border-divider bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-divider p-3.5">
            <span className="flex items-center gap-2 text-meta font-semibold text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-display text-meta font-bold text-paper">𝕏</span>
              <span>Post para Twitter/X</span>
            </span>
            <Button variant="outline" size="sm" onClick={() => void copy(twCaption, 'Post de X')}>
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
          <p className="whitespace-pre-wrap p-4 text-meta leading-relaxed text-ink/90">{twCaption}</p>
        </div>
      )}
      {shareText && (
        <div className="overflow-hidden rounded-lg border border-divider bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-divider p-3.5">
            <span className="flex items-center gap-2 text-meta font-semibold text-ink">
              <MessageCircle className="h-4 w-4 text-approve" />
              Grupos de WhatsApp / Telegram
            </span>
            <Button variant="outline" size="sm" onClick={() => void copy(shareText, 'Texto para grupos')}>
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
          <p className="whitespace-pre-wrap p-4 text-meta leading-relaxed text-ink/90">{shareText}</p>
        </div>
      )}
      <p className="px-1 text-label text-muted">
        {wpPostUrl
          ? 'Al copiar se agrega automáticamente el enlace de la nota publicada.'
          : 'Cuando la nota esté publicada en WordPress, el botón de copiar agregará el enlace automáticamente.'}
      </p>
    </div>
  );
}

function TabKbd({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <kbd className="rounded-sm bg-ink/[0.06] px-1 font-mono text-micro font-semibold text-muted">
      {children}
    </kbd>
  );
}

function WordPressPreview({
  wpTitle, wpBodyHtml, wpExcerpt, wpCategories, wpTags, siteUrl, imgSrc,
}: Props & { imgSrc: string | null }) {
  const slug = wpTitle ? slugify(wpTitle) : '';
  const siteHost = hostOf(siteUrl);
  return (
    // Marco de navegador: deja claro que esto es "lo que se va a publicar",
    // no un formulario más. Medida editorial: máx 760px de columna.
    <div className="mx-auto max-w-[780px] overflow-hidden rounded-lg border border-ink/10 bg-surface shadow-elevated">
      <div className="flex items-center gap-2.5 border-b border-divider bg-subtle px-3.5 py-2">
        <span className="h-2 w-2 rounded-full bg-[#E0685E]" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-[#E5B84B]" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-[#6FBF95]" aria-hidden />
        <span className="mx-auto min-w-0 max-w-[75%] truncate rounded-full bg-surface px-4 py-0.5 text-center font-mono text-label text-muted ring-1 ring-divider">
          <span className="font-medium text-ink/70">{siteHost || 'sitio'}</span>/{slug || '…'}
        </span>
      </div>
      <article className="p-8">
      {imgSrc && (
        // La imagen es 1:1 (1080×1080). Sin tope de altura, en un panel ancho
        // ocupaba toda la pantalla y empujaba el titular fuera de vista.
        <div className="mb-8 flex justify-center overflow-hidden rounded-md bg-subtle/60 p-3">
          <img
            src={imgSrc}
            alt=""
            className="max-h-[280px] w-auto rounded object-contain"
          />
        </div>
      )}
      {wpCategories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {wpCategories.map((c) => (
            <span
              key={c}
              className="rounded-full bg-brand-soft px-2.5 py-0.5 text-label font-semibold uppercase tracking-wider text-brand-dark"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <h1 className="mb-4 font-display text-title font-semibold leading-tight text-ink">
        {wpTitle ?? '—'}
      </h1>
      {wpExcerpt && (
        <p className="mb-8 border-l-2 border-brand pl-4 font-display text-lead italic leading-relaxed text-ink/80">
          {wpExcerpt}
        </p>
      )}
      <div
        className="prose-editorial"
        dangerouslySetInnerHTML={{ __html: wpBodyHtml ?? '' }}
      />
      {wpTags.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-divider pt-6">
          <span className="text-label font-semibold uppercase tracking-wider text-muted">
            Etiquetas
          </span>
          {wpTags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-subtle px-2.5 py-0.5 text-meta text-ink/70"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      </article>
    </div>
  );
}

function FacebookPreview({ fbCaption, wpPostUrl, siteUrl, imgSrc }: Props & { imgSrc: string | null }) {
  return (
    <div className="mx-auto max-w-lg overflow-hidden rounded-lg border border-divider bg-surface shadow-card">
      <div className="flex items-center gap-3 p-4">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand to-brand-dark" />
        <div>
          <div className="text-meta font-semibold text-ink">PaginaUno.Do</div>
          <div className="text-label text-muted">Ahora · 🌐 Público</div>
        </div>
      </div>
      <div className="whitespace-pre-wrap px-4 pb-1 text-meta leading-relaxed text-ink/90">
        {fbCaption ?? '—'}
      </div>
      <ReadMoreLine wpPostUrl={wpPostUrl ?? null} siteUrl={siteUrl} />
      {imgSrc && (
        <div className="flex justify-center border-t border-divider bg-subtle/40">
          <img src={imgSrc} alt="" className="max-h-[300px] w-auto object-contain" />
        </div>
      )}
    </div>
  );
}

/** Línea "Leer más en …" que los workflows anexan al publicar en FB e IG. */
function ReadMoreLine({ wpPostUrl, siteUrl }: Readonly<{ wpPostUrl: string | null; siteUrl?: string }>) {
  const placeholder = siteUrl ? `${siteUrl}/…` : 'el enlace de la nota';
  return (
    <div className="px-4 pb-3 text-meta leading-relaxed">
      <span className="text-schedule">Leer más en {wpPostUrl ?? placeholder}</span>{' '}
      {!wpPostUrl && (
        <span className="ml-1.5 text-label text-muted">· el enlace real se agrega al publicar</span>
      )}
    </div>
  );
}

function InstagramPreview({ igCaption, hashtags, wpPostUrl, siteUrl, imgSrc }: Props & { imgSrc: string | null }) {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-lg border border-divider bg-surface shadow-card">
      <div className="flex items-center gap-3 border-b border-divider p-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand to-brand-dark" />
        <div className="text-meta font-semibold text-ink">paginauno.do</div>
      </div>
      {imgSrc && (
        <img src={imgSrc} alt="" className="aspect-square w-full object-cover" loading="lazy" />
      )}
      <div className="p-4">
        <div className="whitespace-pre-wrap text-meta leading-relaxed text-ink/90">
          <span className="font-semibold text-ink">paginauno.do</span> {igCaption ?? '—'}
        </div>
        <div className="-mx-4">
          <ReadMoreLine wpPostUrl={wpPostUrl ?? null} siteUrl={siteUrl} />
        </div>
        {hashtags?.length > 0 && (
          <div className="text-meta leading-relaxed text-schedule">
            {hashtags.map((h) => `#${h}`).join(' ')}
          </div>
        )}
      </div>
    </div>
  );
}
