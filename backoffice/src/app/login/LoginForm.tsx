'use client';

import { useState } from 'react';
import { Loader2, LogIn, User, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm({ next }: Readonly<{ next: string }>) {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        setPending(false);
        return;
      }
      // Navegación completa: los server components re-renderizan con la cookie.
      window.location.assign(next);
    } catch {
      setError('No se pudo contactar al servidor.');
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-lg border border-ink/10 bg-surface p-7 shadow-elevated"
    >
      <div className="mb-5">
        <Label htmlFor="login-user" className="mb-2 block">Usuario</Label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            id="login-user"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            disabled={pending}
            className="pl-9"
          />
        </div>
      </div>

      <div className="mb-5">
        <Label htmlFor="login-pass" className="mb-2 block">Contraseña</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            id="login-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            disabled={pending}
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-brand/30 bg-brand-soft px-3 py-2 text-meta text-brand-dark">
          {error}
        </p>
      )}

      <Button type="submit" variant="critical" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Entrar
      </Button>
    </form>
  );
}
