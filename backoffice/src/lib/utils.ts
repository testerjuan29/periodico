import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Nuestra escala tipográfica es custom (text-body, text-meta, …). Sin esta
// configuración, tailwind-merge no puede distinguirla de los colores custom
// (text-paper, text-ink) y descarta uno de los dos cuando aparecen juntos —
// p. ej. el botón primario perdía `text-paper` frente a `text-body` y quedaba
// texto negro sobre fondo negro.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['micro', 'label', 'meta', 'body', 'lead', 'headline', 'title', 'display'] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// URL plausible para los marcos de navegador — WP genera el slug igual.
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    // El colapso anterior garantiza a lo sumo UN guión en cada extremo.
    .replace(/^-/, '')
    .replace(/-$/, '')
    .slice(0, 60);
}

// Una nota pendiente sin contenido y recién recibida está "generándose":
// la IA tarda ~1-2 min en redactar. Pasada la ventana, lo más probable es que
// la generación haya fallado y corresponde ofrecer el reintento.
export const GENERATING_WINDOW_MS = 3 * 60 * 1000;

export function isGenerating(receivedAt: string | Date | null | undefined): boolean {
  if (!receivedAt) return false;
  return Date.now() - new Date(receivedAt).getTime() < GENERATING_WINDOW_MS;
}
