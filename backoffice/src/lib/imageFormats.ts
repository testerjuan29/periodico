/**
 * Catálogo de formatos de imagen — configurable por entorno, sin tocar código.
 *
 * - IMAGE_DEFAULT_TEMPLATE / _WIDTH / _HEIGHT: el formato que usa la generación
 *   automática (workflow 03 lee las MISMAS variables) y el re-render manual.
 * - IMAGE_FORMATS: catálogo JSON opcional para ofrecer variantes en la UI.
 *   Si se omite, aplica el catálogo estándar de abajo.
 *
 * Nota: el marco oficial del cliente (templates/1.png) es 4:5 — los formatos
 * cuadrado/historia requieren su propio template con un marco a esa proporción
 * (campo `template` de cada entrada) antes de habilitarse en serio.
 */

export type ImageFormat = {
  key: string;
  label: string;
  width: number;
  height: number;
  template: string;
};

const STANDARD_CATALOG: ImageFormat[] = [
  { key: 'portada',  label: 'Portada 4:5 (Instagram/Facebook)', width: 1080, height: 1350, template: 'article' },
  { key: 'cuadrado', label: 'Cuadrado 1:1',                     width: 1080, height: 1080, template: 'article' },
  { key: 'historia', label: 'Historia 9:16',                    width: 1080, height: 1920, template: 'article' },
];

function isValidFormat(f: unknown): f is ImageFormat {
  if (typeof f !== 'object' || f === null) return false;
  const x = f as Record<string, unknown>;
  return typeof x.key === 'string' && x.key.length > 0
    && typeof x.label === 'string'
    && Number.isFinite(x.width) && (x.width as number) >= 200 && (x.width as number) <= 4000
    && Number.isFinite(x.height) && (x.height as number) >= 200 && (x.height as number) <= 4000
    && typeof x.template === 'string' && /^[a-z0-9-]+$/.test(x.template as string);
}

/** Catálogo activo: IMAGE_FORMATS (JSON) si es válido, si no el estándar. */
export function getImageFormats(): ImageFormat[] {
  const raw = process.env.IMAGE_FORMATS;
  if (!raw) return STANDARD_CATALOG;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidFormat)) {
      return parsed;
    }
  } catch {
    // JSON roto → catálogo estándar; mejor degradar que romper el render.
  }
  return STANDARD_CATALOG;
}

/** Formato por defecto — las mismas variables que lee el workflow 03 en n8n. */
export function getDefaultFormat(): ImageFormat {
  return {
    key: 'default',
    label: 'Formato por defecto',
    template: process.env.IMAGE_DEFAULT_TEMPLATE || 'article',
    width: Number(process.env.IMAGE_DEFAULT_WIDTH) || 1080,
    height: Number(process.env.IMAGE_DEFAULT_HEIGHT) || 1350,
  };
}

/** Resuelve un formato del catálogo por key; sin key (o inexistente) → el default. */
export function resolveFormat(key: string | null | undefined): ImageFormat {
  if (!key) return getDefaultFormat();
  return getImageFormats().find((f) => f.key === key) ?? getDefaultFormat();
}
