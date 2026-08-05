'use client';

import { useEffect, useState } from 'react';
import { subscribeDeferred } from '@/lib/deferredAction';

/**
 * Avisa antes de cerrar la pestaña si hay acciones dentro de su ventana de
 * arrepentimiento. Sin esto el editor cree que publicó y en realidad el
 * request nunca salió.
 */
export function DeferredGuard() {
  const [pending, setPending] = useState(0);

  useEffect(() => subscribeDeferred(setPending), []);

  useEffect(() => {
    if (pending === 0) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Los navegadores modernos ignoran el texto, pero returnValue sigue
      // siendo lo que dispara el diálogo nativo.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [pending]);

  return null;
}
