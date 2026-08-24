'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Loader2, LogOut, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function UserMenu({ user, isAdmin = false }: Readonly<{ user: string; isAdmin?: boolean }>) {
  const [pending, setPending] = useState(false);
  const pathname = usePathname();

  // Sin sesión (página de login) el menú no existe.
  if (!user) return null;

  const logout = async () => {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  };

  return (
    <div className="flex flex-none items-center gap-2">
      {isAdmin && (
        <Link
          href="/usuarios"
          title="Gestionar usuarios"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
            pathname === '/usuarios'
              ? 'border-ink bg-ink text-paper'
              : 'border-divider bg-surface text-muted hover:border-muted hover:text-ink'
          )}
        >
          <Users className="h-3.5 w-3.5" />
        </Link>
      )}
      <span className="hidden rounded-full bg-subtle px-2.5 py-0.5 text-label text-muted md:inline">
        {user}
      </span>
      <button
        type="button"
        onClick={logout}
        disabled={pending}
        title="Cerrar sesión"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-divider bg-surface text-muted transition-colors hover:border-muted hover:text-ink disabled:opacity-50"
      >
        {pending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <LogOut className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
