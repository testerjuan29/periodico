'use client';

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2, Save, ImageUp, FileText, Facebook, Instagram,
  ThumbsUp, MessageSquare, Share2, Heart, MessageCircle, Send, X, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/RichTextEditor';
import { cn, slugify } from '@/lib/utils';

/**
 * Editor "en el preview": no hay formulario — el marco de navegador, el post
 * de Facebook y la tarjeta de Instagram son directamente editables. Lo que se
 * ve mientras se escribe es lo que se publica.
 */

type EditableFields = {
  wpTitle: string;
  wpBodyHtml: string;
  wpExcerpt: string;
  wpCategories: string[];
  wpTags: string[];
  fbCaption: string;
  igCaption: string;
  hashtags: string[];
  wpSubtitle: string;
  seoKeyphrase: string;
  seoKeywords: string[];
  twCaption: string;
  shareText: string;
};

const FIELD_LABEL: Record<keyof EditableFields, string> = {
  wpTitle:      'Titular',
  wpSubtitle:   'Subtítulo',
  wpExcerpt:    'Extracto',
  wpBodyHtml:   'Cuerpo',
  wpCategories: 'Categorías',
  wpTags:       'Etiquetas',
  fbCaption:    'Facebook',
  igCaption:    'Instagram',
  hashtags:     'Hashtags',
  seoKeyphrase: 'Frase clave',
  seoKeywords:  'Keywords SEO',
  twCaption:    'Twitter/X',
  shareText:    'Grupos',
};

// Línea editorial de PaginaUno: titular hasta 110 caracteres.
const TITLE_SOFT_MAX = 110;
const IG_MAX = 2200;
const HASHTAG_MAX = 30;
// X permite 280; dejamos 250 para que el enlace de la nota siempre quepa.
const TW_SOFT_MAX = 250;

type Props = {
  id: string;
  initial: EditableFields;
  imageUrl: string | null;
  /** URL pública del WordPress (env WP_PUBLIC_URL). */
  siteUrl: string;
  onDone: () => void;
};

/** Host legible de una URL ('' si no hay o no parsea). */
function hostOf(url: string): string {
  try {
    return url ? new URL(url).host : '';
  } catch {
    return '';
  }
}

