'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const KEY = 'pa:tip-shortcuts-dismissed';

/**
 * Enseña los atajos una sola vez y desaparece para siempre.
 * Reemplaza a la banda de atajos que vivía fija al pie del panel.
 */
export function ShortcutsTip() {
  // Arranca oculto para no parpadear en SSR; localStorage decide al montar.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="flex flex-none items-center gap-2.5 border-b border-divider bg-schedule-soft px-5 py-2 text-meta text-schedule">
      <Sparkles className="h-3.5 w-3.5 flex-none" />
      <span>
        Movete con <K>j</K> <K>k</K>, aprobá con <K>A</K>, cambiá el preview con{' '}
        <K>1</K> <K>2</K> <K>3</K> — todo sin tocar el mouse.
      </span>
      <button
        type="button"
        aria-label="Cerrar consejo"
        onClick={() => {
          localStorage.setItem(KEY, '1');
          setVisible(false);
        }}
        className="ml-auto rounded-full p-1 transition-colors hover:bg-schedule/10"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function K({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <kbd className="rounded-sm bg-schedule/10 px-1.5 font-mono text-micro font-semibold">
      {children}
    </kbd>
  );
}
