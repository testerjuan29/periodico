'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  Check, Copy, KeyRound, Loader2, Plus, ShieldCheck, UserRound, UserRoundX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Timestamp } from '@/components/Timestamp';
import { cn } from '@/lib/utils';

type ApiUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'editor';
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

/** Credenciales recién generadas — se muestran UNA vez, hasta que se descartan. */
type FreshCreds = { email: string; password: string };

export function UsersManager({ currentUid }: Readonly<{ currentUid: string }>) {
  const { data, mutate, isLoading } = useSWR<{ users: ApiUser[] }>('/api/users', fetcher);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [creds, setCreds] = useState<FreshCreds | null>(null);

  const patch = async (id: string, body: Record<string, unknown>, okMsg: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      if (json.password) setCreds({ email: json.user.email, password: json.password });
      toast.success(okMsg);
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar');
    } finally {
      setBusy(null);
    }
  };

  const users = data?.users ?? [];

  return (
    <div className="flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-[860px] px-6 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-headline font-semibold text-ink">Usuarios</h1>
            <p className="mt-1 text-meta text-muted">
              Un administrador gestiona los accesos; los editores operan la mesa completa.
            </p>
          </div>
          <Button onClick={() => setCreating((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo usuario
          </Button>
        </div>

        {creds && (
          <CredsReveal creds={creds} onDismiss={() => setCreds(null)} />
        )}

        {creating && (
          <CreateForm
            onDone={(fresh) => {
              setCreating(false);
              if (fresh) setCreds(fresh);
              void mutate();
            }}
          />
        )}

        <div className="overflow-hidden rounded-lg border border-divider bg-surface shadow-card">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 p-8 text-meta text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          )}
          {users.map((u, i) => (
            <div
              key={u.id}
              className={cn(
                'flex items-center gap-4 px-5 py-3.5',
                i > 0 && 'border-t border-divider',
                !u.active && 'opacity-55'
              )}
            >
              <span className={cn(
                'flex h-9 w-9 flex-none items-center justify-center rounded-full',
                u.role === 'admin' ? 'bg-ink text-paper' : 'bg-subtle text-muted'
              )}>
                {u.role === 'admin' ? <ShieldCheck className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-body font-semibold text-ink">{u.name ?? u.email}</span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-micro font-semibold uppercase tracking-wider',
                    u.role === 'admin' ? 'bg-ink text-paper' : 'bg-subtle text-muted'
                  )}>
                    {u.role === 'admin' ? 'Admin' : 'Editor'}
                  </span>
                  {u.id === currentUid && (
                    <span className="rounded-full bg-approve-soft px-2 py-0.5 text-micro font-medium text-approve">vos</span>
                  )}
                  {!u.active && (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-micro font-medium text-brand">inactivo</span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-label text-muted">
                  <span className="truncate">{u.email}</span>
                  {u.lastLoginAt && (
                    <span className="hidden flex-none sm:inline">
                      último acceso <Timestamp date={u.lastLoginAt} format="relative" />
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-none items-center gap-1.5">
                {busy === u.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === u.id}
                  onClick={() => patch(u.id, { resetPassword: true }, `Contraseña nueva para ${u.email}`)}
                  title="Generar contraseña nueva"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Resetear clave</span>
                </Button>
                {u.id !== currentUid && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === u.id}
                      onClick={() => patch(
                        u.id,
                        { role: u.role === 'admin' ? 'editor' : 'admin' },
                        u.role === 'admin' ? `${u.email} ahora es editor` : `${u.email} ahora es admin`,
                      )}
                      title={u.role === 'admin' ? 'Pasar a editor' : 'Pasar a administrador'}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span className="hidden lg:inline">{u.role === 'admin' ? 'Hacer editor' : 'Hacer admin'}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === u.id}
                      onClick={() => patch(
                        u.id,
                        { active: !u.active },
                        u.active ? `${u.email} desactivado` : `${u.email} reactivado`,
                      )}
                      title={u.active ? 'Desactivar (no podrá entrar)' : 'Reactivar'}
                      className={u.active ? 'text-brand hover:text-brand' : ''}
                    >
                      <UserRoundX className="h-3.5 w-3.5" />
                      <span className="hidden lg:inline">{u.active ? 'Desactivar' : 'Reactivar'}</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-label leading-relaxed text-muted">
          Las contraseñas se generan automáticamente y se muestran una sola vez — copialas y
          entregalas por un canal privado. Cada acción del panel queda registrada con el correo
          de quien la hizo.
        </p>
      </div>
    </div>
  );
}

function CreateForm({ onDone }: Readonly<{ onDone: (creds: FreshCreds | null) => void }>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'admin'>('editor');
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      toast.success(`Usuario ${json.user.email} creado`);
      onDone({ email: json.user.email, password: json.password });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear');
      setPending(false);
    }
  };

  return (
    <div className="mb-5 rounded-lg border border-divider bg-surface p-5 shadow-card">
      <h2 className="mb-4 text-meta font-semibold uppercase tracking-wider text-muted">Nuevo usuario</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Nombre y apellido" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
        <Input placeholder="correo@paginauno.do" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1.5">
          {(['editor', 'admin'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              disabled={pending}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-meta font-medium transition-colors',
                role === r ? 'bg-ink text-paper' : 'bg-subtle text-muted hover:text-ink'
              )}
            >
              {r === 'editor' ? 'Editor' : 'Administrador'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onDone(null)} disabled={pending}>Cancelar</Button>
          <Button onClick={submit} disabled={pending || !name.trim() || !email.trim()}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Crear usuario
          </Button>
        </div>
      </div>
    </div>
  );
}

function CredsReveal({ creds, onDismiss }: Readonly<{ creds: FreshCreds; onDismiss: () => void }>) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(`Usuario: ${creds.email}\nContraseña: ${creds.password}`);
    setCopied(true);
    toast.success('Credenciales copiadas');
  };

  return (
    <div className="mb-5 rounded-lg border border-schedule/30 bg-schedule-soft p-5">
      <p className="text-meta font-semibold text-ink">
        Credenciales de <span className="font-mono">{creds.email}</span> — se muestran una sola vez
      </p>
      <div className="mt-3 flex items-center gap-3">
        <code className="rounded-md border border-divider bg-surface px-3 py-2 font-mono text-body text-ink">
          {creds.password}
        </code>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5 text-approve" /> : <Copy className="h-3.5 w-3.5" />}
          Copiar credenciales
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>Listo, las guardé</Button>
      </div>
    </div>
  );
}