const arrayEq = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export function EditForm({ id, initial, imageUrl, siteUrl, onDone }: Readonly<Props>) {
  const siteHost = hostOf(siteUrl);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState<EditableFields>(initial);
  const [tab, setTab] = useState('wordpress');
  const [currentImage, setCurrentImage] = useState<string | null>(imageUrl);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof EditableFields>(key: K, value: EditableFields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
  };

  const diff = () => {
    const out: Partial<EditableFields> = {};
    (Object.keys(fields) as Array<keyof EditableFields>).forEach((k) => {
      const a = fields[k];
      const b = initial[k];
      const changed = Array.isArray(a) && Array.isArray(b) ? !arrayEq(a, b) : a !== b;
      if (changed) (out as Record<string, unknown>)[k] = a;
    });
    return out;
  };

  const changedKeys = Object.keys(diff()) as Array<keyof EditableFields>;
  const hasChanges = changedKeys.length > 0;

  // ── Guardias: no perder trabajo en silencio ────────────────────────────
  useEffect(() => {
    if (!hasChanges) return;
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [hasChanges]);

  const cancel = useCallback(() => {
    if (hasChanges && !window.confirm('Tenés cambios sin guardar. ¿Descartarlos?')) return;
    onDone();
  }, [hasChanges, onDone]);

  const save = useCallback(() => {
    const payload = diff();
    if (Object.keys(payload).length === 0) {
      toast.info('No hay cambios que guardar');
      return;
    }
    const toastId = toast.loading('Guardando...');
    startTransition(async () => {
      try {
        const res = await fetch(`/api/publications/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || `Error ${res.status}`, { id: toastId });
          return;
        }
        toast.success(
          `Guardado (${data.changed.length} campo${data.changed.length === 1 ? '' : 's'})`,
          { id: toastId }
        );
        onDone();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error de red', { id: toastId });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, id, onDone, router]);

  // ── Atajos: 1/2/3 pestañas · Ctrl+S guardar · Esc cancelar ─────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
      if (typing) return;
      if (e.key === 'Escape') { cancel(); return; }
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0) setTab(['wordpress', 'facebook', 'instagram', 'difusion'][i]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, cancel]);

  // ── Imagen: se cambia desde el hero, upload inmediato ──────────────────
  const uploadImage = async (file: File) => {
    const toastId = toast.loading('Subiendo y aplicando template...');
    setUploadingImage(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/publications/${id}/image`, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || `Error ${res.status}`, { id: toastId });
        return;
      }
      setCurrentImage(data.imageUrl);
      toast.success('Imagen actualizada', { id: toastId });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error de red', { id: toastId });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const imgSrc = currentImage
    ? `/api/image?path=${encodeURIComponent(currentImage)}&v=${encodeURIComponent(currentImage)}`
    : null;
  const slug = slugify(fields.wpTitle) || '…';

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado al portapapeles`);
    } catch {
      toast.error('No se pudo copiar — copialo a mano');
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); }}
        disabled={pending || uploadingImage}
        className="hidden"
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="flex justify-center">
          <TabsList>
            <TabsTrigger value="wordpress">
              <FileText className="h-3.5 w-3.5" /> WordPress <Kbd>1</Kbd>
            </TabsTrigger>
            <TabsTrigger value="facebook">
              <Facebook className="h-3.5 w-3.5" /> Facebook <Kbd>2</Kbd>
            </TabsTrigger>
            <TabsTrigger value="instagram">
              <Instagram className="h-3.5 w-3.5" /> Instagram <Kbd>3</Kbd>
            </TabsTrigger>
            <TabsTrigger value="difusion">
              <Share2 className="h-3.5 w-3.5" /> Difusión <Kbd>4</Kbd>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ══ WORDPRESS: el artículo es el formulario ══ */}
        <TabsContent value="wordpress">
          <div className="mx-auto max-w-[780px] overflow-hidden rounded-lg border border-ink/10 bg-surface shadow-elevated">
            <div className="flex items-center gap-2.5 border-b border-divider bg-subtle px-3.5 py-2">
              <span className="h-2 w-2 rounded-full bg-[#E0685E]" aria-hidden />
              <span className="h-2 w-2 rounded-full bg-[#E5B84B]" aria-hidden />
              <span className="h-2 w-2 rounded-full bg-[#6FBF95]" aria-hidden />
              <span className="mx-auto min-w-0 max-w-[75%] truncate rounded-full bg-surface px-4 py-0.5 text-center font-mono text-label text-muted ring-1 ring-divider">
                <span className="font-medium text-ink/70">{siteHost || 'sitio'}</span>/{slug}
              </span>
            </div>

            <article className="p-8">
              {/* Hero: la imagen se cambia acá, no en una sección aparte */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="group relative mb-6 flex w-full justify-center overflow-hidden rounded-md bg-subtle/60 p-3"
                title="Cambiar la imagen destacada"
              >
                {imgSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgSrc} alt="" className="max-h-[280px] w-auto rounded object-contain" />
                ) : (
                  <span className="flex h-40 w-full items-center justify-center rounded border border-dashed border-divider text-meta text-muted">
                    Sin imagen — hacé click para subir una
                  </span>
                )}
                <span className={cn(
                  'absolute inset-0 flex items-center justify-center gap-2 bg-ink/45 text-meta font-semibold text-white backdrop-blur-[1px] transition-opacity',
                  uploadingImage ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}>
                  {uploadingImage
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <ImageUp className="h-4 w-4" />}
                  {uploadingImage ? 'Aplicando template…' : 'Cambiar imagen — se re-renderiza con el template'}
                </span>
              </button>

              <ChipEditor
                label="Categorías"
                value={fields.wpCategories}
                onChange={(v) => set('wpCategories', v)}
                variant="category"
                disabled={pending}
              />

              <AutoTextarea
                value={fields.wpTitle}
                onChange={(v) => set('wpTitle', v)}
                disabled={pending}
                maxLength={200}
                placeholder="Titular editorial…"
                className="-mx-1.5 mt-3 w-[calc(100%+12px)] px-1.5 font-display text-title font-semibold leading-tight text-ink"
              />
              <Counter n={fields.wpTitle.length} max={TITLE_SOFT_MAX} suffix="· línea editorial" />

              <AutoTextarea
                value={fields.wpSubtitle}
                onChange={(v) => set('wpSubtitle', v)}
                disabled={pending}
                maxLength={220}
                placeholder="Subtítulo editorial…"
                className="mt-2 w-full font-display text-lead font-medium leading-snug text-ink/85"
              />
              <p className="mb-3 mt-1 text-micro text-muted">
                Subtítulo — referencia para el equipo, no se envía a WordPress
              </p>

              <AutoTextarea
                value={fields.wpExcerpt}
                onChange={(v) => set('wpExcerpt', v)}
                disabled={pending}
                maxLength={300}
                placeholder="Extracto / resumen para SEO…"
                className="mb-5 mt-2 w-full border-l-[3px] border-brand py-0.5 pl-4 font-display text-lead italic leading-relaxed text-ink/80"
              />

              <RichTextEditor
                value={fields.wpBodyHtml}
                onChange={(html) => set('wpBodyHtml', html)}
                disabled={pending}
              />

              <div className="mt-6 border-t border-divider pt-5">
                <ChipEditor
                  label="Etiquetas"
                  value={fields.wpTags}
                  onChange={(v) => set('wpTags', v)}
                  variant="tag"
                  disabled={pending}
                />
              </div>

              <div className="mt-5 border-t border-divider pt-5">
                <p className="mb-3 text-label font-semibold uppercase tracking-wider text-muted">
                  SEO
                </p>
                <div className="mb-3 flex flex-wrap items-baseline gap-2">
                  <span className="text-label font-semibold uppercase tracking-wider text-muted">
                    Frase clave
                  </span>
                  <AutoTextarea
                    value={fields.seoKeyphrase}
                    onChange={(v) => set('seoKeyphrase', v.replaceAll('\n', ' '))}
                    disabled={pending}
                    maxLength={80}
                    placeholder="frase clave principal…"
                    className="min-w-[220px] flex-1 rounded-full bg-approve-soft px-3 py-0.5 font-mono text-meta text-approve"
                  />
                </div>
                <ChipEditor
                  label="Keywords"
                  value={fields.seoKeywords}
                  onChange={(v) => set('seoKeywords', v)}
                  variant="tag"
                  disabled={pending}
                />
              </div>
            </article>
          </div>
        </TabsContent>

        {/* ══ FACEBOOK: el post es el formulario ══ */}
        <TabsContent value="facebook">
          <div className="mx-auto max-w-[460px] overflow-hidden rounded-lg border border-ink/10 bg-surface shadow-elevated">
            <div className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-body font-semibold text-white">P</span>
              <span className="leading-tight">
                <span className="block text-meta font-semibold text-ink">PaginaUno.Do</span>
                <span className="text-label text-muted">Ahora · 🌐 Público</span>
              </span>
            </div>
            <AutoTextarea
              value={fields.fbCaption}
              onChange={(v) => set('fbCaption', v)}
              disabled={pending}
              placeholder="Caption de Facebook…"
              className="mb-1 w-full px-4 text-meta leading-relaxed text-ink/90"
            />
            <p className="mb-3 px-4 text-meta leading-relaxed">
              <span className="text-schedule">Leer más en {siteUrl ? `${siteUrl}/…` : 'el enlace de la nota'}</span>{' '}
              <span className="ml-1.5 text-label text-muted">· se agrega solo al publicar</span>
            </p>
            {imgSrc && (
              <div className="flex justify-center border-y border-divider bg-subtle/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc} alt="" className="max-h-[300px] w-auto object-contain" />
              </div>
            )}
            <div className="flex px-3 py-1.5 text-label text-muted">
              <span className="flex flex-1 items-center justify-center gap-1.5 py-1.5"><ThumbsUp className="h-3.5 w-3.5" /> Me gusta</span>
              <span className="flex flex-1 items-center justify-center gap-1.5 py-1.5"><MessageSquare className="h-3.5 w-3.5" /> Comentar</span>
              <span className="flex flex-1 items-center justify-center gap-1.5 py-1.5"><Share2 className="h-3.5 w-3.5" /> Compartir</span>
            </div>
          </div>
          <p className="mx-auto mt-3 flex max-w-[460px] items-start gap-2 px-1 text-label text-muted">
            <MessageCircle className="mt-0.5 h-3 w-3 flex-none" />
            El texto se edita ahí arriba, dentro del post. La imagen es la del template — se cambia desde la pestaña WordPress.
          </p>
        </TabsContent>

        {/* ══ INSTAGRAM ══ */}
        <TabsContent value="instagram">
          <div className="mx-auto max-w-[400px] overflow-hidden rounded-lg border border-ink/10 bg-surface shadow-elevated">
            <div className="flex items-center gap-2.5 border-b border-divider p-3">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-label font-semibold text-white">P</span>
              <span className="text-meta font-semibold text-ink">paginauno.do</span>
            </div>
            {imgSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgSrc} alt="" className="aspect-square w-full object-cover" />
            )}
            <div className="flex gap-4 px-4 pb-1 pt-3 text-ink">
              <Heart className="h-5 w-5" />
              <MessageCircle className="h-5 w-5" />
              <Send className="h-5 w-5" />
            </div>
            <div className="px-4 pb-1 pt-1">
              <span className="text-meta font-semibold text-ink">paginauno.do</span>
              <AutoTextarea
                value={fields.igCaption}
                onChange={(v) => set('igCaption', v)}
                disabled={pending}
                maxLength={IG_MAX}
                placeholder="Caption de Instagram…"
                className="mt-1 w-full text-meta leading-relaxed text-ink/90"
              />
              <Counter n={fields.igCaption.length} max={IG_MAX} hard />
              <p className="mt-2 text-meta leading-relaxed">
                <span className="text-schedule">Leer más en https://paginauno.do/…</span>
                <span className="ml-1.5 text-label text-muted">· se agrega solo al publicar</span>
              </p>
            </div>
            <div className="px-4 pb-4 pt-1">
              <ChipEditor
                value={fields.hashtags}
                onChange={(v) => set('hashtags', v)}
                variant="hash"
                max={HASHTAG_MAX}
                disabled={pending}
              />
              <p className={cn(
                'mt-2 font-mono text-micro',
                fields.hashtags.length >= HASHTAG_MAX ? 'text-brand' : 'text-muted'
              )}>
                {fields.hashtags.length} / {HASHTAG_MAX} hashtags
              </p>
            </div>
          </div>
        </TabsContent>

        {/* ══ DIFUSIÓN: textos para copiar a X y grupos (no se publican automático) ══ */}
        <TabsContent value="difusion">
          <div className="mx-auto max-w-[520px] space-y-6">
            <div className="overflow-hidden rounded-lg border border-ink/10 bg-surface shadow-elevated">
              <div className="flex items-center justify-between border-b border-divider p-3.5">
                <span className="flex items-center gap-2 text-meta font-semibold text-ink">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-display text-meta font-bold text-paper">𝕏</span>
                  <span>Post para Twitter/X</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(fields.twCaption, 'Post de X')}
                  disabled={!fields.twCaption}
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
              <div className="p-4">
                <AutoTextarea
                  value={fields.twCaption}
                  onChange={(v) => set('twCaption', v)}
                  disabled={pending}
                  maxLength={280}
                  placeholder="Post para X…"
                  className="w-full text-meta leading-relaxed text-ink/90"
                />
                <Counter n={fields.twCaption.length} max={TW_SOFT_MAX} suffix="· deja espacio para el enlace" />
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-ink/10 bg-surface shadow-elevated">
              <div className="flex items-center justify-between border-b border-divider p-3.5">
                <span className="flex items-center gap-2 text-meta font-semibold text-ink">
                  <MessageCircle className="h-4 w-4 text-approve" />
                  Grupos de WhatsApp / Telegram
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(fields.shareText, 'Texto para grupos')}
                  disabled={!fields.shareText}
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
              <div className="p-4">
                <AutoTextarea
                  value={fields.shareText}
                  onChange={(v) => set('shareText', v)}
                  disabled={pending}
                  maxLength={600}
                  placeholder="Texto motivante para los grupos…"
                  className="w-full text-meta leading-relaxed text-ink/90"
                />
              </div>
            </div>

            <p className="flex items-start gap-2 px-1 text-label text-muted">
              <Share2 className="mt-0.5 h-3 w-3 flex-none" />
              Estos textos no se publican automáticamente: el editor los copia y los pega
              en X y en los grupos. Agregá el enlace de la nota al final cuando ya esté publicada.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══ Barra de guardado: nombra qué cambiaste ══ */}
      <div className="sticky bottom-0 z-30 mt-6 flex flex-wrap items-center gap-2 border-t border-divider bg-paper/95 py-3 backdrop-blur">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-meta text-muted">
          {hasChanges
            ? changedKeys.map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-pending-soft px-2.5 py-0.5 text-label font-semibold text-pending">
                  <span className="h-1.5 w-1.5 rounded-full bg-pending" aria-hidden />
                  {FIELD_LABEL[k]}
                </span>
              ))
            : 'Sin cambios'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={cancel} disabled={pending}>
            Cancelar <Kbd>Esc</Kbd>
          </Button>
          <Button variant="primary" onClick={save} disabled={pending || !hasChanges}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cambios <Kbd light>Ctrl+S</Kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

/** Textarea que crece con el contenido y se ve como texto del artículo. */
function AutoTextarea({
  value, onChange, className, placeholder, maxLength, disabled,
}: Readonly<{
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      className={cn(
        'block resize-none overflow-hidden rounded-md border-0 bg-transparent transition-shadow',
        'placeholder:text-muted/50',
        'hover:ring-1 hover:ring-ink/15',
        'focus:bg-surface focus:outline-none focus:ring-2 focus:ring-schedule/70',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    />
  );
}

/** Contador editorial con barra: rojo al pasarse del límite. */
function Counter({ n, max, suffix, hard }: Readonly<{ n: number; max: number; suffix?: string; hard?: boolean }>) {
  const over = !hard && n > max;
  const pct = Math.min(100, (n / max) * 100);
  return (
    <div className={cn('mt-1 flex items-center gap-2 font-mono text-micro', over ? 'text-brand' : 'text-muted')}>
      <span className="h-[3px] w-20 overflow-hidden rounded-full bg-subtle">
        <span
          className={cn('block h-full rounded-full transition-all', over ? 'bg-brand' : 'bg-approve')}
          style={{ width: `${pct}%` }}
        />
      </span>
      {n} / {max}
      {suffix && <span className="font-sans">{suffix}</span>}
    </div>
  );
}

/** Chips vivos: × quita, "+ agregar" abre un input inline. */
function ChipEditor({
  label, value, onChange, variant, max, disabled,
}: Readonly<{
  label?: string;
  value: string[];
  onChange: (v: string[]) => void;
  variant: 'category' | 'tag' | 'hash';
  max?: number;
  disabled?: boolean;
}>) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const commit = () => {
    const t = draft.trim().replace(/^#/, '');
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
    setAdding(false);
  };

  const chipCls = cn(
    'inline-flex items-center gap-1.5 rounded-full py-0.5 pl-2.5 pr-1.5',
    variant === 'category' && 'bg-brand-soft text-label font-semibold uppercase tracking-wider text-brand-dark',
    variant === 'tag'      && 'bg-subtle text-meta text-ink/70',
    variant === 'hash'     && 'bg-schedule-soft text-meta text-schedule',
  );

  const atMax = max !== undefined && value.length >= max;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && (
        <span className="mr-1 text-label font-semibold uppercase tracking-wider text-muted">
          {label}
        </span>
      )}
      {value.map((v, i) => (
        <span key={`${v}-${i}`} className={chipCls}>
          {variant === 'hash' ? `#${v}` : v}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label={`Quitar ${v}`}
              className="rounded-full opacity-50 transition-opacity hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && !atMax && (
        adding ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              else if (e.key === 'Escape') { setDraft(''); setAdding(false); }
            }}
            onBlur={commit}
            placeholder="Enter para agregar"
            className="w-36 rounded-full border border-schedule bg-surface px-3 py-0.5 text-meta text-ink outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full border border-dashed border-divider px-2.5 py-0.5 text-label text-muted transition-colors hover:border-muted hover:text-ink"
          >
            + agregar
          </button>
        )
      )}
    </div>
  );
}

function Kbd({ children, light }: Readonly<{ children: React.ReactNode; light?: boolean }>) {
  return (
    <kbd className={cn(
      'rounded-sm px-1.5 font-mono text-micro font-semibold',
      light ? 'bg-white/20' : 'bg-ink/[0.07] text-muted'
    )}>
      {children}
    </kbd>
  );
}
