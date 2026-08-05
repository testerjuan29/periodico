import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === 'string' ? sp.next : '/';
  // Solo rutas internas — corta cualquier intento de open redirect.
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  return (
    // Overlay a pantalla completa: cubre el chrome del layout raíz sin
    // reestructurar rutas. Para un login de un solo usuario, suficiente.
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-canvas px-6">
      <div className="text-center">
        <p className="font-display text-display font-semibold leading-none text-ink">
          Pagina<span className="text-brand">Uno</span>
          <span className="font-mono text-lead font-normal text-muted">.do</span>
        </p>
        <p className="mt-2 text-label uppercase tracking-[0.2em] text-muted">
          Mesa de edición
        </p>
      </div>

      <LoginForm next={next} />

      <p className="text-label text-muted">
        Acceso restringido al equipo editorial.
      </p>
    </div>
  );
}
