'use client';

import { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';

export function UserMenu({ user }: Readonly<{ user: string }>) {
  const [pending, setPending] = useState(false);

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
